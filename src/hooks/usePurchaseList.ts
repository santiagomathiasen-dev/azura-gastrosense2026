import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useOwnerId } from './useOwnerId';
import { toast } from 'sonner';
import { supabaseFetch } from '@/lib/supabase-fetch';
import type { Database } from '@/integrations/supabase/types';

type PurchaseListItem = Database['public']['Tables']['purchase_list_items']['Row'];
type PurchaseListItemInsert = Database['public']['Tables']['purchase_list_items']['Insert'];
type PurchaseListItemUpdate = Database['public']['Tables']['purchase_list_items']['Update'];
type PurchaseStatus = Database['public']['Enums']['purchase_status'];

export type { PurchaseListItem, PurchaseListItemInsert, PurchaseListItemUpdate, PurchaseStatus };

export const PURCHASE_STATUS_LABELS: Record<PurchaseStatus, string> = {
  pending: 'Pendente',
  ordered: 'Pedido Feito',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
};

export interface PurchaseListItemWithDetails extends PurchaseListItem {
  stock_item: { name: string; unit: string; category: string } | null;
  supplier: {
    name: string;
    whatsapp_number: string | null;
    whatsapp: string | null;
    phone: string | null;
  } | null;
}

const EMPTY_ARRAY: any[] = [];

export function usePurchaseList() {
  const { user } = useAuth();
  const { ownerId, isLoading: isOwnerLoading } = useOwnerId();
  const queryClient = useQueryClient();

  // Query uses RLS - no need to filter by user_id client-side
  const { data: items = EMPTY_ARRAY, isLoading, error } = useQuery({
    queryKey: ['purchase_list_items', ownerId],
    queryFn: async () => {
      if (!user?.id && !ownerId) return [];
      const data = await supabaseFetch('purchase_list_items?select=*,stock_item:stock_items(name,unit,category),supplier:suppliers(name,whatsapp_number,whatsapp,phone)&order=created_at.desc');
      return (Array.isArray(data) ? data : data ? [data] : []) as unknown as PurchaseListItemWithDetails[];
    },
    enabled: (!!user?.id || !!ownerId) && !isOwnerLoading,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const createItem = useMutation({
    mutationFn: async (item: Omit<PurchaseListItemInsert, 'user_id'>) => {
      if (isOwnerLoading) throw new Error('Carregando dados do usuário...');
      if (!ownerId) throw new Error('Usuário não autenticado');

      const data = await supabaseFetch('purchase_list_items', {
        method: 'POST',
        body: JSON.stringify({ ...item, user_id: ownerId })
      });
      return Array.isArray(data) ? data[0] : data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase_list_items'] });
      toast.success('Item adicionado à lista de compras!');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao adicionar item: ${err.message}`);
    },
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, ...updates }: PurchaseListItemUpdate & { id: string }) => {
      const data = await supabaseFetch(`purchase_list_items?id=eq.${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates)
      });
      return Array.isArray(data) ? data[0] : data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase_list_items'] });
      toast.success('Item atualizado!');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao atualizar item: ${err.message}`);
    },
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      await supabaseFetch(`purchase_list_items?id=eq.${id}`, {
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase_list_items'] });
      toast.success('Item removido da lista!');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao remover item: ${err.message}`);
    },
  });

  const pendingItems = items.filter((item) => item.status === 'pending');
  const orderedItems = items.filter((item) => item.status === 'ordered');

  return {
    items,
    pendingItems,
    orderedItems,
    isLoading,
    isOwnerLoading,
    error,
    createItem,
    updateItem,
    deleteItem,
  };
}
