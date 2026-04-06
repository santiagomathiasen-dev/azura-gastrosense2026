import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import { useOwnerId } from './useOwnerId';
import { toast } from 'sonner';
import { supabaseFetch } from '@/lib/supabase-fetch';
import { useDriveData } from '@/contexts/DriveDataContext';

export interface Loss {
  id: string;
  user_id: string;
  source_type: string;
  source_id: string;
  source_name: string;
  quantity: number;
  unit: string;
  estimated_value: number | null;
  notes: string | null;
  created_at: string;
}

export interface LossInput {
  source_type: string;
  source_id: string;
  source_name: string;
  quantity: number;
  unit: string;
  estimated_value?: number;
  notes?: string;
}

export function useLosses() {
  const { user } = useAuth();
  const { ownerId } = useOwnerId();
  const queryClient = useQueryClient();
  const { isDriveConnected, data: driveData } = useDriveData();

  const { data: losses = [], isLoading } = useQuery({
    queryKey: ['losses', ownerId, isDriveConnected ? 'drive' : 'supabase'],
    queryFn: async () => {
      if (!user?.id && !ownerId) return [];

      // Drive mode
      if (isDriveConnected && driveData?.losses?.losses) {
        return driveData.losses.losses as Loss[];
      }

      // Supabase fallback
      try {
        const data = await supabaseFetch('losses?order=created_at.desc');
        return (Array.isArray(data) ? data : data ? [data] : []) as Loss[];
      } catch (err) {
        console.error("Error fetching losses:", err);
        throw err;
      }
    },
    enabled: !!user?.id || !!ownerId,
    staleTime: 60_000,
    gcTime: 10 * 60 * 1000,
    refetchInterval: isDriveConnected ? false : 120_000,
  });

  const createLoss = useMutation({
    mutationFn: async (input: LossInput & { deductStock?: boolean }) => {
      if (!ownerId) throw new Error('Usuário não autenticado');

      // 1. Register the loss in the unified losses table
      const lossData = await supabaseFetch('losses', {
        method: 'POST',
        headers: { 'Prefer': 'return=representation' },
        body: JSON.stringify({
          user_id: ownerId,
          source_type: input.source_type,
          source_id: input.source_id,
          source_name: input.source_name,
          quantity: input.quantity,
          unit: input.unit,
          estimated_value: input.estimated_value || 0,
          notes: input.notes || null,
        })
      });
      const loss = Array.isArray(lossData) ? lossData[0] : lossData;

      // 2. If flag is set, deduct from stock and record movement
      if (input.deductStock) {
        if (input.source_type === 'stock_item') {
          // A. Fetch current stock item to get current qty
          const itemData = await supabaseFetch(`stock_items?id=eq.${input.source_id}&select=current_quantity`);
          const item = Array.isArray(itemData) ? itemData[0] : itemData;

          if (item) {
            const newQty = Math.max(0, Number(item.current_quantity) - input.quantity);

            // B. Update stock_item quantity
            await supabaseFetch(`stock_items?id=eq.${input.source_id}`, {
              method: 'PATCH',
              body: JSON.stringify({ current_quantity: newQty })
            });

            // C. Register stock movement for audit
            await supabaseFetch('stock_movements', {
              method: 'POST',
              body: JSON.stringify({
                user_id: ownerId,
                stock_item_id: input.source_id,
                quantity: input.quantity,
                type: 'exit',
                source: 'manual',
                notes: `Perda registrada: ${input.notes || 'Sem observação'}`,
              })
            });
          }
        } else if (input.source_type === 'finished_production') {
          // Fetch current stock
          const stockData = await supabaseFetch(`finished_productions_stock?id=eq.${input.source_id}&select=quantity`);
          const stock = Array.isArray(stockData) ? stockData[0] : stockData;

          if (stock) {
            const newQty = Math.max(0, Number(stock.quantity) - input.quantity);
            await supabaseFetch(`finished_productions_stock?id=eq.${input.source_id}`, {
              method: 'PATCH',
              body: JSON.stringify({ quantity: newQty })
            });
          }
        }
      }

      return loss;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['losses'] });
      queryClient.invalidateQueries({ queryKey: ['stock_items'] });
      queryClient.invalidateQueries({ queryKey: ['finished_productions_stock'] });
      queryClient.invalidateQueries({ queryKey: ['stock_movements'] });
      toast.success('Perda registrada com sucesso!');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao registrar perda: ${err.message}`);
    },
  });

  const deleteLoss = useMutation({
    mutationFn: async (id: string) => {
      await supabaseFetch(`losses?id=eq.${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['losses'] });
      toast.success('Perda removida!');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao remover perda: ${err.message}`);
    },
  });

  return { losses, isLoading, createLoss, deleteLoss };
}
