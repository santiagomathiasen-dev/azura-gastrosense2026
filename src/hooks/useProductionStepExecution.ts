import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useOwnerId } from './useOwnerId';
import { getNow } from '@/lib/utils';

export interface ProductionStepExecution {
  id: string;
  production_id: string;
  step_id: string;
  completed: boolean;
  completed_at: string | null;
  duration_seconds: number | null;
  notes: string | null;
  created_at: string;
}

export function useProductionStepExecution(productionId?: string) {
  const { user } = useAuth();
  const { ownerId } = useOwnerId();
  const queryClient = useQueryClient();

  const { data: stepExecutions = [], isLoading } = useQuery({
    queryKey: ['production_step_executions', productionId],
    queryFn: async () => {
      if (!productionId || (!user?.id && !ownerId)) return [];

      const { data, error } = await supabase
        .from('production_step_executions')
        .select('*')
        .eq('production_id', productionId);

      if (error) throw error;
      return data as ProductionStepExecution[];
    },
    enabled: !!productionId && (!!user?.id || !!ownerId),
    staleTime: 60_000,
    gcTime: 10 * 60 * 1000,
  });

  const initializeStepExecutions = useMutation({
    mutationFn: async ({ productionId, stepIds }: { productionId: string; stepIds: string[] }) => {
      // Check which steps already have executions
      const { data: existing } = await supabase
        .from('production_step_executions')
        .select('step_id')
        .eq('production_id', productionId);

      const existingStepIds = new Set((existing || []).map(e => e.step_id));
      const newStepIds = stepIds.filter(id => !existingStepIds.has(id));

      if (newStepIds.length === 0) return [];

      const executions = newStepIds.map(stepId => ({
        user_id: ownerId,
        production_id: productionId,
        step_id: stepId,
        completed: false,
      }));

      const { data, error } = await supabase
        .from('production_step_executions')
        .insert(executions)
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production_step_executions'] });
    },
  });

  const toggleStepCompletion = useMutation({
    mutationFn: async ({ stepId, completed, notes }: { stepId: string; completed: boolean; notes?: string }) => {
      const execution = stepExecutions.find(e => e.step_id === stepId);

      if (execution) {
        // Update existing execution
        const { data, error } = await supabase
          .from('production_step_executions')
          .update({
            completed,
            completed_at: completed ? getNow().toISOString() : null,
            notes: notes || execution.notes,
          })
          .eq('id', execution.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        // Create new execution
        const { data, error } = await supabase
          .from('production_step_executions')
          .insert({
            user_id: ownerId,
            production_id: productionId!,
            step_id: stepId,
            completed,
            completed_at: completed ? getNow().toISOString() : null,
            notes,
          })
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production_step_executions'] });
    },
  });

  const isStepCompleted = (stepId: string): boolean => {
    return stepExecutions.some(e => e.step_id === stepId && e.completed);
  };

  const getCompletionPercentage = (totalSteps: number): number => {
    if (totalSteps === 0) return 0;
    const completedCount = stepExecutions.filter(e => e.completed).length;
    return Math.round((completedCount / totalSteps) * 100);
  };

  return {
    stepExecutions,
    isLoading,
    initializeStepExecutions,
    toggleStepCompletion,
    isStepCompleted,
    getCompletionPercentage,
  };
}
