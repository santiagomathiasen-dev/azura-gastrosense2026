// @ts-nocheck
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
    const { integration_id } = await req.json();
    if (!integration_id) throw new Error("ID da integração não fornecido");

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Get integration details
    const { data: integration, error: intError } = await supabase
      .from('pos_integrations')
      .select('*')
      .eq('id', integration_id)
      .single();
    
    if (intError || !integration) throw new Error("Integração não encontrada");
    const userId = integration.user_id;
    const loyverseToken = integration.credentials?.access_token;
    if (!loyverseToken) throw new Error("Token do Loyverse não encontrado na integração");

    const loyHeaders = { 
      'Authorization': `Bearer ${loyverseToken}`, 
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    };

    // --- PUSH LOGIC (Azura -> Loyverse) ---
    // 2. Fetch products to sync from Azura
    const { data: azuraProducts } = await supabase
      .from('sale_products')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true);

    const pushResults = { created: 0, updated: 0, errors: [] };

    if (azuraProducts && azuraProducts.length > 0) {
      // 3. Fetch existing items from Loyverse for mapping
      const itemsRes = await fetch('https://api.loyverse.com/v1.0/items?limit=250', { headers: loyHeaders });
      const { items: loyItems = [] } = await itemsRes.json();
      const loyItemMap = new Map(loyItems.map(item => [item.item_name.toLowerCase().trim(), item]));

      for (const prod of azuraProducts) {
        const existingItem = loyItemMap.get(prod.name.toLowerCase().trim());
        const itemPayload = {
          item_name: prod.name,
          sku: prod.sku || `AZ-${prod.id.substring(0,8)}`,
          price: prod.sale_price || 0,
          description: prod.description || '',
        };

        try {
          if (existingItem) {
            // Update
            const upRes = await fetch(`https://api.loyverse.com/v1.0/items/${existingItem.id}`, {
              method: 'PATCH',
              headers: loyHeaders,
              body: JSON.stringify(itemPayload)
            });
            if (upRes.ok) pushResults.updated++;
            else pushResults.errors.push(`Erro ao atualizar ${prod.name}: ${upRes.statusText}`);
          } else {
            // Create
            const crRes = await fetch('https://api.loyverse.com/v1.0/items', {
              method: 'POST',
              headers: loyHeaders,
              body: JSON.stringify(itemPayload)
            });
            if (crRes.ok) pushResults.created++;
            else pushResults.errors.push(`Erro ao criar ${prod.name}: ${crRes.statusText}`);
          }
        } catch (e) {
          pushResults.errors.push(`${prod.name}: ${e.message}`);
        }
      }
    }

    // --- PULL LOGIC (Loyverse -> Azura) ---
    // 4. Fetch recent receipts (last 24h or since last sync)
    const pullSince = integration.last_sync_at || new Date(Date.now() - 86400000).toISOString();
    const receiptsRes = await fetch(`https://api.loyverse.com/v1.0/receipts?updated_at_min=${pullSince}&limit=50`, {
        headers: loyHeaders
    });
    const { receipts = [] } = await receiptsRes.json();

    // 5. Build product map for sale processing
    const { data: allSalesProds } = await supabase.from('sale_products').select('id, name').eq('user_id', userId).eq('is_active', true);
    const saleProdMap = new Map(allSalesProds?.map(p => [p.name.toLowerCase().trim(), p.id]));

    let pulledCount = 0;
    for (const receipt of receipts) {
        if (receipt.receipt_type !== 'SALE') continue;

        const soldItems = receipt.line_items?.map(item => {
            const azuraId = saleProdMap.get((item.item_name || "").toLowerCase().trim());
            return azuraId ? { product_id: azuraId, quantity: item.quantity || 1 } : null;
        }).filter(Boolean);

        if (soldItems && soldItems.length > 0) {
            const { error: rpcErr } = await supabase.rpc('process_pos_sale', {
                p_user_id: userId,
                p_sale_payload: {
                    date_time: receipt.created_at,
                    payment_method: receipt.payment_type || 'Loyverse',
                    sold_items: soldItems
                }
            });
            if (!rpcErr) pulledCount++;
        }
    }

    // 6. Update last sync timestamp
    await supabase.from('pos_integrations').update({ last_sync_at: new Date().toISOString() }).eq('id', integration_id);

    return new Response(JSON.stringify({ 
      success: true, 
      message: `Sincronização completa: ${pushResults.created} criados, ${pushResults.updated} atualizados em Loyverse. ${pulledCount} vendas processadas no Azura.`,
      details: { push: pushResults, pulled: pulledCount }
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400 
    });
  }
})
