import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useOwnerId } from './useOwnerId';
import { toast } from 'sonner';
import type { StockItem } from './useStockItems';
import { supabaseFetch } from '@/lib/supabase-fetch';

import { ProductionService } from '../modules/production/services/ProductionService';
import type { ProductionStockItem, StockTransfer } from '../modules/production/types';

export type { ProductionStockItem, StockTransfer };

export function useProductionStock() {
  const { user } = useAuth();
  const { ownerId, isLoading: isOwnerLoading } = useOwnerId();
  const queryClient = useQueryClient();

  // Query uses RLS - no need to filter by user_id client-side
  const { data: productionStock = [], isLoading, error } = useQuery({
    queryKey: ['production_stock', ownerId],
    queryFn: async () => {
      if (!user?.id && !ownerId) return [];
      try {
        const data = await supabaseFetch('production_stock?select=*,stock_item:stock_items(*)');
        const result = Array.isArray(data) ? data : data ? [data] : [];
        return result as (ProductionStockItem & { stock_item: StockItem })[];
      } catch (err) {
        console.error("Error fetching production stock:", err);
        throw err;
      }
    },
    enabled: (!!user?.id || !!ownerId) && !isOwnerLoading,
    staleTime: 30_000,
    gcTime: 5 * 60 * 1000,
  });

  // Fetch transfer history
  const { data: transfers = [] } = useQuery({
    queryKey: ['stock_transfers', ownerId],
    queryFn: async () => {
      if (!user?.id && !ownerId) return [];
      try {
        const data = await supabaseFetch('stock_transfers?select=*,stock_item:stock_items(name,unit)&order=created_at.desc&limit=50');
        const result = Array.isArray(data) ? data : data ? [data] : [];
        return result as (StockTransfer & { stock_item: { name: string; unit: string } })[];
      } catch (err) {
        console.error("Error fetching transfers:", err);
        throw err;
      }
    },
    enabled: (!!user?.id || !!ownerId) && !isOwnerLoading,
    staleTime: 30_000,
    gcTime: 5 * 60 * 1000,
  });

  // Transfer from central to production stock
  const transferToProduction = useMutation({
    mutationFn: async ({ stockItemId, quantity, notes }: { stockItemId: string; quantity: number; notes?: string }) => {
      if (isOwnerLoading) throw new Error('Carregando dados do usuário...');
      if (!ownerId) throw new Error('Usuário não autenticado');

      // 1. Subtract from central stock (create exit movement via supabaseFetch)
      await supabaseFetch('stock_movements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stock_item_id: stockItemId,
          user_id: ownerId,
          type: 'exit',
          quantity,
          source: 'manual',
          notes: notes || 'Transferência para estoque de produção',
        })
      });

      // 1b. Deduct from expiry batches (FIFO)
      const batchesData = await supabaseFetch(`item_expiry_dates?stock_item_id=eq.${stockItemId}&quantity=gt.0&order=expiry_date.asc`);
      const batches = Array.isArray(batchesData) ? batchesData : [];

      if (batches.length > 0) {
        let remaining = quantity;
        for (const batch of batches) {
          if (remaining <= 0) break;
          const take = Math.min(remaining, Number(batch.quantity));
          const newQty = Number(batch.quantity) - take;

          await supabaseFetch(`item_expiry_dates?id=eq.${batch.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ quantity: newQty })
          });

          remaining -= take;
        }

        // IMPORTANT: If stock reaches 0 (or was already 0), ensure both batch and legacy fields are cleared
        const itemResult = await supabaseFetch(`stock_items?id=eq.${stockItemId}&select=current_quantity`);
        const currentItem = Array.isArray(itemResult) ? itemResult[0] : itemResult;

        if (currentItem && Number(currentItem.current_quantity) <= 0) {
          await supabaseFetch(`item_expiry_dates?stock_item_id=eq.${stockItemId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ quantity: 0 })
          });

          await supabaseFetch(`stock_items?id=eq.${stockItemId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ expiration_date: null })
          });
        }
      }

      // 2. Add to production stock (upsert via supabaseFetch)
      const existingData = await supabaseFetch(`production_stock?stock_item_id=eq.${stockItemId}&select=id,quantity`);
      const existing = Array.isArray(existingData) ? existingData[0] : existingData;

      if (existing) {
        await supabaseFetch(`production_stock?id=eq.${existing.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ quantity: Number(existing.quantity) + quantity })
        });
      } else {
        await supabaseFetch('production_stock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: ownerId,
            stock_item_id: stockItemId,
            quantity,
          })
        });
      }

      // 3. Record transfer
      await supabaseFetch('stock_transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: ownerId,
          stock_item_id: stockItemId,
          quantity,
          direction: 'to_production',
          notes,
        })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production_stock'] });
      queryClient.invalidateQueries({ queryKey: ['stock_items'] });
      queryClient.invalidateQueries({ queryKey: ['stock_transfers'] });
      toast.success('Transferido para estoque de produção!');
    },
    onError: (err: Error) => {
      toast.error(`Erro na transferência: ${err.message}`);
    },
  });

  // Transfer from production back to central stock
  const transferToCentral = useMutation({
    mutationFn: async ({ stockItemId, quantity, notes }: { stockItemId: string; quantity: number; notes?: string }) => {
      if (isOwnerLoading) throw new Error('Carregando dados do usuário...');
      if (!ownerId) throw new Error('Usuário não autenticado');

      // 1. Check if we have enough in production stock
      const prodStockData = await supabaseFetch(`production_stock?stock_item_id=eq.${stockItemId}&select=id,quantity`);
      const prodStock = Array.isArray(prodStockData) ? prodStockData[0] : prodStockData;

      if (!prodStock || Number(prodStock.quantity) < quantity) {
        throw new Error('Quantidade insuficiente no estoque de produção');
      }

      // 2. Subtract from production stock
      const newQty = Number(prodStock.quantity) - quantity;
      if (newQty === 0) {
        await supabaseFetch(`production_stock?id=eq.${prodStock.id}`, { method: 'DELETE' });
      } else {
        await supabaseFetch(`production_stock?id=eq.${prodStock.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ quantity: newQty })
        });
      }

      // 3. Add to central stock (create entry movement)
      await supabaseFetch('stock_movements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stock_item_id: stockItemId,
          user_id: ownerId,
          type: 'entry',
          quantity,
          source: 'manual',
          notes: notes || 'Devolução do estoque de produção',
        })
      });

      // 4. Record transfer
      await supabaseFetch('stock_transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: ownerId,
          stock_item_id: stockItemId,
          quantity,
          direction: 'to_central',
          notes,
        })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production_stock'] });
      queryClient.invalidateQueries({ queryKey: ['stock_items'] });
      queryClient.invalidateQueries({ queryKey: ['stock_transfers'] });
      toast.success('Devolvido para estoque central!');
    },
    onError: (err: Error) => {
      toast.error(`Erro na devolução: ${err.message}`);
    },
  });

  // Use production stock for production (subtract quantity)
  const useFromProductionStock = useMutation({
    mutationFn: async ({ stockItemId, quantity }: { stockItemId: string; quantity: number }) => {
      if (isOwnerLoading) throw new Error('Carregando dados do usuário...');
      if (!ownerId) throw new Error('Usuário não autenticado');

      const prodStockData = await supabaseFetch(`production_stock?stock_item_id=eq.${stockItemId}&select=id,quantity`);
      const prodStock = Array.isArray(prodStockData) ? prodStockData[0] : prodStockData;

      if (!prodStock) return 0; // Return 0 if item not in production stock

      const available = Number(prodStock.quantity);
      const toUse = Math.min(available, quantity);
      const newQty = available - toUse;

      if (newQty === 0) {
        await supabaseFetch(`production_stock?id=eq.${prodStock.id}`, { method: 'DELETE' });
      } else {
        await supabaseFetch(`production_stock?id=eq.${prodStock.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ quantity: newQty })
        });
      }

      return toUse;
    },
  });

  // Get quantity available in production stock for a specific item
  const getProductionStockQuantity = (stockItemId: string): number => {
    const item = productionStock.find(ps => ps.stock_item_id === stockItemId);
    return item ? Number(item.quantity) : 0;
  };

  // Update production stock quantity directly (for voice input / inventory count)
  const updateQuantity = useMutation({
    mutationFn: async ({ stockItemId, quantity }: { stockItemId: string; quantity: number }) => {
      if (isOwnerLoading) throw new Error('Carregando dados do usuário...');
      if (!ownerId) throw new Error('Usuário não autenticado');

      const existingData = await supabaseFetch(`production_stock?stock_item_id=eq.${stockItemId}&select=id,quantity`);
      const existing = Array.isArray(existingData) ? existingData[0] : existingData;

      if (existing) {
        if (quantity === 0) {
          await supabaseFetch(`production_stock?id=eq.${existing.id}`, { method: 'DELETE' });
        } else {
          await supabaseFetch(`production_stock?id=eq.${existing.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ quantity })
          });
        }
      } else if (quantity > 0) {
        await supabaseFetch('production_stock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: ownerId,
            stock_item_id: stockItemId,
            quantity,
          })
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production_stock'] });
    },
    onError: (err: Error) => {
      toast.error(`Erro ao atualizar quantidade: ${err.message}`);
    },
  });

  return {
    productionStock,
    transfers,
    isLoading,
    isOwnerLoading,
    error,
    transferToProduction,
    transferToCentral,
    useFromProductionStock,
    getProductionStockQuantity,
    updateQuantity,
  };
}
