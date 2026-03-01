import { useState, useEffect } from 'react';
import { Search, DollarSign, Calculator, Clock, Users, ChefHat, Edit, Trash2, Mic, MicOff, Plus, FileText, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Input } from '@/components/ui/input';
import { ImageUpload } from '@/components/ImageUpload';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  MobileList,
  MobileListItem,
  MobileListTitle,
  MobileListDetails,
  MobileListBadge,
} from '@/components/ui/mobile-list';
import { useTechnicalSheets, TechnicalSheetWithIngredients } from '@/hooks/useTechnicalSheets';
import { useTechnicalSheetStages } from '@/hooks/useTechnicalSheetStages';
import { useStockItems, type StockUnit, type StockCategory } from '@/hooks/useStockItems';
import { useStockVoiceControl } from '@/hooks/useStockVoiceControl';
import { VoiceImportDialog, type ExtractedItem } from '@/components/VoiceImportDialog';
import { RecipeFileImportDialog } from '@/components/RecipeFileImportDialog';
import { StageForm, type StageFormData } from '@/components/fichas/StageForm';
import { StageDisplay } from '@/components/fichas/StageDisplay';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import type { ExtractedIngredient, RecipeData } from '@/hooks/useIngredientImport';
import { supabase } from '@/integrations/supabase/client';

const calcularCustoTotal = (sheet: TechnicalSheetWithIngredients) => {
  if (sheet.total_cost) return sheet.total_cost;
  return sheet.ingredients?.reduce((total, ing) => total + (ing.total_cost || 0), 0) || 0;
};

const calcularCustoPorcao = (sheet: TechnicalSheetWithIngredients) => {
  if (sheet.cost_per_unit) return sheet.cost_per_unit;
  const custoTotal = calcularCustoTotal(sheet);
  return sheet.yield_quantity > 0 ? custoTotal / sheet.yield_quantity : 0;
};

export default function Fichas() {
  const { sheets, isLoading, isOwnerLoading, createSheet, updateSheet, deleteSheet, addIngredient, removeIngredient } = useTechnicalSheets();
  const { items: stockItems, isOwnerLoading: stockOwnerLoading, createItem: createStockItem } = useStockItems();

  const [search, setSearch] = useState('');
  const [selectedSheet, setSelectedSheet] = useState<TechnicalSheetWithIngredients | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [voiceDialogOpen, setVoiceDialogOpen] = useState(false);
  const [fileImportDialogOpen, setFileImportDialogOpen] = useState(false);
  const [editingSheet, setEditingSheet] = useState<TechnicalSheetWithIngredients | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const {
    isListening,
    transcript,
    pendingConfirmation,
    startListening,
    stopListening,
    confirmUpdate,
    cancelUpdate
  } = useStockVoiceControl({
    stockItems: stockItems,
    onQuantityUpdate: (id, qty) => {
      // In Fichas we might want to add to current stage or similar
      console.log(`Voice update: ${id} qty ${qty}`);
    }
  });

  const handleMicMouseDown = () => startListening();
  const handleMicMouseUp = () => stopListening();

  // Load stages for selected sheet
  const { stages: sheetStages, createStage, deleteStage } = useTechnicalSheetStages(selectedSheet?.id);

  const [formData, setFormData] = useState({
    nome: '',
    descricao: '',
    tempoPreparo: '',
    rendimento: '',
    unidadeRendimento: 'un',
    image_url: '',
    productionType: 'final' as 'insumo' | 'final',
    minimumStock: '0',
    shelfLife: '',
    leadTime: '',
    video_url: '',
    laborCost: '0',
    energyCost: '0',
    otherCosts: '0',
    markup: '0',
    targetPrice: '',
    praca: '',
  });

  // Stages for form
  const [stages, setStages] = useState<StageFormData[]>([]);

  const filteredSheets = sheets.filter(sheet =>
    sheet.name.toLowerCase().includes(search.toLowerCase()) ||
    (sheet.description?.toLowerCase().includes(search.toLowerCase()))
  );

  const resetForm = () => {
    setFormData({
      nome: '',
      descricao: '',
      tempoPreparo: '',
      rendimento: '',
      unidadeRendimento: 'un',
      image_url: '',
      productionType: 'final',
      minimumStock: '0',
      shelfLife: '',
      leadTime: '',
      video_url: '',
      laborCost: '0',
      energyCost: '0',
      otherCosts: '0',
      markup: '0',
      targetPrice: '',
      praca: '',
    });
    setStages([]);
    setEditingSheet(null);
  };

  // Voice Import
  const handleVoiceImport = async (items: ExtractedItem[], recipeData?: RecipeData) => {
    if (isOwnerLoading || stockOwnerLoading) {
      toast.error('Aguarde o carregamento dos dados do usuário...');
      return;
    }
    setIsSaving(true);

    try {
      const ingredientStockIds: Map<string, string> = new Map();
      const newlyCreatedStockItems: Map<string, string> = new Map();

      for (const ing of items) {
        // Check newly created items first to avoid duplicate creation in this loop
        if (newlyCreatedStockItems.has(ing.name.toLowerCase())) {
          ingredientStockIds.set(ing.name, newlyCreatedStockItems.get(ing.name.toLowerCase())!);
          continue;
        }

        const existing = stockItems.find(
          item => item.name.toLowerCase() === ing.name.toLowerCase()
        );

        if (existing) {
          ingredientStockIds.set(ing.name, existing.id);
        } else {
          try {
            const newItem = await createStockItem.mutateAsync({
              name: ing.name,
              current_quantity: 0,
              unit: ing.unit as StockUnit,
              category: ing.category as StockCategory,
              minimum_quantity: 0,
            });

            if (newItem?.id) {
              ingredientStockIds.set(ing.name, newItem.id);
              newlyCreatedStockItems.set(ing.name.toLowerCase(), newItem.id);
            }
          } catch (err) {
            console.error(`Error creating stock item ${ing.name}:`, err);
            // Continue with other items even if one fails
          }
        }
      }

      const newSheet = await createSheet.mutateAsync({
        name: recipeData?.recipeName || 'Receita por Voz',
        description: '',
        preparation_method: recipeData?.preparationMethod || null,
        preparation_time: recipeData?.preparationTime || null,
        yield_quantity: recipeData?.yieldQuantity || 1,
        yield_unit: 'un',
        labor_cost: recipeData?.labor_cost || 0,
        energy_cost: recipeData?.energy_cost || 0,
        other_costs: recipeData?.other_costs || 0,
        markup: recipeData?.markup || 0,
        praca: recipeData?.praca || null,
      } as any);

      for (const ing of items) {
        const stockItemId = ingredientStockIds.get(ing.name);
        if (stockItemId) {
          await addIngredient.mutateAsync({
            technical_sheet_id: (newSheet as any).id,
            stock_item_id: stockItemId,
            quantity: ing.quantity,
            unit: ing.unit,
          });
        }
      }

      toast.success(`Ficha técnica criada com ${items.length} ingredientes!`);
    } catch (error) {
      console.error('Error creating recipe:', error);
      toast.error('Erro ao criar ficha técnica');
    } finally {
      setIsSaving(false);
    }
  };

  // File Import
  const handleFileImport = async (recipeInfo: RecipeData, items: ExtractedIngredient[]) => {
    if (isOwnerLoading || stockOwnerLoading) {
      toast.error('Aguarde o carregamento dos dados do usuário...');
      return;
    }
    setIsSaving(true);

    try {
      const ingredientStockIds: Map<string, string> = new Map();
      const newlyCreatedStockItems: Map<string, string> = new Map();

      for (const ing of items) {
        if (newlyCreatedStockItems.has(ing.name.toLowerCase())) {
          ingredientStockIds.set(ing.name, newlyCreatedStockItems.get(ing.name.toLowerCase())!);
          continue;
        }

        const existing = stockItems.find(
          item => item.name.toLowerCase() === ing.name.toLowerCase()
        );

        if (existing) {
          ingredientStockIds.set(ing.name, existing.id);
        } else {
          try {
            const newItem = await createStockItem.mutateAsync({
              name: ing.name,
              current_quantity: 0,
              unit: ing.unit as StockUnit,
              category: ing.category as StockCategory,
              minimum_quantity: 0,
            });

            if (newItem?.id) {
              ingredientStockIds.set(ing.name, newItem.id);
              newlyCreatedStockItems.set(ing.name.toLowerCase(), newItem.id);
            }
          } catch (err) {
            console.error(`Error creating stock item ${ing.name}:`, err);
          }
        }
      }

      const newSheet = await createSheet.mutateAsync({
        name: recipeInfo.recipeName || 'Receita Importada',
        description: '',
        preparation_method: recipeInfo.preparationMethod || null,
        preparation_time: recipeInfo.preparationTime ? Number(recipeInfo.preparationTime) : null,
        yield_quantity: recipeInfo.yieldQuantity ? Number(recipeInfo.yieldQuantity) : 1,
        yield_unit: 'un',
        labor_cost: recipeInfo.labor_cost || 0,
        energy_cost: recipeInfo.energy_cost || 0,
        other_costs: recipeInfo.other_costs || 0,
        markup: recipeInfo.markup || 0,
        praca: recipeInfo.praca || null,
      } as any);

      for (const ing of items) {
        const stockItemId = ingredientStockIds.get(ing.name);
        if (stockItemId) {
          await addIngredient.mutateAsync({
            technical_sheet_id: (newSheet as any).id,
            stock_item_id: stockItemId,
            quantity: ing.quantity,
            unit: ing.unit,
          });
        }
      }

      toast.success(`Receita "${recipeInfo.recipeName}" criada com ${items.length} ingredientes!`);
    } catch (error) {
      console.error('Error creating recipe from file:', error);
      toast.error('Erro ao criar receita');
    } finally {
      setIsSaving(false);
    }
  };

  const handleExtractFromVideo = async () => {
    if (!formData.video_url) {
      toast.error('Insira a URL do vídeo primeiro');
      return;
    }

    setIsSaving(true);
    try {
      const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-recipe-video`;
      console.log("Calling process-recipe-video:", functionUrl);

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
        },
        body: JSON.stringify({ videoUrl: formData.video_url })
      });

      if (!response.ok) {
        throw new Error(`Cloud Error: ${response.status}`);
      }

      const data = await response.json();

      if (data && data.error) {
        throw new Error(data.error);
      }

      if (data.preparation_method) {
        if (stages.length === 0) {
          setStages([{
            id: crypto.randomUUID(),
            name: 'Preparo (IA)',
            preparationMethod: data.preparation_method,
            ingredients: [],
            order_index: 0,
          }]);
        } else {
          const newStages = [...stages];
          newStages[0] = { ...newStages[0], preparationMethod: data.preparation_method };
          setStages(newStages);
        }

        if (data.name && !formData.nome) {
          setFormData(prev => ({ ...prev, nome: data.name }));
        }

        if (data.estimated_time && !formData.tempoPreparo) {
          setFormData(prev => ({ ...prev, tempoPreparo: data.estimated_time.toString() }));
        }

        toast.success('Técnicas extraídas com sucesso!');
      }
    } catch (err) {
      console.error('Error extracting from video:', err);
      toast.error('Erro ao extrair técnicas do vídeo');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSelectFicha = (sheet: TechnicalSheetWithIngredients) => {
    setSelectedSheet(sheet);
    setDetailDialogOpen(true);
  };

  const openNewDialog = () => {
    resetForm();
    // Add a default stage
    setStages([{
      id: crypto.randomUUID(),
      name: 'Parte 1',
      preparationMethod: '',
      ingredients: [],
      order_index: 0,
    }]);
    setFormDialogOpen(true);
  };

  const openEditDialog = (sheet: TechnicalSheetWithIngredients) => {
    setEditingSheet(sheet);
    setFormData({
      nome: sheet.name,
      descricao: sheet.description || '',
      tempoPreparo: sheet.preparation_time?.toString() || '',
      rendimento: sheet.yield_quantity?.toString() || '',
      unidadeRendimento: sheet.yield_unit || 'un',
      image_url: sheet.image_url || '',
      productionType: sheet.production_type || 'final',
      minimumStock: (sheet.minimum_stock || 0).toString(),
      shelfLife: sheet.shelf_life_hours?.toString() || '',
      leadTime: sheet.lead_time_hours?.toString() || '',
      video_url: sheet.video_url || '',
      laborCost: (sheet.labor_cost || 0).toString(),
      energyCost: (sheet.energy_cost || 0).toString(),
      otherCosts: (sheet.other_costs || 0).toString(),
      markup: (sheet.markup || 0).toString(),
      targetPrice: sheet.target_price?.toString() || '',
      praca: sheet.praca || '',
    });

    // Convert existing stages and ingredients to form format
    const stageMap = new Map<string, StageFormData>();

    // First, create stages from sheetStages
    sheetStages.forEach((stage, index) => {
      stageMap.set(stage.id, {
        id: stage.id,
        name: stage.name,
        preparationMethod: stage.description || '',
        ingredients: [],
        order_index: stage.order_index,
      });
    });

    // Add ingredients to their respective stages
    (sheet.ingredients || []).forEach(ing => {
      if (ing.stage_id && stageMap.has(ing.stage_id)) {
        const stage = stageMap.get(ing.stage_id)!;
        stage.ingredients.push({
          id: ing.id,
          stockItemId: ing.stock_item_id,
          nome: ing.stock_item?.name || 'Ingrediente',
          quantidade: ing.quantity.toString(),
          unidade: ing.unit,
        });
      }
    });

    // If no stages exist, create one with all ingredients
    if (stageMap.size === 0) {
      const defaultStage: StageFormData = {
        id: crypto.randomUUID(),
        name: 'Parte 1',
        preparationMethod: sheet.preparation_method || '',
        ingredients: (sheet.ingredients || []).map(ing => ({
          id: ing.id,
          stockItemId: ing.stock_item_id,
          nome: ing.stock_item?.name || 'Ingrediente',
          quantidade: ing.quantity.toString(),
          unidade: ing.unit,
        })),
        order_index: 0,
      };
      setStages([defaultStage]);
    } else {
      // Sort stages by order_index
      const sortedStages = Array.from(stageMap.values()).sort((a, b) => a.order_index - b.order_index);
      setStages(sortedStages);
    }

    setDetailDialogOpen(false);
    setFormDialogOpen(true);
  };

  const handleDeleteSheet = (sheet: TechnicalSheetWithIngredients) => {
    if (confirm(`Deseja excluir a ficha técnica "${sheet.name}"?`)) {
      deleteSheet.mutate(sheet.id);
      setDetailDialogOpen(false);
    }
  };

  const handleSave = async () => {
    if (isOwnerLoading || stockOwnerLoading) {
      toast.error('Aguarde o carregamento dos dados do usuário...');
      return;
    }
    if (!formData.nome) {
      toast.error('Preencha o nome da receita');
      return;
    }

    // Validate at least one stage has ingredients (Removed to allow manual creation without ingredients first)
    // const totalIngredients = stages.reduce((sum, stage) => sum + stage.ingredients.length, 0);
    // if (totalIngredients === 0) {
    //   toast.error('Adicione pelo menos um ingrediente');
    //   return;
    // }

    setIsSaving(true);
    try {
      let sheetId: string;
      const sheetData = {
        name: formData.nome,
        description: formData.descricao || null,
        preparation_method: null,
        preparation_time: formData.tempoPreparo ? parseInt(formData.tempoPreparo) : null,
        yield_quantity: formData.rendimento ? parseFloat(formData.rendimento) : 1,
        yield_unit: formData.unidadeRendimento,
        image_url: formData.image_url || null,
        video_url: formData.video_url || null,
        minimum_stock: formData.minimumStock ? parseFloat(formData.minimumStock) : 0,
        production_type: formData.productionType,
        shelf_life_hours: formData.shelfLife ? parseInt(formData.shelfLife) : null,
        lead_time_hours: formData.leadTime ? parseInt(formData.leadTime) : null,
        labor_cost: formData.laborCost ? parseFloat(formData.laborCost) : 0,
        energy_cost: formData.energyCost ? parseFloat(formData.energyCost) : 0,
        other_costs: formData.otherCosts ? parseFloat(formData.otherCosts) : 0,
        markup: formData.markup ? parseFloat(formData.markup) : 0,
        target_price: formData.targetPrice ? parseFloat(formData.targetPrice) : null,
        praca: formData.praca || null,
      };

      if (editingSheet) {
        await updateSheet.mutateAsync({
          id: editingSheet.id,
          ...sheetData
        } as any);
        sheetId = editingSheet.id;

        // Cleanup: remove existing ingredients and stages efficiently
        const { error: ingError } = await supabase
          .from('technical_sheet_ingredients')
          .delete()
          .eq('technical_sheet_id', sheetId);

        if (ingError) throw ingError;

        const { error: stageError } = await supabase
          .from('technical_sheet_stages')
          .delete()
          .eq('technical_sheet_id', sheetId);

        if (stageError) throw stageError;
      } else {
        const newSheet = await createSheet.mutateAsync(sheetData as any);
        sheetId = (newSheet as any).id;
      }

      // Create stages and ingredients
      for (const stage of stages) {
        const newStage = await createStage.mutateAsync({
          technical_sheet_id: sheetId,
          name: stage.name,
          description: stage.preparationMethod || null,
          order_index: stage.order_index,
          duration_minutes: null,
        });

        const stageId = (newStage as any).id;

        // Add ingredients for this stage in parallel
        await Promise.all(stage.ingredients.map(ing =>
          addIngredient.mutateAsync({
            technical_sheet_id: sheetId,
            stock_item_id: ing.stockItemId,
            quantity: parseFloat(ing.quantidade),
            unit: ing.unidade,
            stage_id: stageId,
          })
        ));
      }

      toast.success(editingSheet ? 'Ficha técnica atualizada!' : 'Ficha técnica criada!');
      setFormDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error('Error saving recipe:', error);
      toast.error('Erro ao salvar ficha técnica. Verifique se todos os ingredientes são válidos.');
    } finally {
      setIsSaving(false);
    }

  };

  if (isLoading) {
    return (
      <div className="animate-fade-in space-y-4">
        <PageHeader
          title="Fichas Técnicas"
          description="Cadastre e visualize o custo detalhado de cada receita"
        />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Fichas Técnicas"
        description="Cadastre e visualize o custo detalhado de cada receita"
      />

      <Tabs defaultValue="fichas" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="fichas">Fichas</TabsTrigger>
          <TabsTrigger value="cadastro">Cadastro</TabsTrigger>
        </TabsList>

        {/* Fichas Tab - List */}
        <TabsContent value="fichas">
          {/* Search */}
          <div className="flex gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar fichas técnicas..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Empty State */}
          {filteredSheets.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <ChefHat className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma ficha técnica cadastrada ainda.</p>
              <p className="text-sm mt-1">Use a aba "Cadastro" para adicionar suas receitas.</p>
            </div>
          )}

          {/* List */}
          {filteredSheets.length > 0 && (
            <MobileList>
              {filteredSheets.map((sheet) => {
                const custoTotal = calcularCustoTotal(sheet);
                const custoPorcao = calcularCustoPorcao(sheet);

                return (
                  <MobileListItem
                    key={sheet.id}
                    onClick={() => handleSelectFicha(sheet)}
                  >
                    <div className="flex items-center gap-2">
                      <MobileListTitle>{sheet.name}</MobileListTitle>
                      {sheet.markup && sheet.markup < 2.5 && sheet.markup > 0 && (
                        <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" title="Margem Baixa" />
                      )}
                      <span className="ml-auto text-sm font-bold text-primary">
                        R$ {custoTotal.toFixed(2)}
                      </span>
                    </div>

                    <MobileListDetails>
                      <span className="flex items-center gap-1">
                        <Calculator className="h-3 w-3" />
                        R$ {custoPorcao.toFixed(2)}/{sheet.yield_unit}
                      </span>
                      {sheet.praca && (
                        <span className="flex items-center gap-1">
                          <ChefHat className="h-3 w-3" />
                          {sheet.praca}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {sheet.yield_quantity} {sheet.yield_unit}
                      </span>
                      {sheet.preparation_time && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {sheet.preparation_time} min
                        </span>
                      )}
                    </MobileListDetails>
                  </MobileListItem>
                );
              })}
            </MobileList>
          )}
        </TabsContent>

        {/* Cadastro Tab */}
        <TabsContent value="cadastro">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
            <Card
              className="cursor-pointer hover:border-primary hover:shadow-lg transition-all group"
              onClick={() => setVoiceDialogOpen(true)}
            >
              <CardHeader className="text-center pb-2">
                <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2 group-hover:bg-primary/20 transition-colors">
                  <Mic className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-base">Falar Ingredientes</CardTitle>
                <CardDescription className="text-xs">
                  Dite a receita e a IA cadastra
                </CardDescription>
              </CardHeader>
            </Card>

            <Card
              className="cursor-pointer hover:border-primary hover:shadow-lg transition-all group"
              onClick={() => setFileImportDialogOpen(true)}
            >
              <CardHeader className="text-center pb-2">
                <div className="mx-auto w-12 h-12 rounded-full bg-accent flex items-center justify-center mb-2 group-hover:bg-accent/80 transition-colors">
                  <FileText className="h-6 w-6 text-accent-foreground" />
                </div>
                <CardTitle className="text-base font-bold">Importar PDF / Foto (IA)</CardTitle>
                <CardDescription className="text-xs">
                  A IA cria a ficha técnica inteira
                </CardDescription>
              </CardHeader>
            </Card>

            <Card
              className="cursor-pointer hover:border-primary hover:shadow-lg transition-all group"
              onClick={openNewDialog}
            >
              <CardHeader className="text-center pb-2">
                <div className="mx-auto w-12 h-12 rounded-full bg-secondary/50 flex items-center justify-center mb-2 group-hover:bg-secondary transition-colors">
                  <Plus className="h-6 w-6 text-foreground" />
                </div>
                <CardTitle className="text-base">Cadastro Manual</CardTitle>
                <CardDescription className="text-xs">
                  Adicionar ficha técnica
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Voice Import Dialog */}
      <VoiceImportDialog
        open={voiceDialogOpen}
        onOpenChange={setVoiceDialogOpen}
        onImport={handleVoiceImport}
        title="Falar Ingredientes da Receita"
        description="Fale os ingredientes da receita. Ex: 'Farinha de trigo 500 gramas, açúcar 200 gramas, ovos 3 unidades'"
        mode="recipe"
      />

      {/* File Import Dialog */}
      <RecipeFileImportDialog
        open={fileImportDialogOpen}
        onOpenChange={setFileImportDialogOpen}
        onImport={handleFileImport}
      />

      {/* Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>{selectedSheet?.name}</DialogTitle>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={() => selectedSheet && handleDeleteSheet(selectedSheet)}
                >
                  <Trash2 className="h-4 w-4" />
                  Excluir
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  className="gap-1"
                  onClick={() => selectedSheet && openEditDialog(selectedSheet)}
                >
                  <Edit className="h-4 w-4" />
                  Editar
                </Button>
              </div>
            </div>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh] pr-4">
            {selectedSheet && (
              <div className="space-y-4 py-4">
                <div className="flex flex-wrap gap-2">
                  {selectedSheet.description && (
                    <p className="text-sm text-muted-foreground w-full mb-2">{selectedSheet.description}</p>
                  )}
                  {selectedSheet.preparation_time && (
                    <MobileListBadge>
                      <Clock className="h-3 w-3 mr-1" />
                      {selectedSheet.preparation_time} min
                    </MobileListBadge>
                  )}
                  <MobileListBadge>
                    <Users className="h-3 w-3 mr-1" />
                    {selectedSheet.yield_quantity} {selectedSheet.yield_unit}
                  </MobileListBadge>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Card className="border-primary/20 bg-primary/10">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <DollarSign className="h-4 w-4 text-primary" />
                        <span className="text-sm text-muted-foreground">Custo Total de Produção</span>
                      </div>
                      <p className="text-xl font-bold text-primary">
                        R$ {calcularCustoTotal(selectedSheet).toFixed(2)}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Inclui R$ {((selectedSheet.labor_cost || 0) + (selectedSheet.energy_cost || 0) + (selectedSheet.other_costs || 0)).toFixed(2)} de custos adicionais
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="border-accent/20 bg-accent/10">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <Calculator className="h-4 w-4 text-accent-foreground" />
                        <span className="text-sm text-muted-foreground">Preço Sugerido (MKP {selectedSheet.markup})</span>
                      </div>
                      <p className="text-xl font-bold text-accent-foreground">
                        R$ {((calcularCustoPorcao(selectedSheet)) * (selectedSheet.markup || 1)).toFixed(2)}
                      </p>
                      {selectedSheet.target_price && (
                        <p className="text-[10px] text-accent-foreground mt-1 font-medium">
                          Alvo: R$ {selectedSheet.target_price.toFixed(2)}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-3 gap-2 px-1">
                  <div className="text-center p-2 rounded-lg bg-muted/30">
                    <p className="text-[10px] text-muted-foreground uppercase">Mão de Obra</p>
                    <p className="text-sm font-semibold">R$ {(selectedSheet.labor_cost || 0).toFixed(2)}</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-muted/30">
                    <p className="text-[10px] text-muted-foreground uppercase">Energia</p>
                    <p className="text-sm font-semibold">R$ {(selectedSheet.energy_cost || 0).toFixed(2)}</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-muted/30">
                    <p className="text-[10px] text-muted-foreground uppercase">Setor</p>
                    <p className="text-sm font-semibold truncate">{selectedSheet.praca || '-'}</p>
                  </div>
                </div>

                {selectedSheet.video_url && (
                  <div className="space-y-2">
                    <h4 className="font-medium">Vídeo da Técnica</h4>
                    <div className="aspect-video rounded-lg overflow-hidden border">
                      {selectedSheet.video_url.includes('youtube.com') || selectedSheet.video_url.includes('youtu.be') ? (
                        <iframe
                          width="100%"
                          height="100%"
                          src={`https://www.youtube.com/embed/${selectedSheet.video_url.split('v=')[1] || selectedSheet.video_url.split('/').pop()}`}
                          title="YouTube video player"
                          frameBorder="0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        ></iframe>
                      ) : (
                        <div className="flex items-center justify-center h-full bg-muted">
                          <a
                            href={selectedSheet.video_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline flex items-center gap-2"
                          >
                            <FileText className="h-5 w-5" />
                            Ver Vídeo (Instagram/Outros)
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Stage Display with ingredients organized by stage */}
                <StageDisplay
                  stages={sheetStages}
                  ingredients={selectedSheet.ingredients || []}
                />

                {/* Legacy preparation method display */}
                {selectedSheet.preparation_method && sheetStages.length === 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Modo de Preparo</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                      {selectedSheet.preparation_method}
                    </p>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Dialog open={!!pendingConfirmation} onOpenChange={(open) => !open && cancelUpdate()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar Ingrediente por Voz</DialogTitle>
            <DialogDescription>
              IA identificou este ingrediente para sua ficha técnica:
            </DialogDescription>
          </DialogHeader>

          {pendingConfirmation && (
            <div className="space-y-4 py-4">
              <div className="p-4 bg-muted rounded-lg border border-primary/10">
                <div className="text-xs text-muted-foreground uppercase font-bold tracking-wider mb-1">Ingrediente</div>
                <div className="font-semibold text-lg">{pendingConfirmation.itemName}</div>
              </div>

              <div className="p-4 bg-muted rounded-lg border border-primary/10">
                <div className="text-xs text-muted-foreground uppercase font-bold tracking-wider mb-1">Quantidade Sugerida</div>
                <div className="font-semibold text-lg">
                  {pendingConfirmation.quantity ?? '---'} {pendingConfirmation.unit}
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
            <Button variant="outline" onClick={cancelUpdate}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (pendingConfirmation) {
                  // Logic to add to current stage in Fichas
                  const newIngredient = {
                    stockItemId: pendingConfirmation.itemId,
                    quantidade: (pendingConfirmation.quantity || 0).toString(),
                    unidade: pendingConfirmation.unit || 'un',
                    nome: pendingConfirmation.itemName
                  };

                  if (stages.length > 0) {
                    const lastStageIndex = stages.length - 1;
                    const updatedStages = [...stages];
                    updatedStages[lastStageIndex].ingredients.push(newIngredient as any);
                    setStages(updatedStages);
                    toast.success(`${pendingConfirmation.itemName} adicionado ao último estágio`);
                  } else {
                    toast.error('Crie um estágio primeiro para adicionar o ingrediente');
                  }
                  cancelUpdate();
                }
              }}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              Adicionar à Ficha
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Dialog */}
      <Dialog open={formDialogOpen} onOpenChange={(open) => {
        setFormDialogOpen(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{editingSheet ? 'Editar Ficha Técnica' : 'Nova Ficha Técnica'}</DialogTitle>
            <DialogDescription>
              {editingSheet ? 'Atualize os dados da receita' : 'Preencha os dados da receita'}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[65vh] pr-4">
            <Tabs defaultValue="operacional" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="operacional">Operacional</TabsTrigger>
                <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
              </TabsList>

              <TabsContent value="operacional" className="space-y-4">
                {/* Image Upload */}
                <div className="flex items-start gap-4">
                  <ImageUpload
                    currentImageUrl={formData.image_url || null}
                    onImageUploaded={(url) => setFormData({ ...formData, image_url: url })}
                    onImageRemoved={() => setFormData({ ...formData, image_url: '' })}
                    bucket="technical-sheet-images"
                    size="lg"
                  />
                  <div className="flex-1 space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="nome">Nome da Receita *</Label>
                      <div className="flex gap-2">
                        <Input
                          id="nome"
                          value={formData.nome}
                          onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                          placeholder="Ex: Bolo de Chocolate"
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          variant={isListening ? "destructive" : "outline"}
                          size="icon"
                          className={`shrink-0 transition-all ${isListening ? 'animate-pulse shadow-lg shadow-destructive/20' : ''}`}
                          onMouseDown={handleMicMouseDown}
                          onMouseUp={handleMicMouseUp}
                          onTouchStart={handleMicMouseDown}
                          onTouchEnd={handleMicMouseUp}
                          title="Segure para falar ingrediente"
                        >
                          {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="video_url">URL do Vídeo (YouTube/Instagram)</Label>
                      <div className="flex gap-2">
                        <Input
                          id="video_url"
                          value={formData.video_url}
                          onChange={(e) => setFormData({ ...formData, video_url: e.target.value })}
                          placeholder="https://..."
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={handleExtractFromVideo}
                          disabled={isSaving || !formData.video_url}
                        >
                          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Extrair do Vídeo'}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="praca">Setor / Praça (Extração AI)</Label>
                    <Input
                      id="praca"
                      value={formData.praca}
                      onChange={(e) => setFormData({ ...formData, praca: e.target.value })}
                      placeholder="Ex: Cozinha Quente"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="descricao">Resumo Curto</Label>
                    <Input
                      id="descricao"
                      value={formData.descricao}
                      onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                      placeholder="Ex: Doce, Salgado, etc."
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Tipo de Produção</Label>
                  <Select
                    value={formData.productionType}
                    onValueChange={(value: 'insumo' | 'final') => setFormData({ ...formData, productionType: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="final">Produto Final</SelectItem>
                      <SelectItem value="insumo">Insumo Produzido</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="tempo">Tempo (min)</Label>
                    <Input
                      id="tempo"
                      type="number"
                      value={formData.tempoPreparo}
                      onChange={(e) => setFormData({ ...formData, tempoPreparo: e.target.value })}
                      placeholder="60"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rendimento">Rendimento</Label>
                    <Input
                      id="rendimento"
                      type="number"
                      value={formData.rendimento}
                      onChange={(e) => setFormData({ ...formData, rendimento: e.target.value })}
                      placeholder="12"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="unidadeRendimento">Unidade</Label>
                    <Select
                      value={formData.unidadeRendimento}
                      onValueChange={(value) => setFormData({ ...formData, unidadeRendimento: value })}
                    >
                      <SelectTrigger id="unidadeRendimento">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="un">unidades</SelectItem>
                        <SelectItem value="kg">kg</SelectItem>
                        <SelectItem value="g">g</SelectItem>
                        <SelectItem value="L">L</SelectItem>
                        <SelectItem value="ml">ml</SelectItem>
                        <SelectItem value="porções">porções</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="minimumStock">Estoque Mínimo</Label>
                    <Input
                      id="minimumStock"
                      type="number"
                      value={formData.minimumStock}
                      onChange={(e) => setFormData({ ...formData, minimumStock: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="shelfLife">Validade (h)</Label>
                    <Input
                      id="shelfLife"
                      type="number"
                      value={formData.shelfLife}
                      onChange={(e) => setFormData({ ...formData, shelfLife: e.target.value })}
                      placeholder="48"
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="financeiro" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="markup">Markup Desejado (ex: 3.5)</Label>
                    <Input
                      id="markup"
                      type="number"
                      step="0.1"
                      value={formData.markup}
                      onChange={(e) => setFormData({ ...formData, markup: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="targetPrice">Preço Alvo Sugerido (R$)</Label>
                    <Input
                      id="targetPrice"
                      type="number"
                      step="0.01"
                      value={formData.targetPrice}
                      onChange={(e) => setFormData({ ...formData, targetPrice: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="laborCost" className="text-[10px]">Mão de Obra</Label>
                    <Input
                      id="laborCost"
                      type="number"
                      step="0.01"
                      className="h-8"
                      value={formData.laborCost}
                      onChange={(e) => setFormData({ ...formData, laborCost: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="energyCost" className="text-[10px]">Energia/Gás</Label>
                    <Input
                      id="energyCost"
                      type="number"
                      step="0.01"
                      className="h-8"
                      value={formData.energyCost}
                      onChange={(e) => setFormData({ ...formData, energyCost: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="otherCosts" className="text-[10px]">Outros Adicionais</Label>
                    <Input
                      id="otherCosts"
                      type="number"
                      step="0.01"
                      className="h-8"
                      value={formData.otherCosts}
                      onChange={(e) => setFormData({ ...formData, otherCosts: e.target.value })}
                    />
                  </div>
                </div>

                {/* Real-time Indicators */}
                {(() => {
                  const ingredientsCost = stages.reduce((sum, stage) => {
                    return sum + stage.ingredients.reduce((s, ing) => {
                      const stockItem = stockItems.find(i => i.id === ing.stockItemId);
                      const unitPrice = stockItem?.unit_price || 0;
                      return s + (parseFloat(ing.quantidade) * unitPrice);
                    }, 0);
                  }, 0);

                  const labor = parseFloat(formData.laborCost) || 0;
                  const energy = parseFloat(formData.energyCost) || 0;
                  const others = parseFloat(formData.otherCosts) || 0;
                  const totalProductionCost = ingredientsCost + labor + energy + others;
                  const yieldQty = parseFloat(formData.rendimento) || 1;
                  const unitCost = totalProductionCost / yieldQty;
                  const markupValue = parseFloat(formData.markup) || 1;
                  const suggestedPrice = unitCost * markupValue;

                  return (
                    <Card className="bg-muted/50 border-primary/20">
                      <CardContent className="p-4 space-y-3">
                        <h4 className="font-semibold text-sm flex items-center gap-2">
                          <Calculator className="h-4 w-4" />
                          Indicadores de Custo (Tempo Real)
                        </h4>
                        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                          <div className="flex justify-between border-b border-muted py-1">
                            <span className="text-muted-foreground">Ingredientes:</span>
                            <span className="font-medium">R$ {ingredientsCost.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between border-b border-muted py-1">
                            <span className="text-muted-foreground">Custo Unit.:</span>
                            <span className="font-medium">R$ {unitCost.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between border-b border-muted py-1 items-center">
                            <span className="text-muted-foreground">Custo Total:</span>
                            <span className="font-bold text-primary">R$ {totalProductionCost.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between border-b border-muted py-1 items-center">
                            <span className="text-muted-foreground">Preço Sugerido:</span>
                            <span className="font-bold text-accent-foreground">R$ {suggestedPrice.toFixed(2)}</span>
                          </div>
                        </div>

                        {markupValue < 2.5 && markupValue > 0 && (
                          <div className="flex items-start gap-2 p-2 bg-yellow-50 text-yellow-800 rounded text-xs border border-yellow-200">
                            <Plus className="h-3 w-3 mt-0.5 rotate-45" />
                            <span>Atenção: Markup abaixo de 2.5 pode comprometer a margem de lucro operacional.</span>
                          </div>
                        )}
                        {(labor + energy + others) > ingredientsCost && ingredientsCost > 0 && (
                          <div className="flex items-start gap-2 p-2 bg-orange-50 text-orange-800 rounded text-xs border border-orange-200">
                            <DollarSign className="h-3 w-3 mt-0.5" />
                            <span>Alerta: Custos fixos (mão de obra/energia) estão superiores ao custo de ingredientes.</span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })()}
              </TabsContent>

              <div className="pt-4 border-t mt-6">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <ChefHat className="h-5 w-5" />
                  Ingredientes e Etapas de Preparo
                </h3>
                <StageForm
                  stages={stages}
                  onStagesChange={setStages}
                  stockItems={stockItems as any}
                />
              </div>

            </Tabs>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormDialogOpen(false)} disabled={isSaving || isOwnerLoading}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isSaving || isOwnerLoading || stockOwnerLoading}>
              {isSaving || isOwnerLoading || stockOwnerLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {isOwnerLoading || stockOwnerLoading ? 'Carregando...' : 'Salvando...'}
                </>
              ) : (
                'Salvar Ficha Técnica'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
