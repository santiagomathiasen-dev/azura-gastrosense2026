// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  EdgeErrorCodes,
  denoSuccessResponse,
  denoErrorResponse,
  handleOptions,
  parseJsonBodyDeno,
  getEdgeErrorResponse,
} from '../_shared/api-errors-deno.ts';

declare const Deno: any;

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type, x-loyverse-signature, x-supabase-client-platform",
};

Deno.serve(async (req: any) => {
    if (req.method === "OPTIONS") {
        return handleOptions();
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !supabaseKey) {
        console.error('Supabase configuration missing');
        return denoSuccessResponse({ received: false, reason: 'Configuration error' }, 200);
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
        // Validate POST method
        if (req.method !== "POST") {
            const err = getEdgeErrorResponse(EdgeErrorCodes.METHOD_NOT_ALLOWED, req.method);
            return denoErrorResponse(err, err.status);
        }

        // 1. Read body
        const rawBody = await req.text();
        const method = req.method;
        const headers: Record<string, string> = {};
        req.headers.forEach((value, key) => {
            headers[key] = value;
        });

        // Validate body is not empty
        if (!rawBody || rawBody.trim() === "") {
            await supabase.from("webhook_logs").insert({
                payload: { method, headers, body: null },
                status: "ignored",
                error_message: "Empty request body",
            }).catch(e => console.error("Failed to log empty body:", e));

            return denoSuccessResponse({ received: false, reason: "Empty body" }, 200);
        }

        let payload: any = {};
        try {
            payload = JSON.parse(rawBody);
        } catch (parseErr) {
            console.error("JSON parse error:", parseErr);
            await supabase.from("webhook_logs").insert({
                payload: { raw: rawBody, error: "Invalid JSON", parseErr: parseErr.message },
                status: "error",
                error_message: "Invalid JSON in request body",
            }).catch(e => console.error("Failed to log parse error:", e));

            return denoSuccessResponse({ received: false, reason: "Invalid JSON" }, 200);
        }

        // Log received webhook
        await supabase.from("webhook_logs").insert({
            payload: { method, headers, body: payload },
            status: "received",
            error_message: null,
        }).catch(e => console.error("Failed to log received webhook:", e));

        // 2. Extract receipt from payload
        // Loyverse sends { receipts: [...] } or a single receipt object
        const receipt = payload.receipts ? payload.receipts[0] : payload;

        if (!receipt || !receipt.line_items || !Array.isArray(receipt.line_items)) {
            await supabase.from("webhook_logs").insert({
                payload: payload,
                status: "ignored",
                error_message: "No line_items found in payload",
            }).catch(e => console.error("Failed to log ignored event:", e));

            return denoSuccessResponse(
                { message: "Ignored event - no line_items" },
                200
            );
        }

        // 3. Find the tenant user — prefer owner role, fallback to gestor
        // Support multi-tenant: check for user_id in URL query params first
        const urlParams = new URL(req.url).searchParams;
        const tenantId = urlParams.get("user_id") || urlParams.get("tenant_id");

        let userId: string;

        if (tenantId) {
            // Multi-tenant: use provided user_id param (each tenant has their own webhook URL)
            userId = tenantId;
        } else {
            // Legacy single-tenant: find the primary owner/gestor
            const { data: ownerProfile, error: ownerErr } = await supabase
                .from("profiles")
                .select("id")
                .in("role", ["owner", "gestor"])
                .order("created_at", { ascending: true })
                .limit(1)
                .maybeSingle();

            if (ownerErr || !ownerProfile?.id) {
                const errMsg = `No owner/gestor found: ${ownerErr?.message || "empty result"}`;
                await supabase.from("webhook_logs").insert({
                    payload, status: "error", error_message: errMsg,
                }).catch(e => console.error("Failed to log owner error:", e));

                return denoSuccessResponse({ received: false, reason: errMsg }, 200);
            }
            userId = ownerProfile.id;
        }

        // 4. Get all sale products for this user
        const { data: allProducts, error: prodErr } = await supabase
            .from("sale_products")
            .select("id, name, is_active, user_id")
            .eq("user_id", userId);

        if (prodErr) {
            const errMsg = `Failed to fetch sale_products: ${prodErr.message}`;
            await supabase.from("webhook_logs").insert({
                payload: { error: prodErr },
                status: "error",
                error_message: errMsg,
            }).catch(e => console.error("Failed to log product fetch error:", e));

            return denoSuccessResponse({ received: false, reason: errMsg }, 200);
        }

        // Build a map: lowercase trimmed name -> product id
        const productMap = new Map<string, string>();
        (allProducts || []).forEach((p: any) => {
            if (p.is_active !== false && p.name) {
                productMap.set(p.name.toLowerCase().trim(), p.id);
            }
        });

        // 5. Match line items to products
        const soldItems: { product_id: string; quantity: number }[] = [];
        const unmatchedItems: string[] = [];

        for (const item of receipt.line_items) {
            const itemName = (item.item_name || "").toLowerCase().trim();
            if (!itemName) continue;

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
            }).catch(e => console.error("Failed to log no matches error:", e));

            return denoSuccessResponse(
                { message: "No matching products found", details: errMsg },
                200
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
            }).catch(e => console.error("Failed to log RPC error:", e));

            return denoSuccessResponse({ received: false, reason: errMsg }, 200);
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
        }).catch(e => console.error("Failed to log success:", e));

        return denoSuccessResponse({
            success: true,
            matched: soldItems.length,
            unmatched: unmatchedItems,
            result,
        }, 200);

    } catch (error: any) {
        console.error("Webhook Error:", error);

        try {
            await supabase.from("webhook_logs").insert({
                payload: { error_stack: error.stack },
                status: "error",
                error_message: error.message || "Unknown error",
            });
        } catch (logErr) {
            console.error("Failed to log error:", logErr);
        }

        // Always return 200 for webhooks
        return denoSuccessResponse(
            { received: false, reason: error?.message || "Unknown error" },
            200
        );
    }
});
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
        );
    }
});
