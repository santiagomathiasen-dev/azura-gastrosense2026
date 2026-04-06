import { useDriveCollection } from './useDriveModule';
import { supplierApi } from '@/api/SupplierApi';
import type { Supplier, SupplierInsert, SupplierUpdate } from '../modules/supplier/types';

export type { Supplier, SupplierInsert, SupplierUpdate };

export function useSuppliers() {
  const {
    items: suppliers,
    isLoading,
    isOwnerLoading,
    error,
    create: createSupplier,
    update: updateSupplier,
    remove: deleteSupplier,
  } = useDriveCollection<Supplier>('suppliers', 'suppliers', {
    supabaseFallback: () => supplierApi.getAll(),
    supabaseCreate: (item) => supplierApi.create(item),
    supabaseUpdate: (id, updates) => supplierApi.update(id, updates),
    supabaseDelete: (id) => supplierApi.remove(id),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 300_000,
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
