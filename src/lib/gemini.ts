import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

// gemini-2.0-flash is stable → use v1 (v1beta returns 404 for this model)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export const nfeSchema = {
  description: "Extracted data from a Brazilian NF-e invoice",
  type: SchemaType.OBJECT,
  properties: {
    invoiceNumber: { type: SchemaType.STRING },
    emissionDate: { type: SchemaType.STRING },
    supplierName: { type: SchemaType.STRING },
    supplierCnpj: { type: SchemaType.STRING },
    totalValue: { type: SchemaType.NUMBER },
    items: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          name: { type: SchemaType.STRING },
          quantity: { type: SchemaType.NUMBER },
          unit: { type: SchemaType.STRING },
          unitPrice: { type: SchemaType.NUMBER },
          totalPrice: { type: SchemaType.NUMBER },
          category: { type: SchemaType.STRING }
        },
        required: ["name", "quantity", "unit", "unitPrice"]
      }
    }
  },
  required: ["invoiceNumber", "supplierName", "totalValue", "items"]
};

export const extractInvoiceData = async (content: string) => {
  const model = genAI.getGenerativeModel(
    {
      model: "gemini-2.0-flash",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: nfeSchema as any,
      },
    },
    { apiVersion: "v1" }
  );

  const prompt = `
    Extração de NF-e (Brasil).
    Retorne apenas JSON.
    Unidades: kg, g, L, ml, unidade, caixa, dz.
    Categorias: laticinios, carnes, hortifruti, secos_e_graos, embalagens, limpeza, bebidas, outros.

    Conteúdo:
    ${content}
  `;

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Gemini timeout: resposta não recebida em 30s')), 30_000)
  );
  const result = await Promise.race([model.generateContent(prompt), timeoutPromise]);
  const response = await result.response;
  const text = response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Gemini retornou resposta inválida: ${text.slice(0, 200)}`);
  }
};
