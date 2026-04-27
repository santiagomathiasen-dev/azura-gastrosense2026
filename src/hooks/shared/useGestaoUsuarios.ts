import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { adminSupabase } from '../../integrations/supabase/adminClient'; // admin client for protected functions
import { toast } from 'sonner';
import { Database } from '@/integrations/supabase/types';
import { supabaseFetch } from '@/lib/supabase-fetch';

export type BusinessRole = Database['public']['Enums']['business_role'];

export interface Profile {
    id: string;
    full_name: string | null;
    email: string | null;
    role: BusinessRole;
    status: 'ativo' | 'inativo';
    created_at: string;
}

export interface Gestor extends Profile {
    can_access_dashboard: boolean;
    can_access_estoque: boolean;
    can_access_estoque_producao: boolean;
    can_access_fichas: boolean;
    can_access_producao: boolean;
    can_access_compras: boolean;
    can_access_finalizados: boolean;
    can_access_produtos_venda: boolean;
    can_access_financeiro: boolean;
    can_access_relatorios: boolean;
    status_pagamento: boolean;
    subscription_end_date?: string | null;
    subscription_plan?: string | null;
}

export function useGestaoUsuarios() {
    const queryClient = useQueryClient();

    const { data: profiles = [], isLoading, error } = useQuery({
        queryKey: ['profiles-management'],
        queryFn: async () => {
            try {
                const data = await supabaseFetch('profiles?select=*&order=created_at.desc');
                return (data || []).map((p: any) => ({
                    ...p,
                    status: p.status || 'ativo',
                    can_access_financeiro: p.can_access_financeiro ?? true,
                    can_access_relatorios: p.can_access_relatorios ?? true,
                })) as Gestor[];
            } catch (err) {
                console.error("useGestaoUsuarios QUERY ERROR:", err);
                throw err;
            }
        },
    });

    const createGestor = useMutation({
        mutationFn: async (data: any) => {
            try {
                const result = await supabaseFetch('functions/v1/manage-gestors', {
                    method: 'POST',
                    body: JSON.stringify({ action: 'create', ...data }),
                });
                return result;
            } catch (error: any) {
                throw new Error(error.message || 'Erro ao criar gestor');
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['profiles-management'] });
            toast.success('Gestor criado com sucesso');
        },
        onError: (error: any) => {
            toast.error('Erro ao criar gestor: ' + error.message);
        }
    });

    const updatePermissions = useMutation({
        mutationFn: async ({ gestorId, permissions }: { gestorId: string; permissions: any }) => {
            try {
                const result = await supabaseFetch('functions/v1/manage-gestors', {
                    method: 'POST',
                    body: JSON.stringify({ action: 'update_permissions', gestorId, permissions }),
                });
                return result;
            } catch (error: any) {
                throw new Error(error.message || 'Erro ao atualizar permissões');
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['profiles-management'] });
            toast.success('Permissões atualizadas');
        }
    });

    const updateStatus = useMutation({
        mutationFn: async ({ id, status }: { id: string; status: 'ativo' | 'inativo' }) => {
            try {
                await supabaseFetch('functions/v1/manage-gestors', {
                    method: 'POST',
                    body: JSON.stringify({ action: 'toggle_status', gestorId: id, active: status === 'ativo' }),
                });
            } catch (error: any) {
                throw new Error(error.message || 'Erro ao atualizar status');
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['profiles-management'] });
            toast.success('Status atualizado');
        },
    });

    const deleteGestor = useMutation({
        mutationFn: async (id: string) => {
            try {
                await supabaseFetch('functions/v1/manage-gestors', {
                    method: 'POST',
                    body: JSON.stringify({ action: 'delete', gestorId: id }),
                });
            } catch (error: any) {
                throw new Error(error.message || 'Erro ao excluir gestor');
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['profiles-management'] });
            toast.success('Gestor excluído');
        }
    });

    const updateSubscription = useMutation({
        mutationFn: async ({ id, days, plan }: { id: string; days: number; plan?: string }) => {
            const end_date = days > 0
                ? new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
                : null;
            const { error } = await supabase
                .from('profiles')
                .update({
                    subscription_end_date: end_date,
                    ...(plan ? { subscription_plan: plan } : {}),
                    status_pagamento: days > 0,
                })
                .eq('id', id);
            if (error) throw new Error(error.message);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['profiles-management'] });
            toast.success('Assinatura atualizada');
        },
        onError: (error: any) => {
            toast.error('Erro ao atualizar assinatura: ' + error.message);
        }
    });

    return {
        profiles,
        isLoading,
        error,
        createGestor,
        updatePermissions,
        updateStatus,
        updateSubscription,
        deleteGestor
    };
}

