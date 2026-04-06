import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useOwnerId } from './useOwnerId';
import { toast } from 'sonner';
import { supabaseFetch } from '@/lib/supabase-fetch';
import { useDriveCollection } from './useDriveModule';
import { useDriveData } from '@/contexts/DriveDataContext';

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
  const { isDriveConnected, addItem, writeModule, readModule } = useDriveData();

  // Hybrid query: Drive or Supabase
  const {
    items,
    isLoading,
    error,
    create: createItem,
    update: updateItem,
    remove,
  } = useDriveCollection<StockItem>('stock', 'stock_items', {
    supabaseFallback: () => stockApi.getAll(ownerId || user?.id || ''),
    supabaseCreate: (item) => stockApi.create(item),
    supabaseUpdate: (id, updates) => stockApi.update(id, updates),
    supabaseDelete: (id) => stockApi.remove(id),
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  const deleteItem = remove;

  const itemsInAlert = StockService.getItemsInAlert(items);

  // Batch create (import)
  const batchCreateItems = useMutation({
    mutationFn: async (newItems: Omit<StockItemInsert, 'user_id'>[]) => {
      if (isOwnerLoading) throw new Error('Carregando dados do usuario...');
      if (!ownerId) throw new Error('Usuario nao autenticado');

      const validUnits = new Set(['kg', 'g', 'L', 'ml', 'unidade', 'caixa', 'dz']);
      const unitMap: Record<string, string> = { l: 'L', litro: 'L', un: 'unidade', und: 'unidade', cx: 'caixa', quilo: 'kg' };
      const validCategories = new Set(['laticinios', 'secos_e_graos', 'hortifruti', 'carnes_e_peixes', 'embalagens', 'limpeza', 'outros']);

      const normalized = newItems.map(item => {
        const rawUnit = (item.unit as string || 'unidade').trim();
        const rawCat = item.category as string;
        return {
          ...item,
          user_id: ownerId,
          unit: validUnits.has(rawUnit) ? rawUnit : (unitMap[rawUnit.toLowerCase()] || 'unidade'),
          category: (rawCat && rawCat !== 'null' && validCategories.has(rawCat)) ? rawCat : 'outros',
        };
      });

      if (isDriveConnected) {
        // Add all items to Drive
        const stockData = await readModule('stock');
        const existing = stockData.stock_items || [];
        const created = normalized.map(item => ({
          ...item,
          id: crypto.randomUUID(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }));
        await writeModule('stock', {
          ...stockData,
          stock_items: [...existing, ...created],
        });
        return null;
      }

      // Supabase fallback
      await supabaseFetch('stock_items', {
        method: 'POST',
        body: JSON.stringify(normalized),
      });
      return null;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['stock_items'] });
      toast.success(`${variables.length} itens criados com sucesso!`);
    },
    onError: (err: Error) => {
      toast.error(`Erro ao criar itens: ${err.message}`);
    },
  });

  // Invoice import (complex — stays with Supabase for now, syncs to Drive after)
  const processInvoiceImport = useMutation({
    mutationFn: async ({ nfeData, mappedItems }: { nfeData: any, mappedItems: any[] }) => {
      if (isOwnerLoading) throw new Error('Carregando dados do usuario...');
      if (!ownerId) throw new Error('Usuario nao autenticado');

      // 1. Create Financial Expense
      const expense = {
        user_id: ownerId,
        description: `Compra: ${nfeData.supplierName} (NF ${nfeData.invoiceNumber})`,
        amount: nfeData.totalValue,
        category: 'variable',
        type: 'invoice',
        date: nfeData.emissionDate.split('T')[0],
        status: 'paid',
        invoice_number: nfeData.invoiceNumber,
        notes: `Importacao automatica via XML. Fornecedor: ${nfeData.supplierName}`
      };

      await supabaseFetch('financial_expenses', {
        method: 'POST',
        body: JSON.stringify(expense)
      });

      const newItemsToCreate: any[] = [];
      const existingItemsToUpdate: any[] = [];
      const movementsToCreate: any[] = [];
      const purchaseListToCreate: any[] = [];

      for (const item of mappedItems) {
        if (item.matchedId === 'new') {
          const rawUnit = (item.unit || 'unidade').trim();
          const unitMap: Record<string, string> = { l: 'L', litro: 'L', un: 'unidade', und: 'unidade', cx: 'caixa', quilo: 'kg' };
          const validUnits = new Set(['kg', 'g', 'L', 'ml', 'unidade', 'caixa', 'dz']);
          const normalizedUnit = validUnits.has(rawUnit) ? rawUnit : (unitMap[rawUnit.toLowerCase()] || 'unidade');
          const validCategories = new Set(['laticinios', 'secos_e_graos', 'hortifruti', 'carnes_e_peixes', 'embalagens', 'limpeza', 'outros']);
          const normalizedCategory = (item.category && item.category !== 'null' && validCategories.has(item.category)) ? item.category : 'outros';

          newItemsToCreate.push({
            user_id: ownerId,
            name: item.name,
            current_quantity: item.quantity,
            unit: normalizedUnit,
            category: normalizedCategory,
            unit_price: item.unitPrice,
            notes: `Criado via NF ${nfeData.invoiceNumber}`
          });
        } else if (item.matchedId) {
          const existing = items.find(ei => ei.id === item.matchedId);
          if (existing) {
            existingItemsToUpdate.push({
              id: item.matchedId,
              current_quantity: Number(existing.current_quantity) + item.quantity,
              unit_price: item.unitPrice,
              updated_at: new Date().toISOString()
            });

            movementsToCreate.push({
              user_id: ownerId,
              stock_item_id: item.matchedId,
              type: 'entry',
              quantity: item.quantity,
              source: 'purchase',
              notes: `NF ${nfeData.invoiceNumber} - ${nfeData.supplierName}`
            });
          }
        }
      }

      let newlyCreatedItems: any[] = [];
      if (newItemsToCreate.length > 0) {
        const { data, error } = await supabase.from('stock_items').insert(newItemsToCreate).select();
        if (error) throw error;
        newlyCreatedItems = data || [];

        newlyCreatedItems.forEach((ni, idx) => {
          const sourceItem = newItemsToCreate[idx];
          movementsToCreate.push({
            user_id: ownerId,
            stock_item_id: ni.id,
            type: 'entry',
            quantity: sourceItem.current_quantity,
            source: 'purchase',
            notes: `NF ${nfeData.invoiceNumber} (Novo cadastro)`
          });
        });
      }

      if (existingItemsToUpdate.length > 0) {
        const { error } = await supabase.from('stock_items').upsert(existingItemsToUpdate);
        if (error) throw error;
      }

      if (movementsToCreate.length > 0) {
        const { error } = await supabase.from('stock_movements').insert(movementsToCreate);
        if (error) throw error;
      }

      mappedItems.forEach((item) => {
        let stockItemId = item.matchedId;
        if (stockItemId === 'new') {
          const found = newlyCreatedItems.find(ni => ni.name === item.name);
          if (found) stockItemId = found.id;
        }

        if (stockItemId && stockItemId !== 'new') {
          purchaseListToCreate.push({
            user_id: ownerId,
            stock_item_id: stockItemId,
            suggested_quantity: item.quantity,
            ordered_quantity: item.quantity,
            status: 'delivered',
            actual_delivery_date: new Date().toISOString().split('T')[0],
            order_date: nfeData.emissionDate.split('T')[0],
            notes: `NF ${nfeData.invoiceNumber}`
          });
        }
      });

      if (purchaseListToCreate.length > 0) {
        const { error } = await supabase.from('purchase_list_items').insert(purchaseListToCreate);
        if (error) throw error;
      }

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock_items'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      queryClient.invalidateQueries({ queryKey: ['financial_expenses'] });
      toast.success('Nota Fiscal importada e estoque atualizado!');
    },
    onError: (err: Error) => {
      toast.error(`Erro na importacao: ${err.message}`);
    }
  });

  return {
    items,
    isLoading,
    isOwnerLoading,
    error,
    createItem,
    batchCreateItems,
    processInvoiceImport,
    updateItem,
    deleteItem,
    itemsInAlert,
  };
}
