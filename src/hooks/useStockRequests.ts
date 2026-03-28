import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useOwnerId } from './useOwnerId';
import { toast } from 'sonner';
import type { StockItem } from './useStockItems';
import { supabaseFetch } from '@/lib/supabase-fetch';

export interface StockRequest {
  id: string;
  user_id: string;
  stock_item_id: string;
  requested_quantity: number;
  delivered_quantity: number;
  status: 'pending' | 'partial' | 'completed' | 'cancelled';
  notes: string | null;
  created_at: string;
  updated_at: string;
  stock_item?: StockItem;
}

export function useStockRequests() {
  const { user } = useAuth();
  const { ownerId, isLoading: isOwnerLoading } = useOwnerId();
  const queryClient = useQueryClient();

  // Query uses RLS - no need to filter by user_id client-side
  const { data: requests = [], isLoading, error } = useQuery({
    queryKey: ['stock_requests', ownerId],
    queryFn: async () => {
      if (!user?.id && !ownerId) return [];
      try {
        const data = await supabaseFetch('stock_requests?select=*,stock_item:stock_items(*)&order=created_at.desc');
        return (Array.isArray(data) ? data : data ? [data] : []) as (StockRequest & { stock_item: StockItem })[];
      } catch (err) {
        console.error("Error fetching stock requests:", err);
        throw err;
      }
    },
    enabled: (!!user?.id || !!ownerId) && !isOwnerLoading,
    staleTime: 60_000,
    gcTime: 10 * 60 * 1000,
  });

  // Get pending requests only
  const pendingRequests = requests.filter(r => r.status === 'pending' || r.status === 'partial');

  // Create a new stock request (and add to purchase list if stock insufficient)
  const createRequest = useMutation({
    mutationFn: async ({ stockItemId, quantity, notes }: { stockItemId: string; quantity: number; notes?: string }) => {
      if (isOwnerLoading) throw new Error('Carregando dados do usuário...');
      if (!ownerId) throw new Error('Usuário não autenticado');

      // Check central stock availability
      const itemData = await supabaseFetch(`stock_items?id=eq.${stockItemId}&select=current_quantity,minimum_quantity,supplier_id`);
      const centralItem = Array.isArray(itemData) ? itemData[0] : itemData;

      const currentQty = Number(centralItem?.current_quantity || 0);
      const shortfall = quantity - currentQty;

      // Create the stock request
      await supabaseFetch('stock_requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: ownerId,
          stock_item_id: stockItemId,
          requested_quantity: quantity,
          notes,
        })
      });

      // If stock is insufficient, add shortfall to purchase list
      if (shortfall > 0) {
        // Check if item is already in purchase list (pending or ordered)
        const existingData = await supabaseFetch(`purchase_list_items?stock_item_id=eq.${stockItemId}&status=in.(pending,ordered)&select=id,suggested_quantity`);
        const existingPurchase = Array.isArray(existingData) ? existingData[0] : existingData;

        if (existingPurchase) {
          // Update existing purchase item to increase quantity
          await supabaseFetch(`purchase_list_items?id=eq.${existingPurchase.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              suggested_quantity: Number(existingPurchase.suggested_quantity) + shortfall
            })
          });
        } else {
          // Create new purchase list item
          await supabaseFetch('purchase_list_items', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              user_id: ownerId,
              stock_item_id: stockItemId,
              suggested_quantity: shortfall,
              supplier_id: centralItem?.supplier_id || null,
              status: 'pending',
            })
          });
        }

        return { addedToPurchaseList: true, shortfall };
      }

      return { addedToPurchaseList: false, shortfall: 0 };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['stock_requests'] });
      queryClient.invalidateQueries({ queryKey: ['purchase_list_items'] });
      if (result?.addedToPurchaseList) {
        toast.success(`Solicitação criada! ${result.shortfall.toFixed(1)} adicionado à lista de compras (estoque insuficiente).`);
      } else {
        toast.success('Solicitação criada com sucesso!');
      }
    },
    onError: (err: Error) => {
      toast.error(`Erro ao criar solicitação: ${err.message}`);
    },
  });

  // Fulfill a request (deliver items from central to production)
  const fulfillRequest = useMutation({
    mutationFn: async ({ requestId, deliverQuantity }: { requestId: string; deliverQuantity: number }) => {
      if (isOwnerLoading) throw new Error('Carregando dados do usuário...');
      if (!ownerId) throw new Error('Usuário não autenticado');

      // Get the request
      const requestData = await supabaseFetch(`stock_requests?id=eq.${requestId}&select=*`);
      const request = Array.isArray(requestData) ? requestData[0] : requestData;
      if (!request) throw new Error('Solicitação não encontrada');

      // Check if central stock has enough
      const itemData = await supabaseFetch(`stock_items?id=eq.${request.stock_item_id}&select=current_quantity`);
      const centralItem = Array.isArray(itemData) ? itemData[0] : itemData;
      if (!centralItem || Number(centralItem.current_quantity) < deliverQuantity) {
        throw new Error('Quantidade insuficiente no estoque central');
      }

      // 1. Create exit movement from central stock
      await supabaseFetch('stock_movements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stock_item_id: request.stock_item_id,
          user_id: ownerId,
          type: 'exit',
          quantity: deliverQuantity,
          source: 'manual',
          notes: `Entrega de solicitação #${requestId.slice(0, 8)}`,
        })
      });

      // 2. Add to production stock (upsert)
      const prodStockData = await supabaseFetch(`production_stock?stock_item_id=eq.${request.stock_item_id}&select=id,quantity`);
      const existingProdStock = Array.isArray(prodStockData) ? prodStockData[0] : prodStockData;

      if (existingProdStock) {
        await supabaseFetch(`production_stock?id=eq.${existingProdStock.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ quantity: Number(existingProdStock.quantity) + deliverQuantity })
        });
      } else {
        await supabaseFetch('production_stock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: ownerId,
            stock_item_id: request.stock_item_id,
            quantity: deliverQuantity,
          })
        });
      }

      // 3. Record transfer
      await supabaseFetch('stock_transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: ownerId,
          stock_item_id: request.stock_item_id,
          quantity: deliverQuantity,
          direction: 'to_production',
          notes: `Entrega de solicitação #${requestId.slice(0, 8)}`,
        })
      });

      // 4. Update request status
      const newDeliveredQty = Number(request.delivered_quantity) + deliverQuantity;
      const requestedQty = Number(request.requested_quantity);
      const newStatus = newDeliveredQty >= requestedQty ? 'completed' : 'partial';

      await supabaseFetch(`stock_requests?id=eq.${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          delivered_quantity: newDeliveredQty,
          status: newStatus,
        })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock_requests'] });
      queryClient.invalidateQueries({ queryKey: ['stock_items'] });
      queryClient.invalidateQueries({ queryKey: ['production_stock'] });
      queryClient.invalidateQueries({ queryKey: ['stock_transfers'] });
      toast.success('Solicitação atendida com sucesso!');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao atender solicitação: ${err.message}`);
    },
  });

  // Cancel a request
  const cancelRequest = useMutation({
    mutationFn: async (requestId: string) => {
      if (isOwnerLoading) throw new Error('Carregando dados do usuário...');
      if (!ownerId) throw new Error('Usuário não autenticado');

      await supabaseFetch(`stock_requests?id=eq.${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock_requests'] });
      toast.success('Solicitação cancelada');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao cancelar: ${err.message}`);
    },
  });

  return {
    requests,
    pendingRequests,
    isLoading,
    isOwnerLoading,
    error,
    createRequest,
    fulfillRequest,
    cancelRequest,
  };
}
