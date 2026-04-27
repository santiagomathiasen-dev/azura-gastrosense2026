import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '../shared/useAuth';
import { useOwnerId } from '../shared/useOwnerId';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';
import { supabaseFetch } from '@/lib/supabase-fetch';

type StockMovement = Database['public']['Tables']['stock_movements']['Row'];
type StockMovementInsert = Database['public']['Tables']['stock_movements']['Insert'];
type MovementType = Database['public']['Enums']['movement_type'];
type MovementSource = Database['public']['Enums']['movement_source'];

export type { StockMovement, StockMovementInsert, MovementType, MovementSource };

export const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  entry: 'Entrada',
  exit: 'Saída',
  adjustment: 'Ajuste',
};

export const MOVEMENT_SOURCE_LABELS: Record<MovementSource, string> = {
  manual: 'Manual',
  production: 'Produção',
  audio: 'Áudio',
  image: 'Imagem',
};

export function useStockMovements(stockItemId?: string) {
  const { user } = useAuth();
  const { ownerId, isLoading: isOwnerLoading } = useOwnerId();
  const queryClient = useQueryClient();

  // Query uses RLS - no need to filter by user_id client-side
  const { data: movements = [], isLoading, error } = useQuery({
    queryKey: ['stock_movements', stockItemId, ownerId],
    queryFn: async () => {
      if (!user?.id && !ownerId) return [];
      let query = supabase
        .from('stock_movements')
        .select('*')
        .order('created_at', { ascending: false });

      if (stockItemId) {
        query = query.eq('stock_item_id', stockItemId);
      }

      const { data, error } = await query.limit(100);
      if (error) throw error;
      return data as StockMovement[];
    },
    enabled: (!!user?.id || !!ownerId) && !isOwnerLoading,
    staleTime: 30_000,
    gcTime: 5 * 60 * 1000,
  });

  const createMovement = useMutation({
    mutationFn: async (params: {
      movement: Omit<StockMovementInsert, 'user_id'>;
      deductions?: { id: string; quantity: number }[];
    }) => {
      const { movement, deductions } = params;
      if (isOwnerLoading) throw new Error('Carregando dados do usuário...');
      if (!ownerId) throw new Error('Usuário não autenticado');

      // 1. Create the movement
      let movementData: any;
      try {
        movementData = await supabaseFetch('stock_movements', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify({ ...movement, user_id: ownerId })
        });
        if (Array.isArray(movementData)) movementData = movementData[0];
      } catch (err: any) {
        console.error("Error creating movement:", err);
        throw err;
      }

      // 2. Process deductions or adjustments to sync batches
      if (movement.type === 'exit' && deductions && deductions.length > 0) {
        for (const deduction of deductions) {
          try {
            const batch = await supabaseFetch(`item_expiry_dates?id=eq.${deduction.id}`);
            const batchData = Array.isArray(batch) ? batch[0] : batch;

            if (batchData) {
              const currentQty = Number(batchData.quantity);
              const newQty = Math.max(0, currentQty - deduction.quantity);

              await supabaseFetch(`item_expiry_dates?id=eq.${deduction.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ quantity: newQty })
              });
            }
          } catch (err) {
            console.error("Error updating batch qty:", err);
          }
        }
      } else if (movement.type === 'adjustment' && movement.quantity === 0) {
        // If adjusted to zero, clear ALL batches for this item
        try {
          await supabaseFetch(`item_expiry_dates?stock_item_id=eq.${movement.stock_item_id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ quantity: 0 })
          });

          // ALSO clear the legacy expiration_date in stock_items to prevent phantom alerts
          await supabaseFetch(`stock_items?id=eq.${movement.stock_item_id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ expiration_date: null })
          });
        } catch (err) {
          console.error("Error clearing batches/expiry info:", err);
        }
      }

      return movementData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock_movements'] });
      queryClient.invalidateQueries({ queryKey: ['stock_items'] });
      queryClient.invalidateQueries({ queryKey: ['expiry-dates'] });
      queryClient.invalidateQueries({ queryKey: ['expiry-dates-all'] });
      queryClient.invalidateQueries({ queryKey: ['expiry-dates-all-map'] });
      toast.success('Movimentação registrada com sucesso!');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao registrar movimentação: ${err.message}`);
    },
  });

  return {
    movements,
    isLoading,
    isOwnerLoading,
    error,
    createMovement,
  };
}
