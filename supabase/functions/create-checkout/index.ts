// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { userId, planId, userEmail, paymentMethod } = await req.json()

    if (!userId) {
      throw new Error('User ID is required');
    }

    const price = planId === 'pro' ? 49.90 : 29.90;
    const title = planId === 'pro' ? 'Assinatura Azura Pro' : 'Assinatura Azura Básica';
    const originUrl = req.headers.get('origin') || 'https://azura-gastrosense.vercel.app';

    // 1. DYNAMIC PIX (via Mercado Pago)
    if (paymentMethod === 'pix') {
      const mpAccessToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');
      if (!mpAccessToken) throw new Error("Mercado Pago não configurado");

      const pixResponse = await fetch('https://api.mercadopago.com/v1/payments', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${mpAccessToken}`,
          'Content-Type': 'application/json',
          'X-Idempotency-Key': `pix-${userId}-${Date.now()}`
        },
        body: JSON.stringify({
          transaction_amount: price,
          description: title,
          payment_method_id: 'pix',
          payer: { email: userEmail || 'comprador@email.com' },
          external_reference: userId,
          notification_url: `${new URL(req.url).origin}/payment-webhook`
        })
      });

      const pixData = await pixResponse.json();
      if (!pixResponse.ok) throw new Error(pixData.message || "Erro ao gerar PIX");

      return new Response(
        JSON.stringify({ 
          qrCode: pixData.point_of_interaction.transaction_data.qr_code,
          qrCodeBase64: pixData.point_of_interaction.transaction_data.qr_code_base64,
          paymentId: pixData.id
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. PAYPAL (Balance or Cards)
    if (paymentMethod === 'paypal') {
      const clientId = Deno.env.get('PAYPAL_CLIENT_ID');
      const clientSecret = Deno.env.get('PAYPAL_CLIENT_SECRET');
      const mode = Deno.env.get('PAYPAL_MODE') || 'sandbox';
      
      if (!clientId || !clientSecret) throw new Error("PayPal não configurado");

      const authUrl = mode === 'live' 
        ? 'https://api-m.paypal.com/v1/oauth2/token' 
        : 'https://api-m.sandbox.paypal.com/v1/oauth2/token';
      
      const ordersUrl = mode === 'live' 
        ? 'https://api-m.paypal.com/v2/checkout/orders' 
        : 'https://api-m.sandbox.paypal.com/v2/checkout/orders';

      // Get Access Token
      const authResponse = await fetch(authUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'grant_type=client_credentials'
      });
      const authData = await authResponse.json();
      const accessToken = authData.access_token;

      // Create Order
      const orderResponse = await fetch(ordersUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          intent: 'CAPTURE',
          purchase_units: [{
            amount: { currency_code: 'BRL', value: price.toFixed(2) },
            description: title,
            custom_id: userId
          }],
          application_context: {
            return_url: `${originUrl}/dashboard`,
            cancel_url: `${originUrl}/payment-required`
          }
        })
      });

      const orderData = await orderResponse.json();
      const checkoutUrl = orderData.links.find(l => l.rel === 'approve')?.href;

      return new Response(
        JSON.stringify({ checkoutUrl }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. MERCADO PAGO PREFERENCE (Fallback / Standard)
    const mpAccessToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');
    const preference = {
      items: [{ title, quantity: 1, currency_id: 'BRL', unit_price: price }],
      payer: { email: userEmail || '' },
      external_reference: userId,
      back_urls: { success: `${originUrl}/dashboard`, failure: `${originUrl}/payment-required` },
      auto_return: 'approved',
      notification_url: `${new URL(req.url).origin}/payment-webhook`
    };

    const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${mpAccessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(preference)
    });

    const data = await response.json();
    return new Response(
      JSON.stringify({ checkoutUrl: data.init_point }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
