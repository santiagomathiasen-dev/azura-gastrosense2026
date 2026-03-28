import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOwnerId } from './useOwnerId';
import { toast } from 'sonner';

export interface CalendarEvent {
    id: string;
    user_id: string;
    title: string;
    description: string | null;
    event_date: string;
    multiplier: number;
    created_at: string;
}

export function useEvents() {
    const { ownerId } = useOwnerId();
    const queryClient = useQueryClient();

    const { data: events = [], isLoading } = useQuery({
        queryKey: ['calendar_events', ownerId],
        queryFn: async () => {
            if (!ownerId) return [];

            // Try to fetch from a hypothetical calendar_events table
            const { data, error } = await supabase
                .from('calendar_events' as any)
                .select('*')
                .eq('user_id', ownerId)
                .order('event_date', { ascending: true });

            if (error) {
                console.warn('Table calendar_events not found, using empty list.');
                return [];
            }
            return (data as unknown) as CalendarEvent[];
        },
        enabled: !!ownerId,
        staleTime: 5 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
    });

    const createEvent = useMutation({
        mutationFn: async (event: Omit<CalendarEvent, 'id' | 'user_id' | 'created_at'>) => {
            if (!ownerId) throw new Error('Usuário não autenticado');

            const { data, error } = await (supabase as any)
                .from('calendar_events')
                .insert([{ ...event, user_id: ownerId }])
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['calendar_events'] });
            toast.success('Evento agendado com sucesso!');
        },
        onError: (err: Error) => {
            toast.error(`Erro ao agendado evento: ${err.message}`);
        },
    });

    const deleteEvent = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from('calendar_events' as any)
                .delete()
                .eq('id', id);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['calendar_events'] });
            toast.success('Evento removido!');
        },
    });

    return {
        events,
        isLoading,
        createEvent,
        deleteEvent,
    };
}
