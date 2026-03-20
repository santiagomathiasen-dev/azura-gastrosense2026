// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const Deno: any;

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type, x-api-key, x-supabase-client-platform",
};

Deno.serve(async (req: any) => {
    // Handle CORS preflight requests
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
        const supabase = createClient(supabaseUrl, supabaseKey);

        // 1. Validate API Key
        const apiKey = req.headers.get("x-api-key");
        if (!apiKey) {
            return new Response(
                JSON.stringify({ error: "Missing x-api-key header" }),
                { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const { data: keyData, error: keyError } = await supabase
            .from("api_keys")
            .select("user_id")
            .eq("key_value", apiKey)
            .eq("is_active", true)
            .single();

        if (keyError || !keyData) {
            return new Response(
                JSON.stringify({ error: "Invalid or inactive API Key" }),
                { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const userId = keyData.user_id;

        // 2. Handle Routes
        const url = new window.URL(req.url); // Use window.URL for Deno compatibility if needed, or just URL
        const path = url.pathname.split("/").pop(); // Simple routing: /pos-integration/sales -> sales

        // The user requested: /api/v1/sales and /api/v1/products
        // In Supabase functions, the path is typically /pos-integration
        // So we can check the method or query params, or just assume the whole body decides action or use simple path logic if we can control the invocation url completely.
        // However, usually invocation is POST methods/pos-integration.
        // Let's look at the implementation plan: "POST /sales" and "GET /products".
        // We can simulate this by checking req.method and maybe query params or just a 'type' in body if it was all POST, BUT
        // RESTful design is requested.
        // Supabase functions are invoked via POST usually if using client library, but via raw HTTP they support GET/POST etc.
        // URL pattern: https://<project>.supabase.co/functions/v1/pos-integration

        if (req.method === "GET") {
            // GET /products
            // Fetch active products
            const { data: products, error: prodError } = await supabase
                .from("sale_products")
                .select("id, name, sale_price, description, image_url")
                .eq("is_active", true);

            if (prodError) throw prodError;

            // Transform to match requested format (category is missing, hardcode 'Geral')
            const formattedProducts = products.map((p) => ({
                id: p.id,
                name: p.name,
                price: p.sale_price || 0,
                category: "Geral", // Placeholder
                description: p.description,
                image_url: p.image_url,
            }));

            return new Response(JSON.stringify(formattedProducts), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        } else if (req.method === "POST") {
            // POST /sales
            const body = await req.json();

            // Basic validation
            if (!body.sold_items || !Array.isArray(body.sold_items)) {
                return new Response(
                    JSON.stringify({ error: "Invalid body: 'sold_items' array is required" }),
                    { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }

            // Call the validatd transaction function
            const { data: result, error: rpcError } = await supabase.rpc("process_pos_sale", {
                p_user_id: userId,
                p_sale_payload: body,
            });

            if (rpcError) {
                console.error("Error processing sale:", rpcError);
                return new Response(
                    JSON.stringify({ error: "Error processing sale", details: rpcError.message }),
                    { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }

            return new Response(JSON.stringify(result), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        return new Response(JSON.stringify({ error: "Method not allowed" }), {
            status: 405,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (error) {
        console.error("Internal Error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
