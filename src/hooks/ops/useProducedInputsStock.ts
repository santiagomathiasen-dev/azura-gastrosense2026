import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '../shared/useAuth';
import { useOwnerId } from '../shared/useOwnerId';
import { toast } from 'sonner';
import { getNow } from '@/lib/utils';

export interface ProducedInputStock {
  id: string;
  user_id: string;
  technical_sheet_id: string;
  batch_code: string;
  quantity: number;
  unit: string;
  expiration_date: string | null;
  production_date: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProducedInputWithSheet extends ProducedInputStock {
  technical_sheet: {
    id: string;
    name: string;
    production_type: 'insumo' | 'final';
  } | null;
}

export function useProducedInputsStock() {
  const { user } = useAuth();
  const { ownerId, isLoading: isOwnerLoading } = useOwnerId();
  const queryClient = useQueryClient();

  const { data: producedInputs = [], isLoading } = useQuery({
    queryKey: ['produced_inputs_stock', ownerId],
    queryFn: async () => {
      if (!user?.id && !ownerId) return [];

      const { data, error } = await (supabase as any)
        .from('produced_inputs_stock')
        .select(`
          *,
          technical_sheet:technical_sheets(id, name, production_type)
        `)
        .order('production_date', { ascending: false });

      if (error) throw error;
      return data as ProducedInputWithSheet[];
    },
    enabled: (!!user?.id || !!ownerId) && !isOwnerLoading,
    staleTime: 30_000,
    gcTime: 5 * 60 * 1000,
  });

  const createProducedInput = useMutation({
    mutationFn: async (input: Omit<ProducedInputStock, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
      if (isOwnerLoading) throw new Error('Carregando dados do usuário...');
      if (!ownerId) throw new Error('Usuário não autenticado');

      const { data, error } = await (supabase as any)
        .from('produced_inputs_stock')
        .insert({ ...input, user_id: ownerId })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['produced_inputs_stock'] });
      toast.success('Insumo produzido adicionado ao estoque!');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao adicionar insumo: ${err.message}`);
    },
  });

  const updateProducedInput = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ProducedInputStock> & { id: string }) => {
      const { data, error } = await (supabase as any)
        .from('produced_inputs_stock')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['produced_inputs_stock'] });
      toast.success('Insumo produzido atualizado!');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao atualizar insumo: ${err.message}`);
    },
  });

  const deleteProducedInput = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('produced_inputs_stock')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['produced_inputs_stock'] });
      toast.success('Insumo produzido removido!');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao remover insumo: ${err.message}`);
    },
  });

  // Consume produced input (used when starting a final production)
  const consumeProducedInput = useMutation({
    mutationFn: async ({ id, quantityToConsume }: { id: string; quantityToConsume: number }) => {
      const input = producedInputs.find(i => i.id === id);
      if (!input) throw new Error('Insumo não encontrado');

      const newQuantity = Number(input.quantity) - quantityToConsume;

      if (newQuantity < 0) {
        throw new Error('Quantidade insuficiente');
      }

      if (newQuantity === 0) {
        // Delete if fully consumed
        const { error } = await (supabase as any)
          .from('produced_inputs_stock')
          .delete()
          .eq('id', id);
        if (error) throw error;
      } else {
        // Update remaining quantity
        const { error } = await (supabase as any)
          .from('produced_inputs_stock')
          .update({ quantity: newQuantity })
          .eq('id', id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['produced_inputs_stock'] });
    },
    onError: (err: Error) => {
      toast.error(`Erro ao consumir insumo: ${err.message}`);
    },
  });

  // Get available quantity of a specific produced input by technical sheet
  const getAvailableQuantity = (technicalSheetId: string): number => {
    return producedInputs
      .filter(i => i.technical_sheet_id === technicalSheetId)
      .reduce((sum, i) => sum + Number(i.quantity), 0);
  };

  // Generate batch code
  const generateBatchCode = (sheetName: string): string => {
    const date = getNow();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    const prefix = sheetName.substring(0, 3).toUpperCase();
    return `${prefix}-${dateStr}-${random}`;
  };

  return {
    producedInputs,
    isLoading,
    isOwnerLoading,
    createProducedInput,
    updateProducedInput,
    deleteProducedInput,
    consumeProducedInput,
    getAvailableQuantity,
    generateBatchCode,
  };
}
