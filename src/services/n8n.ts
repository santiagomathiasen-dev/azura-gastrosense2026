const N8N_WEBHOOK_URL =
  process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL ||
  'https://webhook.teste-azura.duckdns.org/webhook/aa5447df-0558-4d70-9287-554917e30782';

export interface N8NPayload {
  event: string;
  [key: string]: unknown;
}

export async function sendToN8N(payload: N8NPayload): Promise<void> {
  try {
    const res = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error('[n8n] webhook respondeu com status', res.status);
    }
  } catch (err) {
    console.error('[n8n] falha ao enviar evento:', err);
  }
}
