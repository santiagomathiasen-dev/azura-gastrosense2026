// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const Deno: any;

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform",
};

Deno.serve(async (req: any) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    const supabaseClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );
    // Using Service Role Key because webhook comes from Meta, not authenticated user.
    // BE CAREFUL with RLS.

    try {
        const url = new URL(req.url);

        // 1. Handle Webhook Verification (GET)
        if (req.method === "GET") {
            const mode = url.searchParams.get("hub.mode");
            const token = url.searchParams.get("hub.verify_token");
            const challenge = url.searchParams.get("hub.challenge");

            const verifyToken = Deno.env.get("WHATSAPP_VERIFY_TOKEN");

            if (mode && token) {
                if (mode === "subscribe" && token === verifyToken) {
                    console.log("WEBHOOK_VERIFIED");
                    return new Response(challenge, { status: 200 });
                } else {
                    return new Response("Forbidden", { status: 403 });
                }
            }
            return new Response("Bad Request", { status: 400 });
        }

        // 2. Handle Incoming Notifications (POST)
        if (req.method === "POST") {
            const body = await req.json();

            console.log("Received webhook:", JSON.stringify(body, null, 2));

            // Check if it's a WhatsApp status update
            if (body.object === "whatsapp_business_account") {
                for (const entry of body.entry) {
                    for (const change of entry.changes) {
                        const value = change.value;

                        // Handle Status Updates (sent, delivered, read)
                        if (value.statuses) {
                            for (const status of value.statuses) {
                                const messageId = status.id; // WhatsApp Message ID
                                const statusString = status.status; // sent, delivered, read, failed

                                // We entered the message into DB but we don't store the WhatsApp Message ID yet...
                                // Wait, in 'send-whatsapp', we got 'data' which contains 'messages' array with 'id'.
                                // If we want to track status, we should have updated the DB with the WA Message ID in 'send-whatsapp'.
                                // But for now, let's just log it. 
                                // To properly implement this, we need a column 'whatsapp_message_id' in 'supplier_messages'.

                                // Assuming we added that column (which we didn't yet), we would do:
                                /*
                                await supabaseClient
                                  .from('supplier_messages')
                                  .update({ 
                                    whatsapp_status: statusString,
                                    updated_at: new Date().toISOString() 
                                  })
                                  .eq('whatsapp_message_id', messageId);
                                */
                                console.log(`Status update for message ${messageId}: ${statusString}`);
                            }
                        }

                        // Handle Incoming Messages
                        if (value.messages) {
                            for (const message of value.messages) {
                                const from = message.from; // Phone number
                                const messageId = message.id;
                                const text = message.text?.body;

                                if (text) {
                                    console.log(`Received message from ${from}: ${text}`);
                                    // Here we could store incoming messages in a 'supplier_replies' table or similar.
                                }
                            }
                        }
                    }
                }
            }

            return new Response("OK", { status: 200 });
        }

        return new Response("Method Not Allowed", { status: 405 });

    } catch (error) {
        console.error("Webhook Error:", error);
        return new Response(
            JSON.stringify({ error: "Internal Server Error" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
