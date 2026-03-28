import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-region, x-supabase-auth, x-supabase-client-platform, x-supabase-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const VALID_PLANS = ['pro', 'ultra'];

// Parse "userId|planId" reference created by create-checkout
function parseExternalRef(ref: string): { userId: string; planId: string } {
  const parts = ref?.split('|');
  if (parts?.length === 2 && VALID_PLANS.includes(parts[1])) {
    return { userId: parts[0], planId: parts[1] };
  }
  // Legacy: ref was just userId, default to pro
  return { userId: ref, planId: 'pro' };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json();
    console.log("Webhook Received:", JSON.stringify(body).slice(0, 500));

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    let userId: string | null = null;
    let planId: string = 'pro';
    let provider: string | null = null;

    // 1. PAYPAL WEBHOOK
    if (body.event_type === 'CHECKOUT.ORDER.APPROVED' || body.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
      provider = 'paypal';
      const resource = body.resource;
      const rawRef = resource.custom_id || resource.purchase_units?.[0]?.custom_id;
      if (rawRef) {
        const parsed = parseExternalRef(rawRef);
        userId = parsed.userId;
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
        const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
          headers: { 'Authorization': `Bearer ${mpAccessToken}` }
        });
        const paymentData = await paymentResponse.json();

        if (paymentData.status === 'approved') {
          const rawRef = paymentData.external_reference;
          const parsed = parseExternalRef(rawRef);
          userId = parsed.userId;
          planId = parsed.planId;
          console.log(`Mercado Pago Approved — userId=${userId} plan=${planId}`);
        }
      }
    }

    // 3. UPDATE USER PROFILE — status_pagamento + plan + subscription_end_date
    if (userId) {
      const newExpiryDate = new Date();
      newExpiryDate.setMonth(newExpiryDate.getMonth() + 1);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          plan: planId,
          status_pagamento: true,
          subscription_end_date: newExpiryDate.toISOString()
        })
        .eq('id', userId);

      if (updateError) throw updateError;
      console.log(`Access liberated — user=${userId} plan=${planId} via ${provider} until ${newExpiryDate.toISOString()}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("Webhook Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
