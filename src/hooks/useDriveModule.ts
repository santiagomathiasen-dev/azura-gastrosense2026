'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDriveData } from '@/contexts/DriveDataContext';
import { useAuth } from './useAuth';
import { useOwnerId } from './useOwnerId';
import type { ModuleName, DriveModuleMap } from '@/lib/drive-data-service';
import { toast } from 'sonner';

/**
 * Generic hook for Drive-backed collections.
 * Uses Google Drive when connected, falls back to Supabase via supabaseFetch.
 *
 * Usage:
 *   const { items, create, update, remove } = useDriveCollection('stock', 'stock_items', {
 *     supabaseFallback: () => stockApi.getAll(ownerId),
 *   });
 */
interface UseDriveCollectionOptions<T> {
  /** Supabase fallback query function */
  supabaseFallback: () => Promise<T[]>;
  /** Supabase create function */
  supabaseCreate?: (item: any) => Promise<T>;
  /** Supabase update function */
  supabaseUpdate?: (id: string, updates: any) => Promise<T>;
  /** Supabase delete function */
  supabaseDelete?: (id: string) => Promise<void>;
  /** Transform items after read from Drive (e.g., normalize enums) */
  transform?: (items: T[]) => T[];
  /** React Query stale time in ms */
  staleTime?: number;
  /** React Query refetch interval in ms (only for Supabase mode) */
  refetchInterval?: number;
}

export function useDriveCollection<T extends { id?: string }>(
  module: ModuleName,
  collection: string,
  options: UseDriveCollectionOptions<T>
) {
  const { user } = useAuth();
  const { ownerId, isLoading: isOwnerLoading } = useOwnerId();
  const driveCtx = useDriveData();
  const isDriveConnected = driveCtx.isDriveConnected;
  const driveData = driveCtx.data;
  // Use type-unsafe wrappers since collection is a runtime string
  const driveAdd = driveCtx.addItem as (m: any, c: any, item: any) => Promise<any>;
  const driveUpdate = driveCtx.updateItem as (m: any, c: any, id: string, u: any) => Promise<any>;
  const driveDelete = driveCtx.deleteItem as (m: any, c: any, id: string) => Promise<void>;
  const queryClient = useQueryClient();

  const queryKey = [collection, ownerId, isDriveConnected ? 'drive' : 'supabase'];

  // Query: read from Drive or Supabase
  const { data: items = [] as T[], isLoading, error } = useQuery({
    queryKey,
    queryFn: async (): Promise<T[]> => {
      if (!user?.id && !ownerId) return [];

      // Try Drive first
      if (isDriveConnected && driveData) {
        const moduleData = driveData[module] as any;
        if (moduleData && moduleData[collection]) {
          const raw = moduleData[collection] as T[];
          return options.transform ? options.transform(raw) : raw;
        }
        return [];
      }

      // Fallback to Supabase
      const result = await options.supabaseFallback();
      return options.transform ? options.transform(result) : result;
    },
    enabled: (!!user?.id || !!ownerId) && !isOwnerLoading,
    staleTime: options.staleTime ?? 60_000,
    // Only poll Supabase; Drive data updates via context
    refetchInterval: isDriveConnected ? false : (options.refetchInterval ?? 120_000),
  });

  // Create mutation
  const create = useMutation({
    mutationFn: async (item: any): Promise<T> => {
      if (isOwnerLoading) throw new Error('Carregando dados do usuario...');
      if (!ownerId) throw new Error('Usuario nao autenticado');

      const itemWithUser = { ...item, user_id: ownerId };

      if (isDriveConnected) {
        return driveAdd(module, collection, itemWithUser);
      }

      if (options.supabaseCreate) {
        return options.supabaseCreate(itemWithUser);
      }
      throw new Error('Metodo de criacao nao disponivel');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [collection] });
      toast.success('Item criado com sucesso!');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao criar: ${err.message}`);
    },
  });

  // Update mutation
  const update = useMutation({
    mutationFn: async ({ id, ...updates }: any): Promise<T> => {
      if (isDriveConnected) {
        return driveUpdate(module, collection, id, updates);
      }

      if (options.supabaseUpdate) {
        return options.supabaseUpdate(id, updates);
      }
      throw new Error('Metodo de atualizacao nao disponivel');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [collection] });
      toast.success('Item atualizado!');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao atualizar: ${err.message}`);
    },
  });

  // Delete mutation
  const remove = useMutation({
    mutationFn: async (id: string): Promise<void> => {
      if (isDriveConnected) {
        return driveDelete(module, collection, id);
      }

      if (options.supabaseDelete) {
        return options.supabaseDelete(id);
      }
      throw new Error('Metodo de exclusao nao disponivel');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [collection] });
      toast.success('Item excluido!');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao excluir: ${err.message}`);
    },
  });

  return {
    items,
    isLoading,
    isOwnerLoading,
    error,
    isDriveMode: isDriveConnected,
    create,
    update,
    remove,
    ownerId,
  };
}
