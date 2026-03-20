// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const Deno: any;

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type, x-loyverse-signature, x-supabase-client-platform",
};

Deno.serve(async (req: any) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
        // 1. Read body
        const rawBody = await req.text();
        const method = req.method;
        const headers: Record<string, string> = {};
        req.headers.forEach((value, key) => {
            headers[key] = value;
        });

        let payload: any = {};
        try {
            payload = JSON.parse(rawBody);
        } catch (_e) {
            payload = { raw: rawBody, error: "Invalid JSON" };
        }

        // Log received webhook
        await supabase.from("webhook_logs").insert({
            payload: { method, headers, body: payload },
            status: "received",
            error_message: null,
        });

        if (!rawBody) {
            return new Response("Empty body", { status: 400, headers: corsHeaders });
        }

        // 2. Extract receipt from payload
        // Loyverse sends { receipts: [...] } or a single receipt object
        const receipt = payload.receipts ? payload.receipts[0] : payload;

        if (!receipt || !receipt.line_items) {
            await supabase.from("webhook_logs").insert({
                payload: payload,
                status: "ignored",
                error_message: "No line_items found in payload",
            });
            return new Response(
                JSON.stringify({ message: "Ignored event - no line_items" }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // 3. Find the gestor user (owner of the system)
        const { data: gestor, error: gestorErr } = await supabase
            .from("profiles")
            .select("id")
            .eq("role", "gestor")
            .limit(1)
            .single();

        if (gestorErr || !gestor?.id) {
            const errMsg = `No gestor found: ${gestorErr?.message || "empty result"}`;
            await supabase.from("webhook_logs").insert({
                payload, status: "error", error_message: errMsg,
            });
            throw new Error(errMsg);
        }

        const userId = gestor.id;

        // 4. Get all sale products for this user
        const { data: allProducts, error: prodErr } = await supabase
            .from("sale_products")
            .select("id, name, is_active, user_id")
            .eq("user_id", userId);

        if (prodErr) {
            throw new Error(`Failed to fetch sale_products: ${prodErr.message}`);
        }

        // Build a map: lowercase trimmed name -> product id
        const productMap = new Map<string, string>();
        allProducts?.forEach((p: any) => {
            if (p.is_active !== false) {
                productMap.set(p.name.toLowerCase().trim(), p.id);
            }
        });

        // 5. Match line items to products
        const soldItems: { product_id: string; quantity: number }[] = [];
        const unmatchedItems: string[] = [];

        for (const item of receipt.line_items) {
            const itemName = (item.item_name || "").toLowerCase().trim();
            const azuraProductId = productMap.get(itemName);

            if (azuraProductId) {
                soldItems.push({
                    product_id: azuraProductId,
                    quantity: item.quantity || 1,
                });
            } else {
                unmatchedItems.push(item.item_name || "unknown");
            }
        }

        if (soldItems.length === 0) {
            const errMsg = `No matching products. Tried: ${unmatchedItems.join(", ")}. Available: ${Array.from(productMap.keys()).join(", ")}`;
            await supabase.from("webhook_logs").insert({
                payload, status: "error", error_message: errMsg,
            });
            return new Response(
                JSON.stringify({ message: "No matching products found", details: errMsg }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // 6. Build sale payload and call RPC
        const saleDate = receipt.created_at
            ? new Date(receipt.created_at).toISOString()
            : new Date().toISOString();

        const salePayload = {
            date_time: saleDate,
            payment_method: receipt.payment_type || "Loyverse",
            total_amount: receipt.total_money || 0,
            sold_items: soldItems,
        };

        const { data: result, error: rpcError } = await supabase.rpc(
            "process_pos_sale",
            {
                p_user_id: userId,
                p_sale_payload: salePayload,
            }
        );

        if (rpcError) {
            const errMsg = `RPC error: ${rpcError.message}`;
            await supabase.from("webhook_logs").insert({
                payload: { salePayload, rpcError },
                status: "error",
                error_message: errMsg,
            });
            throw new Error(errMsg);
        }

        // 7. Log success with details
        await supabase.from("webhook_logs").insert({
            payload: {
                result,
                matched: soldItems.length,
                unmatched: unmatchedItems,
                sale_payload: salePayload,
            },
            status: "success",
            error_message: unmatchedItems.length > 0
                ? `Unmatched items: ${unmatchedItems.join(", ")}`
                : null,
        });

        return new Response(JSON.stringify({
            success: true,
            matched: soldItems.length,
            unmatched: unmatchedItems,
            result,
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (error) {
        console.error("Webhook Error:", error);

        try {
            await supabase.from("webhook_logs").insert({
                payload: { error_stack: error.stack },
                status: "error",
                error_message: error.message,
            });
        } catch (logErr) {
            console.error("Failed to log error:", logErr);
        }

        return new Response(
            JSON.stringify({ error: error.message }),
            {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
        );
    }
});
