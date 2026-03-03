import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useOwnerId } from './useOwnerId';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';
import { supabaseFetch } from '@/lib/supabase-fetch';

type Supplier = Database['public']['Tables']['suppliers']['Row'];
type SupplierInsert = Database['public']['Tables']['suppliers']['Insert'];
type SupplierUpdate = Database['public']['Tables']['suppliers']['Update'];

export type { Supplier, SupplierInsert, SupplierUpdate };

export function useSuppliers() {
  const { user } = useAuth();
  const { ownerId, isLoading: isOwnerLoading } = useOwnerId();
  const queryClient = useQueryClient();

  // Query uses RLS - no need to filter by user_id client-side
  const { data: suppliers = [], isLoading, error } = useQuery({
    queryKey: ['suppliers', ownerId],
    queryFn: async () => {
      if (!user?.id && !ownerId) return [];
      try {
        const data = await supabaseFetch('suppliers?select=*&order=name.asc');
        return data as Supplier[];
      } catch (err) {
        console.error("Error fetching suppliers:", err);
        throw err;
      }
    },
    enabled: (!!user?.id || !!ownerId) && !isOwnerLoading,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const createSupplier = useMutation({
    mutationFn: async (supplier: Omit<SupplierInsert, 'user_id'>) => {
      if (isOwnerLoading) throw new Error('Carregando dados do usuário...');
      if (!ownerId) throw new Error('Usuário não autenticado');

      try {
        const data = await supabaseFetch('suppliers', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify({ ...supplier, user_id: ownerId })
        });
        return Array.isArray(data) ? data[0] : data;
      } catch (err: any) {
        throw new Error(err.message || 'Erro ao criar fornecedor');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast.success('Fornecedor criado com sucesso!');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao criar fornecedor: ${err.message}`);
    },
  });

  const updateSupplier = useMutation({
    mutationFn: async ({ id, ...updates }: SupplierUpdate & { id: string }) => {
      try {
        const data = await supabaseFetch(`suppliers?id=eq.${id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify(updates)
        });
        return Array.isArray(data) ? data[0] : data;
      } catch (err: any) {
        throw new Error(err.message || 'Erro ao atualizar fornecedor');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast.success('Fornecedor atualizado com sucesso!');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao atualizar fornecedor: ${err.message}`);
    },
  });

  const deleteSupplier = useMutation({
    mutationFn: async (id: string) => {
      await supabaseFetch(`suppliers?id=eq.${id}`, {
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast.success('Fornecedor excluído com sucesso!');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao excluir fornecedor: ${err.message}`);
    },
  });

  return {
    suppliers,
    isLoading,
    isOwnerLoading,
    error,
    createSupplier,
    updateSupplier,
    deleteSupplier,
  };
}
