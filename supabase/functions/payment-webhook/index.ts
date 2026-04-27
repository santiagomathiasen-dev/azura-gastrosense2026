import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"
import {
  EdgeErrorCodes,
  denoSuccessResponse,
  denoErrorResponse,
  handleOptions,
  parseJsonBodyDeno,
  getEdgeErrorResponse,
} from '../_shared/api-errors-deno.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-region, x-supabase-auth, x-supabase-client-platform, x-supabase-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const VALID_PLANS = ['pro', 'ultra'];

// Parse "userId|planId" reference created by create-checkout
function parseExternalRef(ref: string): { userId: string; planId: string } {
  const parts = ref?.split('|');
  if (parts?.length === 2 && VALID_PLANS.includes(parts[1])) {
    return { userId: parts[0], planId: parts[1] };
  }
  // Legacy: ref was just userId, default to pro
  return { userId: ref || '', planId: 'pro' };
}

Deno.serve(async (req) => {
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
      // For webhooks, we still return 200 even with empty body
      // because payment providers expect a response
      console.warn('Webhook body validation failed:', parseError);
      return denoSuccessResponse({ received: false, reason: parseError.error }, 200);
    }

    const body = bodyData;
    console.log('Webhook Received:', JSON.stringify(body).slice(0, 500));

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    if (!supabaseUrl || !supabaseKey) {
      console.error('Supabase configuration missing');
      return denoSuccessResponse({ received: false, reason: 'Configuration error' }, 200);
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    let userId: string | null = null;
    let planId: string = 'pro';
    let provider: string | null = null;

    // 1. PAYPAL WEBHOOK
    if (body.event_type === 'CHECKOUT.ORDER.APPROVED' || body.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
      provider = 'paypal';
      const resource = body.resource;
      const rawRef = resource?.custom_id || resource?.purchase_units?.[0]?.custom_id;
      if (rawRef) {
        const parsed = parseExternalRef(rawRef);
        userId = parsed.userId || null;
        planId = parsed.planId;
      }
      console.log(`PayPal Payment Approved — userId=${userId} plan=${planId}`);
    }

    // 2. MERCADO PAGO WEBHOOK (PIX or Preference)
    else if (body.type === 'payment' || body.action?.startsWith('payment.')) {
      provider = 'mercadopago';
      const paymentId = body.data?.id || body.id;
      const mpAccessToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');

      if (paymentId && mpAccessToken) {
        try {
          const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
            headers: { 'Authorization': `Bearer ${mpAccessToken}` },
          });

          if (!paymentResponse.ok) {
            console.warn(`Mercado Pago API error: ${paymentResponse.status}`);
            return denoSuccessResponse({ received: true }, 200);
          }

          const paymentData = await paymentResponse.json();

          if (paymentData.status === 'approved') {
            const rawRef = paymentData.external_reference;
            const parsed = parseExternalRef(rawRef);
            userId = parsed.userId || null;
            planId = parsed.planId;
            console.log(`Mercado Pago Approved — userId=${userId} plan=${planId}`);
          }
        } catch (mpErr) {
          console.error('Mercado Pago fetch error:', mpErr);
          // Continue without failing - webhook still returns success
        }
      }
    }

    // 3. UPDATE USER PROFILE — status_pagamento + plan + subscription_end_date
    if (userId) {
      try {
        const newExpiryDate = new Date();
        newExpiryDate.setMonth(newExpiryDate.getMonth() + 1);

        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            subscription_plan: planId,
            status: 'ativo',
            status_pagamento: true,
            subscription_end_date: newExpiryDate.toISOString(),
          })
          .eq('id', userId);

        if (updateError) {
          console.error('Database update error:', updateError);
          // Still return success for webhook, but log the error
        } else {
          console.log(`Access liberated — user=${userId} plan=${planId} via ${provider} until ${newExpiryDate.toISOString()}`);
        }
      } catch (dbErr) {
        console.error('Database operation error:', dbErr);
        // Continue - webhook must always return success
      }
    }

    // Always return 200 for webhooks, even if nothing was processed
    return denoSuccessResponse({ received: true }, 200);

  } catch (error: any) {
    console.error('Webhook Error:', error);
    // Always return 200 for webhooks to prevent retries
    return denoSuccessResponse(
      { received: false, reason: error?.message || 'Unknown error' },
      200
    );
  }
});
