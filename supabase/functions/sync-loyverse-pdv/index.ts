// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const loyverseToken = Deno.env.get('LOYVERSE_ACCESS_TOKEN');
    if (!loyverseToken) throw new Error("LOYVERSE_ACCESS_TOKEN not configured");

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Get the gestor user (system owner)
    const { data: gestor } = await supabase.from('profiles').select('id').eq('role', 'gestor').single();
    if (!gestor) throw new Error("Gestor profile not found");
    const userId = gestor.id;

    // 2. Fetch receipts from Loyverse
    const response = await fetch('https://api.loyverse.com/v1.0/receipts?limit=50', {
        headers: { 'Authorization': `Bearer ${loyverseToken}`, 'Accept': 'application/json' }
    });
    if (!response.ok) throw new Error(`Loyverse API error: ${response.statusText}`);
    const { receipts = [] } = await response.json();

    // 3. Get all sale products for mapping
    const { data: allProducts } = await supabase.from('sale_products').select('id, name').eq('user_id', userId).eq('is_active', true);
    const productMap = new Map(allProducts?.map(p => [p.name.toLowerCase().trim(), p.id]));

    let syncedCount = 0;
    const errors = [];

    // 4. Process each receipt
    for (const receipt of receipts) {
        const soldItems = [];
        for (const item of receipt.line_items) {
            const azuraId = productMap.get((item.item_name || "").toLowerCase().trim());
            if (azuraId) {
                soldItems.push({ product_id: azuraId, quantity: item.quantity || 1 });
            }
        }

        if (soldItems.length > 0) {
            const { error: rpcErr } = await supabase.rpc('process_pos_sale', {
                p_user_id: userId,
                p_sale_payload: {
                    date_time: receipt.created_at,
                    payment_method: receipt.payment_type || 'Loyverse',
                    sold_items: soldItems
                }
            });
            if (!rpcErr) syncedCount++;
            else errors.push(`Receipt ${receipt.receipt_number}: ${rpcErr.message}`);
        }
    }

    return new Response(JSON.stringify({ 
        success: true, 
        message: `Sincronização concluída. ${syncedCount} recibos processados.`,
        errors: errors.length > 0 ? errors : null
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
    });
  }
})
