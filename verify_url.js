
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load Env
let env = {};
try {
    const envPath = path.resolve(process.cwd(), '.env');
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
        const parts = line.split('=');
        if (parts.length >= 2) {
            const key = parts[0].trim();
            const value = parts.slice(1).join('=').trim().replace(/^"|"$/g, '');
            env[key] = value;
        }
    });
} catch (e) {
    console.log("Could not read .env");
}

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const webhookUrl = `${supabaseUrl}/functions/v1/loyverse-webhook`;

console.log(`Testing Webhook URL: ${webhookUrl}`);

async function testWebhook() {
    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                test: 'self_check',
                message: 'Hello from verification script',
                receipts: [] // Empty receipts to avoid processing logic but trigger logging
            })
        });

        console.log(`Status: ${response.status}`);
        const text = await response.text();
        console.log(`Response: ${text}`);

        if (response.ok || response.status === 400 || response.status === 200) {
            console.log("✅ Webhook is REACHABLE.");
        } else {
            console.log("❌ Webhook returned error status.");
        }

    } catch (error) {
        console.error("❌ Failed to reach webhook:", error.message);
    }
}

testWebhook();
