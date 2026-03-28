
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useOwnerId } from './useOwnerId';
import { TechnicalSheetWithIngredients } from './useTechnicalSheets';

export function useTechnicalSheet(id: string | null) {
    const { user } = useAuth();
    const { ownerId, isLoading: isOwnerLoading } = useOwnerId();

    return useQuery({
        queryKey: ['technical_sheet', id],
        queryFn: async () => {
            if (!id || (!user?.id && !ownerId)) return null;

            const { data, error } = await supabase
                .from('technical_sheets')
                .select(`
          *,
          ingredients:technical_sheet_ingredients(
            *,
            stock_item:stock_items(name, unit, unit_price)
          )
        `)
                .eq('id', id)
                .single();

            if (error) throw error;

            return {
                ...data,
                production_type: (data as any).production_type || 'final',
                minimum_stock: Number((data as any).minimum_stock || 0),
            } as TechnicalSheetWithIngredients;
        },
        enabled: !!id && (!!user?.id || !!ownerId) && !isOwnerLoading,
        staleTime: 5 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
    });
}
