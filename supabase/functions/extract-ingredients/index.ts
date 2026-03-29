declare const Deno: any;

// ══════════════════════════════════════════════════════════════════
// 1. CORS ABSOLUTO — aplicado em TODAS as respostas sem exceção
// ══════════════════════════════════════════════════════════════════
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ══════════════════════════════════════════════════════════════════
// 2. HELPERS
// ══════════════════════════════════════════════════════════════════
function jsonOk(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// IMPORTANT: Always return 200 so supabase.functions.invoke puts the body in `data`
// not in `error`. Non-2xx responses become opaque FunctionsHttpError with no message.
function jsonError(message: string, _status = 200): Response {
  return new Response(JSON.stringify({ error: message, ingredients: [] }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ══════════════════════════════════════════════════════════════════
// 3. SCHEMA / PROMPTS
// ══════════════════════════════════════════════════════════════════
const PROMPT_INGREDIENT = `Você é um extrator de dados de notas fiscais e listas de compras.
Leia o documento e extraia TODOS os itens. Preserve pontuação, símbolos de moeda (R$), unidades reais e formatação original.
Categorias permitidas: laticinios, secos_e_graos, hortifruti, carnes_e_peixes, embalagens, limpeza, outros.

Retorne SOMENTE este JSON (nenhum texto fora do JSON):
{
  "fornecedor": "nome do fornecedor ou null",
  "numero_nota": "número da nota ou null",
  "data_emissao": "YYYY-MM-DD ou null",
  "valor_total": 0.00,
  "ingredients": [
    {
      "nome": "nome exato do produto",
      "codigo": "código ou null",
      "quantidade": 1.0,
      "unidade": "unidade exata do documento",
      "preco_unitario": 0.00,
      "preco_total": 0.00,
      "categoria": "categoria aqui"
    }
  ],
  "summary": "resumo em 1 frase"
}`;

const PROMPT_RECIPE = `Você é um extrator de fichas técnicas gastronômicas.
Leia o documento e extraia os dados da receita. Preserve nomes originais e unidades reais.

Retorne SOMENTE este JSON (nenhum texto fora do JSON):
{
  "recipeName": "nome da receita",
  "preparationMethod": "modo de preparo completo",
  "preparationTime": 0,
  "yieldQuantity": 0,
  "labor_cost": 0.00,
  "energy_cost": 0.00,
  "other_costs": 0.00,
  "markup": 0.00,
  "praca": "local ou null",
  "ingredients": [
    {
      "nome": "nome exato",
      "quantidade": 1.0,
      "unidade": "unidade exata",
      "preco_unitario": 0.00,
      "categoria": "categoria aqui"
    }
  ],
  "summary": "resumo em 1 frase"
}`;

// ══════════════════════════════════════════════════════════════════
// 4. GEMINI — chamada com retry automático + fallback de modelo
// ══════════════════════════════════════════════════════════════════
// Each entry: [modelName, apiVersion]
// gemini-2.0-flash and newer are stable → v1
// v1beta kept as fallback in case the key only has beta access
const GEMINI_MODELS: [string, string][] = [
  ["gemini-2.0-flash", "v1"],
  ["gemini-2.0-flash-lite", "v1"],
  ["gemini-2.0-flash", "v1beta"],
  ["gemini-1.5-flash-latest", "v1beta"],
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

      // ── Capturar e logar o erro REAL da API do Google ──────────
      let errBody: any = {};
      try { errBody = await res.clone().json(); } catch (_) {
        try { errBody = { raw: await res.text() }; } catch (_2) { }
      }
      const errMsg = errBody?.error?.message ?? JSON.stringify(errBody);
      lastErrorDetails = `[${model}/${apiVersion}] HTTP ${res.status}: ${errMsg}`;
      // ESTE log aparece no painel do Supabase → Functions → Logs
      console.error("ERRO REAL DO GEMINI:", lastErrorDetails);
      console.error("GEMINI PAYLOAD COMPLETO:", JSON.stringify(errBody));

      if (res.status === 429) {
        let waitMs = (attempt + 1) * 15000;
        const delay = errBody?.error?.details?.find((d: any) => d.retryDelay)?.retryDelay;
        if (delay) waitMs = (parseInt(delay) + 3) * 1000;
        console.warn(`[Gemini 429] model=${model} aguardando ${waitMs}ms (tentativa ${attempt + 1})`);
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }

      // 404 = modelo não encontrado nesta versão da API → tenta próxima entrada
      // Outros erros não-retryáveis → tenta próxima entrada também
      break;
    }
  }

  const finalErr: any = new Error("Todos os modelos Gemini falharam.");
  finalErr.details = lastErrorDetails;
  throw finalErr;
}

// ══════════════════════════════════════════════════════════════════
// 5. MAIN — padrão à prova de falhas
// ══════════════════════════════════════════════════════════════════
Deno.serve(async (req: any) => {

  // ── 2. Preflight CORS ──────────────────────────────────────────
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // ── 3. Try/Catch Global ────────────────────────────────────────
  try {

    // ── Validar variáveis de ambiente ──────────────────────────────
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      return jsonError("GEMINI_API_KEY não configurada no servidor.", 500);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    // ── Ler body ───────────────────────────────────────────────────
    let body: any;
    try {
      body = await req.json();
    } catch (_) {
      return jsonError("Body inválido: esperado JSON.");
    }

    const {
      content: bodyContent,
      fileType,
      extractRecipe = false,
      mimeType: customMimeType,
      userId,
      saveToDb = false,
      storagePath,       // NEW: path in 'invoices' bucket (avoids 1MB body limit)
    } = body ?? {};

    // ── Download from Storage if storagePath provided ──────────────
    // Supabase Edge Functions limit request body to ~1MB. PDFs sent as
    // base64 often exceed this (546 WORKER_LIMIT error). Uploading to
    // Storage first and passing the path bypasses the limit entirely.
    let content = bodyContent;
    let resolvedMimeType = customMimeType;

    if (storagePath) {
      if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
        return jsonError("Variáveis SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY não configuradas.");
      }
      // @ts-ignore
      const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
      const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      const { data: fileBlob, error: dlErr } = await sb.storage
        .from("invoices")
        .download(storagePath);

      if (dlErr || !fileBlob) {
        return jsonError(`Falha ao baixar arquivo do storage: ${dlErr?.message ?? "arquivo não encontrado"}`);
      }

      // Convert blob → base64
      const arrayBuffer = await fileBlob.arrayBuffer();
      const uint8 = new Uint8Array(arrayBuffer);
      let binary = "";
      for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i]);
      content = btoa(binary);
      resolvedMimeType = fileBlob.type || "application/pdf";

      // Delete temp file — fire-and-forget (don't block the response)
      sb.storage.from("invoices").remove([storagePath]).catch(() => {});
    }

    if (!content) {
      return jsonError("Campo 'content' ou 'storagePath' ausente no body.");
    }

    // ── Determinar MIME type ───────────────────────────────────────
    let mimeType = resolvedMimeType;
    if (!mimeType) {
      if (fileType === "pdf") mimeType = "application/pdf";
      else if (fileType === "image") mimeType = "image/jpeg";
      else mimeType = "text/plain";
    }
    const isBase64 = mimeType !== "text/plain";

    // ── Montar requisição Gemini ───────────────────────────────────
    // Instrução entra como primeiro part dentro de contents
    // (systemInstruction no nível raiz não funciona com inlineData)
    const prompt = extractRecipe ? PROMPT_RECIPE : PROMPT_INGREDIENT;
    const filePart = isBase64
      ? { inlineData: { mimeType, data: content } }
      : { text: content };

    const geminiBody = {
      contents: [
        {
          parts: [
            { text: prompt },
            filePart,
            { text: "Retorne apenas o JSON. Nenhum texto fora do JSON." },
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

    const rawText: string = aiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const finishReason: string = aiData?.candidates?.[0]?.finishReason ?? "UNKNOWN";

    console.log(`[Gemini] finishReason=${finishReason} rawText.length=${rawText.length}`);

    if (!rawText) {
      return jsonError(`Gemini não retornou dados (finishReason: ${finishReason}).`, 500);
    }

    // ── Parse JSON ─────────────────────────────────────────────────
    let parsed: any;
    try {
      parsed = JSON.parse(rawText.trim());
    } catch (_) {
      const match = rawText.match(/\{[\s\S]*\}/);
      if (match) {
        try { parsed = JSON.parse(match[0]); } catch (_2) {
          return jsonError("Resposta do Gemini não é JSON válido.", 500);
        }
      } else {
        return jsonError("Resposta do Gemini não é JSON válido.", 500);
      }
    }

    // ── Normalizar ingredientes ────────────────────────────────────
    const rawIngredients: any[] = Array.isArray(parsed.ingredients) ? parsed.ingredients
      : Array.isArray(parsed) ? parsed : [];

    const ingredients = rawIngredients
      .map((ing: any) => ({
        name: String(ing.nome ?? ing.name ?? "").trim(),
        codigo: ing.codigo ?? null,
        quantity: parseFloat(String(ing.quantidade ?? ing.quantity ?? 1).replace(",", ".")) || 1,
        unit: ing.unidade ?? ing.unit ?? "unidade",
        price: ing.preco_unitario ?? ing.price ?? null,
        price_total: ing.preco_total ?? null,
        category: ing.categoria ?? ing.category ?? "outros",
        supplier: parsed.fornecedor ?? null,
      }))
      .filter((i: any) => i.name);

    // ── Montar resultado final ─────────────────────────────────────
    const result: any = {
      ingredients,
      summary: parsed.summary ?? `${ingredients.length} item(s) extraído(s).`,
      fornecedor: parsed.fornecedor ?? null,
      numero_nota: parsed.numero_nota ?? null,
      data_emissao: parsed.data_emissao ?? null,
      valor_total: parsed.valor_total ?? null,
      ...(extractRecipe && {
        recipeName: parsed.recipeName ?? null,
        preparationMethod: parsed.preparationMethod ?? null,
        preparationTime: parsed.preparationTime ?? 0,
        yieldQuantity: parsed.yieldQuantity ?? 0,
        labor_cost: parsed.labor_cost ?? 0,
        energy_cost: parsed.energy_cost ?? 0,
        other_costs: parsed.other_costs ?? 0,
        markup: parsed.markup ?? 0,
        praca: parsed.praca ?? null,
      }),
    };

    // ── Salvar no Supabase (opcional) ───────────────────────────────
    if (saveToDb && userId && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      // Lazy import: avoid top-level esm.sh import that can crash during cold start
      // @ts-ignore
      const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      const { data: importRow, error: importErr } = await supabase
        .from("invoice_imports")
        .insert({
          user_id: userId,
          supplier_name: result.fornecedor,
          invoice_number: result.numero_nota,
          emission_date: result.data_emissao,
          total_value: result.valor_total,
          items_count: ingredients.length,
          raw_data: parsed,
        })
        .select("id")
        .single();

      if (importErr) {
        console.error("[Supabase] invoice_imports insert error:", importErr.message);
        result.dbError = importErr.message;
      } else {
        result.importId = importRow?.id;

        for (const ing of ingredients) {
          const { error: stockErr } = await supabase
            .from("stock_items")
            .upsert(
              {
                user_id: userId,
                name: ing.name,
                quantity: ing.quantity,
                unit: ing.unit,
                category: ing.category,
                cost_price: ing.price,
                supplier: ing.supplier,
              },
              { onConflict: "user_id,name" }
            );
          if (stockErr) console.warn(`[Supabase] upsert '${ing.name}':`, stockErr.message);
        }

        result.savedToDb = true;
      }
    }

    console.log(`[extract-ingredients] OK: ${ingredients.length} itens. saveToDb=${saveToDb}`);

    // ── 5. Retorno de Sucesso com corsHeaders ──────────────────────
    return jsonOk(result);

  } catch (error: any) {
    // Sempre retorna 200 para que supabase.functions.invoke leia o body em `data`
    // status 500 vira FunctionsHttpError opaco sem mensagem legível no frontend
    console.error("ERRO REAL DO GEMINI:", error?.message ?? error);
    if (error?.details) console.error("DETALHES:", error.details);

    return new Response(
      JSON.stringify({
        error: "Falha na IA",
        details: error?.details ?? error?.message ?? "Erro interno.",
        ingredients: [],
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
