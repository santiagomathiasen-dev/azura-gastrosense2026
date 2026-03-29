import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const maxDuration = 90;

const PROMPT_INGREDIENT = `Você é um extrator de dados de notas fiscais e listas de compras.
Leia o documento e extraia TODOS os itens. Preserve nomes e unidades originais.
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
      "quantidade": 1.0,
      "unidade": "unidade exata",
      "preco_unitario": 0.00,
      "preco_total": 0.00,
      "categoria": "categoria aqui"
    }
  ],
  "summary": "resumo em 1 frase"
}`;

const PROMPT_RECIPE = `Você é um extrator de fichas técnicas gastronômicas.
Leia o documento e extraia os dados da receita. Preserve nomes e unidades originais.

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

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY não configurada no servidor.' }, { status: 500 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const extractRecipe = formData.get('extractRecipe') === 'true';
    const saveToDb = formData.get('saveToDb') !== 'false'; // default true for invoices

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 });
    }

    const mimeType = file.type || 'application/octet-stream';
    const arrayBuffer = await file.arrayBuffer();

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel(
      { model: 'gemini-2.0-flash', generationConfig: { temperature: 0.1, responseMimeType: 'application/json' } },
      { apiVersion: 'v1' }
    );

    const prompt = extractRecipe ? PROMPT_RECIPE : PROMPT_INGREDIENT;

    // Text files: send as plain text part. Binary (PDF/image): use inlineData.
    const contentPart = mimeType === 'text/plain'
      ? { text: `Conteúdo do documento:\n${Buffer.from(arrayBuffer).toString('utf-8')}` }
      : { inlineData: { mimeType, data: Buffer.from(arrayBuffer).toString('base64') } };

    const result = await model.generateContent([
      { text: prompt },
      contentPart,
      { text: 'Retorne apenas o JSON. Nenhum texto fora do JSON.' },
    ]);

    const rawText = result.response.text();
    if (!rawText) {
      return NextResponse.json({ error: 'Gemini não retornou dados.' }, { status: 422 });
    }

    let parsed: any;
    try {
      parsed = JSON.parse(rawText.trim());
    } catch {
      const match = rawText.match(/\{[\s\S]*\}/);
      if (match) {
        try { parsed = JSON.parse(match[0]); } catch {
          return NextResponse.json({ error: 'Resposta do Gemini não é JSON válido.' }, { status: 422 });
        }
      } else {
        return NextResponse.json({ error: 'Resposta do Gemini não é JSON válido.' }, { status: 422 });
      }
    }

    const rawIngredients: any[] = Array.isArray(parsed.ingredients) ? parsed.ingredients : [];
    const ingredients = rawIngredients
      .map((ing: any) => ({
        name: String(ing.nome ?? ing.name ?? '').trim(),
        quantity: parseFloat(String(ing.quantidade ?? ing.quantity ?? 1).replace(',', '.')) || 1,
        unit: ing.unidade ?? ing.unit ?? 'unidade',
        price: ing.preco_unitario ?? ing.price ?? null,
        price_total: ing.preco_total ?? null,
        category: ing.categoria ?? ing.category ?? 'outros',
        supplier: parsed.fornecedor ?? null,
      }))
      .filter((i: any) => i.name);

    const responseData: any = {
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

    // Save invoice record for non-recipe extractions
    if (saveToDb && !extractRecipe) {
      const { data: importRecord, error: importError } = await supabase
        .from('invoice_imports')
        .insert({
          user_id: user.id,
          status: 'completed',
          supplier_name: responseData.fornecedor,
          invoice_number: responseData.numero_nota,
          emission_date: responseData.data_emissao,
          total_value: responseData.valor_total,
          items_count: ingredients.length,
          extracted_data: responseData,
        })
        .select('id')
        .single();

      if (importError) {
        console.error('invoice_imports insert error:', importError.message);
      } else {
        responseData.importId = importRecord?.id ?? null;
      }
    }

    return NextResponse.json(responseData);

  } catch (error: any) {
    console.error('AI extract route error:', error);
    return NextResponse.json({ error: error.message ?? 'Erro interno' }, { status: 500 });
  }
}
