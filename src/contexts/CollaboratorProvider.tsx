'use client';

import { useState, useEffect, ReactNode } from 'react';
import { Collaborator } from '@/hooks/shared/useCollaborators';
import { supabase } from '@/integrations/supabase/client';
import { CollaboratorContext } from './CollaboratorContext';

const STORAGE_KEY = 'azura_collaborator_session';
const IMPERSONATION_KEY = 'azura_impersonation_id';

export function CollaboratorProvider({ children }: { children: ReactNode }) {
    const [collaborator, setCollaborator] = useState<Collaborator | null>(null);
    const [gestorId, setGestorId] = useState<string | null>(null);
    const [impersonatedGestorId, setImpersonatedGestorId] = useState<string | null>(null);

    useEffect(() => {
        // 1. Initial check for stored session (backwards compatibility)
        const collabStored = localStorage.getItem(STORAGE_KEY);
        if (collabStored) {
            try {
                const parsed = JSON.parse(collabStored);
                setCollaborator(parsed.collaborator);
                setGestorId(parsed.gestorId);
            } catch {
                localStorage.removeItem(STORAGE_KEY);
            }
        }

        // 2. Load impersonation from storage
        const impStored = localStorage.getItem(IMPERSONATION_KEY);
        if (impStored) {
            setImpersonatedGestorId(impStored);
        }

        // 3. Listen for Auth changes to automatically resolve Collaborator sessions
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (session?.user) {
                // Fetch profile to check if it's a collaborator
                const { data: profile, error } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', session.user.id)
                    .single() as { data: any, error: any };

                if (!error && profile && profile.role === 'colaborador') {
                    // Fetch additional collaborator data (permissions)
                    const { data: collaboratorData, error: collabError } = await supabase
                        .from('collaborators')
                        .select('*')
                        .eq('auth_user_id', profile.id)
                        .maybeSingle();

                    if (!collabError && collaboratorData) {
                        const collabData = {
                            ...(profile as any),
                            ...(collaboratorData as any),
                            auth_user_id: profile.id,
                            name: profile.full_name || profile.email || (collaboratorData as any).name || '',
                            is_active: (profile as any).status === 'ativo' || (collaboratorData as any).is_active
                        } as Collaborator;

                        setCollaborator(collabData);
                        const finalGestorId = (profile as any).gestor_id || (collaboratorData as any).gestor_id;
                        setGestorId(finalGestorId);
                        // Sync to localStorage for consistency
                        localStorage.setItem(STORAGE_KEY, JSON.stringify({ collaborator: collabData, gestorId: finalGestorId }));
                    }
                } else {
                    // If not a collaborator, or sign-out event
                    clearCollaboratorSession();
                    if (event === 'SIGNED_OUT') {
                        stopImpersonation();
                    }
                }
            } else {
                clearCollaboratorSession();
                stopImpersonation();
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const setCollaboratorSession = (collab: Collaborator, gId: string) => {
        setCollaborator(collab);
        setGestorId(gId);
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ collaborator: collab, gestorId: gId }));
    };

    const setImpersonation = (gId: string) => {
        setImpersonatedGestorId(gId);
        localStorage.setItem(IMPERSONATION_KEY, gId);
    };

    const clearCollaboratorSession = () => {
        setCollaborator(null);
        setGestorId(null);
        localStorage.removeItem(STORAGE_KEY);
    };

    const stopImpersonation = () => {
        setImpersonatedGestorId(null);
        localStorage.removeItem(IMPERSONATION_KEY);
    };

    const hasAccess = (route: string): boolean => {
        if (!collaborator) return true; // Gestor or Admin has full access

        const routePermissions: Record<string, keyof Collaborator> = {
            '/dashboard': 'can_access_dashboard',
            '/estoque': 'can_access_estoque',
            '/estoque-producao': 'can_access_estoque_producao',
            '/fichas': 'can_access_fichas',
            '/producao': 'can_access_producao',
            '/compras': 'can_access_compras',
            '/estoque-finalizados': 'can_access_finalizados',
            '/produtos-venda': 'can_access_produtos_venda',
            '/financeiro': 'can_access_financeiro',
            '/relatorios': 'can_access_relatorios',
        };

        const permission = routePermissions[route];
        if (!permission) return true;

        return collaborator[permission] as boolean;
    };

    return (
        <CollaboratorContext.Provider
            value={{
                collaborator,
                gestorId,
                impersonatedGestorId,
                isCollaboratorMode: !!collaborator,
                isImpersonating: !!impersonatedGestorId,
                setCollaboratorSession,
                setImpersonation,
                clearCollaboratorSession,
                stopImpersonation,
                hasAccess,
            }}
        >
            {children}
        </CollaboratorContext.Provider>
    );
}
