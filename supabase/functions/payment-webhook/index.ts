import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("topic") || url.searchParams.get("type"); // MercadoPago usually sends type or topic in URL
    
    // Parse the webhook payload
    const body = await req.json();
    console.log("Recebido Webhook do MP:", body);
    
    // Validar se é uma notificação de pagamento
    if (body.type === 'payment' || body.topic === 'payment' || body.action === 'payment.created' || body.action === 'payment.updated') {
        const paymentId = body.data?.id;
        
        if (!paymentId) return new Response('No payment ID found', { status: 400, headers: corsHeaders });

        const mpAccessToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');
        if (!mpAccessToken) throw new Error("Missing MP Token");

        // Obter detalhes do pagamento
        const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
            headers: { 'Authorization': `Bearer ${mpAccessToken}` }
        });
        
        const paymentData = await paymentResponse.json();
        
        // Verificar se pagamento foi aprovado
        if (paymentData.status === 'approved') {
            const externalReference = paymentData.external_reference; // Que nós definimos como o USER ID
            
            if (!externalReference) {
                console.error("Payment approved, but no external_reference (user id) found.");
                return new Response('No external reference', { status: 200, headers: corsHeaders });
            }

            console.log(`Payment approved for User ID: ${externalReference}. Updating database...`);

            // Conectar ao banco via Service Role para bypass no RLS e fazer a tabela de updates
            const supabaseUrl = Deno.env.get('SUPABASE_DB_URL') || Deno.env.get('SUPABASE_URL') || '';
            const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
            
            if (!supabaseUrl || !supabaseKey) {
                 throw new Error("Missing Supabase Env variables for Service Role");
            }
            
            const supabase = createClient(supabaseUrl, supabaseKey);
            
            // Adicionar 30 dias (ou 1 ano) ao vencimento atual a partir de hoje
            const newExpiryDate = new Date();
            newExpiryDate.setMonth(newExpiryDate.getMonth() + 1);

            const { error: updateError } = await supabase
                .from('profiles')
                .update({ 
                    status_pagamento: true,
                    subscription_end_date: newExpiryDate.toISOString()
                })
                .eq('id', externalReference);

            if (updateError) {
                console.error("Error updating profile:", updateError);
                throw new Error("Failed to update profile");
            }
            
            console.log("Profile successfully updated and access liberated!");
        }
    }

    // Sempre responda 200 pro MP saber que recebemos
    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error("Webhook Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
