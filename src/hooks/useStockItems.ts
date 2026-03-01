import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useOwnerId } from './useOwnerId';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';
import { supabaseFetch } from '@/lib/supabase-fetch';

type StockItem = Database['public']['Tables']['stock_items']['Row'];
type StockItemInsert = Database['public']['Tables']['stock_items']['Insert'];
type StockItemUpdate = Database['public']['Tables']['stock_items']['Update'];
type StockCategory = Database['public']['Enums']['stock_category'];
type StockUnit = Database['public']['Enums']['stock_unit'];

export type { StockItem, StockItemInsert, StockItemUpdate, StockCategory, StockUnit };

export const CATEGORY_LABELS: Record<StockCategory, string> = {
  laticinios: 'Laticínios',
  secos_e_graos: 'Secos e Grãos',
  hortifruti: 'Hortifruti',
  carnes_e_peixes: 'Carnes e Peixes',
  embalagens: 'Embalagens',
  limpeza: 'Limpeza',
  outros: 'Outros',
};

export const UNIT_LABELS: Record<StockUnit, string> = {
  kg: 'kg',
  g: 'g',
  L: 'L',
  ml: 'ml',
  unidade: 'un',
  caixa: 'cx',
  dz: 'dz',
};

export function getStockStatus(currentQty: number, minimumQty: number, isExpired?: boolean): 'green' | 'yellow' | 'red' {
  if (isExpired || currentQty <= minimumQty) return 'red';
  if (currentQty <= minimumQty * 1.2) return 'yellow';
  return 'green';
}

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
      try {
        const data = await supabaseFetch('stock_items?select=*,supplier:suppliers(name)&order=name.asc');
        return data as StockItem[];
      } catch (err) {
        console.error("Error fetching stock items:", err);
        throw err;
      }
    },
    enabled: (!!user?.id || !!ownerId) && !isOwnerLoading,
    refetchInterval: 30_000,
  });

  const createItem = useMutation({
    mutationFn: async (item: Omit<StockItemInsert, 'user_id'>) => {
      if (isOwnerLoading) throw new Error('Carregando dados do usuário...');
      if (!ownerId) throw new Error('Usuário não autenticado');

      try {
        const data = await supabaseFetch('stock_items', {
          method: 'POST',
          headers: {
            'Prefer': 'return=representation'
          },
          body: JSON.stringify({ ...item, user_id: ownerId })
        });
        return Array.isArray(data) ? data[0] : data;
      } catch (err: any) {
        throw new Error(err.message || 'Erro ao criar item');
      }
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
      try {
        await supabaseFetch(`stock_items?id=eq.${id}`, {
          method: 'PATCH',
          body: JSON.stringify(updates)
        });
        return null;
      } catch (err: any) {
        throw new Error(err.message || 'Erro ao atualizar item');
      }
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
      const { error } = await supabase
        .from('stock_items')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock_items'] });
      toast.success('Item excluído com sucesso!');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao excluir item: ${err.message}`);
    },
  });

  const itemsInAlert = items.filter(
    (item) => getStockStatus(Number(item.current_quantity), Number(item.minimum_quantity)) !== 'green'
  );

  const batchCreateItems = useMutation({
    mutationFn: async (items: Omit<StockItemInsert, 'user_id'>[]) => {
      if (isOwnerLoading) throw new Error('Carregando dados do usuário...');
      if (!ownerId) throw new Error('Usuário não autenticado');

      const itemsWithUser = items.map(item => ({ ...item, user_id: ownerId }));

      try {
        await supabaseFetch('stock_items', {
          method: 'POST',
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
