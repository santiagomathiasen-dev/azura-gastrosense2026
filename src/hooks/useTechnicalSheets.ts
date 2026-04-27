import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useOwnerId } from './useOwnerId';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';
import { supabaseFetch } from '@/lib/supabase-fetch';

import { technicalSheetApi } from '@/api/TechnicalSheetApi';
import { TechnicalSheetService } from '../modules/technical-sheets/services/TechnicalSheetService';
import type {
  TechnicalSheet,
  TechnicalSheetInsert,
  TechnicalSheetUpdate,
  TechnicalSheetIngredient
} from '../modules/technical-sheets/types';

type ProductionType = 'insumo' | 'final';

export type { TechnicalSheet, TechnicalSheetInsert, TechnicalSheetUpdate, TechnicalSheetIngredient, ProductionType };

export interface TechnicalSheetWithIngredients extends TechnicalSheet {
  production_type: ProductionType;
  minimum_stock: number;
  video_url: string | null;
  labor_cost: number;
  energy_cost: number;
  other_costs: number;
  markup: number;
  target_price: number | null;
  ingredients: (TechnicalSheetIngredient & {
    stock_item: { name: string; unit: string; unit_price: number | null } | null;
    stage_id?: string | null;
  })[];
}

const EMPTY_ARRAY: any[] = [];

export function useTechnicalSheets() {
  const { user } = useAuth();
  const { ownerId, isLoading: isOwnerLoading } = useOwnerId();
  const queryClient = useQueryClient();

  // Query uses RLS - no need to filter by user_id client-side
  const { data: sheets = EMPTY_ARRAY, isLoading, error } = useQuery({
    queryKey: ['technical_sheets', ownerId],
    queryFn: async () => {
      if (!user?.id && !ownerId) return [];
      const data = await technicalSheetApi.getAll();

      return (data || []).map((sheet: any) => ({
        ...sheet,
        production_type: (sheet.production_type as ProductionType) || 'final',
        minimum_stock: Number(sheet.minimum_stock || 0),
        video_url: sheet.video_url || null,
        labor_cost: Number(sheet.labor_cost || 0),
        energy_cost: Number(sheet.energy_cost || 0),
        other_costs: Number(sheet.other_costs || 0),
        markup: Number(sheet.markup || 0),
        target_price: sheet.target_price || null,
      })) as TechnicalSheetWithIngredients[];
    },
    enabled: (!!user?.id || !!ownerId) && !isOwnerLoading,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const createSheet = useMutation({
    mutationFn: async (sheet: Omit<TechnicalSheetInsert, 'user_id'>) => {
      if (isOwnerLoading) throw new Error('Carregando dados do usuário...');
      if (!ownerId) throw new Error('Usuário não autenticado');

      return technicalSheetApi.create({
        ...sheet,
        user_id: ownerId,
        labor_cost: Number(sheet.labor_cost || 0),
        energy_cost: Number(sheet.energy_cost || 0),
        other_costs: Number(sheet.other_costs || 0),
        // markup: Number(sheet.markup || 0),
      } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['technical_sheets'] });
      toast.success('Ficha técnica criada com sucesso!');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao criar ficha técnica: ${err.message}`);
    },
  });

  const updateSheet = useMutation({
    mutationFn: async ({ id, ...updates }: TechnicalSheetUpdate & { id: string }) => {
      return technicalSheetApi.update(id, {
        ...updates,
        labor_cost: updates.labor_cost !== undefined ? Number(updates.labor_cost || 0) : undefined,
        energy_cost: updates.energy_cost !== undefined ? Number(updates.energy_cost || 0) : undefined,
        other_costs: updates.other_costs !== undefined ? Number(updates.other_costs || 0) : undefined,
        // markup: updates.markup !== undefined ? Number(updates.markup || 0) : undefined,
      } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['technical_sheets'] });
      toast.success('Ficha técnica atualizada com sucesso!');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao atualizar ficha técnica: ${err.message}`);
    },
  });

  const deleteSheet = useMutation({
    mutationFn: async (id: string) => {
      await technicalSheetApi.remove(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['technical_sheets'] });
      toast.success('Ficha técnica excluída com sucesso!');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao excluir ficha técnica: ${err.message}`);
    },
  });

  const addIngredient = useMutation({
    mutationFn: async (ingredient: {
      technical_sheet_id: string;
      stock_item_id: string;
      quantity: number;
      unit: string;
      stage_id?: string | null;
    }) => {
      if (!ownerId) throw new Error('Usuário não autenticado');

      const data = await supabaseFetch('technical_sheet_ingredients', {
        method: 'POST',
        headers: { 'Prefer': 'return=representation' },
        body: JSON.stringify({
          technical_sheet_id: ingredient.technical_sheet_id,
          stock_item_id: ingredient.stock_item_id,
          quantity: ingredient.quantity,
          unit: ingredient.unit,
          stage_id: ingredient.stage_id || null,
        })
      });
      return Array.isArray(data) ? data[0] : data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['technical_sheets'] });
      queryClient.invalidateQueries({ queryKey: ['technical_sheet_stages'] });
    },
  });

  const removeIngredient = useMutation({
    mutationFn: async (id: string) => {
      await supabaseFetch(`technical_sheet_ingredients?id=eq.${id}`, {
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['technical_sheets'] });
    },
  });

  return {
    sheets,
    isLoading,
    isOwnerLoading,
    error,
    createSheet,
    updateSheet,
    deleteSheet,
    addIngredient,
    removeIngredient,
  };
}
