import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-region, x-supabase-auth, x-supabase-client-platform, x-supabase-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json();
    console.log("Webhook Received:", body);

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    let userId = null;
    let provider = null;

    // 1. PAYPAL WEBHOOK
    if (body.event_type === 'CHECKOUT.ORDER.APPROVED' || body.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
      provider = 'paypal';
      const resource = body.resource;
      // PayPal context: custom_id was set to userId during order creation
      userId = resource.custom_id || (resource.purchase_units && resource.purchase_units[0]?.custom_id);
      
      console.log(`PayPal Payment Approved for User: ${userId}`);
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
          userId = paymentData.external_reference;
          console.log(`Mercado Pago Payment Approved for User: ${userId}`);
        }
      }
    }

    // 3. UPDATE USER PROFILE
    if (userId) {
      const newExpiryDate = new Date();
      newExpiryDate.setMonth(newExpiryDate.getMonth() + 1);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          status_pagamento: true,
          subscription_end_date: newExpiryDate.toISOString()
        })
        .eq('id', userId);

      if (updateError) throw updateError;
      console.log(`Access liberated for user ${userId} via ${provider}`);
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
