import * as pdfjsLib from 'pdfjs-dist';

// Point the worker to the pre-built worker in /public
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

/**
 * Renders the first page of a PDF file as a JPEG image File.
 */
export async function convertPdfToImage(file: File): Promise<File> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const page = await pdf.getPage(1);

  const scale = 2;
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d')!;

  await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;

  return new Promise<File>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return reject(new Error('Failed to convert PDF page to image'));
        resolve(new File([blob], file.name.replace(/\.pdf$/i, '.jpg'), { type: 'image/jpeg' }));
      },
      'image/jpeg',
      0.85
    );
  });
}

/**
 * Extracts all text content from a PDF file, concatenating pages.
 */
export async function extractTextFromPdf(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const parts: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: any) => item.str ?? '')
      .join(' ');
    parts.push(pageText);
  }

  return parts.join('\n');
}
