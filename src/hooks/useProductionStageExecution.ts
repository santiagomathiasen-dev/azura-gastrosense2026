import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useOwnerId } from './useOwnerId';
import { getNow } from '@/lib/utils';
import type { Database } from '@/integrations/supabase/types';

export type ProductionStageExecution = Database['public']['Tables']['production_stage_executions']['Row'];
export type ProductionStageExecutionInsert = Database['public']['Tables']['production_stage_executions']['Insert'];
export type ProductionStageExecutionUpdate = Database['public']['Tables']['production_stage_executions']['Update'];

export function useProductionStageExecution(productionId?: string) {
    const { user } = useAuth();
    const { ownerId } = useOwnerId();
    const queryClient = useQueryClient();

    const { data: stageExecutions = [], isLoading } = useQuery({
        queryKey: ['production_stage_executions', productionId],
        queryFn: async () => {
            if (!productionId || (!user?.id && !ownerId)) return [];

            const { data, error } = await supabase
                .from('production_stage_executions')
                .select('*')
                .eq('production_id', productionId);

            if (error) throw error;
            return data as ProductionStageExecution[];
        },
        enabled: !!productionId && (!!user?.id || !!ownerId),
        staleTime: 60_000,
        gcTime: 10 * 60 * 1000,
    });

    const startStage = useMutation({
        mutationFn: async (stageId: string) => {
            if (!productionId || !ownerId) throw new Error('Dados faltando para iniciar etapa');

            const { data, error } = await supabase
                .from('production_stage_executions')
                .upsert({
                    user_id: ownerId,
                    production_id: productionId,
                    stage_id: stageId,
                    started_at: getNow().toISOString(),
                    updated_at: getNow().toISOString(),
                }, {
                    onConflict: 'production_id,stage_id'
                })
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['production_stage_executions', productionId] });
        },
    });

    const finishStage = useMutation({
        mutationFn: async (stageId: string) => {
            if (!productionId || !ownerId) throw new Error('Dados faltando para finalizar etapa');

            const { data, error } = await supabase
                .from('production_stage_executions')
                .update({
                    finished_at: getNow().toISOString(),
                    updated_at: getNow().toISOString(),
                })
                .eq('production_id', productionId)
                .eq('stage_id', stageId)
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['production_stage_executions', productionId] });
        },
    });

    const getStageExecution = (stageId: string) => {
        return stageExecutions.find(e => e.stage_id === stageId);
    };

    return {
        stageExecutions,
        isLoading,
        startStage,
        finishStage,
        getStageExecution,
    };
}
