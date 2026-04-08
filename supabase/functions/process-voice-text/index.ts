// @ts-ignore

declare const Deno: any;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ══════════════════════════════════════════════════════════════════
// GEMINI — chamada com retry automático + fallback de modelo
// ══════════════════════════════════════════════════════════════════
const GEMINI_MODELS: [string, string][] = [
  ["gemini-1.5-flash", "v1"],
  ["gemini-2.5-flash", "v1"],
  ["gemini-flash-latest", "v1"],
];

async function callGemini(apiKey: string, geminiBody: unknown): Promise<any> {
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
        return json;
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
        console.warn(`[Gemini 429] model=${model} aguardando ${waitMs}ms (tentativa ${attempt + 1})`);
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
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Erro de configuração: Chave da IA (GEMINI_API_KEY) não encontrada no servidor." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { text, systemPrompt } = await req.json();

    if (!text || !text.trim()) {
      return new Response(
        JSON.stringify({ error: "Texto vazio" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const geminiBody = {
      contents: [
        {
          parts: [
            { text: `Extração direta (JSON). Apenas palavras/dados. Sem conversa.\n\nInstrução: ${systemPrompt}\n\nTexto: ${text}` },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json",
      },
    };

    // ── Chamar Gemini ──────────────────────────────────────────────
    const aiData = await callGemini(GEMINI_API_KEY, geminiBody);

    const assistantMessage: string = aiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const finishReason: string = aiData?.candidates?.[0]?.finishReason ?? "UNKNOWN";

    if (!assistantMessage) {
      console.error(`[process-voice-text] Gemini candidates vazios. finishReason=${finishReason}`);
      return new Response(
        JSON.stringify({ error: `IA não retornou dados (finishReason: ${finishReason}).`, ingredients: [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract JSON array from the response with cleaning and recovery
    let ingredients: any[] = [];
    let recipeName: string | null = null;
    let preparationMethod: string | null = null;
    let preparationTime: number | null = null;
    let yieldQuantity: number | null = null;
    let labor_cost: number | null = null;
    let energy_cost: number | null = null;
    let other_costs: number | null = null;
    let markup: number | null = null;
    let praca: string | null = null;
    try {
      let cleanedMessage = assistantMessage.trim();
      if (cleanedMessage.startsWith("```")) {
        cleanedMessage = cleanedMessage.replace(/^```[a-z]*\n/i, "").replace(/\n```$/i, "").trim();
      }

      const parsed = JSON.parse(cleanedMessage);
      ingredients = Array.isArray(parsed) ? parsed : (parsed.ingredients || []);
      recipeName = parsed.recipeName || null;
      preparationMethod = parsed.preparationMethod || null;
    } catch (parseError) {
      console.error("Parse error, trying regex recovery:", parseError);
      try {
        const jsonMatch = assistantMessage.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          ingredients = Array.isArray(parsed) ? parsed : (parsed.ingredients || []);
          recipeName = parsed.recipeName || null;
          preparationMethod = parsed.preparationMethod || null;
          preparationTime = parsed.preparationTime || null;
          yieldQuantity = parsed.yieldQuantity || null;
          labor_cost = parsed.labor_cost || null;
          energy_cost = parsed.energy_cost || null;
          other_costs = parsed.other_costs || null;
          markup = parsed.markup || null;
          praca = parsed.praca || null;
        }
      } catch (e) {
        console.error("Regex recovery failed:", e);
      }
    }

    // Normalize and validate
    const validUnits = ["kg", "g", "L", "ml", "unidade", "caixa", "dz"];
    const validCategories = [
      "laticinios",
      "secos_e_graos",
      "hortifruti",
      "carnes_e_peixes",
      "embalagens",
      "limpeza",
      "outros",
    ];

    const normalizedIngredients = ingredients
      .map((ing: any) => {
        const name = String(ing.name || ing.nome || "").trim();
        if (!name) return null;

        let unitRaw = String(ing.unit || ing.unidade || "unidade").toLowerCase().trim();
        const categoryRaw = String(ing.category || ing.categoria || "outros").toLowerCase().trim();

        if (unitRaw === "l") unitRaw = "L";

        return {
          name,
          quantity: Number(ing.quantity ?? ing.quantidade) || 1,
          unit: validUnits.includes(unitRaw) ? unitRaw : "unidade",
          category: validCategories.includes(categoryRaw) ? categoryRaw : "outros",
          price: ing.price ?? ing.preco ?? null,
          supplier: ing.supplier ?? ing.fornecedor ?? null,
          expiration_date: ing.expiration_date || ing.validade || null,
        };
      })
      .filter(Boolean);

    return new Response(
      JSON.stringify({
        ingredients: normalizedIngredients,
        recipeName: recipeName,
        preparationMethod: preparationMethod,
        preparationTime,
        yieldQuantity,
        labor_cost,
        energy_cost,
        other_costs,
        markup,
        praca
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("process-voice-text error:", error);
    return new Response(
      JSON.stringify({
        error: "Erro no processamento de voz. Verifique se a chave da API (GEMINI_API_KEY) está configurada corretamente.",
        details: error instanceof Error ? error.message : String(error)
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
