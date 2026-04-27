import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '../shared/useAuth';
import { useOwnerId } from '../shared/useOwnerId';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';
import { supabaseFetch } from '@/lib/supabase-fetch';

import { supplierApi } from '@/api/SupplierApi';
import { SupplierService } from '../modules/supplier/services/SupplierService';
import type { Supplier, SupplierInsert, SupplierUpdate } from '../modules/supplier/types';

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
      return supplierApi.getAll();
    },
    enabled: (!!user?.id || !!ownerId) && !isOwnerLoading,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const createSupplier = useMutation({
    mutationFn: async (supplier: Omit<SupplierInsert, 'user_id'>) => {
      if (isOwnerLoading) throw new Error('Carregando dados do usuário...');
      if (!ownerId) throw new Error('Usuário não autenticado');
      return supplierApi.create({ ...supplier, user_id: ownerId });
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
      return supplierApi.update(id, updates);
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
      await supplierApi.remove(id);
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
