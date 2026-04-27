import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { extractInvoiceData } from '@/lib/gemini';
import { errorResponse, ErrorCodes, validateRequiredFields } from '@/lib/api-errors-next';

export const maxDuration = 60; // Vercel timeout adjustment

export async function POST(req: NextRequest) {
  let importId: string | undefined;
  try {
    // Validate HTTP method
    if (req.method !== 'POST') {
      const errorDef = ErrorCodes.METHOD_NOT_ALLOWED;
      const message = typeof errorDef.message === 'function' ? errorDef.message(req.method) : errorDef.message;
      return errorResponse({ status: errorDef.status, code: errorDef.code, message });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return errorResponse(ErrorCodes.UNAUTHORIZED, 401);
    }

    // Parse and validate body
    let bodyData: any;
    try {
      const text = await req.text();
      if (!text || text.trim() === '') {
        return errorResponse(
          {
            message: 'Corpo da requisição vazio (importId obrigatório)',
            code: 'EMPTY_BODY',
            statusCode: 400,
          },
          400
        );
      }
      bodyData = JSON.parse(text);
    } catch {
      return errorResponse(
        {
          message: 'JSON inválido no corpo da requisição',
          code: 'INVALID_JSON',
          statusCode: 400,
        },
        400
      );
    }

    const { importId: reqImportId } = bodyData;
    if (!reqImportId || typeof reqImportId !== 'string') {
      return errorResponse(
        {
          message: 'Campo obrigatório faltando: importId',
          code: 'MISSING_FIELD',
          statusCode: 400,
        },
        400
      );
    }

    importId = reqImportId;

    // 1. Update status to 'processing'
    const { error: updateError1 } = await supabase
      .from('invoice_imports')
      .update({ status: 'processing', updated_at: new Date().toISOString() })
      .eq('id', importId)
      .eq('user_id', user.id); // Ensure user owns this import

    if (updateError1) {
      throw {
        message: 'Erro ao atualizar status de processamento',
        code: 'DATABASE_ERROR',
        statusCode: 500,
      };
    }

    // 2. Get import data
    const { data: importRecord, error: fetchError } = await supabase
      .from('invoice_imports')
      .select('*')
      .eq('id', importId)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !importRecord) {
      await markAsError(supabase, importId, 'Registro não encontrado ou não autorizado');
      return errorResponse(
        {
          message: 'Registro não encontrado ou acesso negado',
          code: 'NOT_FOUND',
          statusCode: 404,
        },
        404
      );
    }

    // 3. Download file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('invoices')
      .download(importRecord.file_url);

    if (downloadError || !fileData) {
      await markAsError(supabase, importId, 'Erro ao baixar arquivo: ' + (downloadError?.message || 'Desconhecido'));
      return errorResponse(
        {
          message: 'Erro ao baixar arquivo',
          code: 'EXTERNAL_API_ERROR',
          statusCode: 502,
        },
        502
      );
    }

    // Convert Blob to text
    let contentText: string;
    try {
      contentText = await fileData.text();
      if (!contentText || contentText.trim().length === 0) {
        await markAsError(supabase, importId, 'Arquivo está vazio');
        return errorResponse(
          {
            message: 'Arquivo está vazio',
            code: 'EMPTY_BODY',
            statusCode: 400,
          },
          400
        );
      }
    } catch {
      await markAsError(supabase, importId, 'Erro ao ler conteúdo do arquivo');
      return errorResponse(
        {
          message: 'Erro ao ler conteúdo do arquivo',
          code: 'VALIDATION_ERROR',
          statusCode: 422,
        },
        422
      );
    }

    // 4. Call Gemini 1.5 Flash (Structured Outputs)
    let extractedData: any;
    try {
      extractedData = await extractInvoiceData(contentText);
      if (!extractedData || Object.keys(extractedData).length === 0) {
        throw new Error('Dados extraídos vazios');
      }
    } catch (geminiErr: any) {
      const errMsg = geminiErr?.message || 'Erro desconhecido na extração';
      await markAsError(supabase, importId, 'Erro na IA: ' + errMsg);
      return errorResponse(
        {
          message: 'Erro ao processar com IA: ' + errMsg,
          code: 'EXTERNAL_API_ERROR',
          statusCode: 502,
        },
        502
      );
    }

    // 5. Update Record with extracted data and status 'completed'
    const { error: updateError } = await supabase
      .from('invoice_imports')
      .update({
        status: 'completed',
        extracted_data: extractedData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', importId);

    if (updateError) {
      console.error('Failed to update invoice_imports:', updateError);
      return errorResponse(
        {
          message: 'Erro ao salvar dados processados',
          code: 'DATABASE_ERROR',
          statusCode: 500,
        },
        500
      );
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Processing error:', error);

    // Attempt to mark as error in database
    if (importId) {
      try {
        const supabase = await createClient();
        await markAsError(supabase, importId, error?.message || 'Erro desconhecido no processamento');
      } catch (e) {
        console.error('Failed to log error to DB:', e);
      }
    }

    return errorResponse(error);
  }
}

async function markAsError(supabase: any, importId: string, errorMessage: string) {
  try {
    await supabase
      .from('invoice_imports')
      .update({
        status: 'error',
        error_message: errorMessage,
        updated_at: new Date().toISOString(),
      })
      .eq('id', importId);
  } catch (e) {
    console.error('Failed to mark as error:', e);
  }
}
