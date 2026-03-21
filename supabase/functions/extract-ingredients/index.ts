// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const Deno: any;

// ─── CORS ────────────────────────────────────────────────────────────────────
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ─── SYSTEM INSTRUCTION (JSON MODE) ──────────────────────────────────────────
// This instructs Gemini to always return a structured, valid JSON object.
// Do NOT sanitize or strip original text — preserve currency symbols, punctuation,
// measurement units and original formatting exactly as they appear in the document.
const SYSTEM_INSTRUCTION_INGREDIENT = `
Você é um extrator de dados de documentos fiscais e listas de compras.
Leia o documento fornecido e extraia TODOS os itens listados.
Preserve pontuação original, símbolos de moeda (R$, $), unidades de medida reais (kg, g, L, ml, cx, dz, un) e formatações dos documentos.
Categorize cada item usando APENAS: laticinios, secos_e_graos, hortifruti, carnes_e_peixes, embalagens, limpeza, outros.

Retorne EXCLUSIVAMENTE este JSON (sem texto fora do JSON):
{
  "fornecedor": "nome do fornecedor ou null",
  "numero_nota": "número da nota fiscal ou null",
  "data_emissao": "data no formato YYYY-MM-DD ou null",
  "valor_total": 0.00,
  "ingredients": [
    {
      "nome": "nome exato do produto como no documento",
      "codigo": "código do produto ou null",
      "quantidade": 1.0,
      "unidade": "unidade exata do documento",
      "preco_unitario": 0.00,
      "preco_total": 0.00,
      "categoria": "categoria aqui"
    }
  ],
  "summary": "resumo em 1 frase"
}`;

const SYSTEM_INSTRUCTION_RECIPE = `
Você é um extrator de fichas técnicas de receitas gastronômicas.
Leia o documento fornecido e extraia TODOS os dados da receita.
Preserve nomes originais dos ingredientes, unidades de medida reais e formatações dos documentos.

Retorne EXCLUSIVAMENTE este JSON:
{
  "recipeName": "nome da receita",
  "preparationMethod": "modo de preparo completo",
  "preparationTime": 0,
  "yieldQuantity": 0,
  "labor_cost": 0.00,
  "energy_cost": 0.00,
  "other_costs": 0.00,
  "markup": 0.00,
  "praca": "local de preparo ou null",
  "ingredients": [
    {
      "nome": "nome exato como no documento",
      "quantidade": 1.0,
      "unidade": "unidade exata do documento",
      "preco_unitario": 0.00,
      "categoria": "categoria aqui"
    }
  ],
  "summary": "resumo em 1 frase"
}`;

// ─── RETRY WITH BACKOFF + MODEL FALLBACK ─────────────────────────────────────
async function callGeminiWithRetry(
  apiKey: string,
  geminiBody: any
): Promise<any> {
  const models = ["gemini-2.0-flash", "gemini-1.5-flash"];
  const maxAttempts = 2;

  for (const model of models) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(geminiBody),
        }
      );

      if (res.ok) {
        const data = await res.json();
        return { data, model };
      }

      if (res.status === 429) {
        let waitMs = (attempt + 1) * 15000; // 15s, 30s
        try {
          const errJson = await res.clone().json();
          const delay = errJson?.error?.details?.find((d: any) => d.retryDelay)?.retryDelay;
          if (delay) {
            const secs = parseInt(delay.replace("s", ""), 10);
            if (!isNaN(secs)) waitMs = (secs + 3) * 1000;
          }
        } catch (_) {}
        console.warn(`[${model}] 429 - aguardando ${waitMs}ms (tentativa ${attempt + 1})`);
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }

      // Non-retryable: proceed to next model
      console.warn(`[${model}] Erro ${res.status} — tentando próximo modelo`);
      break;
    }
  }

  throw new Error("Todos os modelos Gemini falharam. Tente novamente em 1 minuto.");
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
Deno.serve(async (req: any) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  try {
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY não configurada.");
    }

    const body = await req.json();
    const {
      content,
      fileType,
      extractRecipe = false,
      mimeType: customMimeType,
      userId,
      saveToDb = false, // set true to persist directly from the function
    } = body;

    if (!content) {
      throw new Error("Campo 'content' ausente no body.");
    }

    // ── Determine MIME type ──────────────────────────────────────────────────
    let mimeType = customMimeType;
    if (!mimeType) {
      if (fileType === "pdf") mimeType = "application/pdf";
      else if (fileType === "image") mimeType = "image/jpeg";
      else mimeType = "text/plain";
    }
    const isBase64 = mimeType !== "text/plain";

    // ── Build Gemini request ─────────────────────────────────────────────────
    // NOTE: systemInstruction at root-level does NOT work reliably with inlineData.
    // We put the instruction as the FIRST text part inside contents instead.
    const systemInstruction = extractRecipe
      ? SYSTEM_INSTRUCTION_RECIPE
      : SYSTEM_INSTRUCTION_INGREDIENT;

    const filePart = isBase64
      ? { inlineData: { mimeType, data: content } }
      : { text: content };

    const geminiBody = {
      contents: [
        {
          parts: [
            { text: systemInstruction },  // instruction first
            filePart,                      // then the document
            { text: "Retorne apenas o JSON conforme especificado acima. Nenhum texto fora do JSON." },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        // JSON MODE — Gemini will ONLY return valid JSON
        responseMimeType: "application/json",
      },
    };

    // ── Call Gemini with retry ───────────────────────────────────────────────
    const { data: aiData, model: usedModel } = await callGeminiWithRetry(
      GEMINI_API_KEY,
      geminiBody
    );

    const rawText = aiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
    if (!rawText) {
      const reason = aiData.candidates?.[0]?.finishReason || "UNKNOWN";
      throw new Error(`Gemini não retornou dados (finishReason: ${reason}).`);
    }

    // ── Parse JSON — no regex cleaning, preserve original values ─────────────
    let parsed: any;
    try {
      parsed = JSON.parse(rawText);
    } catch (_) {
      // Last resort: find first JSON block (should rarely happen in JSON mode)
      const match = rawText.match(/\{[\s\S]*\}/);
      if (match) {
        parsed = JSON.parse(match[0]);
      } else {
        throw new Error("Resposta do Gemini não é um JSON válido.");
      }
    }

    // ── Normalise ingredient keys (support both 'nome' and 'name') ──────────
    const rawIngredients: any[] = Array.isArray(parsed.ingredients)
      ? parsed.ingredients
      : Array.isArray(parsed)
      ? parsed
      : [];

    const ingredients = rawIngredients.map((ing: any) => ({
      name: ing.nome ?? ing.name ?? "",
      codigo: ing.codigo ?? ing.code ?? null,
      quantity: typeof ing.quantidade === "number" ? ing.quantidade : parseFloat(String(ing.quantidade ?? ing.quantity ?? 1).replace(",", ".")) || 1,
      unit: ing.unidade ?? ing.unit ?? "unidade",
      price: ing.preco_unitario ?? ing.price ?? ing.preco ?? null,
      price_total: ing.preco_total ?? ing.total ?? null,
      category: ing.categoria ?? ing.category ?? "outros",
      supplier: parsed.fornecedor ?? null,
    })).filter((i: any) => i.name);

    // ── Build final result ───────────────────────────────────────────────────
    const result: any = {
      ingredients,
      summary: parsed.summary ?? `${ingredients.length} item(s) extraído(s) com ${usedModel}.`,
      fornecedor: parsed.fornecedor ?? null,
      numero_nota: parsed.numero_nota ?? null,
      data_emissao: parsed.data_emissao ?? null,
      valor_total: parsed.valor_total ?? null,
      usedModel,
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

    // ── Optional: Save directly to Supabase ──────────────────────────────────
    // When saveToDb=true and userId is provided, the validated data is persisted
    // directly from the Edge Function without relying on the frontend to do it.
    if (saveToDb && userId && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      // 1. Record the invoice import
      const { data: importRecord, error: importError } = await supabase
        .from("invoice_imports")
        .insert({
          user_id: userId,
          supplier_name: result.fornecedor,
          invoice_number: result.numero_nota,
          emission_date: result.data_emissao,
          total_value: result.valor_total,
          items_count: ingredients.length,
          raw_data: parsed, // preserve full original JSON from Gemini
        })
        .select("id")
        .single();

      if (importError) {
        console.error("Erro ao salvar invoice_imports:", importError.message);
        // Don't fail the whole request — still return the extracted data
        result.dbError = importError.message;
      } else {
        result.importId = importRecord?.id;

        // 2. Upsert each ingredient into stock_items
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
              { onConflict: "user_id,name", ignoreDuplicates: false }
            );

          if (stockErr) {
            console.warn(`Erro ao inserir item '${ing.name}':`, stockErr.message);
          }
        }

        result.savedToDb = true;
      }
    }

    console.log(`[extract-ingredients] ${ingredients.length} itens extraídos via ${usedModel}. saveToDb=${saveToDb}`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[extract-ingredients] Erro:", err?.message ?? err);
    return new Response(
      JSON.stringify({ error: err?.message ?? "Erro interno.", ingredients: [] }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
