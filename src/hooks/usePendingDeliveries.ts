import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useOwnerId } from './useOwnerId';
import { toast } from 'sonner';
import { getTodayStr } from '@/lib/utils';
import { supabaseFetch } from '@/lib/supabase-fetch';
import type { Database } from '@/integrations/supabase/types';

type PurchaseListItem = Database['public']['Tables']['purchase_list_items']['Row'];

export interface PendingDeliveryItem extends PurchaseListItem {
  stock_item: { name: string; unit: string; category: string } | null;
  supplier: { name: string } | null;
}

export function usePendingDeliveries() {
  const { user } = useAuth();
  const { ownerId } = useOwnerId();
  const queryClient = useQueryClient();

  // Query uses RLS - no need to filter by user_id client-side
  const { data: pendingItems = [], isLoading, error } = useQuery({
    queryKey: ['pending_deliveries', ownerId],
    queryFn: async () => {
      if (!user?.id && !ownerId) return [];
      const data = await supabaseFetch('purchase_list_items?status=eq.ordered&select=*,stock_item:stock_items(name,unit,category),supplier:suppliers(name)&order=order_date.desc');
      return (Array.isArray(data) ? data : data ? [data] : []) as unknown as PendingDeliveryItem[];
    },
    enabled: !!user?.id || !!ownerId,
    staleTime: 60_000,
    gcTime: 10 * 60 * 1000,
    refetchInterval: 30_000,
  });

  // Mark an item as "ordered" with quantity (from Compras page)
  const markAsOrdered = useMutation({
    mutationFn: async ({
      stockItemId,
      orderedQuantity,
      supplierId,
      suggestedQuantity,
      expectedDeliveryDate
    }: {
      stockItemId: string;
      orderedQuantity: number;
      supplierId?: string | null;
      suggestedQuantity: number;
      expectedDeliveryDate?: string;
    }) => {
      if (!ownerId) throw new Error('Usuário não autenticado');

      // Check for existing ordered item
      const existingData = await supabaseFetch(`purchase_list_items?stock_item_id=eq.${stockItemId}&status=eq.ordered&select=id`);
      const existing = Array.isArray(existingData) ? existingData[0] : existingData;

      if (existing) {
        // Update existing ordered item
        await supabaseFetch(`purchase_list_items?id=eq.${existing.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            ordered_quantity: orderedQuantity,
            order_date: getTodayStr(),
            expected_delivery_date: expectedDeliveryDate || null,
          })
        });
      } else {
        // Create new ordered item
        await supabaseFetch('purchase_list_items', {
          method: 'POST',
          body: JSON.stringify({
            user_id: ownerId,
            stock_item_id: stockItemId,
            suggested_quantity: suggestedQuantity,
            ordered_quantity: orderedQuantity,
            supplier_id: supplierId || null,
            status: 'ordered',
            order_date: getTodayStr(),
            expected_delivery_date: expectedDeliveryDate || null,
          })
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending_deliveries'] });
      queryClient.invalidateQueries({ queryKey: ['purchase_list_items'] });
      toast.success('Compra registrada! Aguardando entrada no estoque.');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao registrar compra: ${err.message}`);
    },
  });

  // Confirm delivery and add to stock (entry movement)
  const confirmDelivery = useMutation({
    mutationFn: async ({
      itemId,
      receivedQuantity,
      stockItemId
    }: {
      itemId: string;
      receivedQuantity: number;
      stockItemId: string;
    }) => {
      if (!ownerId) throw new Error('Usuário não autenticado');

      // 1. Create entry movement for stock
      await supabaseFetch('stock_movements', {
        method: 'POST',
        body: JSON.stringify({
          stock_item_id: stockItemId,
          user_id: ownerId,
          type: 'entry',
          quantity: receivedQuantity,
          source: 'manual',
          notes: 'Entrada de compra',
        })
      });

      // 2. Mark purchase item as delivered
      await supabaseFetch(`purchase_list_items?id=eq.${itemId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'delivered',
          actual_delivery_date: getTodayStr(),
        })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending_deliveries'] });
      queryClient.invalidateQueries({ queryKey: ['purchase_list_items'] });
      queryClient.invalidateQueries({ queryKey: ['stock_items'] });
      queryClient.invalidateQueries({ queryKey: ['stock_movements'] });
      toast.success('Entrada no estoque registrada!');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao confirmar entrada: ${err.message}`);
    },
  });

  // Cancel pending order
  const cancelOrder = useMutation({
    mutationFn: async (itemId: string) => {
      await supabaseFetch(`purchase_list_items?id=eq.${itemId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'cancelled' })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending_deliveries'] });
      queryClient.invalidateQueries({ queryKey: ['purchase_list_items'] });
      toast.success('Pedido cancelado.');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao cancelar: ${err.message}`);
    },
  });

  return {
    pendingItems,
    isLoading,
    error,
    markAsOrdered,
    confirmDelivery,
    cancelOrder,
  };
}
