import { useMemo } from 'react';
import { useSaleProducts, SaleProduct } from './useSaleProducts';
import { useTechnicalSheets, TechnicalSheetWithIngredients } from './useTechnicalSheets';
import { useStockItems } from './useStockItems';

export interface ProductCostBreakdown {
    id: string;
    name: string;
    type: 'sale_product' | 'technical_sheet';
    totalCost: number;
    currentSalePrice?: number;
    suggestedSalePrice: number;
    margin: number; // Percentage
    laborCost: number;
    energyCost: number;
    otherCosts: number;
    ingredientCost: number;
    components: {
        name: string;
        quantity: number;
        unit: string;
        cost: number;
    }[];
}

export function useProductCosts() {
    const { saleProducts, isLoading: salesLoading } = useSaleProducts();
    const { sheets: technicalSheets, isLoading: sheetsLoading } = useTechnicalSheets();
    const { items: stockItems, isLoading: stockLoading } = useStockItems();

    const calculateSheetCost = useMemo(() => {
        const memo: Record<string, number> = {};

        const calc = (sheetId: string): number => {
            if (memo[sheetId] !== undefined) return memo[sheetId];

            const sheet = technicalSheets.find(s => s.id === sheetId);
            if (!sheet || !sheet.ingredients) return 0;

            const ingredientsTotal = sheet.ingredients.reduce((acc, ing) => {
                const item = stockItems.find(si => si.id === ing.stock_item_id);
                const unitPrice = Number(item?.unit_price || 0);
                return acc + (Number(ing.quantity) * unitPrice);
            }, 0);

            const total = ingredientsTotal +
                Number(sheet.labor_cost || 0) +
                Number(sheet.energy_cost || 0) +
                Number(sheet.other_costs || 0);

            memo[sheetId] = total;
            return total;
        };

        return calc;
    }, [technicalSheets, stockItems]);

    const productCosts = useMemo((): ProductCostBreakdown[] => {
        if (salesLoading || sheetsLoading || stockLoading) return [];

        return saleProducts.map(product => {
            let totalCMV = 0;
            const componentsBreakdown: ProductCostBreakdown['components'] = [];

            product.components?.forEach(comp => {
                let compCost = 0;
                let compName = 'Desconhecido';

                if (comp.component_type === 'stock_item') {
                    const item = stockItems.find(si => si.id === comp.component_id);
                    compCost = Number(comp.quantity) * Number(item?.unit_price || 0);
                    compName = item?.name || 'Insumo';
                } else if (comp.component_type === 'finished_production') {
                    const sheet = technicalSheets.find(s => s.id === comp.component_id);
                    const sheetBaseCost = calculateSheetCost(comp.component_id);
                    const yieldQty = Number(sheet?.yield_quantity || 1);
                    compCost = (Number(comp.quantity) / yieldQty) * sheetBaseCost;
                    compName = sheet?.name || 'Produção';
                } else if (comp.component_type === 'sale_product') {
                    // Simplification for now to avoid complex recursive sale product costs if they nest
                    // Most products usually nest technical sheets
                    const otherProd = saleProducts.find(p => p.id === comp.component_id);
                    compName = otherProd?.name || 'Sub-produto';
                    // This would ideally be recursive but standard setup is Product -> Sheet -> Ingredients
                }

                totalCMV += compCost;
                componentsBreakdown.push({
                    name: compName,
                    quantity: comp.quantity,
                    unit: comp.unit,
                    cost: compCost,
                });
            });

            const salePrice = Number(product.sale_price || 0);
            const laborCost = Number((product as any).labor_cost || 0);
            const energyCost = Number((product as any).energy_cost || 0);
            const otherCosts = Number((product as any).other_costs || 0);

            const totalCost = totalCMV + laborCost + energyCost + otherCosts;
            const suggestedPrice = totalCost / 0.3; // 30% Target CMV (now including OPEX)

            const margin = salePrice > 0 ? ((salePrice - totalCost) / salePrice) * 100 : 0;

            return {
                id: product.id,
                name: product.name,
                type: 'sale_product',
                totalCost: totalCost,
                ingredientCost: totalCMV,
                laborCost,
                energyCost,
                otherCosts,
                currentSalePrice: salePrice,
                suggestedSalePrice: suggestedPrice,
                margin,
                components: componentsBreakdown,
            };
        });
    }, [saleProducts, technicalSheets, stockItems, calculateSheetCost, salesLoading, sheetsLoading, stockLoading]);

    return {
        productCosts,
        isLoading: salesLoading || sheetsLoading || stockLoading,
    };
}
