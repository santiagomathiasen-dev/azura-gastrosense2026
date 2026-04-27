import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import { useOwnerId } from './useOwnerId';
import { toast } from 'sonner';
import { supabaseFetch } from '@/lib/supabase-fetch';
import { supabase } from '@/integrations/supabase/client';

export interface PosIntegration {
    id: string;
    user_id: string;
    platform: string;
    name: string;
    credentials: any;
    status: 'connected' | 'disconnected' | 'error';
    last_sync_at: string | null;
    webhook_url: string | null;
    created_at: string;
    updated_at: string;
}

export function usePosIntegrations() {
    const { user } = useAuth();
    const { ownerId, isLoading: isOwnerLoading } = useOwnerId();
    const queryClient = useQueryClient();

    const { data: integrations = [], isLoading } = useQuery({
        queryKey: ['pos_integrations', ownerId],
        queryFn: async () => {
            if (!user?.id && !ownerId) return [];
            try {
                const data = await supabaseFetch('pos_integrations?order=created_at.desc');
                return data as PosIntegration[];
            } catch (err: any) {
                if (err.message && err.message.includes('does not exist')) {
                    // O banco de dados ainda não tem a tabela (fallback limpo para n dar crash 500)
                    return [];
                }
                throw err;
            }
        },
        enabled: (!!user?.id || !!ownerId) && !isOwnerLoading,
        staleTime: 5 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
        retry: false
    });

    const createIntegration = useMutation({
        mutationFn: async (integration: {
            platform: string;
            name: string;
            credentials: any;
        }) => {
            if (!ownerId) throw new Error('Usuário não autenticado');
            try {
                const data = await supabaseFetch('pos_integrations', {
                    method: 'POST',
                    headers: { 'Prefer': 'return=representation' },
                    body: JSON.stringify({
                        user_id: ownerId,
                        ...integration,
                        status: 'connected',
                    })
                });
                return data[0];
            } catch (err: any) {
                if (err.message && err.message.includes('does not exist')) {
                     throw new Error('A tabela pos_integrations não foi criada no Supabase ainda. Execute o script SQl no painel do Supabase!');
                }
                throw err;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pos_integrations'] });
            toast.success('Integração de PDV conectada com sucesso!');
        },
        onError: (err: Error) => {
            toast.error(`${err.message}`);
        },
    });

    const updateIntegration = useMutation({
        mutationFn: async ({ id, ...updates }: { id: string } & Partial<PosIntegration>) => {
            const data = await supabaseFetch(`pos_integrations?id=eq.${id}`, {
                method: 'PATCH',
                headers: { 'Prefer': 'return=representation' },
                body: JSON.stringify(updates)
            });
            return data[0];
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pos_integrations'] });
            toast.success('Configurações atualizadas!');
        },
        onError: (err: Error) => {
            toast.error(`Erro ao atualizar PDV: ${err.message}`);
        },
    });

    const deleteIntegration = useMutation({
        mutationFn: async (id: string) => {
            await supabaseFetch(`pos_integrations?id=eq.${id}`, {
                method: 'DELETE'
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pos_integrations'] });
            toast.success('PDV desativado e removido com sucesso!');
        },
        onError: (err: Error) => {
            toast.error(`Erro ao remover PDV: ${err.message}`);
        },
    });
    
    const syncIntegration = useMutation({
        mutationFn: async (id: string) => {
            console.log('Invoking sync-loyverse-pdv for ID:', id);
            const { data, error } = await supabase.functions.invoke('sync-loyverse-pdv', {
                body: { integration_id: id }
            });
            if (error) {
                console.error('Supabase Function Error:', error);
                throw error;
            }
            console.log('Sync Function Result:', data);
            return data;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['pos_integrations'] });
            toast.success(data?.message || 'Sincronização concluída com sucesso!');
        },
        onError: (err: Error) => {
            console.error('Sync Error:', err);
            toast.error(`Erro na sincronização: ${err.message}`);
        },
    });

    return {
        integrations,
        isLoading,
        createIntegration,
        updateIntegration,
        deleteIntegration,
        syncIntegration
    };
}
