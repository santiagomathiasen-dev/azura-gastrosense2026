import { useState, useCallback } from 'react';
import { Search, Filter, Mic, MicOff, PackageCheck, Check, X, Plus, FileText, ArrowRightLeft, ShoppingBag, ClipboardList, Send, ClipboardCheck } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useStockItems, CATEGORY_LABELS, UNIT_LABELS, type StockItem, type StockCategory, type StockUnit } from '@/hooks/useStockItems';
import { useStockMovements, type MovementType } from '@/hooks/useStockMovements';
import { useStockVoiceControl } from '@/hooks/useStockVoiceControl';
import { useEarliestExpiryMap } from '@/hooks/useExpiryDates';
import { useProductions } from '@/hooks/useProductions';
import { usePendingDeliveries } from '@/hooks/usePendingDeliveries';
import { useProductionStock } from '@/hooks/useProductionStock';
import { useSaleProducts } from '@/hooks/useSaleProducts';
import { useStockRequests } from '@/hooks/useStockRequests';
import { StockTable } from '@/components/stock/StockTable';
import { StockItemForm } from '@/components/stock/StockItemForm';
import { StockMovementDialog } from '@/components/stock/StockMovementDialog';
import { VoiceImportDialog, type ExtractedItem } from '@/components/VoiceImportDialog';
import { IngredientFileImportDialog, type ExtractedIngredient } from '@/components/IngredientFileImportDialog';
import { formatQuantity } from '@/lib/utils';
import { SupplierManagement } from '@/components/suppliers/SupplierManagement';
import { BatchManagementDialog } from '@/components/stock/BatchManagementDialog';
import { Calendar } from 'lucide-react';
import { toast } from 'sonner';

type TransferDestination = 'production' | 'sale';

export default function Estoque() {
  const { items, isLoading, isOwnerLoading, createItem, batchCreateItems, updateItem, deleteItem, itemsInAlert } = useStockItems();
  const { expiryMap, isLoading: expiryMapLoading } = useEarliestExpiryMap();
  const { pendingItems, confirmDelivery, cancelOrder } = usePendingDeliveries();
  const { createMovement } = useStockMovements();
  const { getProjectedConsumption, plannedProductions } = useProductions();
  const { transferToProduction } = useProductionStock();
  const { saleProducts } = useSaleProducts();
  const { pendingRequests, fulfillRequest } = useStockRequests();

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [movementOpen, setMovementOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<StockItem | null>(null);
  const [pendingQuantities, setPendingQuantities] = useState<Record<string, string>>({});

  // Voice and file import dialogs
  const [voiceDialogOpen, setVoiceDialogOpen] = useState(false);
  const [fileImportDialogOpen, setFileImportDialogOpen] = useState(false);

  // Transfer dialog state
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [transferItem, setTransferItem] = useState<StockItem | null>(null);
  const [transferQuantity, setTransferQuantity] = useState('');
  const [transferDestination, setTransferDestination] = useState<TransferDestination>('production');

  // Fulfill request dialog state
  const [fulfillDialogOpen, setFulfillDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [fulfillQuantity, setFulfillQuantity] = useState('');

  // Stock count mode
  const [countingMode, setCountingMode] = useState(false);

  // Batch management state
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  const [batchItem, setBatchItem] = useState<StockItem | null>(null);

  // Duplicate item detection state
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [duplicateItem, setDuplicateItem] = useState<StockItem | null>(null);
  const [pendingData, setPendingData] = useState<any>(null);

  // Voice control for inline quantity updates
  const handleQuantityUpdate = useCallback((itemId: string, quantity: number) => {
    createMovement.mutate(
      {
        movement: {
          stock_item_id: itemId,
          type: 'adjustment',
          quantity: quantity,
          source: 'audio',
          notes: 'Contagem por voz',
        }
      },
      {
        onSuccess: () => {
          toast.success('Quantidade contada atualizada!');
        },
      }
    );
  }, [createMovement]);

  const handleExpiryUpdate = useCallback((itemId: string, expirationDate: string) => {
    updateItem.mutate(
      { id: itemId, expiration_date: expirationDate } as any,
      {
        onSuccess: () => {
          toast.success('Data de validade atualizada!');
        },
      }
    );
  }, [updateItem]);

  const {
    isSupported: voiceSupported,
    isListening,
    activeItemId: activeVoiceItemId,
    transcript,
    pendingConfirmation,
    toggleListening,
    startListening,
    stopListening,
    confirmUpdate,
    cancelUpdate
  } = useStockVoiceControl({
    stockItems: items,
    onQuantityUpdate: handleQuantityUpdate,
    onExpiryUpdate: handleExpiryUpdate,
  });

  const handleMicMouseDown = () => {
    startListening();
  };

  const handleMicMouseUp = () => {
    stopListening();
  };

  const filteredItems = items.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Calculate projected quantities
  const itemsWithProjection = filteredItems.map((item) => {
    const projectedConsumption = getProjectedConsumption(item.id);
    const projectedQuantity = Number(item.current_quantity) - projectedConsumption;
    return {
      ...item,
      projectedQuantity,
      projectedConsumption,
    };
  });

  // Standardize name formatting
  const formatItemName = (name: string) => {
    return name
      .trim()
      .split(/\s+/)
      .map((word) => {
        const lower = word.toLowerCase();
        if (['de', 'da', 'do', 'das', 'dos', 'e', 'com', 'sem'].includes(lower)) {
          return lower;
        }
        return lower.charAt(0).toUpperCase() + lower.slice(1);
      })
      .join(' ');
  };

  // Voice import handler
  const handleVoiceImport = async (voiceItems: ExtractedItem[]) => {
    try {
      const itemsToCreate = voiceItems.map(item => ({
        name: formatItemName(item.name),
        current_quantity: item.quantity,
        unit: item.unit as StockUnit,
        category: item.category as StockCategory,
        unit_price: item.price || 0,
        notes: item.supplier ? `Fornecedor: ${item.supplier}` : undefined,
      }));

      await batchCreateItems.mutateAsync(itemsToCreate);
    } catch (err) {
      console.error('Error in handleVoiceImport:', err);
    }
  };

  // File import handler
  const handleFileImport = async (ingredientsList: ExtractedIngredient[]) => {
    try {
      const itemsToCreate = ingredientsList.map(item => ({
        name: formatItemName(item.name),
        current_quantity: item.quantity,
        unit: item.unit as StockUnit,
        category: item.category as StockCategory,
        unit_price: item.price || 0,
        minimum_quantity: item.minimum_quantity || 0,
        notes: item.supplier ? `Fornecedor: ${item.supplier}` : undefined,
      }));

      await batchCreateItems.mutateAsync(itemsToCreate);
      setFileImportDialogOpen(false);
    } catch (err) {
      console.error('Error in handleFileImport:', err);
      // Error toast is already handled in batchCreateItems
    }
  };

  const handleCreateItem = (data: any) => {
    const formattedName = formatItemName(data.name);

    // Check for exact duplicate match ignoring case
    const existingItem = items.find(
      (item) => item.name.trim().toLowerCase() === formattedName.toLowerCase()
    );

    if (existingItem) {
      setDuplicateItem(existingItem);
      setPendingData({ ...data, name: formattedName });
      setDuplicateDialogOpen(true);
      return;
    }

    createItem.mutate({ ...data, name: formattedName }, {
      onSuccess: () => setFormOpen(false),
    });
  };

  const handleReplaceDuplicate = () => {
    if (!duplicateItem || !pendingData) return;

    updateItem.mutate({ id: duplicateItem.id, ...pendingData }, {
      onSuccess: () => {
        setDuplicateDialogOpen(false);
        setFormOpen(false);
        setDuplicateItem(null);
        setPendingData(null);
      },
    });
  };

  const handleUpdateItem = (data: any) => {
    if (!selectedItem) return;
    updateItem.mutate({ id: selectedItem.id, ...data }, {
      onSuccess: () => {
        setFormOpen(false);
        setSelectedItem(null);
      },
    });
  };

  const handleDeleteItem = () => {
    if (!selectedItem) return;
    deleteItem.mutate(selectedItem.id, {
      onSuccess: () => {
        setDeleteDialogOpen(false);
        setSelectedItem(null);
      },
    });
  };

  const handleMovement = (data: {
    type: MovementType;
    quantity: number;
    notes?: string;
    deductions?: { id: string; quantity: number }[];
  }) => {
    if (!selectedItem) return;
    createMovement.mutate(
      {
        movement: {
          stock_item_id: selectedItem.id,
          type: data.type,
          quantity: data.quantity,
          source: 'manual',
          notes: data.notes,
        },
        deductions: data.deductions
      },
      {
        onSuccess: () => {
          setMovementOpen(false);
          setSelectedItem(null);
        },
      }
    );
  };

  const handleCountedQuantityChange = (itemId: string, quantity: number) => {
    createMovement.mutate(
      {
        movement: {
          stock_item_id: itemId,
          type: 'adjustment',
          quantity: quantity,
          source: 'manual',
          notes: 'Contagem manual',
        }
      },
      {
        onSuccess: () => {
          toast.success('Quantidade contada atualizada!');
        },
      }
    );
  };

  const openEditForm = (item: StockItem) => {
    setSelectedItem(item);
    setFormOpen(true);
  };

  const openMovementDialog = (item: StockItem) => {
    setSelectedItem(item);
    setMovementOpen(true);
  };

  const openDeleteDialog = (item: StockItem) => {
    setSelectedItem(item);
    setDeleteDialogOpen(true);
  };

  const openTransferDialog = (item: StockItem) => {
    setTransferItem(item);
    setTransferQuantity('');
    setTransferDestination('production');
    setTransferDialogOpen(true);
  };

  const openBatchDialog = (item: StockItem) => {
    setBatchItem(item);
    setBatchDialogOpen(true);
  };

  const handleTransfer = async () => {
    if (!transferItem) return;

    const qty = parseFloat(transferQuantity);
    if (isNaN(qty) || qty <= 0) {
      toast.error('Informe uma quantidade válida');
      return;
    }

    if (qty > Number(transferItem.current_quantity)) {
      toast.error('Quantidade insuficiente no estoque');
      return;
    }

    try {
      if (transferDestination === 'production') {
        // Use the existing transferToProduction mutation
        await transferToProduction.mutateAsync({
          stockItemId: transferItem.id,
          quantity: qty,
          notes: 'Transferência para Estoque de Produção',
        });

        toast.success(`${formatQuantity(qty)} ${transferItem.unit} transferido(s) para Estoque de Produção`);
      } else {
        // Saída do estoque central para produtos de venda
        await createMovement.mutateAsync({
          movement: {
            stock_item_id: transferItem.id,
            type: 'exit',
            quantity: qty,
            source: 'manual',
            notes: 'Transferência para Produtos para Venda',
          }
        });

        toast.success(`${formatQuantity(qty)} ${transferItem.unit} transferido(s) para Produtos para Venda`);
      }

      setTransferDialogOpen(false);
      setTransferItem(null);
      setTransferQuantity('');
    } catch (error) {
      console.error('Error transferring stock:', error);
      toast.error('Erro ao transferir estoque');
    }
  };

  const openFulfillDialog = (request: any) => {
    setSelectedRequest(request);
    const remaining = Number(request.requested_quantity) - Number(request.delivered_quantity);
    setFulfillQuantity(remaining.toString());
    setFulfillDialogOpen(true);
  };

  const handleFulfillRequest = async () => {
    if (!selectedRequest || !fulfillQuantity) return;

    const qty = parseFloat(fulfillQuantity);
    if (isNaN(qty) || qty <= 0) {
      toast.error('Informe uma quantidade válida');
      return;
    }

    const centralItem = items.find(i => i.id === selectedRequest.stock_item_id);
    if (!centralItem || Number(centralItem.current_quantity) < qty) {
      toast.error('Quantidade insuficiente no estoque central');
      return;
    }

    try {
      await fulfillRequest.mutateAsync({
        requestId: selectedRequest.id,
        deliverQuantity: qty,
      });
      setFulfillDialogOpen(false);
      setSelectedRequest(null);
      setFulfillQuantity('');
    } catch (error) {
      console.error('Error fulfilling request:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="animate-fade-in">
        <PageHeader
          title="Estoque Central"
          description="Gerencie ingredientes, entradas, saídas e alertas do estoque"
        />
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <PageHeader
        title="Estoque Central"
        description="Ingredientes, entradas e saídas"
      />

      <Tabs defaultValue="stock" className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="grid w-full grid-cols-3 mb-3">
          <TabsTrigger value="stock">Estoque</TabsTrigger>
          <TabsTrigger value="register">Cadastro</TabsTrigger>
          <TabsTrigger value="suppliers">Fornecedores</TabsTrigger>
        </TabsList>

        {/* Stock Tab - Main tab for counting and managing stock */}
        <TabsContent value="stock" className="flex-1 flex flex-col overflow-hidden space-y-3">
          {/* Big Stock Update Button - Opens microphone immediately */}
          <Card
            className={`cursor-pointer transition-all border-2 ${isListening ? 'border-destructive bg-destructive/5' : 'hover:border-primary/40'}`}
            onMouseDown={handleMicMouseDown}
            onMouseUp={handleMicMouseUp}
            onTouchStart={handleMicMouseDown}
            onTouchEnd={handleMicMouseUp}
          >
            <CardContent className="flex items-center justify-center gap-3 py-6">
              {isListening ? (
                <MicOff className="h-8 w-8 text-destructive animate-pulse" />
              ) : (
                <Mic className="h-8 w-8 text-primary" />
              )}
              <div className="text-center">
                <h3 className="text-lg font-bold">
                  {isListening ? 'Ouvindo...' : 'Segure para Atualizar'}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {isListening
                    ? (transcript || 'Diga o ingrediente e quantidade')
                    : 'Pressione e segure para falar'}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Alert Summary - Compact */}
          {itemsInAlert.length > 0 && (
            <div className="flex items-center gap-2 p-1.5 bg-destructive/10 border border-destructive/30 rounded text-xs">
              <span className="font-medium text-destructive">{itemsInAlert.length} em alerta</span>
              {plannedProductions.length > 0 && <span className="text-muted-foreground">• {plannedProductions.length} produção(ões)</span>}
            </div>
          )}

          {/* Pending Stock Requests from Production */}
          {pendingRequests.length > 0 && (
            <Card className="border-primary/30 bg-primary/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-primary" />
                  Solicitações da Produção ({pendingRequests.length})
                </CardTitle>
                <CardDescription className="text-xs">
                  Pedidos de insumos do estoque de produção
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {pendingRequests.map(request => {
                  const remaining = Number(request.requested_quantity) - Number(request.delivered_quantity);
                  const centralItem = items.find(i => i.id === request.stock_item_id);
                  const hasEnough = centralItem && Number(centralItem.current_quantity) >= remaining;
                  return (
                    <div
                      key={request.id}
                      className="flex items-center gap-2 p-2 bg-background rounded-lg border"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm truncate">{request.stock_item?.name}</span>
                          <Badge variant={request.status === 'partial' ? 'secondary' : 'outline'} className="text-[10px]">
                            {request.status === 'partial' ? 'Parcial' : 'Pendente'}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Solicitado: {formatQuantity(Number(request.requested_quantity))} {request.stock_item?.unit ? UNIT_LABELS[request.stock_item.unit as keyof typeof UNIT_LABELS] : ''}
                          {request.delivered_quantity > 0 && ` • Entregue: ${formatQuantity(Number(request.delivered_quantity))}`}
                          {' • Falta: '}
                          <span className={!hasEnough ? 'text-destructive' : ''}>{formatQuantity(remaining)}</span>
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="default"
                        className="h-8 text-xs px-2"
                        onClick={() => openFulfillDialog(request)}
                      >
                        <Send className="h-3 w-3 mr-1" />
                        Entregar
                      </Button>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Pending Deliveries - Items awaiting stock entry */}
          {pendingItems.length > 0 && (
            <Card className="border-green-500/30 bg-green-500/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <PackageCheck className="h-4 w-4 text-green-600" />
                  Itens Comprados Aguardando Entrada ({pendingItems.length})
                </CardTitle>
                <CardDescription className="text-xs">
                  Autorize a entrada dos itens comprados no estoque central
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {pendingItems.map(item => (
                  <div
                    key={item.id}
                    className="flex items-center gap-2 p-2 bg-background rounded-lg border"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{item.stock_item?.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Comprado: {formatQuantity(Number(item.ordered_quantity))} {item.stock_item?.unit}
                        {item.order_date && ` em ${new Date(item.order_date).toLocaleDateString('pt-BR')}`}
                      </p>
                    </div>
                    <Input
                      type="number"
                      className="w-20 h-8"
                      placeholder="Qtd"
                      value={pendingQuantities[item.id] || item.ordered_quantity?.toString() || ''}
                      onChange={(e) => setPendingQuantities(prev => ({
                        ...prev,
                        [item.id]: e.target.value
                      }))}
                    />
                    <span className="text-xs text-muted-foreground w-8">{item.stock_item?.unit}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-100"
                      onClick={() => {
                        const qty = parseFloat(pendingQuantities[item.id] || item.ordered_quantity?.toString() || '0');
                        confirmDelivery.mutate({
                          itemId: item.id,
                          receivedQuantity: qty,
                          stockItemId: item.stock_item_id,
                        });
                      }}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => cancelOrder.mutate(item.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Search and Filter */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 h-9"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-36 h-9">
                <Filter className="h-3 w-3 mr-1" />
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Table - Scrollable */}
          <div className="flex-1 overflow-auto min-h-0">
            <StockTable
              items={itemsWithProjection}
              onMovement={openMovementDialog}
              onEdit={openEditForm}
              onDelete={openDeleteDialog}
              onCountedQuantityChange={handleCountedQuantityChange}
              isVoiceActive={isListening}
              activeVoiceItemId={activeVoiceItemId}
              onVoiceToggle={voiceSupported ? toggleListening : undefined}
              onTransfer={openTransferDialog}
              onManageBatches={openBatchDialog}
              expiryMap={expiryMap}
            />
          </div>
        </TabsContent>

        {/* Register Tab - For creating new stock items */}
        <TabsContent value="register" className="flex-1 overflow-auto space-y-4">
          {/* Action Cards */}
          <div className="grid grid-cols-3 gap-2">

            <Card
              className="cursor-pointer hover:border-primary transition-all group"
              onClick={() => setFileImportDialogOpen(true)}
            >
              <CardHeader className="text-center p-3">
                <div className="mx-auto w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center mb-1 group-hover:bg-orange-500/20">
                  <FileText className="h-5 w-5 text-orange-500" />
                </div>
                <CardTitle className="text-sm font-bold">Importar PDF / Foto (IA)</CardTitle>
              </CardHeader>
            </Card>

            <Card
              className="cursor-pointer hover:border-primary transition-all group"
              onClick={() => { setSelectedItem(null); setFormOpen(true); }}
            >
              <CardHeader className="text-center p-3">
                <div className="mx-auto w-10 h-10 rounded-full bg-secondary/50 flex items-center justify-center mb-1 group-hover:bg-secondary">
                  <Plus className="h-5 w-5 text-foreground" />
                </div>
                <CardTitle className="text-sm">Cadastro Manual</CardTitle>
              </CardHeader>
            </Card>
          </div>

          {/* Registered Items List */}
          <div className="space-y-2">
            <h3 className="font-semibold text-lg">Insumos Cadastrados ({(items || []).length})</h3>
            {(items || []).map((item) => (
              <Card key={item.id} className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {CATEGORY_LABELS[item.category]} • {formatQuantity(Number(item.current_quantity))} {UNIT_LABELS[item.unit]}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditForm(item)}
                    >
                      Editar
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>


        {/* Suppliers Tab */}
        <TabsContent value="suppliers" className="flex-1 overflow-auto">
          <SupplierManagement />
        </TabsContent>
      </Tabs>

      {/* Voice Import Dialog */}
      <VoiceImportDialog
        open={voiceDialogOpen}
        onOpenChange={setVoiceDialogOpen}
        onImport={handleVoiceImport}
        title="Falar Ingredientes"
        description="Fale os ingredientes e quantidades. Ex: 'Farinha de trigo 5 quilos, açúcar 2 quilos'"
        mode="ingredients"
      />

      {/* File Import Dialog */}
      <IngredientFileImportDialog
        open={fileImportDialogOpen}
        onOpenChange={setFileImportDialogOpen}
        onImport={handleFileImport}
      />

      {/* Form Dialog */}
      <StockItemForm
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setSelectedItem(null);
        }}
        onSubmit={selectedItem ? handleUpdateItem : handleCreateItem}
        initialData={selectedItem}
        isLoading={createItem.isPending || updateItem.isPending || isOwnerLoading}
      />

      {/* Movement Dialog */}
      <StockMovementDialog
        open={movementOpen}
        onOpenChange={(open) => {
          setMovementOpen(open);
          if (!open) setSelectedItem(null);
        }}
        item={selectedItem}
        onSubmit={handleMovement}
        isLoading={createMovement.isPending}
      />

      {/* Batch Management Dialog */}
      {batchItem && (
        <BatchManagementDialog
          open={batchDialogOpen}
          onOpenChange={setBatchDialogOpen}
          stockItemId={batchItem.id}
          stockItemName={batchItem.name}
        />
      )}

      {/* Transfer Dialog */}
      <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Transferir Estoque</DialogTitle>
            <DialogDescription>
              {transferItem?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="p-3 rounded-lg bg-muted">
              <p className="text-sm text-muted-foreground">Estoque atual</p>
              <p className="text-2xl font-bold">
                {formatQuantity(Number(transferItem?.current_quantity || 0))} {transferItem?.unit}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Destino</Label>
              <Select
                value={transferDestination}
                onValueChange={(v) => setTransferDestination(v as TransferDestination)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="production">
                    <span className="flex items-center gap-2">
                      <ArrowRightLeft className="h-4 w-4 text-primary" />
                      Estoque de Produção
                    </span>
                  </SelectItem>
                  <SelectItem value="sale">
                    <span className="flex items-center gap-2">
                      <ShoppingBag className="h-4 w-4 text-green-500" />
                      Produtos para Venda
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="transfer-quantity">Quantidade ({transferItem?.unit})</Label>
              <Input
                id="transfer-quantity"
                type="number"
                step="0.001"
                value={transferQuantity}
                onChange={(e) => setTransferQuantity(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleTransfer} disabled={!transferQuantity}>
              Transferir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fulfill Request Dialog */}
      <Dialog open={fulfillDialogOpen} onOpenChange={setFulfillDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Entregar Solicitação</DialogTitle>
            <DialogDescription>
              {selectedRequest?.stock_item?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-muted">
                <p className="text-xs text-muted-foreground">Solicitado</p>
                <p className="text-lg font-bold">
                  {formatQuantity(Number(selectedRequest?.requested_quantity || 0))}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-muted">
                <p className="text-xs text-muted-foreground">Já entregue</p>
                <p className="text-lg font-bold">
                  {formatQuantity(Number(selectedRequest?.delivered_quantity || 0))}
                </p>
              </div>
            </div>

            {(() => {
              const centralItem = items.find(i => i.id === selectedRequest?.stock_item_id);
              return (
                <div className="p-3 rounded-lg bg-primary/10 border border-primary/30">
                  <p className="text-xs text-muted-foreground">Disponível no Central</p>
                  <p className="text-lg font-bold text-primary">
                    {formatQuantity(Number(centralItem?.current_quantity || 0))} {centralItem?.unit ? UNIT_LABELS[centralItem.unit] : ''}
                  </p>
                </div>
              );
            })()}

            <div className="space-y-2">
              <Label htmlFor="fulfill-quantity">
                Quantidade a entregar ({selectedRequest?.stock_item?.unit ? UNIT_LABELS[selectedRequest.stock_item.unit as keyof typeof UNIT_LABELS] : ''})
              </Label>
              <Input
                id="fulfill-quantity"
                type="number"
                step="0.001"
                min="0"
                value={fulfillQuantity}
                onChange={(e) => setFulfillQuantity(e.target.value)}
                placeholder="0"
              />
              <p className="text-xs text-muted-foreground">
                Falta: {formatQuantity(Number(selectedRequest?.requested_quantity || 0) - Number(selectedRequest?.delivered_quantity || 0))}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFulfillDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleFulfillRequest}
              disabled={!fulfillQuantity || fulfillRequest.isPending}
            >
              <Send className="h-4 w-4 mr-1" />
              Entregar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir item?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir "{selectedItem?.name}"? Esta ação não pode ser desfeita e todo o histórico de movimentações será perdido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteItem}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Duplicate Item Confirmation Dialog */}
      <AlertDialog open={duplicateDialogOpen} onOpenChange={setDuplicateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Item já existe</AlertDialogTitle>
            <AlertDialogDescription>
              Já existe um item chamado "{duplicateItem?.name}" no estoque.
              Deseja substituir as informações do item existente pelas novas ou manter o item anterior?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setDuplicateDialogOpen(false);
              setFormOpen(false);
              setDuplicateItem(null);
              setPendingData(null);
            }}>Manter o Anterior</AlertDialogCancel>
            <AlertDialogAction onClick={handleReplaceDuplicate}>
              Substituir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Voice Confirmation Dialog */}
      <Dialog open={!!pendingConfirmation} onOpenChange={(open) => !open && cancelUpdate()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar Atualização de Voz</DialogTitle>
            <DialogDescription>
              A IA interpretou seu comando. Confirme os dados abaixo:
            </DialogDescription>
          </DialogHeader>

          {pendingConfirmation && (
            <div className="space-y-4 py-4">
              <div className="flex flex-col gap-1 p-4 bg-muted rounded-lg border border-primary/10">
                <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Item</span>
                <span className="font-semibold text-lg">{pendingConfirmation.itemName}</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1 p-4 bg-muted rounded-lg border border-primary/10">
                  <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Quantidade</span>
                  <span className="font-semibold text-lg">
                    {pendingConfirmation.quantity ?? '---'} {pendingConfirmation.unit}
                  </span>
                </div>

                <div className="flex flex-col gap-1 p-4 bg-muted rounded-lg border border-primary/10">
                  <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Validade</span>
                  <span className="font-semibold text-lg">
                    {pendingConfirmation.expirationDate
                      ? new Date(pendingConfirmation.expirationDate + 'T12:00:00').toLocaleDateString('pt-BR')
                      : '---'}
                  </span>
                </div>
              </div>

              {transcript && (
                <div className="p-3 bg-secondary/30 rounded italic text-sm text-muted-foreground border-l-4 border-primary/30">
                  " {transcript} "
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex gap-2 sm:justify-end">
            <Button variant="outline" onClick={cancelUpdate} className="flex gap-2">
              <X className="h-4 w-4" /> Cancelar
            </Button>
            <Button onClick={confirmUpdate} className="flex gap-2 bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-600/20 transition-all hover:scale-105 active:scale-95">
              <Check className="h-4 w-4" /> Confirmar Alteração
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
