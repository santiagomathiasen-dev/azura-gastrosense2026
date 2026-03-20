// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const Deno: any;

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform",
};

interface WhatsAppRequest {
    to: string; // The recipient's phone number
    message: string; // The text message content
    templateName?: string; // Optional: for template messages
    templateLanguage?: string; // Optional: default 'pt_BR'
    components?: any[]; // Optional: for template parameters
}

Deno.serve(async (req: any) => {
    // Handle CORS preflight requests
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        // 1. Verify Authentication
        const authHeader = req.headers.get("Authorization");
        if (!authHeader?.startsWith("Bearer ")) {
            return new Response(
                JSON.stringify({ error: "Missing or invalid authorization header" }),
                { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const supabaseClient = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_ANON_KEY") ?? "",
            { global: { headers: { Authorization: authHeader } } }
        );

        const { data: { user }, error: userError } = await supabaseClient.auth.getUser();

        if (userError || !user) {
            return new Response(
                JSON.stringify({ error: "Unauthorized" }),
                { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // 2. Get WhatsApp Credentials from Environment Variables
        const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
        const accessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN");

        if (!phoneNumberId || !accessToken) {
            console.error("Missing WhatsApp credentials");
            return new Response(
                JSON.stringify({ error: "WhatsApp service not configured (missing credentials)" }),
                { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // 3. Parse Request Body
        const { to, message, templateName, templateLanguage, components }: WhatsAppRequest = await req.json();

        if (!to) {
            return new Response(
                JSON.stringify({ error: "Recipient phone number is required" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Basic cleaning of phone number (remove non-digits)
        const cleanTo = to.replace(/\D/g, "");

        // 4. Construct WhatsApp API Payload
        let payload: any = {
            messaging_product: "whatsapp",
            to: cleanTo,
        };

        if (templateName) {
            // Template Message
            payload.type = "template";
            payload.template = {
                name: templateName,
                language: {
                    code: templateLanguage || "pt_BR",
                },
                components: components || [],
            };
        } else if (message) {
            // Free Text Message (Only works within 24h window or if user initiated)
            // Note: Initiating conversations requires Templates.
            payload.type = "text";
            payload.text = {
                body: message,
            };
        } else {
            return new Response(
                JSON.stringify({ error: "Message content or template name is required" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // 5. Send Request to Meta Graph API
        console.log(`Sending WhatsApp message to ${cleanTo}...`);

        const response = await fetch(
            `https://graph.facebook.com/v17.0/${phoneNumberId}/messages`,
            {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${accessToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            }
        );

        const data = await response.json();

        if (!response.ok) {
            console.error("WhatsApp API Error:", data);
            return new Response(
                JSON.stringify({ error: "Failed to send WhatsApp message", details: data }),
                { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // 6. Log success and return
        console.log("WhatsApp message sent successfully:", data);

        // Optionally log to database table 'supplier_messages' if that was the intent,
        // but the frontend might handle that record keeping.
        // For now, we just return the success.

        return new Response(
            JSON.stringify({ success: true, data }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error) {
        console.error("Internal Server Error:", error);
        return new Response(
            JSON.stringify({ error: "Internal Server Error", details: error instanceof Error ? error.message : String(error) }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
