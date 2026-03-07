import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { StockItem } from './useStockItems';

export interface StockSuggestion {
  itemName: string;
  matchedItemId?: string;
  quantity: number;
  unit: string;
  action: 'entry' | 'exit' | 'adjustment';
  confidence: number;
}

export interface AIResponse {
  suggestions: StockSuggestion[];
  message: string;
}

export function useStockAI(stockItems: StockItem[]) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [suggestions, setSuggestions] = useState<StockSuggestion[]>([]);
  const [aiMessage, setAiMessage] = useState<string>('');

  const processVoiceInput = async (text: string): Promise<AIResponse | null> => {
    setIsProcessing(true);
    setSuggestions([]);
    setAiMessage('');

    try {
      const functionUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/process-stock-input`;
      console.log("Calling process-stock-input (voice):", functionUrl);

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY}`,
          'apikey': process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
        },
        body: JSON.stringify({
          type: 'voice',
          content: text,
          stockItems: stockItems.map((item) => ({
            id: item.id,
            name: item.name,
            unit: item.unit,
            category: item.category,
          })),
        })
      });

      if (!response.ok) {
        throw new Error(`Cloud Error: ${response.status}`);
      }

      const data = await response.json();

      if (data.error) {
        toast.error(data.error);
        return null;
      }

      setSuggestions(data.suggestions || []);
      setAiMessage(data.message || '');
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao processar entrada';
      toast.error(message);
      return null;
    } finally {
      setIsProcessing(false);
    }
  };

  const processImageInput = async (imageBase64: string): Promise<AIResponse | null> => {
    setIsProcessing(true);
    setSuggestions([]);
    setAiMessage('');

    try {
      const functionUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/process-stock-input`;
      console.log("Calling process-stock-input (image):", functionUrl);

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY}`,
          'apikey': process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
        },
        body: JSON.stringify({
          type: 'image',
          content: imageBase64,
          stockItems: stockItems.map((item) => ({
            id: item.id,
            name: item.name,
            unit: item.unit,
            category: item.category,
          })),
        })
      });

      if (!response.ok) {
        throw new Error(`Cloud Error: ${response.status}`);
      }

      const data = await response.json();

      if (data.error) {
        toast.error(data.error);
        return null;
      }

      setSuggestions(data.suggestions || []);
      setAiMessage(data.message || '');
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao processar imagem';
      toast.error(message);
      return null;
    } finally {
      setIsProcessing(false);
    }
  };

  const clearSuggestions = () => {
    setSuggestions([]);
    setAiMessage('');
  };

  return {
    isProcessing,
    suggestions,
    aiMessage,
    processVoiceInput,
    processImageInput,
    clearSuggestions,
  };
}
