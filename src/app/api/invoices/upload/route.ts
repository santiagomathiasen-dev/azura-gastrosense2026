import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import OpenAI from 'openai';
import {
  errorResponse,
  ErrorCodes,
  validateFileSize,
  getErrorResponse,
} from '@/lib/api-errors-next';

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
    // 1. Verificação de Autenticação
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return errorResponse(
        { message: 'Sessão expirada ou não autorizado', code: 'UNAUTHORIZED', statusCode: 401 },
        401
      );
    }

    // 2. Validar que é POST
    if (req.method !== 'POST') {
      const errorDef = ErrorCodes.METHOD_NOT_ALLOWED;
      const message = typeof errorDef.message === 'function' ? errorDef.message(req.method) : errorDef.message;
      return errorResponse({ status: errorDef.status, code: errorDef.code, message });
    }

    // 3. Chave de API
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error('ERRO CRÍTICO: OPENAI_API_KEY ausente.');
      return errorResponse(
        {
          message: 'Configuração da IA ausente no servidor',
          code: 'CONFIGURATION_ERROR',
          statusCode: 502,
        },
        502
      );
    }

    // 4. Parsing do Arquivo
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch (e: any) {
      console.error('Form parsing error:', e);
      return errorResponse(
        {
          message: 'Falha ao processar formulário: ' + e.message,
          code: 'FORM_PARSE_ERROR',
          statusCode: 400,
        },
        400
      );
    }

    const file = formData.get('file') as File;
    const extractRecipe = formData.get('extractRecipe') === 'true';
    const saveToDb = formData.get('saveToDb') !== 'false';

    if (!file) {
      return errorResponse(
        {
          message: 'Nenhum arquivo enviado',
          code: 'MISSING_FIELD',
          statusCode: 400,
        },
        400
      );
    }

    // Validate file size
    const fileSizeValidation = validateFileSize(file.size, 10 * 1024 * 1024);
    if (!fileSizeValidation.valid) {
      return errorResponse(fileSizeValidation.error);
    }

    // Validate file type
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'application/pdf', 'text/csv', 'text/xml', 'text/plain'];
    const mimeType = file.type || 'application/octet-stream';
    if (!mimeType.startsWith('image/') && !['application/pdf', 'text/csv', 'text/xml', 'text/plain'].includes(mimeType)) {
      return errorResponse(
        {
          message: `Tipo de arquivo não permitido: ${mimeType}`,
          code: 'INVALID_CONTENT_TYPE',
          statusCode: 400,
        },
        400
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const base64Data = Buffer.from(arrayBuffer).toString('base64');

    // 5. OpenAI Chat Completions
    const openai = new OpenAI({ apiKey });
    const prompt = extractRecipe ? PROMPT_RECIPE : PROMPT_INGREDIENT;

    const contentParts: OpenAI.ChatCompletionContentPart[] = [
      { type: 'text', text: prompt },
    ];

    if (mimeType.startsWith('image/')) {
      contentParts.push({
        type: 'image_url',
        image_url: { url: `data:${mimeType};base64,${base64Data}`, detail: 'high' },
      });
    } else if (mimeType === 'application/pdf') {
      contentParts.push({
        type: 'file',
        file: { filename: file.name, file_data: `data:application/pdf;base64,${base64Data}` },
      } as any);
    } else {
      // Text files (XML, CSV, TXT)
      const textContent = Buffer.from(arrayBuffer).toString('utf-8');
      if (!textContent || textContent.trim().length === 0) {
        return errorResponse(
          {
            message: 'Arquivo vazio',
            code: 'EMPTY_BODY',
            statusCode: 400,
          },
          400
        );
      }
      contentParts[0] = { type: 'text', text: `${prompt}\n\n--- CONTEÚDO DO ARQUIVO ---\n${textContent}` };
    }

    let result;
    try {
      result = await openai.chat.completions.create({
        model: 'gpt-4o',
        temperature: 0.1,
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: contentParts }],
      });
    } catch (aiErr: any) {
      console.error('FALHA NA API OPENAI:', aiErr);
      return errorResponse(
        {
          message: aiErr.message?.includes('quota')
            ? 'Limite de uso da IA excedido. Tente novamente mais tarde.'
            : `Erro ao processar com IA: ${aiErr.message}`,
          code: 'EXTERNAL_API_ERROR',
          statusCode: 502,
        },
        502
      );
    }

    const rawText = result.choices[0]?.message?.content;
    if (!rawText || rawText.trim().length === 0) {
      return errorResponse(
        {
          message: 'A IA não conseguiu ler o documento (resposta vazia)',
          code: 'VALIDATION_ERROR',
          statusCode: 422,
        },
        422
      );
    }

    // 6. Parsing de JSON
    let parsed: any;
    try {
      parsed = JSON.parse(rawText.trim());
    } catch {
      const match = rawText.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          parsed = JSON.parse(match[0]);
        } catch {
          return errorResponse(
            {
              message: 'IA retornou formato JSON inválido',
              code: 'INVALID_FORMAT',
              statusCode: 422,
            },
            422
          );
        }
      } else {
        return errorResponse(
          {
            message: 'IA falhou ao estruturar dados (resposta não contém JSON)',
            code: 'INVALID_FORMAT',
            statusCode: 422,
          },
          422
        );
      }
    }

    // 7. Normalização
    const rawIngredients: any[] = Array.isArray(parsed.ingredients) ? parsed.ingredients : [];
    const ingredients = rawIngredients
      .map((ing: any) => ({
        name: String(ing.nome ?? ing.name ?? '').trim(),
        quantity: typeof ing.quantidade === 'number' ? ing.quantidade : parseFloat(String(ing.quantidade ?? 1).replace(',', '.')) || 1,
        unit: String(ing.unidade ?? ing.unit ?? 'unidade').toLowerCase().trim(),
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

    // 8. Persistência
    if (saveToDb && !extractRecipe) {
      try {
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

        if (importError) throw importError;
        responseData.importId = importRecord?.id ?? null;
      } catch (dbErr: any) {
        console.warn('Alerta: Dados extraídos mas não salvos no histórico:', dbErr.message);
        // Continue sem erro - a extração foi bem-sucedida
      }
    }

    return NextResponse.json(responseData);

  } catch (error: any) {
    console.error('ERRO NÃO TRATADO NO UPLOAD:', error);
    return errorResponse(error);
  }
}
