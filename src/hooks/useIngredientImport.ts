import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
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
      let fileType: 'image' | 'pdf' | 'excel';
      let content: string;

      // Check file size - max 5MB
      const MAX_SIZE = 5 * 1024 * 1024;
      if (file.size > MAX_SIZE) {
        toast.error('Arquivo muito grande', {
          description: 'O tamanho máximo permitido é 5MB.',
        });
        return null;
      }


      if (file.type.startsWith('image/')) {
        fileType = 'image';
        content = await fileToBase64(file);
      } else if (file.type === 'application/pdf') {
        fileType = 'pdf';
        content = await fileToBase64(file);
      } else if (
        file.type === 'application/vnd.ms-excel' ||
        file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ) {
        fileType = 'excel';
        content = await fileToBase64(file);
      } else {
        toast.error('Tipo de arquivo não suportado');
        return null;
      }

      const mimeType = file.type;

      const { data, error: funcError } = await supabase.functions.invoke('extract-ingredients', {
        body: { fileType, content, extractRecipe, mimeType },
      });

      if (funcError) {
        throw new Error(`Falha na nuvem (Edge Function): ${funcError.message}`);
      }

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

      // Extract recipe data if available
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

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const skipResize = file.size < 1024 * 1024; // Less than 1MB
    const isHeic = file.type.toLowerCase().includes('heic') || file.name.toLowerCase().endsWith('.heic');

    if (!skipResize && !isHeic && file.type.startsWith('image/')) {
      const img = new window.Image();
      const objectUrl = URL.createObjectURL(file);
      let isResolved = false;

      const resolveFallback = () => {
        if (isResolved) return;
        isResolved = true;
        URL.revokeObjectURL(objectUrl);
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.includes(',') ? result.split(',')[1] : result);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      };

      const fallbackTimer = setTimeout(resolveFallback, 3000);

      img.onload = () => {
        if (isResolved) return;
        clearTimeout(fallbackTimer);
        isResolved = true;
        URL.revokeObjectURL(objectUrl);
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const MAX_SIZE = 1200;

        if (width > height && width > MAX_SIZE) {
          height *= MAX_SIZE / width;
          width = MAX_SIZE;
        } else if (height > MAX_SIZE) {
          width *= MAX_SIZE / height;
          height = MAX_SIZE;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          resolve(dataUrl.split(',')[1]);
        } else {
          resolveFallback();
        }
      };

      img.onerror = () => {
        if (isResolved) return;
        clearTimeout(fallbackTimer);
        resolveFallback();
      };

      img.src = objectUrl;
    } else {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.includes(',') ? result.split(',')[1] : result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    }
  });
}
