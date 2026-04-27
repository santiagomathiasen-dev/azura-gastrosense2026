import { useState, useRef, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { StockItem } from './useStockItems';
import { addDays, format, isValid } from 'date-fns';
import { getNow } from '@/lib/utils';
import { AIApi } from '@/api/AIApi';

// Speech Recognition types
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  }
}

export interface PendingVoiceUpdate {
  itemId: string;
  itemName: string;
  quantity?: number;
  expirationDate?: string;
  unit?: string;
}

interface UseStockVoiceControlProps {
  stockItems: StockItem[];
  onQuantityUpdate: (itemId: string, quantity: number) => void;
  onExpiryUpdate?: (itemId: string, expirationDate: string) => void;
}

const VOICE_TIMEOUT_MS = 300000; // 5 minutes max per user request

export function useStockVoiceControl({ stockItems, onQuantityUpdate, onExpiryUpdate }: UseStockVoiceControlProps) {
  const [isListening, setIsListening] = useState(false);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState('');
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingVoiceUpdate | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const timeoutRef = useRef<any>(null);

  const isSupported = typeof window !== 'undefined' &&
    !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  const clearVoiceTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const resetVoiceTimeout = useCallback(() => {
    clearVoiceTimeout();
    timeoutRef.current = setTimeout(() => {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) { }
      }
      setIsListening(false);
    }, VOICE_TIMEOUT_MS);
  }, [clearVoiceTimeout]);

  // Parse quantity from voice input
  const parseQuantity = useCallback((text: string): number | null => {
    // Clean the text
    const cleanText = text.toLowerCase().trim();

    // Try to find numbers (including decimals with comma or dot)
    const numberMatch = cleanText.match(/(\d+[,.]?\d*)/);
    if (numberMatch) {
      return parseFloat(numberMatch[1].replace(',', '.'));
    }

    // Word to number mapping (Portuguese)
    const wordToNumber: Record<string, number> = {
      'zero': 0, 'um': 1, 'uma': 1, 'dois': 2, 'duas': 2, 'três': 3, 'tres': 3,
      'quatro': 4, 'cinco': 5, 'seis': 6, 'sete': 7, 'oito': 8, 'nove': 9,
      'dez': 10, 'onze': 11, 'doze': 12, 'treze': 13, 'quatorze': 14, 'catorze': 14,
      'quinze': 15, 'dezesseis': 16, 'dezessete': 17, 'dezoito': 18, 'dezenove': 19,
      'vinte': 20, 'trinta': 30, 'quarenta': 40, 'cinquenta': 50,
      'sessenta': 60, 'setenta': 70, 'oitenta': 80, 'noventa': 90,
      'cem': 100, 'cento': 100, 'duzentos': 200, 'trezentos': 300,
      'meio': 0.5, 'meia': 0.5,
    };

    // Check for word numbers
    for (const [word, num] of Object.entries(wordToNumber)) {
      if (cleanText.includes(word)) {
        return num;
      }
    }

    return null;
  }, []);

  // Parse date from voice input
  const parseDate = useCallback((text: string): Date | null => {
    const cleanText = text.toLowerCase().trim();
    const now = getNow();

    // Handles keywords
    if (cleanText.includes('amanhã') || cleanText.includes('amanha')) return addDays(now, 1);
    if (cleanText.includes('hoje')) return now;
    if (cleanText.includes('ontem')) return addDays(now, -1);

    // Month mapping
    const months: Record<string, number> = {
      'janeiro': 0, 'fevereiro': 1, 'março': 2, 'marco': 2, 'abril': 3, 'maio': 4,
      'junho': 5, 'julho': 6, 'agosto': 7, 'setembro': 8, 'outubro': 9, 'novembro': 10, 'dezembro': 11
    };

    // Try format: [dia] de [mês]
    const dateMatch = cleanText.match(/(\d+)\s+de\s+([a-zç]+)/);
    if (dateMatch) {
      const day = parseInt(dateMatch[1]);
      const monthName = dateMatch[2];
      const month = months[monthName];

      if (month !== undefined && day >= 1 && day <= 31) {
        let year = now.getFullYear();
        let targetDate = new Date(year, month, day);

        // If date already passed this year, assume next year
        if (targetDate < now) {
          targetDate.setFullYear(year + 1);
        }
        return targetDate;
      }
    }

    // Try format: dd/mm/aaaa or dd/mm
    const slashMatch = cleanText.match(/(\d{1,2})\/(\d{1,2})(\/(\d{2,4}))?/);
    if (slashMatch) {
      const day = parseInt(slashMatch[1]);
      const month = parseInt(slashMatch[2]) - 1;
      let year = slashMatch[4] ? parseInt(slashMatch[4]) : now.getFullYear();
      if (slashMatch[4] && slashMatch[4].length === 2) year += 2000;

      const targetDate = new Date(year, month, day);
      if (isValid(targetDate)) return targetDate;
    }

    return null;
  }, []);

  // Parse unit from voice input
  const parseUnit = useCallback((text: string): string | null => {
    const cleanText = text.toLowerCase().trim();

    // Unit mapping (Portuguese words to stock_unit values)
    const unitMappings: Record<string, string> = {
      'quilo': 'kg', 'quilos': 'kg', 'kg': 'kg', 'kilo': 'kg', 'kilos': 'kg',
      'grama': 'g', 'gramas': 'g', 'g': 'g',
      'litro': 'L', 'litros': 'L', 'l': 'L',
      'mililitro': 'ml', 'mililitros': 'ml', 'ml': 'ml',
      'unidade': 'unidade', 'unidades': 'unidade', 'un': 'unidade',
      'caixa': 'caixa', 'caixas': 'caixa',
      'dúzia': 'dz', 'duzia': 'dz', 'duzias': 'dz', 'dz': 'dz',
    };

    for (const [word, unit] of Object.entries(unitMappings)) {
      if (cleanText.includes(word)) {
        return unit;
      }
    }

    return null;
  }, []);

  // Find item by name in voice input
  const findItemByVoice = useCallback((text: string): StockItem | null => {
    const cleanText = text.toLowerCase().trim().replace(/s$/, ''); // Basic singularization

    // Try exact match first
    const exactMatch = stockItems.find(item => {
      const itemName = item.name.toLowerCase().trim();
      return cleanText === itemName || cleanText.includes(itemName) || itemName.includes(cleanText);
    });
    if (exactMatch) return exactMatch;

    // Try partial match with words
    for (const item of stockItems) {
      const itemWords = item.name.toLowerCase().split(' ').filter(w => w.length > 2);
      for (const word of itemWords) {
        if (cleanText.includes(word)) {
          return item;
        }
      }
    }

    return null;
  }, [stockItems]);

  // Initialize speech recognition once
  useEffect(() => {
    if (!isSupported) return;

    const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionClass) return;

    const recognition = new SpeechRecognitionClass();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'pt-BR';

    recognitionRef.current = recognition;

    return () => {
      clearVoiceTimeout();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.onresult = null;
          recognitionRef.current.onerror = null;
          recognitionRef.current.onend = null;
          recognitionRef.current.abort();
        } catch (e) {
          console.warn("Error cleaning up speech recognition:", e);
        }
      }
    };
  }, [isSupported, clearVoiceTimeout]);

  const startListening = useCallback((itemId?: string) => {
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.abort();
    } catch (e) { }

    setTranscript('');
    setActiveItemId(itemId || null);

    try {
      recognitionRef.current.start();
      setIsListening(true);
      resetVoiceTimeout(); // Start 30s timeout
      if (itemId) {
        const item = stockItems.find(i => i.id === itemId);
        toast.info(item ? `Ouvindo para ${item.name}... (30s)` : 'Ouvindo... (30s)');
      } else {
        toast.info('Ouvindo... Diga ingrediente e quantidade/validade. (30s)');
      }
    } catch (error) {
      setIsListening(false);
    }
  }, [stockItems, resetVoiceTimeout]);

  const stopListening = useCallback((cancel = false) => {
    clearVoiceTimeout();
    if (recognitionRef.current) {
      try {
        if (cancel) {
          recognitionRef.current.abort();
        } else {
          recognitionRef.current.stop();
        }
      } catch (e) { }
    }
    setIsListening(false);
    // Don't clear transcripts here if we just stopped to process
  }, [clearVoiceTimeout]);

  // Setup event handlers separately to avoid recreating recognition
  useEffect(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;

    recognition.onresult = async (event: SpeechRecognitionEvent) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const resultTranscript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += resultTranscript;
        } else {
          interimTranscript += resultTranscript;
        }
      }

      // Reset timeout on every speech event
      resetVoiceTimeout();
      setTranscript(finalTranscript || interimTranscript);

      if (event.results[event.results.length - 1].isFinal && finalTranscript.trim()) {
        const cleanFinal = finalTranscript.toLowerCase().trim();
        const currentActiveItemId = activeItemId;

        // Stop listening to process with AI
        stopListening();
        toast.info('Processando áudio com IA...');

        try {
          const now = new Date();
          const cleanFinal = finalTranscript.toLowerCase().trim();

          // Optimized prompt - more concise
          const systemPrompt = `Hoje: ${now.toLocaleDateString('pt-BR')}.
Extraia item, qte (decimal) e validade (YYYY-MM-DD ou null).
Retorne JSON: {"ingredients": [{"name": string, "quantity": number, "expiration_date": string | null}]}`;

          const data = await AIApi.processVoiceText(cleanFinal, systemPrompt);

          if (data && data.error) {
            console.error('Voice process logic error:', data.error);
            throw new Error(`Erro na IA: ${data.error}`);
          }

          if (!data || !data.ingredients || data.ingredients.length === 0) {
            console.error('Voice process returned no ingredients. Data:', data);
            throw new Error('Não consegui entender o comando ou extrair ingredientes.');
          }

          const extracted = data.ingredients && data.ingredients.length > 0
            ? data.ingredients[0]
            : (Array.isArray(data) && data.length > 0 ? data[0] : null);

          if (!extracted) {
            console.error('No extracted data found in:', data);
            throw new Error('Não consegui extrair informações do áudio.');
          }

          // Match extracted item with stockItems
          const item = currentActiveItemId
            ? stockItems.find(i => i.id === currentActiveItemId)
            : findItemByVoice(extracted.name);

          if (item) {
            const pending: PendingVoiceUpdate = {
              itemId: item.id,
              itemName: item.name,
              quantity: extracted.quantity ?? undefined,
              expirationDate: extracted.expiration_date ?? undefined,
              unit: item.unit
            };
            setPendingConfirmation(pending);
          } else {
            console.warn("Item not found for name:", extracted.name);
            toast.error(`Não encontrei o item "${extracted.name}"`);
          }
        } catch (err) {
          console.error('Erro no processamento de voz AI:', err);
          toast.error('Erro ao processar áudio. Tente novamente.');
        } finally {
          setActiveItemId(null);
          setTranscript('');
        }
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error);
      clearVoiceTimeout();
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        setIsListening(false);
        setActiveItemId(null);
      }
    };

    recognition.onend = () => {
      clearVoiceTimeout();
      setIsListening(false);
    };
  }, [activeItemId, parseQuantity, parseDate, parseUnit, findItemByVoice, stockItems, onQuantityUpdate, onExpiryUpdate, resetVoiceTimeout, clearVoiceTimeout, stopListening]);

  const toggleListening = useCallback((itemId?: string) => {
    if (isListening) {
      stopListening();
    } else {
      startListening(itemId);
    }
  }, [isListening, startListening, stopListening]);

  const confirmUpdate = useCallback(() => {
    if (pendingConfirmation) {
      if (pendingConfirmation.quantity !== undefined) {
        onQuantityUpdate(pendingConfirmation.itemId, pendingConfirmation.quantity);
      }
      if (pendingConfirmation.expirationDate && onExpiryUpdate) {
        onExpiryUpdate(pendingConfirmation.itemId, pendingConfirmation.expirationDate);
      }
      toast.success(`${pendingConfirmation.itemName} atualizado!`);
      setPendingConfirmation(null);
    }
  }, [pendingConfirmation, onQuantityUpdate, onExpiryUpdate]);

  const cancelUpdate = useCallback(() => {
    setPendingConfirmation(null);
  }, []);

  return {
    isSupported,
    isListening,
    activeItemId,
    transcript,
    pendingConfirmation,
    toggleListening,
    startListening,
    stopListening,
    confirmUpdate,
    cancelUpdate
  };
}
