import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { extractInvoiceData } from '@/lib/gemini';

export const maxDuration = 60; // Vercel timeout adjustment

export async function POST(req: NextRequest) {
  let importId: string | undefined;
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    ({ importId } = await req.json());
    if (!importId) throw new Error('Missing importId');

    // 1. Update status to 'processing'
    await supabase
      .from('invoice_imports')
      .update({ status: 'processing' })
      .eq('id', importId);

    // 2. Get import data
    const { data: importRecord, error: fetchError } = await supabase
      .from('invoice_imports')
      .select('*')
      .eq('id', importId)
      .single();

    if (fetchError || !importRecord) throw fetchError || new Error('Record not found');

    // 3. Download file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('invoices')
      .download(importRecord.file_url);

    if (downloadError) throw downloadError;

    // Convert Blob to text/base64
    const contentText = await fileData.text();

    // 4. Call Gemini 1.5 Flash (Structured Outputs)
    const extractedData = await extractInvoiceData(contentText);

    // 5. Update Record with extracted data and status 'completed'
    // This is where we ensure the status change triggers Realtime on frontend
    const { error: updateError } = await supabase
      .from('invoice_imports')
      .update({
        status: 'completed',
        extracted_data: extractedData,
        updated_at: new Date().toISOString()
      })
      .eq('id', importId);

    if (updateError) throw updateError;

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Processing error:', error);
    
    // Attempt to mark as error in database
    try {
      if (importId) {
        const supabase = await createClient();
        await supabase
          .from('invoice_imports')
          .update({
            status: 'error',
            error_message: error.message,
            updated_at: new Date().toISOString()
          })
          .eq('id', importId);
      }
    } catch (e) {
      console.error('Failed to log error to DB:', e);
    }

    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
