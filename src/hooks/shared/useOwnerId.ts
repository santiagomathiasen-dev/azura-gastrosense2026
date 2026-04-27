import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useCollaboratorContext } from '@/contexts/CollaboratorContext';
import { supabaseFetch } from '@/lib/supabase-fetch';

/**
 * Hook that returns the correct owner_id for data operations.
 * - For gestors: returns their own user ID
 * - For collaborators: returns the gestor's ID
 * 
 * This ensures all data is associated with the gestor, enabling
 * data sharing between gestors and their collaborators.
 */
export function useOwnerId() {
  const { user } = useAuth();
  const { isCollaboratorMode, gestorId, impersonatedGestorId, isImpersonating } = useCollaboratorContext();

  // For collaborators, we already have the gestorId from context
  // For gestors/admins, we call the database function to get the owner_id
  const { data: ownerId, isLoading } = useQuery({
    queryKey: ['owner_id', user?.id, isCollaboratorMode, gestorId, impersonatedGestorId],
    queryFn: async () => {
      // If Admin is impersonating a gestor, use that ID
      if (isImpersonating && impersonatedGestorId) {
        return impersonatedGestorId;
      }

      // If in collaborator mode, use the gestorId from context
      if (isCollaboratorMode && gestorId) {
        return gestorId;
      }

      // If not in collaborator mode, call the database function
      if (!user?.id) return null;

      try {
        const data = await supabaseFetch('rpc/get_owner_id', { method: 'POST' });
        return data as string;
      } catch (error) {
        console.error('Error getting owner_id via fetch:', error);
        return user.id; // Fallback to user's own ID
      }
    },
    enabled: !!user?.id || isCollaboratorMode || isImpersonating,
    staleTime: Infinity,
    retry: false,
  });

  return {
    ownerId: ownerId ?? impersonatedGestorId ?? gestorId ?? user?.id ?? null,
    isLoading: isLoading && !ownerId, // Don't show loading if we already have a value
  };
}
