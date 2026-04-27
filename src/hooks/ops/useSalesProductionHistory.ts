import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOwnerId } from './useOwnerId';
import { subDays } from 'date-fns';
import { formatInBrasilia } from '@/lib/utils';

export interface ProductionHistoryItem {
    technicalSheetId: string;
    name: string;
    unit: string;
    totalSales: number;
    productionUsed: number;
    currentStock: number;
    toProduce: number;
}

export function useSalesProductionHistory(baseDate: Date, days: number = 7) {
    const { ownerId } = useOwnerId();

    return useQuery({
        queryKey: ['sales_production_history', ownerId, baseDate.toISOString(), days],
        queryFn: async () => {
            if (!ownerId) return [];

            const startDate = formatInBrasilia(subDays(baseDate, days), 'yyyy-MM-dd');
            const endDate = formatInBrasilia(baseDate, 'yyyy-MM-dd');

            // 1. Fetch all technical sheets
            const { data: sheets, error: sErr } = await supabase
                .from('technical_sheets')
                .select('id, name, yield_unit');

            if (sErr) throw sErr;

            // 2. Fetch sales products and their components to link sales to sheets
            const { data: components, error: cErr } = await supabase
                .from('sale_product_components')
                .select('sale_product_id, component_id, quantity')
                .eq('component_type', 'finished_production');

            if (cErr) throw cErr;

            // 3. Fetch sales in the period
            const { data: sales, error: salesErr } = await supabase
                .from('sales')
                .select('sale_product_id, quantity_sold')
                .gte('sale_date', `${startDate}T00:00:00`)
                .lte('sale_date', `${endDate}T23:59:59`);

            if (salesErr) throw salesErr;

            // 4. Fetch current stock
            const { data: stock, error: stockErr } = await supabase
                .from('finished_productions_stock')
                .select('technical_sheet_id, quantity');

            if (stockErr) throw stockErr;

            // Aggregation maps
            const salesMap = new Map<string, number>(); // technical_sheet_id -> qty
            const stockMap = new Map<string, number>(); // technical_sheet_id -> qty

            // Map stock
            stock?.forEach(s => {
                stockMap.set(s.technical_sheet_id, (stockMap.get(s.technical_sheet_id) || 0) + Number(s.quantity));
            });

            // Map sales to technical sheets
            sales?.forEach(sale => {
                const prodComponents = components?.filter(c => c.sale_product_id === sale.sale_product_id);
                prodComponents?.forEach(comp => {
                    const totalNeeded = Number(comp.quantity) * Number(sale.quantity_sold);
                    salesMap.set(comp.component_id, (salesMap.get(comp.component_id) || 0) + totalNeeded);
                });
            });

            // 5. Build results
            const results: ProductionHistoryItem[] = sheets.map(sheet => {
                const totalSales = salesMap.get(sheet.id) || 0;
                const currentStock = stockMap.get(sheet.id) || 0;

                // "Production Used" in the context of history often means what was actually consumed.
                // For simplicity, we can equate consumed production to sales for now, OR 
                // look at stock_movements if they exist for finished productions (currently they don't seem to).
                // Let's use totalSales as the primary consumption metric.
                const productionUsed = totalSales;

                // Calculation for toProduce: (Total Sales + some buffer if needed) - stock
                const buffer = 0; // The user didn't specify a buffer here, but we could add 10% like in the other suggest logic
                const toProduce = Math.max(0, totalSales - currentStock);

                return {
                    technicalSheetId: sheet.id,
                    name: sheet.name,
                    unit: sheet.yield_unit,
                    totalSales,
                    productionUsed,
                    currentStock,
                    toProduce
                };
            });

            // Filter out items with no activity if needed, or return all
            return results.filter(r => r.totalSales > 0 || r.currentStock > 0);
        },
        enabled: !!ownerId,
        staleTime: 10 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
    });
}
