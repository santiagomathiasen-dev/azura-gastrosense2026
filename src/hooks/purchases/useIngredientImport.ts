import { useState } from 'react';
import { toast } from 'sonner';
import type { StockCategory, StockUnit } from './useStockItems';

export interface ExtractedIngredient {
  name: string;
  quantity: number;
  unit: StockUnit;
  category: StockCategory;
  price?: number | null;
  supplier?: string | null;
  expiration_date?: string | null;
  selected?: boolean;
}

export interface RecipeData {
  recipeName?: string;
  preparationMethod?: string;
  yieldQuantity?: number;
  preparationTime?: number;
  labor_cost?: number;
  energy_cost?: number;
  other_costs?: number;
  markup?: number;
  praca?: string;
}

export interface ExtractionResult {
  ingredients: ExtractedIngredient[];
  summary: string;
  recipeData?: RecipeData;
}

export function useIngredientImport() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedIngredients, setExtractedIngredients] = useState<ExtractedIngredient[]>([]);
  const [summary, setSummary] = useState<string>('');
  const [recipeData, setRecipeData] = useState<RecipeData | null>(null);

  const extractFromFile = async (file: File, extractRecipe = false): Promise<ExtractionResult | null> => {
    setIsProcessing(true);
    setExtractedIngredients([]);
    setSummary('');
    setRecipeData(null);

    try {
      // Check file size - max 5MB
      const MAX_SIZE = 5 * 1024 * 1024;
      if (file.size > MAX_SIZE) {
        toast.error('Arquivo muito grande', {
          description: 'O tamanho máximo permitido é 5MB.',
        });
        return null;
      }

      const validTypes = [
        'image/jpeg', 'image/png', 'image/webp', 'image/gif',
        'application/pdf',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ];
      if (!validTypes.includes(file.type)) {
        toast.error('Tipo de arquivo não suportado');
        return null;
      }

      // Compress images >1MB before sending
      let fileToSend = file;
      if (file.type.startsWith('image/') && file.size > 1024 * 1024) {
        fileToSend = await compressImageToFile(file, 1200, 0.75);
      }

      const formData = new FormData();
      formData.append('file', fileToSend, fileToSend.name);
      formData.append('extractRecipe', String(extractRecipe));
      formData.append('saveToDb', 'false');

      const res = await fetch('/api/invoices/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Erro HTTP ${res.status}`);
      }

      const data = await res.json();

      if (data.error) {
        toast.error(data.error);
        return null;
      }

      const ingredients = (data.ingredients || []).map((ing: ExtractedIngredient) => ({
        ...ing,
        selected: true,
      }));

      setExtractedIngredients(ingredients);
      setSummary(data.summary || '');

      const extractedRecipeData: RecipeData | undefined = (data.recipeName || data.preparationMethod) ? {
        recipeName: data.recipeName,
        preparationMethod: data.preparationMethod,
        yieldQuantity: data.yieldQuantity,
        preparationTime: data.preparationTime,
        labor_cost: data.labor_cost,
        energy_cost: data.energy_cost,
        other_costs: data.other_costs,
        markup: data.markup,
        praca: data.praca,
      } : undefined;

      if (extractedRecipeData) {
        setRecipeData(extractedRecipeData);
      }

      return { ingredients, summary: data.summary || '', recipeData: extractedRecipeData };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao processar arquivo';
      toast.error(message);
      return null;
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleIngredient = (index: number) => {
    setExtractedIngredients((prev) =>
      prev.map((ing, i) =>
        i === index ? { ...ing, selected: !ing.selected } : ing
      )
    );
  };

  const updateIngredient = (index: number, updates: Partial<ExtractedIngredient>) => {
    setExtractedIngredients((prev) =>
      prev.map((ing, i) =>
        i === index ? { ...ing, ...updates } : ing
      )
    );
  };

  const removeIngredient = (index: number) => {
    setExtractedIngredients((prev) => prev.filter((_, i) => i !== index));
  };

  const clearExtraction = () => {
    setExtractedIngredients([]);
    setSummary('');
    setRecipeData(null);
  };

  const getSelectedIngredients = () => {
    return extractedIngredients.filter((ing) => ing.selected);
  };

  return {
    isProcessing,
    extractedIngredients,
    summary,
    recipeData,
    extractFromFile,
    toggleIngredient,
    updateIngredient,
    removeIngredient,
    clearExtraction,
    getSelectedIngredients,
  };
}

function compressImageToFile(file: File, maxPx = 1200, quality = 0.75): Promise<File> {
  return new Promise((resolve) => {
    const img = new window.Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxPx || height > maxPx) {
        if (width > height) { height = Math.round(height * maxPx / width); width = maxPx; }
        else { width = Math.round(width * maxPx / height); height = maxPx; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => resolve(new File([blob!], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' })),
        'image/jpeg', quality
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}
