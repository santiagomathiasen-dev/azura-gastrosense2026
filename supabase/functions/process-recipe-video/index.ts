declare const Deno: any;

// ── CORS absoluto ─────────────────────────────────────────────────────────────
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonOk = (data: unknown) =>
  new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const jsonError = (msg: string, status = 400) =>
  new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// ── Prompt de extração de vídeo ───────────────────────────────────────────────
const PROMPT = `Você é um Chef Assistente. A partir da URL ou descrição de vídeo fornecida, extraia a receita.
Retorne SOMENTE este JSON (nenhum texto fora do JSON):
{
  "name": "nome da receita",
  "preparation_method": "modo de preparo completo em português",
  "techniques": ["técnica1", "técnica2"],
  "estimated_time": 30,
  "ingredients": [
    { "nome": "ingrediente", "quantidade": 1.0, "unidade": "unidade" }
  ]
}`;

// ── Gemini com retry e fallback ────────────────────────────────────────────────
async function callGemini(apiKey: string, prompt: string): Promise<any> {
  const models = ["gemini-2.0-flash", "gemini-1.5-flash"];

  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);

      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
            }),
            signal: controller.signal,
          }
        );

        clearTimeout(timeout);

        if (res.ok) {
          const json = await res.json();
          console.log(`[process-recipe-video] OK model=${model}`);
          return json;
        }

        let errJson: any = {};
        try { errJson = await res.clone().json(); } catch (_) {}
        console.error(`ERRO REAL DO GEMINI [${model}] HTTP ${res.status}:`, JSON.stringify(errJson));

        if (res.status === 429 && attempt === 0) {
          const delay = errJson?.error?.details?.find((d: any) => d.retryDelay)?.retryDelay;
          const waitMs = Math.min(delay ? parseInt(delay) * 1000 : 8000, 8000);
          console.warn(`[429] aguardando ${waitMs}ms`);
          await new Promise((r) => setTimeout(r, waitMs));
          continue;
        }

        break; // outro erro → tenta próximo modelo
      } catch (e: any) {
        clearTimeout(timeout);
        if (e?.name === "AbortError") throw new Error("Timeout: Gemini não respondeu em 30s.");
        throw e;
      }
    }
  }

  throw new Error("Todos os modelos Gemini falharam. Tente novamente em 1 minuto.");
}

// ── Main ──────────────────────────────────────────────────────────────────────
Deno.serve(async (req: any) => {
  // Preflight
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) return jsonError("GEMINI_API_KEY não configurada.", 500);

    let body: any;
    try { body = await req.json(); } catch (_) { return jsonError("Body JSON inválido."); }

    const { videoUrl } = body ?? {};
    if (!videoUrl) return jsonError("Campo 'videoUrl' ausente.");

    const fullPrompt = `${PROMPT}\n\nURL/Descrição do vídeo: ${videoUrl}`;
    const aiData = await callGemini(GEMINI_API_KEY, fullPrompt);

    const rawText: string = aiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    if (!rawText) return jsonError("Gemini não retornou dados.", 500);

    let result: any;
    try {
      result = JSON.parse(rawText.trim());
    } catch (_) {
      const match = rawText.match(/\{[\s\S]*\}/);
      if (match) { try { result = JSON.parse(match[0]); } catch (_2) { return jsonError("Resposta do Gemini não é JSON válido.", 500); } }
      else return jsonError("Resposta do Gemini não é JSON válido.", 500);
    }

    // Sanitize estimated_time
    if (result.estimated_time !== undefined) {
      const n = parseInt(String(result.estimated_time).replace(/\D/g, ""));
      result.estimated_time = isNaN(n) ? null : n;
    }

    return jsonOk(result);

  } catch (error: any) {
    console.error("[process-recipe-video] CATCH:", error?.message ?? error);
    return new Response(
      JSON.stringify({ error: error?.message ?? "Erro interno.", details: error?.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
