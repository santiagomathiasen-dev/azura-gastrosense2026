import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useOwnerId } from './useOwnerId';
import { toast } from 'sonner';
import { getNow } from '@/lib/utils';
import type { Database } from '@/integrations/supabase/types';
import { supabaseFetch } from '@/lib/supabase-fetch';

import { productionApi } from '@/api/ProductionApi';
import { ProductionService } from '../modules/production/services/ProductionService';
import type {
  Production,
  ProductionInsert,
  ProductionUpdate,
  ProductionStatus,
  ProductionPeriod,
  ProductionWithSheet
} from '../modules/production/types';

export type { Production, ProductionInsert, ProductionUpdate, ProductionStatus, ProductionPeriod, ProductionWithSheet };

export const STATUS_LABELS: Record<ProductionStatus, string> = {
  requested: 'Solicitada',
  planned: 'Planejada',
  in_progress: 'Em Andamento',
  completed: 'Concluída',
  cancelled: 'Cancelada',
  paused: 'Pausada',
};

export const PERIOD_LABELS: Record<ProductionPeriod, string> = {
  day: 'Diária',
  week: 'Semanal',
  month: 'Mensal',
  year: 'Anual',
  custom: 'Personalizada',
};

export function useProductions() {
  const { user } = useAuth();
  const { ownerId, isLoading: isOwnerLoading } = useOwnerId();
  const queryClient = useQueryClient();

  // Query uses RLS - no need to filter by user_id client-side
  const { data: productions = [], isLoading, error } = useQuery({
    queryKey: ['productions', ownerId],
    queryFn: async () => {
      if (!user?.id && !ownerId) return [];
      return productionApi.getAll(ownerId || '');
    },
    enabled: (!!user?.id || !!ownerId) && !isOwnerLoading,
    refetchInterval: 30_000,
  });

  const createProduction = useMutation({
    mutationFn: async (production: Omit<ProductionInsert, 'user_id'>) => {
      if (isOwnerLoading) throw new Error('Carregando dados do usuário...');
      if (!ownerId) throw new Error('Usuário não autenticado');

      return productionApi.create({ ...production, user_id: ownerId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productions'] });
      toast.success('Produção criada com sucesso!');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao criar produção: ${err.message}`);
    },
  });

  // Function to subtract stock when production starts
  // Priority: 1. Production Stock → 2. Central Stock → 3. Generate purchase order
  const subtractStockForProduction = async (production: ProductionWithSheet) => {
    if (!ownerId || !production.technical_sheet) return;

    const multiplier = ProductionService.getMultiplier(
      Number(production.planned_quantity),
      Number(production.technical_sheet.yield_quantity)
    );

    const insufficientItems: { name: string; needed: number; available: number; unit: string }[] = [];

    for (const ingredient of production.technical_sheet.ingredients) {
      const stockItemId = ingredient.stock_item_id;
      const stockResult = await supabaseFetch(`stock_items?id=eq.${stockItemId}&select=waste_factor,current_quantity,name,unit`);
      const itemData = Array.isArray(stockResult) ? stockResult[0] : stockResult;

      const neededQty = ProductionService.calculateNeededQuantity(
        Number(ingredient.quantity),
        multiplier,
        Number(itemData?.waste_factor || 0)
      );

      // Fetch dependencies for planning
      const prodStockResult = await supabaseFetch(`production_stock?stock_item_id=eq.${stockItemId}&select=id,quantity`);
      const prodStock = Array.isArray(prodStockResult) ? prodStockResult[0] : prodStockResult;

      const batchesData = await supabaseFetch(`item_expiry_dates?stock_item_id=eq.${stockItemId}&quantity=gt.0&order=expiry_date.asc`);
      const batches = Array.isArray(batchesData) ? batchesData : [];

      const plan = ProductionService.planStockDeduction(
        neededQty,
        Number(prodStock?.quantity || 0),
        Number(itemData?.current_quantity || 0),
        batches
      );

      // Execution of the plan
      if (plan.fromProduction > 0 && prodStock) {
        const newProdQty = Number(prodStock.quantity) - plan.fromProduction;
        if (newProdQty <= 0) {
          await supabaseFetch(`production_stock?id=eq.${prodStock.id}`, { method: 'DELETE' });
        } else {
          await supabaseFetch(`production_stock?id=eq.${prodStock.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ quantity: newProdQty })
          });
        }
      }

      if (plan.fromCentral > 0) {
        await supabaseFetch('stock_movements', {
          method: 'POST',
          body: JSON.stringify({
            stock_item_id: stockItemId,
            user_id: ownerId,
            type: 'exit',
            quantity: plan.fromCentral,
            source: 'production',
            related_production_id: production.id,
            notes: `Baixa automática - Produção: ${production.name}`,
          })
        });

        for (const deduction of plan.batchDeductions) {
          const batch = batches.find(b => b.id === deduction.batchId);
          if (batch) {
            await supabaseFetch(`item_expiry_dates?id=eq.${batch.id}`, {
              method: 'PATCH',
              body: JSON.stringify({ quantity: Number(batch.quantity) - deduction.take })
            });
          }
        }
      }

      if (plan.insufficient > 0) {
        insufficientItems.push({
          name: itemData?.name || ingredient.stock_item?.name || 'Item',
          needed: neededQty,
          available: (Number(prodStock?.quantity || 0) + Number(itemData?.current_quantity || 0)),
          unit: itemData?.unit || ingredient.unit,
        });

        const purchaseData = await supabaseFetch(`purchase_list_items?stock_item_id=eq.${stockItemId}&status=eq.pending&select=id,suggested_quantity`);
        const existingPurchase = Array.isArray(purchaseData) ? purchaseData[0] : purchaseData;

        if (existingPurchase) {
          await supabaseFetch(`purchase_list_items?id=eq.${existingPurchase.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ suggested_quantity: Number(existingPurchase.suggested_quantity) + plan.insufficient })
          });
        } else {
          await supabaseFetch('purchase_list_items', {
            method: 'POST',
            body: JSON.stringify({
              user_id: ownerId,
              stock_item_id: stockItemId,
              suggested_quantity: plan.insufficient,
              status: 'pending',
              notes: `Gerado automaticamente - Produção: ${production.name}`,
            })
          });
        }
      }
    }

    if (insufficientItems.length > 0) {
      const itemsList = insufficientItems.map(i => `${i.name} (falta ${(i.needed - i.available).toFixed(2)} ${i.unit})`).join(', ');
      toast.warning(`Estoque insuficiente para: ${itemsList}. Pedidos de compra gerados automaticamente.`);
    }
  };

  // Function to add to finished productions stock when production is completed
  const addToFinishedStock = async (production: ProductionWithSheet, actualQuantity: number) => {
    if (!ownerId || !production.technical_sheet) return;

    const sheet = production.technical_sheet;
    const technicalSheetId = sheet.id;
    const unit = sheet.yield_unit;
    const praca = production.praca || null;
    const productionType = (sheet as any).production_type || 'final';

    if (productionType === 'insumo') {
      // Add to produced_inputs_stock
      const expirationDate = (sheet as any).shelf_life_hours
        ? new Date(getNow().getTime() + (sheet as any).shelf_life_hours * 60 * 60 * 1000).toISOString()
        : null;

      const dateStr = getNow().toISOString().slice(0, 10).replace(/-/g, '');
      const random = Math.random().toString(36).substring(2, 6).toUpperCase();
      const batchCode = `${sheet.name.substring(0, 3).toUpperCase()}-${dateStr}-${random}`;

      await supabaseFetch('produced_inputs_stock', {
        method: 'POST',
        body: JSON.stringify({
          user_id: ownerId,
          technical_sheet_id: technicalSheetId,
          batch_code: batchCode,
          quantity: actualQuantity,
          unit: unit,
          production_date: getNow().toISOString(),
          expiration_date: expirationDate,
          notes: `Produção: ${production.name}`,
        })
      });
    } else {
      // Add to finished_productions_stock
      // Check if entry already exists for this technical sheet + praca combo
      let path = `finished_productions_stock?technical_sheet_id=eq.${technicalSheetId}&select=id,quantity`;
      if (praca) {
        path += `&praca=eq.${praca}`;
      } else {
        path += '&praca=is.null';
      }

      const existingResult = await supabaseFetch(path);
      const existing = Array.isArray(existingResult) ? existingResult[0] : existingResult;

      if (existing) {
        // Update existing entry
        await supabaseFetch(`finished_productions_stock?id=eq.${existing.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            quantity: Number(existing.quantity) + actualQuantity,
          })
        });
      } else {
        // Create new entry
        const insertData: any = {
          user_id: ownerId,
          technical_sheet_id: technicalSheetId,
          quantity: actualQuantity,
          unit: unit,
          notes: `Produção: ${production.name}`,
        };
        if (praca) insertData.praca = praca;

        await supabaseFetch('finished_productions_stock', {
          method: 'POST',
          body: JSON.stringify(insertData)
        });
      }
    }
  };

  const updateProduction = useMutation({
    mutationFn: async ({ id, ...updates }: ProductionUpdate & { id: string }) => {
      // Get the current production to check status change
      const currentProduction = productions.find(p => p.id === id);

      const updatedData = await productionApi.update(id, updates);

      // If changing from 'planned' or 'requested' to 'in_progress', subtract stock
      if (
        (currentProduction?.status === 'planned' || currentProduction?.status === 'requested') &&
        updates.status === 'in_progress' &&
        currentProduction.technical_sheet
      ) {
        await subtractStockForProduction(currentProduction);
      }

      // If changing to 'completed', add to finished productions stock
      // Also handles paused productions being completed directly
      if (
        (currentProduction?.status === 'in_progress' || currentProduction?.status === 'paused') &&
        updates.status === 'completed' &&
        currentProduction.technical_sheet
      ) {
        const actualQty = updates.actual_quantity || currentProduction.planned_quantity;
        await addToFinishedStock(currentProduction, Number(actualQty));
      }

      return updatedData;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['productions'] });
      queryClient.invalidateQueries({ queryKey: ['stock_items'] });
      queryClient.invalidateQueries({ queryKey: ['stock_movements'] });
      queryClient.invalidateQueries({ queryKey: ['finished_productions_stock'] });

      if (variables.status === 'in_progress') {
        toast.success('Produção iniciada! Estoque atualizado automaticamente.');
      } else if (variables.status === 'completed') {
        toast.success('Produção finalizada! Adicionada ao estoque de produções finalizadas.');
      } else {
        toast.success('Produção atualizada com sucesso!');
      }
    },
    onError: (err: Error) => {
      toast.error(`Erro ao atualizar produção: ${err.message}`);
    },
  });

  const deleteProduction = useMutation({
    mutationFn: async (id: string) => {
      await productionApi.remove(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productions'] });
      toast.success('Produção excluída com sucesso!');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao excluir produção: ${err.message}`);
    },
  });

  // Calculate projected stock consumption for planned productions
  const plannedProductions = productions.filter((p) => p.status === 'planned');

  const getProjectedConsumption = (stockItemId: string): number => {
    let totalConsumption = 0;
    for (const production of plannedProductions) {
      if (!production.technical_sheet) continue;
      const yieldQty = Number(production.technical_sheet.yield_quantity);
      const plannedQty = Number(production.planned_quantity);
      const multiplier = plannedQty / yieldQty;

      for (const ingredient of production.technical_sheet.ingredients) {
        if (ingredient.stock_item_id === stockItemId) {
          totalConsumption += Number(ingredient.quantity) * multiplier;
        }
      }
    }
    return totalConsumption;
  };

  return {
    productions,
    plannedProductions,
    isLoading,
    isOwnerLoading,
    error,
    createProduction,
    updateProduction,
    deleteProduction,
    getProjectedConsumption,
  };
}
