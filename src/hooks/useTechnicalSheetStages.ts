import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useOwnerId } from './useOwnerId';
import { toast } from 'sonner';
import { supabaseFetch } from '@/lib/supabase-fetch';

export interface TechnicalSheetStage {
  id: string;
  technical_sheet_id: string;
  name: string;
  description: string | null;
  order_index: number;
  duration_minutes: number | null;
  created_at: string;
}

export interface TechnicalSheetStageStep {
  id: string;
  stage_id: string;
  description: string;
  order_index: number;
  duration_minutes: number | null;
  notes: string | null;
  created_at: string;
}

export interface StageWithSteps extends TechnicalSheetStage {
  steps: TechnicalSheetStageStep[];
}

export function useTechnicalSheetStages(technicalSheetId?: string) {
  const { user } = useAuth();
  const { ownerId } = useOwnerId();
  const queryClient = useQueryClient();

  const { data: stages = [], isLoading } = useQuery({
    queryKey: ['technical_sheet_stages', technicalSheetId],
    queryFn: async () => {
      if (!technicalSheetId || (!user?.id && !ownerId)) return [];

      try {
        const data = await supabaseFetch(`technical_sheet_stages?technical_sheet_id=eq.${technicalSheetId}&select=*,steps:technical_sheet_stage_steps(*)&order=order_index`);

        // Sort steps within each stage
        return (data || []).map((stage: any) => ({
          ...stage,
          steps: (stage.steps || []).sort((a: TechnicalSheetStageStep, b: TechnicalSheetStageStep) => a.order_index - b.order_index)
        })) as StageWithSteps[];
      } catch (err) {
        console.error("Error fetching stages:", err);
        throw err;
      }
    },
    enabled: !!technicalSheetId && (!!user?.id || !!ownerId),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const createStage = useMutation({
    mutationFn: async (stage: Omit<TechnicalSheetStage, 'id' | 'created_at'>) => {
      if (!ownerId) throw new Error('Usuário não autenticado');
      const data = await supabaseFetch('technical_sheet_stages', {
        method: 'POST',
        headers: { 'Prefer': 'return=representation' },
        body: JSON.stringify({ ...stage })
      });
      return Array.isArray(data) ? data[0] : data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['technical_sheet_stages'] });
      queryClient.invalidateQueries({ queryKey: ['technical_sheets'] });
    },
    onError: (err: Error) => {
      toast.error(`Erro ao criar etapa: ${err.message}`);
    },
  });

  const updateStage = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<TechnicalSheetStage> & { id: string }) => {
      const data = await supabaseFetch(`technical_sheet_stages?id=eq.${id}`, {
        method: 'PATCH',
        headers: { 'Prefer': 'return=representation' },
        body: JSON.stringify(updates)
      });
      return Array.isArray(data) ? data[0] : data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['technical_sheet_stages'] });
    },
    onError: (err: Error) => {
      toast.error(`Erro ao atualizar etapa: ${err.message}`);
    },
  });

  const deleteStage = useMutation({
    mutationFn: async (id: string) => {
      await supabaseFetch(`technical_sheet_stages?id=eq.${id}`, {
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['technical_sheet_stages'] });
      queryClient.invalidateQueries({ queryKey: ['technical_sheets'] });
    },
    onError: (err: Error) => {
      toast.error(`Erro ao excluir etapa: ${err.message}`);
    },
  });

  const createStep = useMutation({
    mutationFn: async (step: Omit<TechnicalSheetStageStep, 'id' | 'created_at'>) => {
      if (!ownerId) throw new Error('Usuário não autenticado');
      const data = await supabaseFetch('technical_sheet_stage_steps', {
        method: 'POST',
        headers: { 'Prefer': 'return=representation' },
        body: JSON.stringify({ ...step })
      });
      return Array.isArray(data) ? data[0] : data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['technical_sheet_stages'] });
    },
    onError: (err: Error) => {
      toast.error(`Erro ao criar passo: ${err.message}`);
    },
  });

  const updateStep = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<TechnicalSheetStageStep> & { id: string }) => {
      const data = await supabaseFetch(`technical_sheet_stage_steps?id=eq.${id}`, {
        method: 'PATCH',
        headers: { 'Prefer': 'return=representation' },
        body: JSON.stringify(updates)
      });
      return Array.isArray(data) ? data[0] : data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['technical_sheet_stages'] });
    },
    onError: (err: Error) => {
      toast.error(`Erro ao atualizar passo: ${err.message}`);
    },
  });

  const deleteStep = useMutation({
    mutationFn: async (id: string) => {
      await supabaseFetch(`technical_sheet_stage_steps?id=eq.${id}`, {
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['technical_sheet_stages'] });
    },
    onError: (err: Error) => {
      toast.error(`Erro ao excluir passo: ${err.message}`);
    },
  });

  return {
    stages,
    isLoading,
    createStage,
    updateStage,
    deleteStage,
    createStep,
    updateStep,
    deleteStep,
  };
}
