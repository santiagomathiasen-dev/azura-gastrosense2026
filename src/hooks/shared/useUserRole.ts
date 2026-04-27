import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export type AppRole = 'admin' | 'gestor' | 'colaborador' | 'user';

export function useUserRole() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: ['user_profile_role', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user!.id)
        .maybeSingle();


      if (error) {
        console.error('useUserRole: ERROR fetching profile:', error);
        throw error;
      }
      return data;
    },
    enabled: !!user?.id,
    retry: false,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });


  const userRole = profile?.role as AppRole;
  const isAdmin = userRole === 'admin';
  const isGestor = userRole === 'gestor';
  const isColaborador = userRole === 'colaborador';
  const isBlocked = false; // The status column is not present in the production profiles table

  const assignRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ role } as any)
        .eq('id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user_profile_role'] });
      queryClient.invalidateQueries({ queryKey: ['profiles-management'] });
      toast.success('Papel atribuído com sucesso!');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao atribuir papel: ${err.message}`);
    },
  });

  return {
    userRole,
    isAdmin,
    isGestor,
    isColaborador,
    isBlocked,
    isLoading,
    assignRole,
    profile,
  };
}
