import { useMemo } from 'react';
import { useStockItems, UNIT_LABELS, CATEGORY_LABELS } from './useStockItems';
import { useSuppliers } from './useSuppliers';
import { useProductionStock } from './useProductionStock';
import { useSaleProducts } from './useSaleProducts';
import { useTechnicalSheets } from './useTechnicalSheets';
import type { ProductionWithSheet } from './useProductions';

export interface PurchaseNeedItem {
  stockItemId: string;
  name: string;
  category: string;
  unit: string;
  currentQuantity: number;
  productionStockQuantity: number;
  totalAvailable: number;
  minimumQuantity: number;
  productionNeed: number;
  wasteFactor: number;
  suggestedQuantity: number;
  supplierId: string | null;
  supplierName: string | null;
  supplierPhone: string | null;
  unitPrice: number;
  estimatedCost: number;
  isUrgent: boolean;
}

interface UsePurchaseCalculationByPeriodParams {
  productions: ProductionWithSheet[];
}

export function usePurchaseCalculationByPeriod({ productions }: UsePurchaseCalculationByPeriodParams) {
  const { items: stockItems, isLoading: stockLoading } = useStockItems();
  const { suppliers, isLoading: suppliersLoading } = useSuppliers();
  const { productionStock, isLoading: productionStockLoading } = useProductionStock();
  const { saleProducts, isLoading: saleProductsLoading } = useSaleProducts();
  const { sheets, isLoading: sheetsLoading } = useTechnicalSheets();

  // Calculate projected consumption for productions AND sale product stock gaps
  const getTotalProjectedDemand = useMemo(() => {
    // Helper to explode technical sheet ingredients
    const getSheetIngredientNeed = (sheetId: string, multiplier: number, targetStockItemId: string): number => {
      const sheet = sheets.find(s => s.id === sheetId);
      if (!sheet) return 0;

      let total = 0;
      const sheetYield = Number(sheet.yield_quantity || 1);
      const finalMultiplier = multiplier / sheetYield;

      if (!sheet.ingredients) return 0;

      for (const ingredient of sheet.ingredients) {
        if (ingredient.stock_item_id === targetStockItemId) {
          total += Number(ingredient.quantity) * finalMultiplier;
        }
      }
      return total;
    };

    // Recursive helper to explode sale product components into base ingredients
    const getSaleProductIngredientNeed = (productId: string, multiplier: number, targetStockItemId: string, depth = 0): number => {
      // Prevent infinite recursion on circular dependencies
      if (depth > 10) {
        console.warn('Circular dependency detected in sale products for component:', productId);
        return 0;
      }

      const product = saleProducts.find(p => p.id === productId);
      if (!product || !product.components) return 0;

      let total = 0;
      for (const component of product.components) {
        const compQty = Number(component.quantity) * multiplier;

        if (component.component_type === 'stock_item') {
          if (component.component_id === targetStockItemId) {
            total += compQty;
          }
        } else if (component.component_type === 'finished_production') {
          total += getSheetIngredientNeed(component.component_id, compQty, targetStockItemId);
        } else if (component.component_type === 'sale_product') {
          total += getSaleProductIngredientNeed(component.component_id, compQty, targetStockItemId, depth + 1);
        }
      }
      return total;
    };

    return (stockItemId: string): number => {
      let totalDemand = 0;

      // 1. Demand from Planned Productions
      for (const production of productions) {
        if (!production.technical_sheet || production.status !== 'planned') continue;

        const yieldQty = Number(production.technical_sheet.yield_quantity || 1);
        const plannedQty = Number(production.planned_quantity);
        const multiplier = plannedQty / yieldQty;

        const ingredients = production.technical_sheet.ingredients || [];
        for (const ingredient of ingredients) {
          if (ingredient.stock_item_id === stockItemId) {
            totalDemand += Number(ingredient.quantity) * multiplier;
          }
        }
      }

      // 2. Demand from Sale Products below minimum stock
      for (const product of saleProducts) {
        const gap = Math.max(0, (product.minimum_stock || 0) - (product.ready_quantity || 0));
        if (gap > 0) {
          totalDemand += getSaleProductIngredientNeed(product.id, gap, stockItemId);
        }
      }

      return totalDemand;
    };
  }, [productions, saleProducts, sheets]);

  const purchaseNeeds = useMemo(() => {
    if (!stockItems.length) return [];

    const needs: PurchaseNeedItem[] = [];

    for (const item of stockItems) {
      const currentQty = Number(item.current_quantity);
      const minQty = Number(item.minimum_quantity);
      const wasteFactor = Number((item as any).waste_factor || 0) / 100;

      // Get production stock quantity for this item
      const prodStockItem = productionStock.find(ps => ps.stock_item_id === item.id);
      const productionStockQty = prodStockItem ? Number(prodStockItem.quantity) : 0;

      // Total available = central + production stock
      const totalAvailable = currentQty + productionStockQty;

      // Get production need (includes productions + sale products gap)
      const baseDemand = getTotalProjectedDemand(item.id);
      const totalProjectedNeed = baseDemand * (1 + wasteFactor);

      // Formula: Need = (Total Projected Need + Minimum Stock) - Total Available
      const totalNeed = (totalProjectedNeed + minQty) - totalAvailable;

      // Only include if need > 0 (ignore negative values)
      if (totalNeed > 0) {
        const supplier = item.supplier_id
          ? suppliers.find(s => s.id === item.supplier_id)
          : null;

        const unitPrice = Number(item.unit_price) || 0;
        const isUrgent = totalAvailable <= minQty;

        needs.push({
          stockItemId: item.id,
          name: item.name,
          category: CATEGORY_LABELS[item.category] || item.category,
          unit: UNIT_LABELS[item.unit] || item.unit,
          currentQuantity: currentQty,
          productionStockQuantity: productionStockQty,
          totalAvailable,
          minimumQuantity: minQty,
          productionNeed: totalProjectedNeed,
          wasteFactor: wasteFactor * 100,
          suggestedQuantity: Math.ceil(totalNeed), // Round up to ensure enough
          supplierId: item.supplier_id,
          supplierName: supplier?.name || null,
          supplierPhone: supplier?.whatsapp_number || supplier?.whatsapp || supplier?.phone || null,
          unitPrice,
          estimatedCost: Math.ceil(totalNeed) * unitPrice,
          isUrgent,
        });
      }
    }

    // Sort by urgency first, then by name
    return needs.sort((a, b) => {
      if (a.isUrgent !== b.isUrgent) return a.isUrgent ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [stockItems, suppliers, getTotalProjectedDemand, productionStock]);

  const urgentCount = purchaseNeeds.filter(item => item.isUrgent).length;
  const totalEstimatedCost = purchaseNeeds.reduce((sum, item) => sum + item.estimatedCost, 0);

  return {
    purchaseNeeds,
    urgentCount,
    totalEstimatedCost,
    isLoading: stockLoading || suppliersLoading || productionStockLoading || saleProductsLoading || sheetsLoading,
    plannedProductionsCount: productions.filter(p => p.status === 'planned').length,
  };
}
