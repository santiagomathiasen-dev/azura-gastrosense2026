// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const Deno: any;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface StockInputRequest {
  type: "voice" | "image";
  content: string;
  stockItems: { id: string; name: string; unit: string; category: string }[];
}

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
    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Token inválido ou expirado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    const { type, content, stockItems }: StockInputRequest = await req.json();

    // Validate input
    if (!type || !content) {
      return new Response(
        JSON.stringify({ error: "Tipo e conteúdo são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const stockItemsList = (stockItems || [])
      .map((item) => `- ${item.name} (ID: ${item.id}, unidade: ${item.unit}, category: ${item.category})`)
      .join("\n");

    const promptText = `IA de Estoque Profissional.
Extração direta de JSON. 
Ação: entry, exit, adjustment.

ITENS:
${stockItemsList || "Nenhum"}

JSON apenas.`;

    const parts: any[] = [{ text: promptText }];

    if (type === "voice") {
      parts.push({ text: `Voz: "${content}"` });
    } else {
      parts.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: content.includes(",") ? content.split(",")[1] : content,
        },
      });
      parts.push({ text: "Analise imagem." });
    }

    const geminiBody = {
      contents: [{ parts }],
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
      console.error(`[process-stock-input] Gemini candidates vazios. finishReason=${finishReason}`);
      return new Response(
        JSON.stringify({ error: `IA não retornou dados (finishReason: ${finishReason}).` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract JSON from the response with cleaning and recovery
    let result;
    try {
      let cleanedMessage = assistantMessage.trim();
      if (cleanedMessage.startsWith("```")) {
        cleanedMessage = cleanedMessage.replace(/^```[a-z]*\n/i, "").replace(/\n```$/i, "").trim();
      }

      result = JSON.parse(cleanedMessage);
    } catch (parseError) {
      console.error("Parse error, trying regex recovery:", parseError);
      try {
        const jsonMatch = assistantMessage.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
        if (jsonMatch) {
          result = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error("No JSON found");
        }
      } catch (e) {
        console.error("Regex recovery failed:", e);
        result = {
          suggestions: [],
          message: "Não foi possível interpretar a entrada. Tente novamente com mais clareza.",
        };
      }
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("process-stock-input error:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
