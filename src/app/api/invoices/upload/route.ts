import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import {
  errorResponse,
  ErrorCodes,
  validateFileSize,
} from '@/lib/api-errors-next';

export const maxDuration = 90;

const N8N_WEBHOOK_URL =
  'https://webhook.teste-azura.duckdns.org/webhook/aa5447df-0558-4d70-9287-554917e30782';

// Google Drive / DriveDataService calls are intentionally disabled.
// Files go directly to the n8n webhook above.

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return errorResponse(
        { message: 'Sessão expirada ou não autorizado', code: 'UNAUTHORIZED', statusCode: 401 },
        401
      );
    }

    if (req.method !== 'POST') {
      const errorDef = ErrorCodes.METHOD_NOT_ALLOWED;
      const message =
        typeof errorDef.message === 'function' ? errorDef.message(req.method) : errorDef.message;
      return errorResponse({ status: errorDef.status, code: errorDef.code, message });
    }

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch (e: any) {
      console.error('Form parsing error:', e);
      return errorResponse(
        { message: 'Falha ao processar formulário: ' + e.message, code: 'FORM_PARSE_ERROR', statusCode: 400 },
        400
      );
    }

    const file = formData.get('file') as File;
    const extractRecipe = formData.get('extractRecipe') === 'true';

    if (!file) {
      return errorResponse(
        { message: 'Nenhum arquivo enviado', code: 'MISSING_FIELD', statusCode: 400 },
        400
      );
    }

    const fileSizeValidation = validateFileSize(file.size, 10 * 1024 * 1024);
    if (!fileSizeValidation.valid) {
      return errorResponse(fileSizeValidation.error);
    }

    const mimeType = file.type || 'application/octet-stream';
    const allowedMimeTypes = [
      'image/jpeg',
      'image/png',
      'application/pdf',
      'text/csv',
      'text/xml',
      'text/plain',
    ];
    if (!mimeType.startsWith('image/') && !allowedMimeTypes.includes(mimeType)) {
      return errorResponse(
        { message: `Tipo de arquivo não permitido: ${mimeType}`, code: 'INVALID_CONTENT_TYPE', statusCode: 400 },
        400
      );
    }

    // Send file directly to n8n webhook
    const webhookFormData = new FormData();
    webhookFormData.append('file', file);
    webhookFormData.append('user_id', user.id);
    webhookFormData.append('extractRecipe', String(extractRecipe));
    webhookFormData.append('filename', file.name);
    webhookFormData.append('file_size', String(file.size));
    webhookFormData.append('mime_type', mimeType);

    const webhookResponse = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      body: webhookFormData,
    });

    if (!webhookResponse.ok) {
      console.error('Webhook responded with status:', webhookResponse.status);
      return errorResponse(
        { message: 'Erro ao enviar dados para processamento', code: 'WEBHOOK_ERROR', statusCode: 502 },
        502
      );
    }

    // Try to use the webhook response body; fall back to a safe default
    let webhookData: any = {};
    try {
      webhookData = await webhookResponse.json();
    } catch {
      // n8n may return non-JSON — that's fine
    }

    const responseData: any = {
      ingredients: webhookData.ingredients ?? [],
      summary: webhookData.summary ?? 'Arquivo enviado para processamento.',
      fornecedor: webhookData.fornecedor ?? null,
      numero_nota: webhookData.numero_nota ?? null,
      data_emissao: webhookData.data_emissao ?? null,
      valor_total: webhookData.valor_total ?? null,
    };

    if (extractRecipe) {
      responseData.recipeName = webhookData.recipeName ?? null;
      responseData.preparationMethod = webhookData.preparationMethod ?? null;
      responseData.preparationTime = webhookData.preparationTime ?? 0;
      responseData.yieldQuantity = webhookData.yieldQuantity ?? 0;
      responseData.labor_cost = webhookData.labor_cost ?? 0;
      responseData.energy_cost = webhookData.energy_cost ?? 0;
      responseData.other_costs = webhookData.other_costs ?? 0;
      responseData.markup = webhookData.markup ?? 0;
      responseData.praca = webhookData.praca ?? null;
    }

    return NextResponse.json(responseData);
  } catch (error: any) {
    console.error('ERRO NÃO TRATADO NO UPLOAD:', error);
    return errorResponse(error);
  }
}
