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
            try {
                // First get basic profile (array format to behave like maybeSingle)
                let profiles: any = null;
                try {
                    profiles = await supabaseFetch(`profiles?id=eq.${user.id}&select=*`);
                } catch (fetchErr: any) {
                    if (fetchErr.status === 406 || fetchErr.message?.includes('PGRST116')) {
                        console.warn("useProfile: 406/PGRST116 Profile not found, proceeding to fallback creation...");
                        profiles = null;
                    } else {
                        throw fetchErr;
                    }
                }

                let profile = Array.isArray(profiles) ? profiles[0] : profiles;

                // Fallback: Create profile automatically if it doesn't exist
                if (!profile) {
                    console.log("useProfile: Profile not found. Creating fallback profile...");
                    const newProfileData = {
                        id: user.id,
                        email: user.email,
                        full_name: user.user_metadata?.name || user.email?.split('@')[0] || 'Usuário',
                        role: 'user',
                        status: 'ativo',
                        status_pagamento: false
                    };
                    
                    try {
                        const { data: newProfile, error: insertError } = await supabase
                            .from('profiles')
                            .upsert([newProfileData], { onConflict: 'id', ignoreDuplicates: true })
                            .select()
                            .maybeSingle();
                            
                        if (insertError) {
                            console.error("useProfile: Error creating fallback profile", insertError);
                        } else if (newProfile) {
                            profile = newProfile;
                        }
                    } catch (e) {
                         console.error("useProfile: Exception creating fallback profile", e);
                    }
                }

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
        retry: 1,
        staleTime: 30_000,        // Profile re-fetches after 30s (catches admin DB updates quickly)
        gcTime: 5 * 60 * 1000,
    });


    return {
        profile,
        isLoading,
        error,
        refetch,
    };
}
