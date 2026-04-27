import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import { supabaseFetch } from '@/lib/supabase-fetch';

export interface Collaborator {
  id: string;
  gestor_id: string;
  name: string;
  email: string | null;
  pin_hash: string | null;
  auth_user_id: string | null;
  role?: string;
  is_active: boolean;
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
  created_at: string;
  updated_at: string;
}

export interface CollaboratorPermissions {
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
}

// Hash function for PIN
export async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin + 'azura_salt_2024');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function useCollaborators() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: collaborators = [], isLoading } = useQuery({
    queryKey: ['collaborators', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      try {
        const profile = await supabaseFetch(`profiles?id=eq.${user.id}&select=role`);
        const userRole = Array.isArray(profile) ? profile[0]?.role : profile?.role;

        let path = 'collaborators?select=*';

        // If not admin, filter by gestor_id
        if (userRole !== 'admin') {
          path += `&gestor_id=eq.${user.id}`;
        }

        const data = await supabaseFetch(`${path}&order=name.asc`);

        // Map back to interface expected by UI
        return (data as any[]).map(p => ({
          ...p,
          is_active: p.is_active
        })) as Collaborator[];
      } catch (err) {
        console.error("useCollaborators QUERY ERROR:", err);
        throw err;
      }
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const createCollaborator = useMutation({
    mutationFn: async ({ name, email, password, pin, permissions }: { name: string; email: string; password?: string; pin?: string; permissions: any }) => {
      if (!user?.id) throw new Error('Usuário não autenticado');

      // Edge function still handles the complex Auth creation
      try {
        const data = await supabaseFetch('functions/v1/create-collaborator', {
          method: 'POST',
          body: JSON.stringify({ name, email, password, pin, permissions }),
        });
        return data.collaborator;
      } catch (error: any) {
        throw new Error(error.message || 'Erro ao criar colaborador');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collaborators'] });
      toast.success('Colaborador criado com sucesso!');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao criar colaborador: ${err.message}`);
    },
  });

  const updateCollaborator = useMutation({
    mutationFn: async ({ id, name, pin, permissions }: { id: string; name: string; pin?: string; permissions: any }) => {
      const { role, ...otherPerms } = permissions;

      const updateData: Record<string, unknown> = {
        name: name,
        ...otherPerms,
      };

      if (pin) {
        updateData.pin_hash = await hashPin(pin);
      }

      // Update collaborators table
      await supabaseFetch(`collaborators?id=eq.${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updateData)
      });

      // Also update role in profiles table if it's connected to an auth user
      try {
        const collabList = await supabaseFetch(`collaborators?id=eq.${id}&select=auth_user_id`);
        const collabData = Array.isArray(collabList) ? collabList[0] : collabList;

        if (collabData?.auth_user_id && role) {
          await supabaseFetch(`profiles?id=eq.${collabData.auth_user_id}`, {
            method: 'PATCH',
            body: JSON.stringify({
              role,
              gestor_id: role === 'gestor' || role === 'admin' ? null : user?.id,
              ...otherPerms
            })
          });
        }
      } catch (profileError) {
        console.error("Error updating profile role:", profileError);
        // Don't throw here to not block the whole operation if profile update fails
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collaborators'] });
      toast.success('Colaborador atualizado!');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao atualizar: ${err.message}`);
    },
  });

  const deleteCollaborator = useMutation({
    mutationFn: async (id: string) => {
      try {
        await supabaseFetch('functions/v1/delete-collaborator', {
          method: 'POST',
          body: JSON.stringify({ collaboratorId: id }),
        });
      } catch (error: any) {
        throw new Error(error.message || 'Erro ao remover colaborador');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collaborators'] });
      toast.success('Colaborador removido!');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao remover: ${err.message}`);
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      await supabaseFetch(`collaborators?id=eq.${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: isActive })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collaborators'] });
    },
  });

  const resetPin = useMutation({
    mutationFn: async (id: string) => {
      await supabaseFetch(`collaborators?id=eq.${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ pin_hash: null })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collaborators'] });
      toast.success('PIN resetado!');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao resetar PIN: ${err.message}`);
    },
  });

  return {
    collaborators,
    isLoading,
    createCollaborator,
    updateCollaborator,
    deleteCollaborator,
    toggleActive,
    resetPin,
  };
}

export function useCollaboratorAuth() {
  const verifyPin = async (collaboratorId: string, pin: string): Promise<boolean> => {
    const hashedPin = await hashPin(pin);

    try {
      const data = await supabaseFetch(`collaborators?id=eq.${collaboratorId}&select=pin_hash`);
      const collab = Array.isArray(data) ? data[0] : data;
      return collab?.pin_hash === hashedPin;
    } catch (error) {
      console.error("Error verifying PIN:", error);
      return false;
    }
  };

  const setPin = async (collaboratorId: string, pin: string): Promise<boolean> => {
    const hashedPin = await hashPin(pin);

    try {
      await supabaseFetch(`collaborators?id=eq.${collaboratorId}`, {
        method: 'PATCH',
        body: JSON.stringify({ pin_hash: hashedPin })
      });
      return true;
    } catch (error) {
      return false;
    }
  };

  return {
    verifyPin,
    setPin,
  };
}
