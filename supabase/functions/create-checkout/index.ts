// @ts-nocheck
import {
  EdgeErrorCodes,
  denoSuccessResponse,
  denoErrorResponse,
  handleOptions,
  parseJsonBodyDeno,
  validateRequiredFieldsDeno,
  getEdgeErrorResponse,
} from '../_shared/api-errors-deno.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-region, x-supabase-auth, x-supabase-client-platform, x-supabase-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const PLAN_CONFIG = {
  pro: { price: 197.00, title: 'Assinatura Azura Pro' },
  ultra: { price: 397.00, title: 'Assinatura Azura Ultra' },
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return handleOptions();
  }

  try {
    // Validate POST method
    if (req.method !== 'POST') {
      const err = getEdgeErrorResponse(EdgeErrorCodes.METHOD_NOT_ALLOWED, req.method);
      return denoErrorResponse(err, err.status);
    }

    // Parse and validate body
    const { data: bodyData, error: parseError } = await parseJsonBodyDeno(req);
    if (parseError) {
      return denoErrorResponse(parseError, parseError.status);
    }

    const { userId, planId, userEmail, paymentMethod } = bodyData;

    // Validate required fields
    const missingField = validateRequiredFieldsDeno(bodyData, ['userId', 'planId', 'paymentMethod']);
    if (missingField) {
      const err = getEdgeErrorResponse(EdgeErrorCodes.MISSING_FIELD, missingField);
      return denoErrorResponse(err, 400);
    }

    // Validate planId
    if (!PLAN_CONFIG[planId]) {
      const err = getEdgeErrorResponse(EdgeErrorCodes.INVALID_FIELD, `planId (permitidos: ${Object.keys(PLAN_CONFIG).join(', ')})`);
      return denoErrorResponse(err, 400);
    }

    // Validate paymentMethod
    const validMethods = ['pix', 'paypal', 'mercadopago'];
    if (!validMethods.includes(paymentMethod)) {
      const err = getEdgeErrorResponse(EdgeErrorCodes.INVALID_FIELD, `paymentMethod (permitidos: ${validMethods.join(', ')})`);
      return denoErrorResponse(err, 400);
    }

    const { price, title } = PLAN_CONFIG[planId];
    const originUrl = req.headers.get('origin') || 'https://azura-gastrosense.vercel.app';
    const externalRef = `${userId}|${planId}`;

    // 1. DYNAMIC PIX (via Mercado Pago)
    if (paymentMethod === 'pix') {
      const mpAccessToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');
      if (!mpAccessToken) {
        const err = getEdgeErrorResponse(EdgeErrorCodes.CONFIGURATION_ERROR, 'MERCADOPAGO_ACCESS_TOKEN');
        return denoErrorResponse(err, 502);
      }

      const pixResponse = await fetch('https://api.mercadopago.com/v1/payments', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${mpAccessToken}`,
          'Content-Type': 'application/json',
          'X-Idempotency-Key': `pix-${userId}-${planId}-${Date.now()}`,
        },
        body: JSON.stringify({
          transaction_amount: price,
          description: title,
          payment_method_id: 'pix',
          payer: { email: userEmail || 'comprador@email.com' },
          external_reference: externalRef,
          notification_url: `${new URL(req.url).origin}/payment-webhook`,
        }),
      });

      if (!pixResponse.ok) {
        const pixData = await pixResponse.json().catch(() => ({}));
        console.error('Mercado Pago PIX error:', pixData);
        const err = getEdgeErrorResponse(
          EdgeErrorCodes.EXTERNAL_API_ERROR,
          'Mercado Pago'
        );
        return denoErrorResponse(err, 502);
      }

      const pixData = await pixResponse.json();

      // Validate response structure
      if (!pixData?.point_of_interaction?.transaction_data?.qr_code) {
        console.error('Invalid PIX response structure:', pixData);
        const err = getEdgeErrorResponse(
          EdgeErrorCodes.EXTERNAL_API_ERROR,
          'Mercado Pago'
        );
        return denoErrorResponse(err, 502);
      }

      return denoSuccessResponse({
        qrCode: pixData.point_of_interaction.transaction_data.qr_code,
        qrCodeBase64: pixData.point_of_interaction.transaction_data.qr_code_base64,
        paymentId: pixData.id,
      });
    }

    // 2. PAYPAL (Balance or Cards)
    if (paymentMethod === 'paypal') {
      const clientId = Deno.env.get('PAYPAL_CLIENT_ID');
      const clientSecret = Deno.env.get('PAYPAL_CLIENT_SECRET');
      const mode = Deno.env.get('PAYPAL_MODE') || 'sandbox';

      if (!clientId || !clientSecret) {
        const err = getEdgeErrorResponse(EdgeErrorCodes.CONFIGURATION_ERROR, 'PayPal credentials');
        return denoErrorResponse(err, 502);
      }

      const authUrl = mode === 'live'
        ? 'https://api-m.paypal.com/v1/oauth2/token'
        : 'https://api-m.sandbox.paypal.com/v1/oauth2/token';

      const ordersUrl = mode === 'live'
        ? 'https://api-m.paypal.com/v2/checkout/orders'
        : 'https://api-m.sandbox.paypal.com/v2/checkout/orders';

      const authResponse = await fetch(authUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
      });

      if (!authResponse.ok) {
        console.error('PayPal auth failed:', authResponse.status);
        const err = getEdgeErrorResponse(EdgeErrorCodes.EXTERNAL_API_ERROR, 'PayPal Auth');
        return denoErrorResponse(err, 502);
      }

      const authData = await authResponse.json().catch(() => ({}));
      const accessToken = authData?.access_token;

      if (!accessToken) {
        console.error('No PayPal access token received');
        const err = getEdgeErrorResponse(EdgeErrorCodes.EXTERNAL_API_ERROR, 'PayPal');
        return denoErrorResponse(err, 502);
      }

      const orderResponse = await fetch(ordersUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          intent: 'CAPTURE',
          purchase_units: [
            {
              amount: { currency_code: 'BRL', value: price.toFixed(2) },
              description: title,
              custom_id: externalRef,
            },
          ],
          application_context: {
            return_url: `${originUrl}/payment-required`,
            cancel_url: `${originUrl}/payment-required`,
          },
        }),
      });

      if (!orderResponse.ok) {
        console.error('PayPal order creation failed:', orderResponse.status);
        const err = getEdgeErrorResponse(EdgeErrorCodes.EXTERNAL_API_ERROR, 'PayPal Order');
        return denoErrorResponse(err, 502);
      }

      const orderData = await orderResponse.json();
      const checkoutUrl = orderData?.links?.find(l => l.rel === 'approve')?.href;

      if (!checkoutUrl) {
        console.error('No PayPal checkout URL in response');
        const err = getEdgeErrorResponse(EdgeErrorCodes.EXTERNAL_API_ERROR, 'PayPal');
        return denoErrorResponse(err, 502);
      }

      return denoSuccessResponse({ checkoutUrl });
    }

    // 3. MERCADO PAGO PREFERENCE (Fallback)
    const mpAccessToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');
    if (!mpAccessToken) {
      const err = getEdgeErrorResponse(EdgeErrorCodes.CONFIGURATION_ERROR, 'MERCADOPAGO_ACCESS_TOKEN');
      return denoErrorResponse(err, 502);
    }

    const preference = {
      items: [{ title, quantity: 1, currency_id: 'BRL', unit_price: price }],
      payer: { email: userEmail || '' },
      external_reference: externalRef,
      back_urls: {
        success: `${originUrl}/dashboard`,
        failure: `${originUrl}/payment-required`,
      },
      auto_return: 'approved',
      notification_url: `${new URL(req.url).origin}/payment-webhook`,
    };

    const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mpAccessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(preference),
    });

    if (!response.ok) {
      console.error('Mercado Pago preference error:', response.status);
      const err = getEdgeErrorResponse(EdgeErrorCodes.EXTERNAL_API_ERROR, 'Mercado Pago');
      return denoErrorResponse(err, 502);
    }

    const data = await response.json();

    if (!data?.init_point) {
      console.error('No checkout URL in Mercado Pago response');
      const err = getEdgeErrorResponse(EdgeErrorCodes.EXTERNAL_API_ERROR, 'Mercado Pago');
      return denoErrorResponse(err, 502);
    }

    return denoSuccessResponse({ checkoutUrl: data.init_point });

  } catch (error: any) {
    console.error('Create checkout error:', error);
    return denoErrorResponse(
      {
        error: error?.message || 'Erro ao criar checkout',
        code: error?.code || 'INTERNAL_ERROR',
        status: error?.status || 500,
      },
      error?.status || 500
    );
  }
});
