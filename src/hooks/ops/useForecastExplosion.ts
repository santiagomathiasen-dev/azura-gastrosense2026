import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOwnerId } from './useOwnerId';
import { toast } from 'sonner';

interface ExplosionResult {
    technicalSheetId: string;
    technicalSheetName: string;
    productionDate: string;
    targetDate: string;
    requiredQuantity: number;
    existingStock: number;
    netQuantity: number;
    praca: string | null;
    unit: string;
    servesProducts: string[];
    shelfLifeWarning?: string;
}

/**
 * Hook that implements the "explosion" algorithm:
 * Takes sales forecasts for a target date and generates production orders
 * by resolving sale product components into sub-recipes, calculating
 * production dates based on lead time, and aggregating across products.
 */
export function useForecastExplosion() {
    const { ownerId } = useOwnerId();
    const queryClient = useQueryClient();

    const explode = useMutation({
        mutationFn: async (targetDate: string): Promise<ExplosionResult[]> => {
            if (!ownerId) throw new Error('Usuário não autenticado');

            // 1. Fetch all forecasts for target date
            const { data: forecasts, error: fErr } = await supabase
                .from('sales_forecasts')
                .select(`
          *,
          sale_product:sale_products(id, name)
        `)
                .eq('target_date', targetDate);

            if (fErr) throw fErr;
            if (!forecasts || forecasts.length === 0) {
                throw new Error('Nenhuma previsão encontrada para esta data.');
            }

            // 2. For each forecast, resolve its components
            // Map: technical_sheet_id -> { qty, unit, servesProducts[], targetDate }
            const demandMap = new Map<string, {
                qty: number;
                unit: string;
                yieldQty: number;
                servesProducts: string[];
                leadTimeHours: number;
                shelfLifeHours: number;
                praca: string | null;
                name: string;
            }>();

            for (const forecast of forecasts) {
                const productName = ((forecast as any).sale_product as any)?.name || 'Produto';

                // Get components of this sale product
                const { data: components, error: cErr } = await (supabase as any)
                    .from('sale_product_components')
                    .select('*')
                    .eq('sale_product_id', (forecast as any).sale_product_id);

                if (cErr) throw cErr;
                if (!components) continue;

                for (const comp of components) {
                    if (comp.component_type === 'finished_production') {
                        // This is a sub-recipe (technical_sheet)
                        const qtyNeeded = Number(comp.quantity) * (forecast as any).forecasted_quantity;

                        // Get technical sheet details
                        const { data: sheet } = await (supabase as any)
                            .from('technical_sheets')
                            .select('id, name, yield_quantity, yield_unit, lead_time_hours, shelf_life_hours, praca')
                            .eq('id', comp.component_id)
                            .single();

                        if (!sheet) continue;

                        const existing = demandMap.get(sheet.id);
                        if (existing) {
                            existing.qty += qtyNeeded;
                            if (!existing.servesProducts.includes(`${productName} (${(forecast as any).forecasted_quantity})`)) {
                                existing.servesProducts.push(`${productName} (${(forecast as any).forecasted_quantity})`);
                            }
                        } else {
                            demandMap.set(sheet.id, {
                                qty: qtyNeeded,
                                unit: sheet.yield_unit,
                                yieldQty: Number(sheet.yield_quantity),
                                servesProducts: [`${productName} (${(forecast as any).forecasted_quantity})`],
                                leadTimeHours: Number(sheet.lead_time_hours) || 0,
                                shelfLifeHours: Number(sheet.shelf_life_hours) || 9999,
                                praca: sheet.praca,
                                name: sheet.name,
                            });
                        }
                    }
                    // stock_items go to purchase list, not production orders
                }
            }

            // 3. Calculate production dates, check stock, generate results
            const results: ExplosionResult[] = [];
            const targetDateObj = new Date(targetDate + 'T12:00:00');

            for (const [sheetId, demand] of demandMap.entries()) {
                // Calculate production date based on lead time
                const productionDateObj = new Date(targetDateObj);
                productionDateObj.setHours(productionDateObj.getHours() - demand.leadTimeHours);
                const productionDate = productionDateObj.toISOString().split('T')[0];

                // Check shelf life validity
                const expiryDateObj = new Date(productionDateObj);
                expiryDateObj.setHours(expiryDateObj.getHours() + demand.shelfLifeHours);
                let shelfLifeWarning: string | undefined;
                if (expiryDateObj < targetDateObj) {
                    shelfLifeWarning = `⚠️ Produzido em ${productionDate} vence antes do consumo em ${targetDate}!`;
                }

                // Check existing stock (finished_productions_stock)
                const { data: stockEntry } = await (supabase as any)
                    .from('finished_productions_stock')
                    .select('quantity')
                    .eq('technical_sheet_id', sheetId)
                    .single();

                const existingStock = stockEntry ? Number(stockEntry.quantity) : 0;

                // Check produced_inputs_stock with valid expiration
                const { data: inputsStock } = await (supabase as any)
                    .from('produced_inputs_stock')
                    .select('quantity')
                    .eq('technical_sheet_id', sheetId)
                    .gte('expiration_date', targetDate);

                const inputsStockQty = inputsStock
                    ? inputsStock.reduce((sum, s) => sum + Number(s.quantity), 0)
                    : 0;

                const totalExisting = existingStock + inputsStockQty;

                // Round up to full batches
                const batchesNeeded = Math.ceil(demand.qty / demand.yieldQty);
                const roundedQty = batchesNeeded * demand.yieldQty;

                const netQuantity = Math.max(0, roundedQty - totalExisting);

                results.push({
                    technicalSheetId: sheetId,
                    technicalSheetName: demand.name,
                    productionDate,
                    targetDate,
                    requiredQuantity: roundedQty,
                    existingStock: totalExisting,
                    netQuantity,
                    praca: demand.praca,
                    unit: demand.unit,
                    servesProducts: demand.servesProducts,
                    shelfLifeWarning,
                });
            }

            // 4. Save to database: delete old orders for this target date, insert new ones
            await (supabase as any)
                .from('forecast_production_orders')
                .delete()
                .eq('user_id', ownerId)
                .eq('target_consumption_date', targetDate)
                .in('status', ['pending']);

            const ordersToInsert = results
                .filter(r => r.netQuantity > 0)
                .map(r => ({
                    user_id: ownerId,
                    technical_sheet_id: r.technicalSheetId,
                    production_date: r.productionDate,
                    target_consumption_date: r.targetDate,
                    required_quantity: r.requiredQuantity,
                    existing_stock: r.existingStock,
                    net_quantity: r.netQuantity,
                    praca: r.praca as any || 'praca_quente',
                    status: 'pending' as const,
                }));

            if (ordersToInsert.length > 0) {
                const { error: insertErr } = await (supabase as any)
                    .from('forecast_production_orders')
                    .insert(ordersToInsert);

                if (insertErr) throw insertErr;
            }

            return results;
        },
        onSuccess: (results) => {
            queryClient.invalidateQueries({ queryKey: ['forecast_production_orders'] });
            const withProduction = results.filter(r => r.netQuantity > 0);
            toast.success(`Explosão concluída! ${withProduction.length} ordem(ns) de produção gerada(s).`);
        },
        onError: (err: Error) => {
            toast.error(`Erro na explosão: ${err.message}`);
        },
    });

    return { explode };
}
