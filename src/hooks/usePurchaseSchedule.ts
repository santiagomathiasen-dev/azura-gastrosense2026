import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useOwnerId } from './useOwnerId';
import { toast } from 'sonner';
import { getNow } from '@/lib/utils';
import { useProductions } from './useProductions';
import { useSuppliers } from './useSuppliers';
import { supabaseFetch } from '@/lib/supabase-fetch';
import type { Database } from '@/integrations/supabase/types';

type PurchaseSchedule = Database['public']['Tables']['purchase_schedule']['Row'];
type PurchaseScheduleInsert = Database['public']['Tables']['purchase_schedule']['Insert'];

export type { PurchaseSchedule };

const DAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export function usePurchaseSchedule() {
  const { user } = useAuth();
  const { ownerId } = useOwnerId();
  const queryClient = useQueryClient();
  const { plannedProductions } = useProductions();
  const { suppliers } = useSuppliers();

  // Query uses RLS - no need to filter by user_id client-side
  const { data: schedules = [], isLoading, error } = useQuery({
    queryKey: ['purchase_schedule', ownerId],
    queryFn: async () => {
      if (!user?.id && !ownerId) return [];
      const data = await supabaseFetch(`purchase_schedule?select=*,supplier:suppliers(name)&order=day_of_week`);
      return data as (PurchaseSchedule & { supplier: { name: string } | null })[];
    },
    enabled: !!user?.id || !!ownerId,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  // Calculate suggested purchase days based on production schedule
  const suggestedPurchaseDays = (() => {
    const productionDays = new Set<number>();

    plannedProductions.forEach(prod => {
      const date = new Date(prod.scheduled_date);
      productionDays.add(date.getDay());
    });

    // Suggest purchasing 1-2 days before production day
    const purchaseDays: { dayOfWeek: number; productionDay: number; dayName: string }[] = [];
    productionDays.forEach(prodDay => {
      const purchaseDay = prodDay === 0 ? 5 : prodDay - 1; // If Sunday, suggest Friday
      purchaseDays.push({
        dayOfWeek: purchaseDay,
        productionDay: prodDay,
        dayName: DAY_NAMES[purchaseDay],
      });
    });

    return purchaseDays;
  })();

  // Create schedule entry
  const createSchedule = useMutation({
    mutationFn: async (schedule: Omit<PurchaseScheduleInsert, 'user_id'>) => {
      if (!ownerId) throw new Error('Usuário não autenticado');
      const data = await supabaseFetch(`purchase_schedule`, {
        method: 'POST',
        body: JSON.stringify({ ...schedule, user_id: ownerId }),
        headers: { 'Prefer': 'return=representation' }
      });
      return data[0];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase_schedule'] });
      toast.success('Dia de compra adicionado!');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao adicionar: ${err.message}`);
    },
  });

  // Update schedule
  const updateSchedule = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<PurchaseSchedule> & { id: string }) => {
      const data = await supabaseFetch(`purchase_schedule?id=eq.${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
        headers: { 'Prefer': 'return=representation' }
      });
      return data[0];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase_schedule'] });
      toast.success('Cronograma atualizado!');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao atualizar: ${err.message}`);
    },
  });

  // Delete schedule entry
  const deleteSchedule = useMutation({
    mutationFn: async (id: string) => {
      await supabaseFetch(`purchase_schedule?id=eq.${id}`, {
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase_schedule'] });
      toast.success('Dia de compra removido!');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao remover: ${err.message}`);
    },
  });

  // Check if today is a purchase day
  const isTodayPurchaseDay = schedules.some(s => s.day_of_week === getNow().getDay() && s.order_day);

  // Get next purchase day
  const getNextPurchaseDay = (): { dayName: string; daysUntil: number } | null => {
    const today = getNow().getDay();
    const purchaseDays = schedules.filter(s => s.order_day).map(s => s.day_of_week);

    if (purchaseDays.length === 0) return null;

    let minDays = 8;
    let nextDay = 0;

    purchaseDays.forEach(day => {
      let daysUntil = day - today;
      if (daysUntil <= 0) daysUntil += 7;
      if (daysUntil < minDays) {
        minDays = daysUntil;
        nextDay = day;
      }
    });

    return {
      dayName: DAY_NAMES[nextDay],
      daysUntil: minDays,
    };
  };

  return {
    schedules,
    isLoading,
    error,
    createSchedule,
    updateSchedule,
    deleteSchedule,
    suggestedPurchaseDays,
    isTodayPurchaseDay,
    getNextPurchaseDay,
    DAY_NAMES,
  };
}
