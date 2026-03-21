import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 });
    }

    // Convert file to base64 for direct Gemini extraction (no Storage needed)
    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    // Call extract-ingredients Edge Function directly with the base64 content
    const { data: extractedData, error: extractError } = await supabase.functions.invoke(
      'extract-ingredients',
      {
        body: {
          content: base64,
          fileType: file.type.startsWith('image/') ? 'image' : file.type === 'application/pdf' ? 'pdf' : 'text',
          mimeType: file.type,
          extractRecipe: false,
        },
      }
    );

    if (extractError) {
      console.error('extract-ingredients error:', extractError);
      return NextResponse.json(
        { error: `Erro na extração: ${extractError.message}` },
        { status: 500 }
      );
    }

    if (extractedData?.error) {
      return NextResponse.json(
        { error: extractedData.error, details: extractedData.details },
        { status: 422 }
      );
    }

    // Optionally store the import record in the DB
    const { data: importRecord, error: importError } = await supabase
      .from('invoice_imports')
      .insert({
        user_id: user.id,
        status: 'completed',
        supplier_name: extractedData?.fornecedor ?? null,
        invoice_number: extractedData?.numero_nota ?? null,
        emission_date: extractedData?.data_emissao ?? null,
        total_value: extractedData?.valor_total ?? null,
        items_count: extractedData?.ingredients?.length ?? 0,
        extracted_data: extractedData,
      })
      .select('id')
      .single();

    if (importError) {
      // Log but don't fail — extraction already worked
      console.error('invoice_imports insert error:', importError.message);
    }

    return NextResponse.json({
      success: true,
      importId: importRecord?.id ?? null,
      ...extractedData,
    });

  } catch (error: any) {
    console.error('Upload route error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
