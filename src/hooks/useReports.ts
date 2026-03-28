import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useOwnerId } from './useOwnerId';
import { supabaseFetch } from '@/lib/supabase-fetch';
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, format, subDays } from 'date-fns';
import { getNow, formatInBrasilia } from '@/lib/utils';
import { parseSafeDate } from './useExpiryDates';

export interface SalesReportItem {
  date: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface LossReportItem {
  date: string;
  productName: string;
  quantity: number;
  unit: string;
  sourceType: string;
  estimatedValue: number;
}

export interface PurchasedIngredientsItem {
  date: string;
  itemName: string;
  quantity: number;
  unit: string;
  supplierName: string | null;
  totalCost: number;
}

export interface UsedIngredientsItem {
  date: string;
  itemName: string;
  quantity: number;
  unit: string;
  productionName: string | null;
  source: string;
}

export interface MovementReportItem {
  date: string;
  itemName: string;
  type: 'entry' | 'exit';
  quantity: number;
  unit: string;
  source: string;
  notes: string | null;
}

export interface PurchaseReportItem {
  date: string;
  itemName: string;
  quantity: number;
  unit: string;
  supplierName: string | null;
  status: string;
  estimatedCost: number;
}

export type DateRangeType = 'today' | 'week' | 'month' | 'custom';

export function useReports(dateRange: DateRangeType, customStart?: Date, customEnd?: Date) {
  const { user } = useAuth();
  const { ownerId } = useOwnerId();

  // Calculate date range based on selection
  const getDateRange = () => {
    const now = getNow();
    switch (dateRange) {
      case 'today':
        return { start: now, end: now };
      case 'week':
        return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
      case 'month':
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case 'custom':
        return { start: customStart || subDays(now, 30), end: customEnd || now };
      default:
        return { start: startOfMonth(now), end: endOfMonth(now) };
    }
  };

  const { start, end } = getDateRange();
  const startDate = format(start, 'yyyy-MM-dd');
  const endDate = format(end, 'yyyy-MM-dd');

  // Sales Report
  const { data: salesReport = [], isLoading: salesLoading } = useQuery({
    queryKey: ['reports', 'sales', ownerId, startDate, endDate],
    queryFn: async () => {
      if (!user?.id && !ownerId) return [];

      const data = await supabaseFetch(`sales?select=id,quantity_sold,sale_date,sale_product:sale_products!inner(name,sale_price)&sale_date=gte.${startDate}T00:00:00&sale_date=lte.${endDate}T23:59:59&order=sale_date.desc`);

      return (data as any[]).map(sale => {
        const dateObj = sale.sale_date ? new Date(sale.sale_date) : getNow();
        const productName = sale.sale_product?.name || 'Produto desconhecido';
        const unitPrice = sale.sale_product?.sale_price || 0;

        return {
          date: isNaN(dateObj.getTime()) ? '-' : formatInBrasilia(dateObj, 'dd/MM/yyyy HH:mm'),
          productName,
          quantity: sale.quantity_sold,
          unitPrice,
          total: sale.quantity_sold * unitPrice,
        };
      }) as SalesReportItem[];
    },
    enabled: !!user?.id || !!ownerId,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  // Losses Report - from unified losses table + legacy stock_movements
  const { data: lossesReport = [], isLoading: lossesLoading } = useQuery({
    queryKey: ['reports', 'losses', ownerId, startDate, endDate],
    queryFn: async () => {
      if (!user?.id && !ownerId) return [];

      // Get losses from the new unified losses table
      const lossesData = await supabaseFetch(`losses?select=*&created_at=gte.${startDate}T00:00:00&created_at=lte.${endDate}T23:59:59&order=created_at.desc`);

      // Also get legacy losses from stock_movements (for backwards compatibility)
      const legacyData = await supabaseFetch(`stock_movements?select=id,quantity,created_at,notes,stock_item:stock_items!inner(name,unit_price)&type=eq.exit&notes=ilike.*perda*&created_at=gte.${startDate}T00:00:00&created_at=lte.${endDate}T23:59:59&order=created_at.desc`);

      // Combine both sources
      const newLosses = (lossesData || []).map(loss => {
        const dateObj = loss.created_at ? new Date(loss.created_at) : getNow();
        return {
          date: isNaN(dateObj.getTime()) ? '-' : formatInBrasilia(dateObj, 'dd/MM/yyyy HH:mm'),
          productName: loss.source_name,
          quantity: Number(loss.quantity),
          unit: loss.unit,
          sourceType: loss.source_type,
          estimatedValue: Number(loss.estimated_value) || 0,
        };
      });

      const legacyLosses = (legacyData as any[] || []).map(movement => {
        const dateObj = movement.created_at ? new Date(movement.created_at) : getNow();
        const stockItem = movement.stock_item;
        return {
          date: isNaN(dateObj.getTime()) ? '-' : formatInBrasilia(dateObj, 'dd/MM/yyyy HH:mm'),
          productName: stockItem?.name || 'Item desconhecido',
          quantity: Number(movement.quantity),
          unit: 'unidade',
          sourceType: 'stock_item',
          estimatedValue: Number(movement.quantity) * (stockItem?.unit_price || 0),
        };
      });

      return [...newLosses, ...legacyLosses].sort((a, b) => {
        if (a.date === '-' || b.date === '-') return 0;
        try {
          const dateA = new Date(a.date.split(' ')[0].split('/').reverse().join('-')).getTime();
          const dateB = new Date(b.date.split(' ')[0].split('/').reverse().join('-')).getTime();
          return dateB - dateA;
        } catch (e) {
          return 0;
        }
      }) as LossReportItem[];
    },
    enabled: !!user?.id || !!ownerId,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  // Purchased Ingredients Report (delivered purchase items)
  const { data: purchasedReport = [], isLoading: purchasedLoading } = useQuery({
    queryKey: ['reports', 'purchased', ownerId, startDate, endDate],
    queryFn: async () => {
      if (!user?.id && !ownerId) return [];

      const data = await supabaseFetch(`purchase_list_items?select=id,ordered_quantity,actual_delivery_date,stock_item:stock_items!inner(name,unit,unit_price),supplier:suppliers(name)&status=eq.delivered&actual_delivery_date=not.is.null&actual_delivery_date=gte.${startDate}&actual_delivery_date=lte.${endDate}&order=actual_delivery_date.desc`);

      return (data as any[]).map(item => {
        const stockItem = item.stock_item;
        return {
          date: item.actual_delivery_date ? formatInBrasilia(parseSafeDate(item.actual_delivery_date), 'dd/MM/yyyy') : '-',
          itemName: stockItem?.name || 'Item desconhecido',
          quantity: item.ordered_quantity || 0,
          unit: stockItem?.unit || 'un',
          supplierName: item.supplier?.name || null,
          totalCost: (item.ordered_quantity || 0) * (stockItem?.unit_price || 0),
        };
      }) as PurchasedIngredientsItem[];
    },
    enabled: !!user?.id || !!ownerId,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  // Used Ingredients Report (stock exits for production)
  const { data: usedReport = [], isLoading: usedLoading } = useQuery({
    queryKey: ['reports', 'used', ownerId, startDate, endDate],
    queryFn: async () => {
      if (!user?.id && !ownerId) return [];

      const data = await supabaseFetch(`stock_movements?select=id,quantity,created_at,source,notes,stock_item:stock_items!inner(name,unit)&type=eq.exit&created_at=gte.${startDate}T00:00:00&created_at=lte.${endDate}T23:59:59&order=created_at.desc`);

      return (data as any[]).map(movement => {
        const stockItem = movement.stock_item;
        return {
          date: formatInBrasilia(movement.created_at, 'dd/MM/yyyy HH:mm'),
          itemName: stockItem?.name || 'Item desconhecido',
          quantity: movement.quantity,
          unit: stockItem?.unit || 'un',
          productionName: movement.notes || null,
          source: movement.source === 'production' ? 'Produção' : movement.source === 'manual' ? 'Manual' : movement.source,
        };
      }) as UsedIngredientsItem[];
    },
    enabled: !!user?.id || !!ownerId,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  // Purchase List Report (all purchase items)
  const { data: purchaseListReport = [], isLoading: purchaseListLoading } = useQuery({
    queryKey: ['reports', 'purchase_list', ownerId, startDate, endDate],
    queryFn: async () => {
      if (!user?.id && !ownerId) return [];

      const data = await supabaseFetch(`purchase_list_items?select=id,suggested_quantity,ordered_quantity,status,created_at,order_date,stock_item:stock_items!inner(name,unit,unit_price),supplier:suppliers(name)&created_at=gte.${startDate}T00:00:00&created_at=lte.${endDate}T23:59:59&order=created_at.desc`);

      const statusLabels: Record<string, string> = {
        pending: 'Pendente',
        ordered: 'Comprado',
        delivered: 'Entregue',
        cancelled: 'Cancelado',
      };

      return (data as any[]).map(item => {
        const stockItem = item.stock_item;
        return {
          date: item.order_date
            ? formatInBrasilia(parseSafeDate(item.order_date), 'dd/MM/yyyy')
            : formatInBrasilia(item.created_at, 'dd/MM/yyyy'),
          itemName: stockItem?.name || 'Item desconhecido',
          quantity: item.ordered_quantity || item.suggested_quantity,
          unit: stockItem?.unit || 'un',
          supplierName: item.supplier?.name || null,
          status: statusLabels[item.status] || item.status,
          estimatedCost: (item.ordered_quantity || item.suggested_quantity) * (stockItem?.unit_price || 0),
        };
      }) as PurchaseReportItem[];
    },
    enabled: !!user?.id || !!ownerId,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  // Movements Report (All stock movements)
  const { data: movementsReport = [], isLoading: movementsLoading } = useQuery({
    queryKey: ['reports', 'movements', ownerId, startDate, endDate],
    queryFn: async () => {
      if (!user?.id && !ownerId) return [];

      const data = await supabaseFetch(`stock_movements?select=id,type,quantity,created_at,source,notes,stock_item:stock_items!inner(name,unit)&created_at=gte.${startDate}T00:00:00&created_at=lte.${endDate}T23:59:59&order=created_at.desc`);

      return (data as any[]).map(movement => {
        const stockItem = movement.stock_item;
        return {
          date: formatInBrasilia(movement.created_at, 'dd/MM/yyyy HH:mm'),
          itemName: stockItem?.name || 'Item desconhecido',
          type: movement.type as 'entry' | 'exit',
          quantity: movement.quantity,
          unit: stockItem?.unit || 'un',
          notes: movement.notes || null,
          source: movement.source === 'production' ? 'Produção' :
            movement.source === 'manual' ? 'Manual' :
              movement.source === 'purchase' ? 'Compra' : movement.source,
        };
      }) as MovementReportItem[];
    },
    enabled: !!user?.id || !!ownerId,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  // Calculate totals
  const totalSales = salesReport.reduce((sum, item) => sum + item.total, 0);
  const totalLosses = lossesReport.reduce((sum, item) => sum + item.estimatedValue, 0);
  const totalPurchased = purchasedReport.reduce((sum, item) => sum + item.totalCost, 0);
  const totalPurchaseList = purchaseListReport.reduce((sum, item) => sum + item.estimatedCost, 0);

  // --- New Logic: Alerts & Insights ---
  const alerts = useMemo(() => {
    const list: { type: 'price' | 'waste' | 'stock', title: string, message: string, severity: 'warning' | 'info' | 'error' }[] = [];

    // 1. Price Variation (Compare with previous 30 days)
    // For now, let's flag items that are 20% above their typical average cost in the report
    purchasedReport.forEach(item => {
      // Mock logic for "high cost" detection
      if (item.totalCost > 1000) {
        list.push({
          type: 'price',
          title: `Custo Elevado: ${item.itemName}`,
          message: `O item ${item.itemName} representou um gasto de R$ ${item.totalCost.toFixed(2)} no período.`,
          severity: 'info'
        });
      }
    });

    // 2. Waste Alerts
    lossesReport.forEach(item => {
      if (item.quantity > 5) {
        list.push({
          type: 'waste',
          title: `Desperdício detectado: ${item.productName}`,
          message: `Houve uma perda de ${item.quantity} ${item.unit}.`,
          severity: 'warning'
        });
      }
    });

    return list;
  }, [purchasedReport, lossesReport]);

  return {
    salesReport,
    lossesReport,
    purchasedReport,
    usedReport,
    purchaseListReport,
    movementsReport,
    totalSales,
    totalLosses,
    totalPurchased,
    totalPurchaseList,
    alerts,
    isLoading: salesLoading || lossesLoading || purchasedLoading || usedLoading || purchaseListLoading || movementsLoading,
  };
}
