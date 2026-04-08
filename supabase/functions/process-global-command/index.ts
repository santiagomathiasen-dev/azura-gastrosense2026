declare const Deno: any;

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Always return 200 — supabase.functions.invoke puts non-2xx into opaque FunctionsHttpError
function jsonOk(data: unknown): Response {
    return new Response(JSON.stringify(data), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
}

const GEMINI_MODELS: [string, string][] = [
    ["gemini-1.5-flash", "v1"],
    ["gemini-2.5-flash", "v1"],
    ["gemini-flash-latest", "v1"],
];

async function callGemini(apiKey: string, geminiBody: unknown): Promise<string> {
    let lastErrorDetails = "";

    for (const [model, apiVersion] of GEMINI_MODELS) {
        for (let attempt = 0; attempt < 3; attempt++) {
            console.log(`[Gemini] Tentando model=${model} api=${apiVersion} attempt=${attempt}`);

            const res = await fetch(
                `https://generativelanguage.googleapis.com/${apiVersion}/models/${model}:generateContent?key=${apiKey}`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(geminiBody),
                }
            );

            if (res.ok) {
                const json = await res.json();
                console.log(`[Gemini OK] model=${model} attempt=${attempt}`);
                const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
                if (text) return text;
                continue;
            }

            let errBody: any = {};
            try { errBody = await res.clone().json(); } catch (_) {
                try { errBody = { raw: await res.text() }; } catch (_2) { }
            }
            const errMsg = errBody?.error?.message ?? JSON.stringify(errBody);
            lastErrorDetails = `[${model}/${apiVersion}] HTTP ${res.status}: ${errMsg}`;
            console.error("ERRO REAL DO GEMINI:", lastErrorDetails);

            if (res.status === 429) {
                let waitMs = (attempt + 1) * 15000;
                const delay = errBody?.error?.details?.find((d: any) => d.retryDelay)?.retryDelay;
                if (delay) waitMs = (parseInt(delay) + 3) * 1000;
                await new Promise((r) => setTimeout(r, waitMs));
                continue;
            }
            break;
        }
    }

    const finalErr: any = new Error("Todos os modelos Gemini falharam.");
    finalErr.details = lastErrorDetails;
    throw finalErr;
}

Deno.serve(async (req: any) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
        if (!GEMINI_API_KEY) {
            return jsonOk({ action: "toast", message: "IA não configurada no servidor (GEMINI_API_KEY ausente)." });
        }

        const { text, path, context } = await req.json();
        if (!text?.trim()) {
            return jsonOk({ action: "toast", message: "Nenhum comando recebido." });
        }

        const systemPrompt = `Assistente Azura (Gestão Gastronômica).
Página atual: ${path}
Contexto da tela: ${(context || "").substring(0, 1500)}

Determine a intenção do usuário e retorne JSON.
Ações disponíveis:
1. {"action": "navigate", "target": "/rota", "label": "Nome da página"}
2. {"action": "toast", "message": "Texto informativo"}
3. {"action": "info", "message": "Resposta direta à pergunta"}

Rotas válidas: /dashboard, /estoque, /fichas, /producao, /financeiro, /compras, /relatorios, /perdas, /previsao-vendas, /produtos-venda, /colaboradores.

Retorne SOMENTE JSON válido, sem texto fora do JSON.`;

        const geminiBody = {
            contents: [{ parts: [{ text: `${systemPrompt}\n\nComando do usuário: "${text}"` }] }],
            generationConfig: { temperature: 0.1, responseMimeType: "application/json" },
        };

        const rawText = await callGemini(GEMINI_API_KEY, geminiBody);

        // Parse and return
        let parsed: any;
        try {
            parsed = JSON.parse(rawText.trim());
        } catch (_) {
            const match = rawText.match(/\{[\s\S]*\}/);
            parsed = match ? JSON.parse(match[0]) : { action: "toast", message: rawText };
        }

        return jsonOk(parsed);

    } catch (error: any) {
        console.error("[GlobalAI] Erro:", error?.message ?? error);
        return jsonOk({ action: "toast", message: `Erro na IA: ${error?.message ?? "Erro interno."}` });
    }
});
