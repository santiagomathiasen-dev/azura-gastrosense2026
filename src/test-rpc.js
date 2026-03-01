import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');

const env = {};
envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
        let value = match[2].trim();
        if (value.startsWith('"') && value.endsWith('"')) {
            value = value.substring(1, value.length - 1);
        }
        env[match[1]] = value;
    }
});

const url = `${env.VITE_SUPABASE_URL}/rest/v1/rpc/get_owner_id`;

async function testRpc() {
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'apikey': env.VITE_SUPABASE_PUBLISHABLE_KEY,
                'Authorization': `Bearer ${env.VITE_SUPABASE_PUBLISHABLE_KEY}`, // Using anon key for this test
                'Content-Type': 'application/json'
            }
        });
        const text = await res.text();
        console.log("Status:", res.status);
        console.log("Raw Response:", text);
    } catch (err) {
        console.error(err);
    }
}

testRpc();
