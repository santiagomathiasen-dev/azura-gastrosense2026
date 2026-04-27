import { useMemo } from 'react';
import { useStockItems, StockItem, UNIT_LABELS, CATEGORY_LABELS } from './useStockItems';
import { useProductions } from './useProductions';
import { useSuppliers } from './useSuppliers';
import { useProductionStock } from './useProductionStock';

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
  unitPrice: number;
  estimatedCost: number;
  isUrgent: boolean;
}

export function usePurchaseCalculation() {
  const { items: stockItems, isLoading: stockLoading } = useStockItems();
  const { plannedProductions, getProjectedConsumption, isLoading: productionsLoading } = useProductions();
  const { suppliers, isLoading: suppliersLoading } = useSuppliers();
  const { productionStock, isLoading: productionStockLoading } = useProductionStock();

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
      
      // Get production need and apply waste factor
      const baseProductionNeed = getProjectedConsumption(item.id);
      const productionNeed = baseProductionNeed * (1 + wasteFactor);
      
      // Formula: Need = (Production Need + Minimum Stock) - Total Available
      const totalNeed = (productionNeed + minQty) - totalAvailable;
      
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
          productionNeed,
          wasteFactor: wasteFactor * 100,
          suggestedQuantity: Math.ceil(totalNeed), // Round up to ensure enough
          supplierId: item.supplier_id,
          supplierName: supplier?.name || null,
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
  }, [stockItems, suppliers, getProjectedConsumption, productionStock]);

  const urgentCount = purchaseNeeds.filter(item => item.isUrgent).length;
  const totalEstimatedCost = purchaseNeeds.reduce((sum, item) => sum + item.estimatedCost, 0);

  return {
    purchaseNeeds,
    urgentCount,
    totalEstimatedCost,
    isLoading: stockLoading || productionsLoading || suppliersLoading || productionStockLoading,
    plannedProductionsCount: plannedProductions.length,
  };
}
