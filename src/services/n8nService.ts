const BASE_URL =
  process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL ||
  'https://webhook.teste-azura.duckdns.org/webhook/aa5447df-0558-4d70-9287-554917e30782';

export async function triggerN8NFlow(webhookPath: string, data: unknown): Promise<void> {
  const url = webhookPath ? `${BASE_URL}/${webhookPath.replace(/^\//, '')}` : BASE_URL;

  console.log(`[n8n] disparando evento → ${url}`, data);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      console.log('[n8n] ✓ evento recebido com sucesso', res.status);
    } else {
      console.error('[n8n] ✗ webhook respondeu com status', res.status);
    }
  } catch (err) {
    console.error('[n8n] ✗ falha de rede ao enviar evento:', err);
  }
}
