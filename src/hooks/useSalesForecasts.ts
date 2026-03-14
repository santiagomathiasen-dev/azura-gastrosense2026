import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useOwnerId } from './useOwnerId';
import { toast } from 'sonner';
import { supabaseFetch } from '@/lib/supabase-fetch';

export interface SalesForecast {
    id: string;
    user_id: string;
    sale_product_id: string;
    target_date: string;
    forecasted_quantity: number;
    notes: string | null;
    created_at: string;
    sale_product?: { id: string; name: string; image_url: string | null };
}

export function useSalesForecasts(targetDate?: string) {
    const { user } = useAuth();
    const { ownerId, isLoading: isOwnerLoading } = useOwnerId();
    const queryClient = useQueryClient();

    const { data: forecasts = [], isLoading } = useQuery({
        queryKey: ['sales_forecasts', ownerId, targetDate],
        queryFn: async () => {
            if (!user?.id && !ownerId) return [];

            let url = `sales_forecasts?select=*,sale_product:sale_products(id,name,image_url)&order=created_at.desc`;

            if (targetDate) {
                url += `&target_date=eq.${targetDate}`;
            }

            const data = await supabaseFetch(url);
            return data as SalesForecast[];
        },
        enabled: (!!user?.id || !!ownerId) && !isOwnerLoading,
        refetchInterval: 30_000,
    });

    const createForecast = useMutation({
        mutationFn: async (forecast: {
            sale_product_id: string;
            target_date: string;
            forecasted_quantity: number;
            notes?: string;
        }) => {
            if (isOwnerLoading) throw new Error('Carregando dados do usuário...');
            if (!ownerId) throw new Error('Usuário não autenticado');

            const response = await supabaseFetch('sales_forecasts?on_conflict=user_id,sale_product_id,target_date', {
                method: 'POST',
                headers: {
                    'Prefer': 'resolution=merge-duplicates,return=representation',
                },
                body: JSON.stringify({
                    user_id: ownerId,
                    sale_product_id: forecast.sale_product_id,
                    target_date: forecast.target_date,
                    forecasted_quantity: forecast.forecasted_quantity,
                    notes: forecast.notes || null,
                })
            });
            return response;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['sales_forecasts'] });
            toast.success('Previsão salva!');
        },
        onError: (err: Error) => {
            toast.error(`Erro ao salvar previsão: ${err.message}`);
        },
    });

    const updateForecast = useMutation({
        mutationFn: async ({ id, ...updates }: {
            id: string;
            forecasted_quantity?: number;
            notes?: string;
        }) => {
            await supabaseFetch(`sales_forecasts?id=eq.${id}`, {
                method: 'PATCH',
                body: JSON.stringify(updates)
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['sales_forecasts'] });
            toast.success('Previsão atualizada!');
        },
        onError: (err: Error) => {
            toast.error(`Erro ao atualizar previsão: ${err.message}`);
        },
    });

    const deleteForecast = useMutation({
        mutationFn: async (id: string) => {
            await supabaseFetch(`sales_forecasts?id=eq.${id}`, {
                method: 'DELETE'
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['sales_forecasts'] });
            toast.success('Previsão removida!');
        },
        onError: (err: Error) => {
            toast.error(`Erro ao remover previsão: ${err.message}`);
        },
    });

    const generateForecast = useMutation({
        mutationFn: async ({ targetDate, baseDate, bufferPercent, periodType }: { targetDate: string, baseDate: string, bufferPercent: number, periodType?: string }) => {
            if (!ownerId) throw new Error('Usuário não autenticado');

            // 1. Fetch sales products
            const products = await supabaseFetch(`sale_products?user_id=eq.${ownerId}&is_active=eq.true&select=id,name`);
            const productsArray = Array.isArray(products) ? products : (products ? [products] : []);

            // 2. Fetch sales from baseDate (full day range)
            const sales = await supabaseFetch(`sales?sale_date=gte.${baseDate}T00:00:00&sale_date=lte.${baseDate}T23:59:59&select=sale_product_id,quantity_sold`);
            const salesArray = Array.isArray(sales) ? sales : (sales ? [sales] : []);

            // 3. Check for events on target date
            const events = await supabaseFetch(`calendar_events?event_date=eq.${targetDate}&select=multiplier`);
            const eventsArray = Array.isArray(events) ? events : (events ? [events] : []);

            const eventMultiplier = eventsArray.reduce((acc, ev) => acc * Number(ev.multiplier), 1) || 1;

            // 4. Calculate and upsert forecasts
            const baseMultiplier = 1 + (bufferPercent / 100);
            const totalMultiplier = baseMultiplier * eventMultiplier;

            const forecastsToUpsert = productsArray.map(product => {
                const productSale = salesArray.find(s => s.sale_product_id === product.id);
                const quantity = productSale ? productSale.quantity_sold * totalMultiplier : 0;

                let notes = `Sugerido com base em ${baseDate} (+${bufferPercent}%)`;
                if (eventMultiplier !== 1) {
                    notes += ` x Evento (${eventMultiplier}x)`;
                }

                return {
                    user_id: ownerId,
                    sale_product_id: product.id,
                    target_date: targetDate,
                    forecasted_quantity: Math.ceil(quantity),
                    notes: notes
                };
            }).filter(f => f.forecasted_quantity > 0);

            if (forecastsToUpsert.length === 0) {
                throw new Error('Não foram encontradas vendas na data base selecionada.');
            }

            await supabaseFetch('sales_forecasts?on_conflict=user_id,sale_product_id,target_date', {
                method: 'POST',
                headers: {
                    'Prefer': 'resolution=merge-duplicates,return=representation',
                },
                body: JSON.stringify(forecastsToUpsert)
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['sales_forecasts'] });
            toast.success('Sugestão gerada com sucesso!');
        },
        onError: (err: Error) => {
            toast.error(`Erro ao gerar sugestão: ${err.message}`);
        },
    });

    return {
        forecasts,
        isLoading,
        createForecast,
        updateForecast,
        deleteForecast,
        generateForecast,
    };
}
