import { useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Edit, Trash2, ShoppingBag, Search, DollarSign, X, Package, Mic, FileText, ChefHat, Trash, Minus, Settings2, RefreshCw } from 'lucide-react';
import { useSaleProducts, SaleProduct, ComponentInput } from '@/hooks/useSaleProducts';
import { useFinishedProductionsStock } from '@/hooks/useFinishedProductionsStock';
import { useStockItems } from '@/hooks/useStockItems';
import { useTechnicalSheets } from '@/hooks/useTechnicalSheets';
import { usePurchaseList } from '@/hooks/usePurchaseList';
import { toast } from 'sonner';

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { VoiceImportDialog, type ExtractedItem } from '@/components/VoiceImportDialog';
import { AIImportDialog } from '@/components/AIImportDialog';
import { formatQuantity } from '@/lib/utils';
import type { Database } from '@/integrations/supabase/types';

type SaleComponentType = Database['public']['Enums']['sale_component_type'];

export default function ProdutosVenda() {
  const { saleProducts, isLoading, createSaleProduct, updateSaleProduct, deleteSaleProduct, prepareSaleProduct, quickSale, returnProduct, registerLoss } = useSaleProducts();
  const { finishedStock } = useFinishedProductionsStock();
  const { items: stockItems } = useStockItems();
  const { sheets: technicalSheets } = useTechnicalSheets();
  const { createItem: createPurchaseItem } = usePurchaseList();


  const [search, setSearch] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<SaleProduct | null>(null);
  const [voiceDialogOpen, setVoiceDialogOpen] = useState(false);
  const [aiImportDialogOpen, setAiImportDialogOpen] = useState(false);

  // Quantity state per product (for prepare action)
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    sale_price: '',
    minimum_stock: '0',
  });
  const [components, setComponents] = useState<ComponentInput[]>([]);
  const [newComponent, setNewComponent] = useState({
    component_type: '' as SaleComponentType | '',
    component_id: '',
    quantity: '',
    unit: '',
  });

  const filteredProducts = saleProducts.filter(product =>
    product.name.toLowerCase().includes(search.toLowerCase())
  );

  const getComponentName = (type: SaleComponentType, id: string): string => {
    if (type === 'finished_production') {
      const sheet = technicalSheets.find(s => s.id === id);
      return sheet?.name || 'Produção desconhecida';
    } else if (type === 'stock_item') {
      const item = stockItems.find(s => s.id === id);
      return item?.name || 'Ingrediente desconhecido';
    } else if (type === 'sale_product') {
      const product = saleProducts.find(p => p.id === id);
      return product?.name || 'Produto desconhecido';
    }
    return 'Desconhecido';
  };

  const getComponentOptions = () => {
    if (newComponent.component_type === 'finished_production') {
      return technicalSheets.map(s => ({ id: s.id, name: s.name, unit: s.yield_unit }));
    } else if (newComponent.component_type === 'stock_item') {
      return stockItems.map(s => ({ id: s.id, name: s.name, unit: s.unit }));
    } else if (newComponent.component_type === 'sale_product') {
      return saleProducts
        .filter(p => p.id !== editingProduct?.id)
        .map(p => ({ id: p.id, name: p.name, unit: 'unidade' }));
    }
    return [];
  };

  const addComponent = () => {
    if (!newComponent.component_type || !newComponent.component_id || !newComponent.quantity) return;

    setComponents([...components, {
      component_type: newComponent.component_type as SaleComponentType,
      component_id: newComponent.component_id,
      quantity: Number(newComponent.quantity),
      unit: newComponent.unit,
    }]);

    setNewComponent({ component_type: '', component_id: '', quantity: '', unit: '' });
  };

  const removeComponent = (index: number) => {
    setComponents(components.filter((_, i) => i !== index));
  };

  const resetForm = () => {
    setFormData({ name: '', description: '', sale_price: '', minimum_stock: '0' });
    setComponents([]);
    setNewComponent({ component_type: '', component_id: '', quantity: '', unit: '' });
  };

  const handleAdd = () => {
    createSaleProduct.mutate({
      name: formData.name,
      description: formData.description || undefined,
      sale_price: formData.sale_price ? Number(formData.sale_price) : undefined,
      minimum_stock: formData.minimum_stock ? Number(formData.minimum_stock) : 0,
      components,
    }, {
      onSuccess: () => {
        setIsAddDialogOpen(false);
        resetForm();
      }
    });
  };

  const handleUpdate = () => {
    if (!editingProduct) return;

    updateSaleProduct.mutate({
      id: editingProduct.id,
      name: formData.name,
      description: formData.description || undefined,
      sale_price: formData.sale_price ? Number(formData.sale_price) : undefined,
      minimum_stock: formData.minimum_stock ? Number(formData.minimum_stock) : 0,
      components,
    }, {
      onSuccess: () => {
        setEditingProduct(null);
        resetForm();
      }
    });
  };

  const openEditDialog = (product: SaleProduct) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description || '',
      sale_price: product.sale_price?.toString() || '',
      minimum_stock: product.minimum_stock?.toString() || '0',
    });
    setComponents(product.components?.map(c => ({
      component_type: c.component_type,
      component_id: c.component_id,
      quantity: c.quantity,
      unit: c.unit,
    })) || []);
  };

  const handleVoiceImport = async (items: ExtractedItem[]) => {
    for (const item of items) {
      await new Promise<void>((resolve, reject) => {
        createSaleProduct.mutate({
          name: item.name,
          sale_price: item.price || undefined,
          components: [],
        }, {
          onSuccess: () => resolve(),
          onError: (err) => reject(err),
        });
      });
    }
  };

  const handleAIImport = async (parsedProducts: any[]) => {
    for (const product of parsedProducts) {
      await new Promise<void>((resolve, reject) => {
        createSaleProduct.mutate({
          name: product.name || 'Produto sem nome',
          description: product.description,
          sale_price: product.price || undefined,
          components: [],
        }, {
          onSuccess: () => resolve(),
          onError: (err) => reject(err),
        });
      });
    }
  };

  // Quantity handlers
  const getQuantity = (productId: string) => quantities[productId] || 1;

  const incrementQuantity = (productId: string) => {
    setQuantities(prev => ({ ...prev, [productId]: (prev[productId] || 1) + 1 }));
  };

  const decrementQuantity = (productId: string) => {
    setQuantities(prev => ({ ...prev, [productId]: Math.max(1, (prev[productId] || 1) - 1) }));
  };

  const setQuantity = (productId: string, value: number) => {
    setQuantities(prev => ({ ...prev, [productId]: Math.max(1, value) }));
  };

  const handlePrepare = async (productId: string) => {
    const qty = getQuantity(productId);
    prepareSaleProduct.mutate({ sale_product_id: productId, quantity: qty }, {
      onSuccess: () => {
        setQuantities(prev => ({ ...prev, [productId]: 1 }));
      },
      onError: (error: any) => {
        if (error.insufficientItems) {
          const missingIngredients = error.insufficientItems.filter((item: any) => item.type === 'stock_item');
          const missingProductions = error.insufficientItems.filter((item: any) => item.type === 'finished_production');

          if (missingIngredients.length > 0) {
            missingIngredients.forEach((item: any) => {
              createPurchaseItem.mutate({
                stock_item_id: item.id,
                suggested_quantity: item.amount,
                status: 'pending',
              });
            });

            toast.warning('Estoque insuficiente! Ingredientes adicionados à lista de compras.', {
              description: `Faltando: ${missingIngredients.map((i: any) => i.name).join(', ')}`,
            });
          }

          if (missingProductions.length > 0) {
            toast.error('Produção insuficiente!', {
              description: `Você precisa produzir mais: ${missingProductions.map((i: any) => i.name).join(', ')}`,
            });
          }
        }
      }
    });
  };

  if (isLoading) {
    return (
      <div className="p-4 md:p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  const renderProductForm = () => (
    <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto">
      <div className="space-y-2">
        <Label htmlFor="product-name">Nome do Produto *</Label>
        <Input
          id="product-name"
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
          placeholder="Ex: Kit Festa Completo"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="product-description">Descrição</Label>
        <Textarea
          id="product-description"
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          placeholder="Descrição do produto..."
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="product-price">Preço de Venda (R$)</Label>
        <Input
          id="product-price"
          type="number"
          min="0"
          step="0.01"
          value={formData.sale_price}
          onChange={(e) => setFormData(prev => ({ ...prev, sale_price: e.target.value }))}
          placeholder="0.00"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="product-min-stock">Estoque Mínimo (Alerta)</Label>
        <Input
          id="product-min-stock"
          type="number"
          min="0"
          value={formData.minimum_stock}
          onChange={(e) => setFormData(prev => ({ ...prev, minimum_stock: e.target.value }))}
          placeholder="0"
        />
        <p className="text-[10px] text-muted-foreground">
          Quantidade mínima em estoque pronto para venda para gerar alerta.
        </p>
      </div>

      {/* Components Section */}
      <div className="space-y-3 pt-4 border-t">
        <Label className="text-base font-semibold">Componentes do Produto</Label>

        {/* Add Component Form */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 p-3 bg-muted/50 rounded-lg">
          <Select
            value={newComponent.component_type}
            onValueChange={(v) => setNewComponent({
              ...newComponent,
              component_type: v as SaleComponentType,
              component_id: '',
              unit: '',
            })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="finished_production">Produção Finalizada</SelectItem>
              <SelectItem value="stock_item">Ingrediente</SelectItem>
              <SelectItem value="sale_product">Outro Produto</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={newComponent.component_id}
            onValueChange={(v) => {
              const options = getComponentOptions();
              const selected = options.find(o => o.id === v);
              setNewComponent({
                ...newComponent,
                component_id: v,
                unit: selected?.unit || '',
              });
            }}
            disabled={!newComponent.component_type}
          >
            <SelectTrigger>
              <SelectValue placeholder="Item" />
            </SelectTrigger>
            <SelectContent>
              {getComponentOptions().map((opt) => (
                <SelectItem key={opt.id} value={opt.id}>
                  {opt.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            type="number"
            min="0"
            step="0.01"
            value={newComponent.quantity}
            onChange={(e) => setNewComponent({ ...newComponent, quantity: e.target.value })}
            placeholder="Qtd"
          />

          <Button
            type="button"
            onClick={addComponent}
            disabled={!newComponent.component_type || !newComponent.component_id || !newComponent.quantity}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* Components List */}
        {components.length > 0 && (
          <div className="space-y-2">
            {components.map((comp, idx) => (
              <div key={idx} className="flex items-center justify-between p-2 bg-muted rounded-lg">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {comp.component_type === 'finished_production' ? 'Produção' :
                      comp.component_type === 'stock_item' ? 'Ingrediente' : 'Produto'}
                  </Badge>
                  <span className="font-medium">
                    {getComponentName(comp.component_type, comp.component_id)}
                  </span>
                  <span className="text-muted-foreground">
                    {formatQuantity(comp.quantity)} {comp.unit}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeComponent(idx)}
                  className="h-8 w-8"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-4 md:space-y-6">
      <PageHeader
        title="Produtos para Venda"
        description="Prepare produtos e registre vendas"
        action={{
          label: 'Configurações PDV',
          onClick: () => window.location.href = '/config-pdv',
          icon: Settings2
        }}
      />

      <Tabs defaultValue="products" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="products">Produtos</TabsTrigger>
          <TabsTrigger value="register">Cadastro</TabsTrigger>
        </TabsList>

        {/* Products Tab - Main tab for preparing and selling */}
        <TabsContent value="products" className="space-y-4">
          {/* Search */}
          {saleProducts.length > 0 && (
            <div className="flex flex-col md:flex-row gap-3 items-center justify-between mb-2">
              <div className="relative w-full max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar produtos..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button variant="outline" size="sm" className="w-full md:w-auto gap-2 text-primary border-primary/20 hover:bg-primary/5">
                <RefreshCw className="h-4 w-4" />
                Sincronizar com PDV
              </Button>
            </div>
          )}

          {/* Products Grid */}
          {filteredProducts.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-8">
                <ShoppingBag className="h-10 w-10 text-muted-foreground mb-3" />
                <h3 className="text-base font-semibold mb-1">Nenhum produto cadastrado</h3>
                <p className="text-muted-foreground text-center text-sm max-w-md">
                  Vá para a aba "Cadastro" para criar produtos.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredProducts.map((product) => {
                const qty = getQuantity(product.id);

                return (
                  <Card key={product.id} className="flex flex-col">
                    <CardHeader className="pb-2 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <CardTitle className="text-base truncate">{product.name}</CardTitle>
                          {product.description && (
                            <CardDescription className="mt-1 text-xs line-clamp-1">{product.description}</CardDescription>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <Badge
                            variant={product.ready_quantity > 0 ? 'default' : 'secondary'}
                            className="text-sm font-bold"
                          >
                            {formatQuantity(product.ready_quantity || 0)} prontos
                          </Badge>
                          {(product.minimum_stock || 0) > (product.ready_quantity || 0) && (
                            <div className="text-xs text-orange-600 font-medium bg-orange-50 px-2 py-0.5 rounded">
                              Faltam {formatQuantity((product.minimum_stock || 0) - (product.ready_quantity || 0))}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col p-4 pt-0">
                      {/* Price */}
                      {product.sale_price && (
                        <div className="mb-3">
                          <p className="text-xl font-bold text-primary">
                            R$ {Number(product.sale_price).toFixed(2)}
                          </p>
                        </div>
                      )}

                      {/* Components */}
                      <div className="flex-1 mb-3">
                        <p className="text-xs font-medium mb-1 text-muted-foreground">Componentes:</p>
                        <div className="space-y-0.5">
                          {product.components?.slice(0, 2).map((comp, idx) => (
                            <div key={idx} className="flex items-center gap-1 text-xs">
                              <Package className="h-3 w-3 text-muted-foreground shrink-0" />
                              <span className="text-muted-foreground truncate">
                                {formatQuantity(comp.quantity)} {comp.unit} - {getComponentName(comp.component_type, comp.component_id)}
                              </span>
                            </div>
                          ))}
                          {(product.components?.length || 0) > 2 && (
                            <p className="text-xs text-muted-foreground">
                              +{(product.components?.length || 0) - 2} mais...
                            </p>
                          )}
                          {(!product.components || product.components.length === 0) && (
                            <p className="text-xs text-muted-foreground italic">
                              Sem componentes
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Quantity Selector and Add Button - Centered layout */}
                      <div className="flex flex-col gap-2 mb-3 p-2 bg-muted/50 rounded-lg">
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 shrink-0"
                            onClick={() => decrementQuantity(product.id)}
                            disabled={qty <= 1}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>

                          <Input
                            type="number"
                            min="1"
                            value={qty}
                            onChange={(e) => setQuantity(product.id, parseInt(e.target.value) || 1)}
                            className="h-8 text-center w-16"
                          />

                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 shrink-0"
                            onClick={() => incrementQuantity(product.id)}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>

                        <Button
                          variant="secondary"
                          size="sm"
                          className="w-full"
                          onClick={() => handlePrepare(product.id)}
                          disabled={prepareSaleProduct.isPending}
                          title={`Preparar ${qty} unidade(s) (deduz do estoque)`}
                        >
                          <ChefHat className="h-4 w-4 mr-1" />
                          Adicionar
                        </Button>
                      </div>

                      {/* Bottom Actions - Loss (Red) and Sale (Blue) */}
                      <div className="flex gap-2 pt-2 border-t">
                        {/* Loss button - red/destructive */}
                        <Button
                          variant="destructive"
                          size="sm"
                          className="flex-1"
                          onClick={() => registerLoss.mutate(product.id)}
                          disabled={registerLoss.isPending || (product.ready_quantity || 0) < 1}
                          title="Registrar perda"
                        >
                          <Trash className="h-4 w-4 mr-1" />
                          Perdas
                        </Button>

                        {/* Sell button - primary/blue */}
                        <Button
                          className="flex-1 bg-blue-600 hover:bg-blue-700"
                          size="sm"
                          onClick={() => quickSale.mutate(product.id)}
                          disabled={quickSale.isPending || (product.ready_quantity || 0) < 1}
                          title={product.ready_quantity > 0 ? "Vender 1 unidade" : "Prepare produtos primeiro"}
                        >
                          <DollarSign className="h-4 w-4 mr-1" />
                          Vender
                        </Button>
                      </div>

                      {/* Edit/Delete actions */}
                      <div className="flex gap-2 pt-2 mt-2 border-t">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => openEditDialog(product)}
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          Editar
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm" className="text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remover produto?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta ação irá remover "{product.name}" permanentemente.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteSaleProduct.mutate(product.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Remover
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Register Tab - For all users to create products */}
        <TabsContent value="register" className="space-y-4">
          <>
            {/* Action Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 max-w-2xl mx-auto">
              <Card
                className="cursor-pointer hover:border-primary hover:shadow-lg transition-all group"
                onClick={() => setVoiceDialogOpen(true)}
              >
                <CardHeader className="text-center p-4">
                  <div className="mx-auto w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mb-2 group-hover:bg-primary/20 transition-colors">
                    <Mic className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="text-sm">Falar Produtos</CardTitle>
                </CardHeader>
              </Card>

              <Card
                className="cursor-pointer hover:border-primary hover:shadow-lg transition-all group"
                onClick={() => setAiImportDialogOpen(true)}
              >
                <CardHeader className="text-center p-4">
                  <div className="mx-auto w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center mb-2 group-hover:bg-orange-500/20 transition-colors">
                    <FileText className="h-5 w-5 text-orange-500" />
                  </div>
                  <CardTitle className="text-sm">Importar Arquivo</CardTitle>
                </CardHeader>
              </Card>

              <Card
                className="cursor-pointer hover:border-primary hover:shadow-lg transition-all group"
                onClick={() => { resetForm(); setIsAddDialogOpen(true); }}
              >
                <CardHeader className="text-center p-4">
                  <div className="mx-auto w-10 h-10 rounded-full bg-secondary/50 flex items-center justify-center mb-2 group-hover:bg-secondary transition-colors">
                    <Plus className="h-5 w-5 text-foreground" />
                  </div>
                  <CardTitle className="text-sm">Cadastro Manual</CardTitle>
                </CardHeader>
              </Card>
            </div>

            {/* Products list for management */}
            <div className="space-y-2">
              <h3 className="font-semibold text-lg">Produtos Cadastrados ({saleProducts.length})</h3>
              {saleProducts.map((product) => (
                <Card key={product.id} className="p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{product.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {product.sale_price ? `R$ ${Number(product.sale_price).toFixed(2)}` : 'Sem preço'} • {product.components?.length || 0} componentes
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(product)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm" className="text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remover produto?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta ação irá remover "{product.name}" permanentemente.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteSaleProduct.mutate(product.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Remover
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </>
        </TabsContent>
      </Tabs>

      {/* Add Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Criar Produto para Venda</DialogTitle>
          </DialogHeader>
          {renderProductForm()}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsAddDialogOpen(false); resetForm(); }}>
              Cancelar
            </Button>
            <Button
              onClick={handleAdd}
              disabled={!formData.name || createSaleProduct.isPending}
            >
              Criar Produto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingProduct} onOpenChange={(open) => { if (!open) { setEditingProduct(null); resetForm(); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar Produto</DialogTitle>
          </DialogHeader>
          {renderProductForm()}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditingProduct(null); resetForm(); }}>
              Cancelar
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={!formData.name || updateSaleProduct.isPending}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Voice Import Dialog */}
      <VoiceImportDialog
        open={voiceDialogOpen}
        onOpenChange={setVoiceDialogOpen}
        onImport={handleVoiceImport}
        title="Falar Produtos"
        description="Fale os nomes e preços dos produtos. Ex: 'Kit festa 150 reais, Bolo decorado 80 reais'"
        mode="products"
      />

      {/* AI Import Dialog */}
      <AIImportDialog
        open={aiImportDialogOpen}
        onOpenChange={setAiImportDialogOpen}
        onConfirmImport={async (ingredients) => {
          for (const ing of ingredients) {
            await new Promise<void>((resolve, reject) => {
              createSaleProduct.mutate({
                name: ing.name,
                sale_price: ing.price || undefined,
                components: [],
              }, {
                onSuccess: () => resolve(),
                onError: (err) => reject(err),
              });
            });
          }
        }}
        title="Importar Produtos"
        description="Envie uma foto ou arquivo com produtos para cadastrar"
      />
    </div>
  );
}
