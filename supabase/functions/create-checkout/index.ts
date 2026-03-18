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
    const { userId, planId, userEmail } = await req.json()

    if (!userId) {
      throw new Error('User ID is required');
    }

    const mpAccessToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');
    if (!mpAccessToken) {
        console.error("Missing MERCADOPAGO_ACCESS_TOKEN env variable");
        throw new Error("Serviço de pagamentos não configurado");
    }

    // Origin for returning the user after payment
    const originUrl = req.headers.get('origin') || 'https://azura-gastrosense.vercel.app';

    const preference = {
      items: [
        {
          title: planId === 'pro' ? 'Assinatura Azura Pro' : 'Assinatura Azura Básica',
          description: 'Acesso completo ao sistema Azura GastroSense',
          quantity: 1,
          currency_id: 'BRL',
          unit_price: planId === 'pro' ? 49.90 : 29.90
        }
      ],
      payer: {
        email: userEmail || ''
      },
      external_reference: userId, // CRUCIAL: this is how the webhook knows which user paid
      back_urls: {
        success: `${originUrl}/dashboard`,
        pending: `${originUrl}/payment-required`,
        failure: `${originUrl}/payment-required`
      },
      auto_return: 'approved',
    };

    const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mpAccessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(preference)
    });

    const data = await response.json();
    
    if (!response.ok) {
        console.error("Mercado Pago Error:", data);
        throw new Error(data.message || 'Erro ao criar checkout no banco');
    }

    return new Response(
      JSON.stringify({ checkoutUrl: data.init_point, preferenceId: data.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
