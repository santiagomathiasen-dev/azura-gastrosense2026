import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useOwnerId } from './useOwnerId';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';
import { supabaseFetch } from '@/lib/supabase-fetch';

import { StockService } from '../modules/stock/services/StockService';
import { stockApi } from '@/api/StockApi';
import type {
  StockItem,
  StockItemInsert,
  StockItemUpdate,
  StockCategory,
  StockUnit
} from '../modules/stock/types';
import { CATEGORY_LABELS, UNIT_LABELS } from '../modules/stock/types';

export type { StockItem, StockItemInsert, StockItemUpdate, StockCategory, StockUnit };
export { CATEGORY_LABELS, UNIT_LABELS };

export function useStockItems() {
  const { user } = useAuth();
  const { ownerId, isLoading: isOwnerLoading } = useOwnerId();
  const queryClient = useQueryClient();

  // Query uses RLS - no need to filter by user_id client-side
  // RLS policies use can_access_owner_data() which handles gestor/collaborator access
  const { data: items = [], isLoading, error } = useQuery({
    queryKey: ['stock_items', ownerId],
    queryFn: async () => {
      if (!user?.id && !ownerId) return [];
      return stockApi.getAll(ownerId || user?.id || '');
    },
    enabled: (!!user?.id || !!ownerId) && !isOwnerLoading,
    refetchInterval: 30_000,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const createItem = useMutation({
    mutationFn: async (item: Omit<StockItemInsert, 'user_id'>) => {
      if (isOwnerLoading) throw new Error('Carregando dados do usuário...');
      if (!ownerId) throw new Error('Usuário não autenticado');

      return stockApi.create({ ...item, user_id: ownerId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock_items'] });
      toast.success('Item criado com sucesso!');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao criar item: ${err.message}`);
    },
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, ...updates }: StockItemUpdate & { id: string }) => {
      return stockApi.update(id, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock_items'] });
      toast.success('Item atualizado com sucesso!');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao atualizar item: ${err.message}`);
    },
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      await stockApi.remove(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock_items'] });
      toast.success('Item excluído com sucesso!');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao excluir item: ${err.message}`);
    },
  });

  const itemsInAlert = StockService.getItemsInAlert(items);

  const batchCreateItems = useMutation({
    mutationFn: async (items: Omit<StockItemInsert, 'user_id'>[]) => {
      if (isOwnerLoading) throw new Error('Carregando dados do usuário...');
      if (!ownerId) throw new Error('Usuário não autenticado');

      const itemsWithUser = items.map(item => ({ ...item, user_id: ownerId }));

      try {
        await supabaseFetch('stock_items', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(itemsWithUser)
        });
        return null;
      } catch (err: any) {
        throw new Error(err.message || 'Erro ao importar itens');
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['stock_items'] });
      toast.success(`${variables.length} itens criados com sucesso!`);
    },
    onError: (err: Error) => {
      toast.error(`Erro ao criar itens: ${err.message}`);
    },
  });

  return {
    items,
    isLoading,
    isOwnerLoading,
    error,
    createItem,
    batchCreateItems,
    updateItem,
    deleteItem,
    itemsInAlert,
  };
}
