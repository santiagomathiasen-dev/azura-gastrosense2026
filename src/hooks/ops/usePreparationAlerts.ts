import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '../shared/useAuth';
import { useOwnerId } from '../shared/useOwnerId';
import { toast } from 'sonner';

export interface PreparationAlert {
    id: string;
    user_id: string;
    sale_product_id: string;
    missing_component_id: string;
    missing_component_type: string;
    missing_quantity: number;
    resolved: boolean;
    created_at: string;
    sale_product?: { name: string };
    missing_component_name?: string; // Will need to be fetched or joined
}

export function usePreparationAlerts() {
    const { user } = useAuth();
    const { ownerId, isLoading: isOwnerLoading } = useOwnerId();
    const queryClient = useQueryClient();

    const { data: alerts = [], isLoading } = useQuery({
        queryKey: ['preparation_alerts', ownerId],
        queryFn: async () => {
            if (!user?.id && !ownerId) return [];

            const { data, error } = await (supabase as any)
                .from('preparation_alerts')
                .select(`
          *,
          sale_product:sale_products(name)
        `)
                .eq('resolved', false)
                .order('created_at', { ascending: false });

            if (error) throw error;

            // We need to fetch the names of missing components manually since they can be from different tables
            // This is a bit inefficient but works for now. 
            // A better approach might be a database view or function.
            const alertsWithNames = await Promise.all(data.map(async (alert: any) => {
                let missingName = 'Desconhecido';

                if (alert.missing_component_type === 'stock_item') {
                    const { data: item } = await (supabase as any)
                        .from('stock_items')
                        .select('name')
                        .eq('id', alert.missing_component_id)
                        .single();
                    if (item) missingName = item.name;
                } else if (alert.missing_component_type === 'finished_production') {
                    const { data: sheet } = await (supabase as any)
                        .from('technical_sheets')
                        .select('name')
                        .eq('id', alert.missing_component_id)
                        .single();
                    if (sheet) missingName = sheet.name;
                } else if (alert.missing_component_type === 'sale_product') {
                    const { data: product } = await (supabase as any)
                        .from('sale_products')
                        .select('name')
                        .eq('id', alert.missing_component_id)
                        .single();
                    if (product) missingName = product.name;
                }

                return {
                    ...alert,
                    missing_component_name: missingName,
                };
            }));

            return alertsWithNames as PreparationAlert[];
        },
        enabled: (!!user?.id || !!ownerId) && !isOwnerLoading,
        refetchInterval: 15_000, // Auto-refresh every 15 seconds
        staleTime: 10_000,
    });

    const resolveAlert = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await (supabase as any)
                .from('preparation_alerts')
                .update({ resolved: true })
                .eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['preparation_alerts'] });
            toast.success('Alerta resolvido!');
        },
        onError: (err: Error) => {
            toast.error(`Erro ao resolver alerta: ${err.message}`);
        },
    });

    return {
        alerts,
        isLoading,
        resolveAlert,
    };
}
