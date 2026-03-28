import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOwnerId } from './useOwnerId';
import { toast } from 'sonner';
import { supabaseFetch } from '@/lib/supabase-fetch';
import { getNow } from '@/lib/utils';

/**
 * Parses a YYYY-MM-DD string into a Date object at local time midnight.
 * This prevents timezone shifts (e.g., Brazil UTC-3 seeing the previous day).
 */
export function parseSafeDate(dateStr: string): Date {
    if (!dateStr) return new Date();
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
}

export interface ExpiryDate {
    id: string;
    user_id: string;
    stock_item_id: string;
    expiry_date: string;
    batch_name: string | null;
    quantity: number;
    notes: string | null;
    created_at: string;
}

export interface CreateExpiryDate {
    stock_item_id: string;
    expiry_date: string;
    batch_name?: string;
    quantity?: number;
    notes?: string;
}

export function useExpiryDates(stockItemId?: string) {
    const queryClient = useQueryClient();
    const { ownerId } = useOwnerId();

    const { data: expiryDates = [], isLoading } = useQuery({
        queryKey: ['expiry-dates', stockItemId, ownerId],
        queryFn: async () => {
            if (!ownerId) return [];
            try {
                let path = 'item_expiry_dates?select=*&order=expiry_date.asc';
                if (stockItemId) {
                    path += `&stock_item_id=eq.${stockItemId}`;
                }
                const data = await supabaseFetch(path);
                return (data || []) as unknown as ExpiryDate[];
            } catch (err) {
                console.error("Error fetching expiry dates:", err);
                throw err;
            }
        },
        enabled: !!ownerId,
        staleTime: 30_000,
        gcTime: 5 * 60 * 1000,
    });

    const addExpiryDate = useMutation({
        mutationFn: async (newDate: CreateExpiryDate) => {
            if (!ownerId) throw new Error('Usuário não autenticado');

            const { data, error } = await supabase
                .from('item_expiry_dates' as any)
                .insert({
                    user_id: ownerId,
                    stock_item_id: newDate.stock_item_id,
                    expiry_date: newDate.expiry_date,
                    batch_name: newDate.batch_name || null,
                    quantity: newDate.quantity || 0,
                    notes: newDate.notes || null,
                } as any)
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['expiry-dates'] });
            toast.success('Data de validade adicionada!');
        },
        onError: (error) => {
            console.error('Error adding expiry date:', error);
            toast.error('Erro ao adicionar data de validade');
        },
    });

    const updateExpiryQuantity = useMutation({
        mutationFn: async ({ id, quantity }: { id: string, quantity: number }) => {
            const { error } = await (supabase as any)
                .from('item_expiry_dates')
                .update({ quantity } as any)
                .eq('id', id);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['expiry-dates'] });
            queryClient.invalidateQueries({ queryKey: ['expiry-dates-all'] });
            queryClient.invalidateQueries({ queryKey: ['expiry-dates-all-map'] });
        },
        onError: (error) => {
            console.error('Error updating expiry quantity:', error);
            toast.error('Erro ao atualizar quantidade de validade');
        },
    });

    const removeExpiryDate = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from('item_expiry_dates' as any)
                .delete()
                .eq('id', id);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['expiry-dates'] });
            toast.success('Data de validade removida!');
        },
        onError: (error) => {
            console.error('Error removing expiry date:', error);
            toast.error('Erro ao remover data de validade');
        },
    });

    // Get all expiry alerts (items near or past expiry)
    const getExpiryAlerts = (allDates: ExpiryDate[], daysThreshold = 7) => {
        const now = getNow();
        const thresholdDate = new Date(now);
        thresholdDate.setDate(now.getDate() + daysThreshold);

        return allDates.filter(d => {
            const expiry = parseSafeDate(d.expiry_date);
            return expiry <= thresholdDate;
        }).map(d => {
            const expiry = parseSafeDate(d.expiry_date);
            const daysUntil = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            return {
                ...d,
                daysUntil,
                isExpired: daysUntil < 0,
                isNearExpiry: daysUntil >= 0 && daysUntil <= daysThreshold,
            };
        }).sort((a, b) => a.daysUntil - b.daysUntil);
    };

    // Helper to auto-deduct quantity using FIFO
    const autoDeductFIFO = async (stockItemId: string, quantityToDeduct: number) => {
        // Fetch batches for this item ordered by date ASC
        const { data: batches, error } = await supabase
            .from('item_expiry_dates' as any)
            .select('*')
            .eq('stock_item_id', stockItemId)
            .gt('quantity', 0)
            .order('expiry_date', { ascending: true });

        if (error || !batches) return;

        let remaining = quantityToDeduct;
        for (const batch of batches) {
            if (remaining <= 0) break;
            const take = Math.min(remaining, Number((batch as any).quantity));
            const newQty = Number((batch as any).quantity) - take;

            const { error: updateError } = await (supabase as any)
                .from('item_expiry_dates')
                .update({ quantity: newQty } as any)
                .eq('id', (batch as any).id);

            if (updateError) console.error('Error auto-deducting batch:', updateError);
            remaining -= take;
        }
    };

    return {
        expiryDates,
        isLoading,
        addExpiryDate,
        updateExpiryQuantity,
        removeExpiryDate,
        autoDeductFIFO,
        getExpiryAlerts,
    };
}

// Hook to get ALL expiry dates for dashboard alerts
export function useAllExpiryAlerts(daysThreshold = 7) {
    const { data: allExpiryDates = [], isLoading, error } = useQuery({
        queryKey: ['expiry-dates-all'],
        queryFn: async () => {
            try {
                const data = await supabaseFetch('item_expiry_dates?select=*,stock_item:stock_items(id,name,unit,category)&order=expiry_date.asc');
                return (data || []) as unknown as (ExpiryDate & { stock_item: { id: string; name: string; unit: string; category: string } })[];
            } catch (err) {
                console.error("Error fetching all expiry alerts:", err);
                throw err;
            }
        },
    });

    const now = getNow();
    const thresholdDate = new Date(now);
    thresholdDate.setDate(now.getDate() + daysThreshold);

    const alerts = allExpiryDates
        .filter(d => {
            const expiry = parseSafeDate(d.expiry_date);
            return expiry <= thresholdDate && Number(d.quantity) > 0;
        })
        .map(d => {
            const expiry = parseSafeDate(d.expiry_date);
            const daysUntil = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            return {
                ...d,
                daysUntil,
                isExpired: daysUntil < 0,
                isNearExpiry: daysUntil >= 0 && daysUntil <= daysThreshold,
            };
        })
        .sort((a, b) => a.daysUntil - b.daysUntil);

    return {
        alerts,
        isLoading,
        error,
        totalAlerts: alerts.length,
        expiredCount: alerts.filter(a => a.isExpired).length,
        nearExpiryCount: alerts.filter(a => a.isNearExpiry).length,
    };
}

export function useEarliestExpiryMap() {
    const { data: allExpiryDates = [], isLoading } = useQuery({
        queryKey: ['expiry-dates-all-map'],
        queryFn: async () => {
            try {
                const data = await supabaseFetch('item_expiry_dates?select=stock_item_id,expiry_date&quantity=gt.0&order=expiry_date.asc');
                return (data || []) as unknown as { stock_item_id: string; expiry_date: string }[];
            } catch (err) {
                console.error("Error fetching earliest expiry map:", err);
                throw err;
            }
        },
    });

    const expiryMap = useMemo(() => {
        const map: Record<string, string> = {};
        allExpiryDates.forEach(d => {
            // Since it's ordered by date, the first one encountered for each ID is the earliest
            if (!map[d.stock_item_id]) {
                map[d.stock_item_id] = d.expiry_date;
            }
        });
        return map;
    }, [allExpiryDates]);

    return {
        expiryMap,
        isLoading,
    };
}
