import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { supabaseFetch } from '@/lib/supabase-fetch';

export function useProfile() {
    const { user } = useAuth();

    const { data: profile, isLoading, error, refetch } = useQuery({
        queryKey: ['profile', user?.id],
        queryFn: async () => {
            if (!user?.id) return null;
            console.log("useProfile: fetching profile via fetch for", user.id);
            try {
                // First get basic profile
                const profile = await supabaseFetch(`profiles?id=eq.${user.id}&select=*`, {
                    headers: {
                        'Accept': 'application/vnd.pgrst.object+json'
                    }
                });

                if (profile && profile.role === 'colaborador') {
                    // Fetch collaborator specific data (permissions)
                    const collabData = await supabaseFetch(`collaborators?auth_user_id=eq.${user.id}&select=*`, {
                        headers: {
                            'Accept': 'application/vnd.pgrst.object+json'
                        }
                    });

                    if (collabData) {
                        return { ...profile, ...collabData };
                    }
                }

                return profile;
            } catch (err) {
                console.error("useProfile: FETCH ERROR", err);
                throw err;
            }
        },
        enabled: !!user?.id,
        retry: false,
        staleTime: 5 * 60 * 1000, // Keep profile fresh for 5 minutes
        gcTime: 30 * 60 * 1000,   // Keep in cache for 30 minutes
    });


    return {
        profile,
        isLoading,
        error,
        refetch,
    };
}
