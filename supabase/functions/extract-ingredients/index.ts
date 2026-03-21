// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const Deno: any;

// ══════════════════════════════════════════════════════════════════
// 1. CORS ABSOLUTO — aplicado em TODAS as respostas sem exceção
// ══════════════════════════════════════════════════════════════════
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

function jsonError(message: string, status = 400): Response {
  return new Response(JSON.stringify({ error: message, ingredients: [] }), {
    status,
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
async function callGemini(apiKey: string, geminiBody: unknown): Promise<any> {
  const models = ["gemini-2.0-flash", "gemini-1.5-flash"];
  let lastErrorDetails = "";

  for (const model of models) {
    for (let attempt = 0; attempt < 3; attempt++) {
      console.log(`[Gemini] Tentando model=${model} attempt=${attempt}`);

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
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
      lastErrorDetails = `[${model}] HTTP ${res.status}: ${errMsg}`;
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

      // Erro não-retryável neste modelo → tenta próximo
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
      content,
      fileType,
      extractRecipe = false,
      mimeType: customMimeType,
      userId,
      saveToDb = false,
    } = body ?? {};

    if (!content) {
      return jsonError("Campo 'content' ausente no body.");
    }

    // ── Determinar MIME type ───────────────────────────────────────
    let mimeType = customMimeType;
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
    // ── 4. Retorno de Erro Seguro com corsHeaders ──────────────────
    // Exibe o erro completo nos logs do Supabase (painel → Functions → Logs)
    console.error("ERRO REAL DO GEMINI:", error?.message ?? error);
    if (error?.details) console.error("DETALHES:", error.details);

    return new Response(
      JSON.stringify({
        error: "Falha na IA",
        details: error?.details ?? error?.message ?? "Erro interno.",
        ingredients: [],
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
