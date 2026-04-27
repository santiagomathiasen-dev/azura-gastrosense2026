import { ShoppingCart, Search, AlertTriangle, Download, Factory, Package, Calendar, Check, Clock, CheckCircle2, Printer, MessageCircle } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { cn, getNow } from '@/lib/utils';
import { useState, useMemo, useCallback } from 'react';
import { usePurchaseCalculationByPeriod } from '@/hooks/purchases/usePurchaseCalculationByPeriod';
import { usePendingDeliveries } from '@/hooks/purchases/usePendingDeliveries';
import { usePurchaseSchedule } from '@/hooks/purchases/usePurchaseSchedule';
import { useProductions, ProductionWithSheet } from '@/hooks/ops/useProductions';
import { usePurchaseList } from '@/hooks/purchases/usePurchaseList';
import { PurchasePeriodSelector } from '@/components/purchases/PurchasePeriodSelector';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { parseSafeDate } from '@/hooks/stock/useExpiryDates';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  MobileList,
  MobileListItem,
  MobileListTitle,
  MobileListDetails,
  MobileListBadge,
} from '@/components/ui/mobile-list';
import { WhatsAppDialog } from '@/components/suppliers/WhatsAppDialog';
import { useSuppliers } from '@/hooks/purchases/useSuppliers';


// Extended interface to include purchase status
interface PurchaseListItem {
  stockItemId: string;
  name: string;
  category: string;
  unit: string;
  currentQuantity: number;
  minimumQuantity: number;
  productionNeed: number;
  suggestedQuantity: number;
  supplierId: string | null;
  supplierName: string | null;
  supplierPhone: string | null;

  unitPrice: number;
  estimatedCost: number;
  isUrgent: boolean;
  // Purchase tracking
  isPurchased: boolean;
  orderedQuantity: number;
  pendingDeliveryId?: string;
  isManual?: boolean;
}

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export default function Compras() {
  const [search, setSearch] = useState('');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [showOrderDialog, setShowOrderDialog] = useState(false);
  const [orderQuantities, setOrderQuantities] = useState<Record<string, string>>({});
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [newScheduleDay, setNewScheduleDay] = useState('1');
  const [filteredProductions, setFilteredProductions] = useState<ProductionWithSheet[]>([]);
  const [activeFilter, setActiveFilter] = useState<'all' | 'pending' | 'purchased' | 'urgent'>('all');

  // WhatsApp Dialog State
  const [whatsAppDialogData, setWhatsAppDialogData] = useState({
    open: false,
    supplierName: '',
    phoneNumber: '',
    supplierId: '',
    initialMessage: '',
  });

  // Supplier picker state (for items without a linked supplier)
  const [supplierPickerData, setSupplierPickerData] = useState<{
    open: boolean;
    item: PurchaseListItem | null;
  }>({ open: false, item: null });
  const [pickedSupplierId, setPickedSupplierId] = useState('');

  // All suppliers for the picker
  const { suppliers: allSuppliers = [] } = useSuppliers();
  const suppliersWithPhone = allSuppliers.filter(
    (s: any) => s.whatsapp_number || s.whatsapp || s.phone
  );


  // Get all productions
  const { productions, isLoading: productionsLoading } = useProductions();

  // Custom shopping list items (manual/auto added)
  const { pendingItems: shoppingListItems, isLoading: shoppingListLoading } = usePurchaseList();

  // Pending deliveries (ordered items)
  const { pendingItems, markAsOrdered } = usePendingDeliveries();

  // Memoize planned productions to avoid reference changes during renders
  // which causes loops in PurchasePeriodSelector's useEffect
  const plannedProductions = useMemo(() =>
    productions.filter(p => p.status === 'planned'),
    [productions]
  );

  // Purchase schedules
  const {
    schedules,
    suggestedPurchaseDays,
    isTodayPurchaseDay,
    getNextPurchaseDay,
    createSchedule,
    deleteSchedule,
    DAY_NAMES
  } = usePurchaseSchedule();

  // Handle period change from selector
  const handlePeriodChange = useCallback((startDate: Date, endDate: Date, productions: ProductionWithSheet[]) => {
    setFilteredProductions(productions);
  }, []);

  // Calculate purchase needs based on filtered productions
  const {
    purchaseNeeds,
    urgentCount,
    totalEstimatedCost,
    isLoading: calculationLoading,
    plannedProductionsCount
  } = usePurchaseCalculationByPeriod({ productions: filteredProductions });

  const isLoading = calculationLoading || productionsLoading || shoppingListLoading;

  // Merge purchase needs with pending deliveries to show purchased status
  // AND with the manual shopping list (pendingItems from usePurchaseList)
  const mergedPurchaseList = useMemo((): (PurchaseListItem & { isManual?: boolean })[] => {
    const list: (PurchaseListItem & { isManual?: boolean })[] = [
      ...purchaseNeeds.map(item => ({
        ...item,
        isPurchased: false,
        orderedQuantity: 0
      }))
    ];

    // Add or Update items from the manual shopping list
    shoppingListItems.forEach(manualItem => {
      const existingItem = list.find(i => i.stockItemId === manualItem.stock_item_id);

      if (existingItem) {
        // If it already exists, ensure we use the highest quantity
        if (Number(manualItem.suggested_quantity) > existingItem.suggestedQuantity) {
          existingItem.suggestedQuantity = Number(manualItem.suggested_quantity);
          existingItem.estimatedCost = existingItem.suggestedQuantity * existingItem.unitPrice;
        }
        existingItem.isManual = true;
      } else if (manualItem.stock_item) {
        // Add new item if not in calculated needs
        list.push({
          stockItemId: manualItem.stock_item_id,
          name: manualItem.stock_item.name,
          category: manualItem.stock_item.category,
          unit: manualItem.stock_item.unit,
          currentQuantity: 0, // Not explicitly needed here as it's a manual add
          minimumQuantity: 0,
          productionNeed: 0,
          suggestedQuantity: Number(manualItem.suggested_quantity),
          supplierId: manualItem.supplier_id,
          supplierName: manualItem.supplier?.name || null,
          supplierPhone: manualItem.supplier?.whatsapp_number || manualItem.supplier?.whatsapp || manualItem.supplier?.phone || null,
          unitPrice: 0, // We could fetch this but it's okay for now

          estimatedCost: 0,
          isUrgent: true,
          isPurchased: false,
          orderedQuantity: 0,
          isManual: true,
        });
      }
    });

    return list.map(item => {
      const pendingItem = pendingItems.find(p => p.stock_item_id === item.stockItemId);
      const orderedQty = pendingItem?.ordered_quantity || 0;
      const isPurchased = !!pendingItem && orderedQty >= item.suggestedQuantity;

      return {
        ...item,
        isPurchased,
        orderedQuantity: orderedQty,
        pendingDeliveryId: pendingItem?.id,
      };
    });
  }, [purchaseNeeds, pendingItems, shoppingListItems]);

  // Filter items - exclude items that are already in stock (delivered status handled by usePurchaseCalculation)
  const filteredItems = useMemo(() => {
    let list = mergedPurchaseList.filter(item =>
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      (item.supplierName?.toLowerCase().includes(search.toLowerCase()))
    );

    if (activeFilter === 'pending') {
      return list.filter(item => !item.isPurchased);
    }
    if (activeFilter === 'purchased') {
      return list.filter(item => item.isPurchased);
    }
    if (activeFilter === 'urgent') {
      return list.filter(item => item.isUrgent && !item.isPurchased);
    }
    return list;
  }, [mergedPurchaseList, search, activeFilter]);

  // Get only items that haven't been purchased yet
  const unpurchasedItems = filteredItems.filter(item => !item.isPurchased);

  const toggleSelectItem = (stockItemId: string) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(stockItemId)) {
        newSet.delete(stockItemId);
      } else {
        newSet.add(stockItemId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedItems.size === unpurchasedItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(unpurchasedItems.map(item => item.stockItemId)));
    }
  };



  const openOrderDialog = () => {
    // Pre-fill quantities with suggested values
    const quantities: Record<string, string> = {};
    selectedItems.forEach(stockItemId => {
      const item = filteredItems.find(i => i.stockItemId === stockItemId);
      if (item) {
        quantities[stockItemId] = item.suggestedQuantity.toString();
      }
    });
    setOrderQuantities(quantities);
    setShowOrderDialog(true);
  };

  const handleConfirmOrder = async () => {
    for (const stockItemId of selectedItems) {
      const item = filteredItems.find(i => i.stockItemId === stockItemId);
      if (item) {
        const orderedQty = parseFloat(orderQuantities[stockItemId] || item.suggestedQuantity.toString());
        await markAsOrdered.mutateAsync({
          stockItemId,
          orderedQuantity: orderedQty,
          supplierId: item.supplierId,
          suggestedQuantity: item.suggestedQuantity,
        });
      }
    }
    setSelectedItems(new Set());
    setShowOrderDialog(false);
    toast.success(`${selectedItems.size} item(s) marcado(s) como comprado(s)!`);
  };

  const handleAddScheduleDay = () => {
    createSchedule.mutate({
      day_of_week: parseInt(newScheduleDay),
      order_day: true,
    });
    setShowScheduleDialog(false);
  };

  const handleOpenWhatsApp = (item: PurchaseListItem) => {
    // If item has a linked supplier with phone, use it directly
    if (item.supplierPhone && item.supplierName && item.supplierId) {
      handleOpenWhatsAppByGroup(item.supplierId, item.supplierName, item.supplierPhone);
    } else {
      // No supplier linked — open the supplier picker dialog
      if (suppliersWithPhone.length === 0) {
        toast.error('Nenhum fornecedor com WhatsApp cadastrado. Cadastre um fornecedor primeiro.');
        return;
      }
      setSupplierPickerData({ open: true, item });
      setPickedSupplierId('');
    }
  };

  const handleOpenWhatsAppByGroup = (supplierId: string, supplierName: string, phone: string) => {
    const supplierItems = unpurchasedItems.filter(
      i => i.supplierId === supplierId
    );

    if (supplierItems.length === 0) {
      toast.info('Nenhum item pendente para este fornecedor.');
      return;
    }

    let message = `Olá *${supplierName}*, gostaria de fazer um pedido:\n\n`;
    supplierItems.forEach(i => {
      message += `• *${i.suggestedQuantity} ${i.unit}* de ${i.name}\n`;
    });

    setWhatsAppDialogData({
      open: true,
      supplierName: supplierName,
      phoneNumber: phone,
      supplierId: supplierId,
      initialMessage: message
    });
  };

  const handleOpenWhatsAppGrouped = () => {
    if (selectedItems.size === 0) return;

    // Open supplier picker for the WHOLE selection
    setSupplierPickerData({
      open: true,
      item: null // special case: item is null means we are sending the whole selected set
    });
    setPickedSupplierId('');
  };

  const handleConfirmSupplierPick = () => {
    const supplier = allSuppliers.find((s: any) => s.id === pickedSupplierId) as any;
    if (!supplier) return;

    const phone = supplier.whatsapp_number || supplier.whatsapp || supplier.phone;
    if (!phone) {
      toast.error('Este fornecedor não possui número de WhatsApp cadastrado.');
      return;
    }

    // Build the message based on WHAT prompted the picker
    let message = `Olá *${supplier.name}*, gostaria de fazer um pedido:\n\n`;

    if (supplierPickerData.item) {
      // Single item case (legacy/individual)
      const item = supplierPickerData.item;
      message += `• *${item.suggestedQuantity} ${item.unit}* de ${item.name}\n`;
    } else {
      // Grouped selection case
      const selectedDetails = mergedPurchaseList.filter(item => selectedItems.has(item.stockItemId));
      selectedDetails.forEach(i => {
        message += `• *${i.suggestedQuantity} ${i.unit}* de ${i.name}\n`;
      });
    }

    setWhatsAppDialogData({
      open: true,
      supplierName: supplier.name,
      phoneNumber: phone,
      supplierId: supplier.id,
      initialMessage: message
    });
    setSupplierPickerData({ open: false, item: null });
  };

  const gerarListaCompras = () => {
    if (filteredItems.length === 0) {
      toast.info('Nenhum item na lista de compras.');
      return;
    }

    const lista = filteredItems.map(item =>
      `• ${item.suggestedQuantity} ${item.unit} de ${item.name}${item.supplierName ? ` - ${item.supplierName}` : ''}`
    ).join('\n');

    navigator.clipboard.writeText(lista);
    toast.success('Lista copiada para a área de transferência!');
  };

  const exportarCSV = () => {
    if (filteredItems.length === 0) {
      toast.info('Nenhum item para exportar.');
      return;
    }

    const headers = ['Item', 'Quantidade', 'Unidade', 'Estoque Atual', 'Mínimo', 'Necessidade Produção', 'Fornecedor', 'Custo Estimado', 'Status'];
    const csvContent = [
      headers.join(';'),
      ...filteredItems.map(item => [
        item.name,
        item.suggestedQuantity,
        item.unit,
        item.currentQuantity,
        item.minimumQuantity,
        item.productionNeed.toFixed(2),
        item.supplierName || '',
        `R$ ${item.estimatedCost.toFixed(2)}`,
        item.isPurchased ? 'Comprado' : 'Pendente'
      ].join(';'))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const blobUrl = URL.createObjectURL(blob);
    link.href = blobUrl;
    link.download = `lista_compras_${getNow().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(blobUrl);
    toast.success('Lista exportada com sucesso!');
  };

  const imprimirLista = () => {
    if (filteredItems.length === 0) {
      toast.info('Nenhum item para imprimir.');
      return;
    }

    const printContent = `
      <html>
        <head>
          <title>Lista de Compras - ${getNow().toLocaleDateString('pt-BR')}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { font-size: 18px; margin-bottom: 5px; }
            p { font-size: 12px; color: #666; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; }
            th, td { border: 1px solid #ddd; padding: 6px; text-align: left; }
            th { background-color: #f5f5f5; font-weight: bold; }
            .text-right { text-align: right; }
            .urgent { background-color: #fff3cd; }
            .purchased { background-color: #d4edda; text-decoration: line-through; color: #666; }
            .total { font-weight: bold; margin-top: 15px; }
          </style>
        </head>
        <body>
          <h1>Lista de Compras</h1>
          <p>Gerada em ${getNow().toLocaleString('pt-BR')}</p>
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th class="text-right">Qtd</th>
                <th>Unid.</th>
                <th>Fornecedor</th>
                <th class="text-right">Custo Est.</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${filteredItems.map(item => `
                <tr class="${item.isPurchased ? 'purchased' : item.isUrgent ? 'urgent' : ''}">
                  <td>${escapeHtml(item.name)}</td>
                  <td class="text-right">${item.suggestedQuantity}</td>
                  <td>${escapeHtml(item.unit)}</td>
                  <td>
                    ${escapeHtml(item.supplierName || '-')}
                    ${item.supplierPhone ? ' (WhatsApp)' : ''}
                  </td>
                  <td class="text-right">R$ ${item.estimatedCost.toFixed(2)}</td>

                  <td>${item.isPurchased ? 'Comprado' : item.isUrgent ? 'Urgente' : 'Pendente'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <p class="total">Total Estimado: R$ ${totalEstimatedCost.toFixed(2)}</p>
          <p class="total">Itens Pendentes: ${unpurchasedItems.length} | Urgentes: ${urgentCount}</p>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
      printWindow.close();
    }
  };

  const nextPurchaseDay = getNextPurchaseDay();

  if (isLoading) {
    return (
      <div className="animate-fade-in space-y-4">
        <PageHeader
          title="Lista de Compras"
          description="Compras baseadas em estoque mínimo e produção"
        />
        <div className="grid grid-cols-3 gap-2">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
        <Skeleton className="h-10" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Lista de Compras"
        description="Calculada automaticamente: (Produção + Estoque Mín.) - Estoque Atual"
      />

      {/* Period Selector - NEW! */}
      <PurchasePeriodSelector
        productions={plannedProductions}
        onPeriodChange={handlePeriodChange}
      />

      {/* Stats - Mobile Friendly */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <Card
          className={cn(
            "cursor-pointer transition-all hover:border-primary/50",
            activeFilter === 'pending' ? "ring-2 ring-primary border-primary bg-primary/5" : ""
          )}
          onClick={() => setActiveFilter(activeFilter === 'pending' ? 'all' : 'pending')}
        >
          <CardContent className="p-3 text-center">
            <ShoppingCart className={cn("h-5 w-5 mx-auto mb-1", activeFilter === 'pending' ? "text-primary" : "text-muted-foreground")} />
            <p className="text-lg font-bold">{mergedPurchaseList.filter(i => !i.isPurchased).length}</p>
            <p className="text-xs text-muted-foreground">Pendentes</p>
          </CardContent>
        </Card>
        <Card
          className={cn(
            "cursor-pointer transition-all hover:border-emerald-500/50",
            activeFilter === 'purchased' ? "ring-2 ring-emerald-500 border-emerald-500 bg-emerald-500/5" : "border-emerald-500/30 bg-emerald-500/10"
          )}
          onClick={() => setActiveFilter(activeFilter === 'purchased' ? 'all' : 'purchased')}
        >
          <CardContent className="p-3 text-center">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 mx-auto mb-1" />
            <p className="text-lg font-bold text-emerald-700">{mergedPurchaseList.filter(i => i.isPurchased).length}</p>
            <p className="text-xs text-emerald-600">Comprados</p>
          </CardContent>
        </Card>
        <Card
          className={cn(
            "cursor-pointer transition-all hover:border-warning/50",
            activeFilter === 'urgent' ? "ring-2 ring-warning border-warning bg-warning/5" : (urgentCount > 0 ? 'border-warning/50 bg-warning/5' : '')
          )}
          onClick={() => setActiveFilter(activeFilter === 'urgent' ? 'all' : 'urgent')}
        >
          <CardContent className="p-3 text-center">
            <AlertTriangle className={cn("h-5 w-5 mx-auto mb-1", activeFilter === 'urgent' ? "text-warning" : "text-muted-foreground")} />
            <p className="text-lg font-bold">{mergedPurchaseList.filter(i => i.isUrgent && !i.isPurchased).length}</p>
            <p className="text-xs text-muted-foreground">Urgentes</p>
          </CardContent>
        </Card>
        <Card
          className={cn(
            "cursor-pointer transition-all hover:border-primary/50",
            activeFilter === 'all' ? "ring-2 ring-primary border-primary bg-primary/5" : ""
          )}
          onClick={() => setActiveFilter('all')}
        >
          <CardContent className="p-3 text-center">
            <Package className={cn("h-5 w-5 mx-auto mb-1", activeFilter === 'all' ? "text-primary" : "text-muted-foreground")} />
            <p className="text-lg font-bold text-primary">R$ {totalEstimatedCost.toFixed(0)}</p>
            <p className="text-xs text-muted-foreground">Total Est.</p>
          </CardContent>
        </Card>
      </div>



      {/* Selection Actions (Sticky Bar) */}
      {selectedItems.size > 0 && (
        <div className="flex items-center gap-2 mb-4 p-2 bg-primary/10 rounded-lg border border-primary/20 sticky top-2 z-10 shadow-md backdrop-blur-sm animate-in slide-in-from-top-4 duration-300">
          <span className="text-sm font-bold flex-1 ml-2 text-primary">
            {selectedItems.size} selecionado(s)
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={handleOpenWhatsAppGrouped}
              className="h-9 gap-2 bg-green-600 hover:bg-green-700 text-white border-0 shadow-sm"
            >
              <MessageCircle className="h-4 w-4 text-white" />
              Pedido WhatsApp
            </Button>
            <Button
              size="sm"
              onClick={openOrderDialog}
              className="h-9 gap-2 shadow-sm"
            >
              <ShoppingCart className="h-4 w-4" />
              Confirmar Compra
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setSelectedItems(new Set())}
              className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              title="Limpar seleção"
            >
              <Clock className="h-4 w-4 rotate-45" />
            </Button>
          </div>
        </div>
      )}

      {/* Search and Actions */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar itens..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-9"
          />
        </div>
        <Button variant="outline" size="icon" onClick={gerarListaCompras} className="h-9 w-9" title="Copiar lista">
          <Download className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" onClick={exportarCSV} className="h-9 w-9" title="Exportar CSV">
          <Package className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" onClick={imprimirLista} className="h-9 w-9" title="Imprimir">
          <Printer className="h-4 w-4" />
        </Button>
      </div>

      {/* Purchase List */}
      {filteredItems.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <h3 className="font-medium mb-1">Nenhuma compra necessária</h3>
            <p className="text-sm text-muted-foreground">
              Seu estoque está adequado para as produções planejadas.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {(() => {
            // Group items by supplier
            const groups: Record<string, { name: string; items: PurchaseListItem[] }> = {};

            filteredItems.forEach(item => {
              const key = item.supplierId || 'none';
              if (!groups[key]) {
                groups[key] = {
                  name: item.supplierName || 'Sem Fornecedor',
                  items: []
                };
              }
              groups[key].items.push(item);
            });

            // Sort groups: suppliers first, then 'none'
            const sortedKeys = Object.keys(groups).sort((a, b) => {
              if (a === 'none') return 1;
              if (b === 'none') return -1;
              return groups[a].name.localeCompare(groups[b].name);
            });

            return sortedKeys.map(key => {
              const group = groups[key];
              const groupItems = group.items;
              const unpurchasedGroupItems = groupItems.filter(i => !i.isPurchased);
              const allSelected = unpurchasedGroupItems.length > 0 &&
                unpurchasedGroupItems.every(i => selectedItems.has(i.stockItemId));

              return (
                <div key={key} className="space-y-1">
                  {/* Group Header */}
                  <div className="flex items-center gap-3 px-3 py-2 bg-muted/30 rounded-t-lg border-x border-t">
                    {unpurchasedGroupItems.length > 0 && (
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={(checked) => {
                          setSelectedItems(prev => {
                            const newSet = new Set(prev);
                            unpurchasedGroupItems.forEach(i => {
                              if (checked) newSet.add(i.stockItemId);
                              else newSet.delete(i.stockItemId);
                            });
                            return newSet;
                          });
                        }}
                      />
                    )}
                    <span className="text-sm font-bold flex flex-1 items-center gap-2">
                      {key === 'none' ? <Package className="h-4 w-4 text-muted-foreground" /> : <Factory className="h-4 w-4 text-primary" />}
                      {group.name}
                      <Badge variant="secondary" className="text-[10px] h-4 ml-1 px-1.5 font-medium">
                        {groupItems.length}
                      </Badge>
                    </span>

                    {key !== 'none' && unpurchasedGroupItems.length > 0 && groupItems[0].supplierPhone && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-green-600 hover:text-green-700 hover:bg-green-50 gap-1 px-2"
                        onClick={() => handleOpenWhatsAppByGroup(key, group.name, groupItems[0].supplierPhone!)}
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        <span className="text-[11px]">WhatsApp</span>
                      </Button>
                    )}
                  </div>

                  <MobileList className="border-t-0 shadow-none">
                    {groupItems.map((item) => (
                      <MobileListItem
                        key={item.stockItemId}
                        className={cn(
                          item.isUrgent && !item.isPurchased && "border-warning/50 bg-warning/5",
                          selectedItems.has(item.stockItemId) && "bg-primary/5 border-primary/30",
                          item.isPurchased && "bg-muted/50 border-muted opacity-60"
                        )}
                        onClick={() => !item.isPurchased && toggleSelectItem(item.stockItemId)}
                      >
                        <div className="flex items-center gap-2">
                          {!item.isPurchased ? (
                            <Checkbox
                              checked={selectedItems.has(item.stockItemId)}
                              onCheckedChange={() => toggleSelectItem(item.stockItemId)}
                              onClick={(e) => e.stopPropagation()}
                            />
                          ) : (
                            <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                          )}
                          <MobileListTitle
                            className={cn(
                              "flex-1",
                              item.isPurchased && "line-through text-muted-foreground"
                            )}
                          >
                            {item.name}
                          </MobileListTitle>

                          {item.isPurchased ? (
                            <MobileListBadge variant="default" className="bg-emerald-100 text-emerald-700 border-emerald-200">
                              Comprado
                            </MobileListBadge>
                          ) : item.isUrgent ? (
                            <MobileListBadge variant="warning">Urgente</MobileListBadge>
                          ) : item.isManual ? (
                            <MobileListBadge variant="default" className="bg-emerald-100 text-emerald-700 border-emerald-200">
                              Na Lista
                            </MobileListBadge>
                          ) : null}

                          {item.estimatedCost > 0 && !item.isPurchased && (
                            <span className="text-sm font-semibold text-emerald-600">
                              R$ {item.estimatedCost.toFixed(0)}
                            </span>
                          )}
                        </div>

                        <MobileListDetails className={cn("ml-6", item.isPurchased && "text-muted-foreground")}>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                            {item.isPurchased ? (
                              <span className="text-emerald-600 text-[11px]">
                                Comprado: {item.orderedQuantity} {item.unit}
                              </span>
                            ) : (
                              <span className="text-[11px]">Pedir: <strong className="text-primary">{item.suggestedQuantity} {item.unit}</strong></span>
                            )}
                            <span className="text-[11px]">Stock: {item.currentQuantity}</span>
                            {item.productionNeed > 0 && !item.isPurchased && (
                              <span className="text-primary text-[11px]">Produção: {item.productionNeed.toFixed(1)}</span>
                            )}
                          </div>
                        </MobileListDetails>
                      </MobileListItem>
                    ))}
                  </MobileList>
                </div>
              );
            });
          })()}
        </div>
      )}

      {/* Order Confirmation Dialog */}
      <Dialog open={showOrderDialog} onOpenChange={setShowOrderDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar Compra</DialogTitle>
            <DialogDescription>
              Informe a quantidade comprada de cada item. Eles ficarão pendentes para dar entrada no estoque.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[50vh] overflow-y-auto space-y-3 py-4">
            {Array.from(selectedItems).map(stockItemId => {
              const item = filteredItems.find(i => i.stockItemId === stockItemId);
              if (!item) return null;
              return (
                <div key={stockItemId} className="flex items-center gap-3 p-2 border rounded-lg">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{item.name}</p>
                    <p className="text-xs text-muted-foreground">Sugerido: {item.suggestedQuantity} {item.unit}</p>
                  </div>
                  <Input
                    type="number"
                    className="w-20 h-8"
                    value={orderQuantities[stockItemId] || ''}
                    onChange={(e) => setOrderQuantities(prev => ({
                      ...prev,
                      [stockItemId]: e.target.value
                    }))}
                    placeholder="Qtd"
                  />
                  <span className="text-xs text-muted-foreground">{item.unit}</span>
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOrderDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmOrder} disabled={markAsOrdered.isPending}>
              {markAsOrdered.isPending ? 'Salvando...' : 'Confirmar Compra'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule Dialog */}
      <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Adicionar Dia de Compra</DialogTitle>
            <DialogDescription>
              Configure os dias da semana para realizar compras
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Dia da Semana</Label>
              <Select value={newScheduleDay} onValueChange={setNewScheduleDay}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAY_NAMES.map((name, index) => (
                    <SelectItem key={index} value={index.toString()}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowScheduleDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddScheduleDay}>
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Supplier Picker Dialog (for items without a linked supplier) */}
      <Dialog
        open={supplierPickerData.open}
        onOpenChange={(open) => setSupplierPickerData(prev => ({ ...prev, open }))}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Selecionar Fornecedor</DialogTitle>
            <DialogDescription>
              Escolha o fornecedor para enviar o pedido de{' '}
              <strong>{supplierPickerData.item?.name}</strong> via WhatsApp.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Fornecedor</Label>
            <Select value={pickedSupplierId} onValueChange={setPickedSupplierId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um fornecedor" />
              </SelectTrigger>
              <SelectContent>
                {suppliersWithPhone.map((s: any) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSupplierPickerData({ open: false, item: null })}
            >
              Cancelar
            </Button>
            <Button onClick={handleConfirmSupplierPick} disabled={!pickedSupplierId}>
              Abrir WhatsApp
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* WhatsApp Dialog */}
      <WhatsAppDialog
        open={whatsAppDialogData.open}
        onOpenChange={(open) => setWhatsAppDialogData(prev => ({ ...prev, open }))}
        supplierName={whatsAppDialogData.supplierName}
        phoneNumber={whatsAppDialogData.phoneNumber}
        supplierId={whatsAppDialogData.supplierId}
        initialMessage={whatsAppDialogData.initialMessage}
      />
    </div>
  );
}
