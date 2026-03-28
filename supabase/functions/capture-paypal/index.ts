// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const VALID_PLANS = ['pro', 'ultra'];

function parseCustomId(customId: string): { userId: string; planId: string } {
  const parts = customId?.split('|');
  if (parts?.length === 2 && VALID_PLANS.includes(parts[1])) {
    return { userId: parts[0], planId: parts[1] };
  }
  return { userId: customId, planId: 'pro' };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { orderId, userId: reqUserId } = await req.json();
    if (!orderId) throw new Error('orderId is required');

    const clientId = Deno.env.get('PAYPAL_CLIENT_ID');
    const clientSecret = Deno.env.get('PAYPAL_CLIENT_SECRET');
    const mode = Deno.env.get('PAYPAL_MODE') || 'sandbox';

    if (!clientId || !clientSecret) throw new Error("PayPal não configurado");

    const baseUrl = mode === 'live'
      ? 'https://api-m.paypal.com'
      : 'https://api-m.sandbox.paypal.com';

    // 1. Get PayPal access token
    const authResp = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });
    const { access_token } = await authResp.json();
    if (!access_token) throw new Error("Falha ao autenticar com PayPal");

    // 2. Capture the order
    const captureResp = await fetch(`${baseUrl}/v2/checkout/orders/${orderId}/capture`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
    });
    const captureData = await captureResp.json();

    if (!captureResp.ok || captureData.status !== 'COMPLETED') {
      console.error("PayPal capture failed:", JSON.stringify(captureData));
      throw new Error(`Captura falhou: ${captureData.details?.[0]?.description || captureData.message || 'Erro desconhecido'}`);
    }

    // 3. Extract userId and planId from custom_id
    const customId = captureData.purchase_units?.[0]?.custom_id
      || captureData.purchase_units?.[0]?.payments?.captures?.[0]?.custom_id;
    const { userId, planId } = customId
      ? parseCustomId(customId)
      : { userId: reqUserId, planId: 'pro' };

    if (!userId) throw new Error("Não foi possível identificar o usuário");

    // 4. Update profile
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    const newExpiryDate = new Date();
    newExpiryDate.setMonth(newExpiryDate.getMonth() + 1);

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        plan: planId,
        status_pagamento: true,
        subscription_end_date: newExpiryDate.toISOString(),
      })
      .eq('id', userId);

    if (updateError) throw updateError;

    console.log(`PayPal captured — order=${orderId} user=${userId} plan=${planId}`);

    return new Response(JSON.stringify({ success: true, planId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("capture-paypal error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
