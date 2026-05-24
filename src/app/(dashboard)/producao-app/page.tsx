'use client';

import { useState } from 'react';
import { useProductions, STATUS_LABELS } from '@/hooks/ops/useProductions';
import { useProductionStock } from '@/hooks/ops/useProductionStock';
import { useTechnicalSheets } from '@/hooks/ops/useTechnicalSheets';
import { useLosses } from '@/hooks/stock/useLosses';
import { useStockVoiceControl } from '@/hooks/stock/useStockVoiceControl';
import { useProfile } from '@/hooks/shared/useProfile';
import { sendToN8N } from '@/services/n8n';

import {
  Mic,
  MicOff,
  Factory,
  Boxes,
  FileText,
  TrendingDown,
  Play,
  Pause,
  CheckCircle,
  AlertTriangle,
  Plus,
  Minus,
  Sparkles,
  ChevronRight,
  Utensils,
  Clock,
  Check,
  X,
  Volume2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';

export default function ProducaoAppPage() {
  const { productions, updateProduction, isLoading: prodLoading } = useProductions();
  const { productionStock, updateQuantity, getProductionStockQuantity, isLoading: stockLoading } = useProductionStock();
  const { sheets: technicalSheets, isLoading: sheetsLoading } = useTechnicalSheets();
  const { createLoss, isLoading: lossLoading } = useLosses();
  const { profile } = useProfile();

  // Selected tab state
  const [activeTab, setActiveTab] = useState('fila');

  // Selected production detail state
  const [selectedProduction, setSelectedProduction] = useState<any | null>(null);
  const [completeProductionId, setCompleteProductionId] = useState<string | null>(null);
  const [actualQuantity, setActualQuantity] = useState<number>(0);

  // Selected recipe detail state
  const [selectedRecipe, setSelectedRecipe] = useState<any | null>(null);

  // Waste/Loss form state
  const [wasteItemId, setWasteItemId] = useState('');
  const [wasteQty, setWasteQty] = useState('');
  const [wasteNotes, setWasteNotes] = useState('');

  // Stock items list mapping
  const stockItemsList = productionStock.map(ps => ps.stock_item).filter(Boolean);

  // Bind voice control to update production stock quantity
  const {
    isSupported: voiceSupported,
    isListening,
    transcript,
    pendingConfirmation,
    toggleListening,
    confirmUpdate,
    cancelUpdate
  } = useStockVoiceControl({
    stockItems: stockItemsList as any[],
    onQuantityUpdate: (itemId, quantity) => {
      // Direct kitchen stock update
      updateQuantity.mutate({ stockItemId: itemId, quantity });
      // Log AI Voice Movement to n8n
      sendToN8N({
        event: 'ia_voice_production_app',
        action: 'stock_update',
        itemId,
        quantity,
        origin: 'producao-app'
      }).catch(() => {});
    }
  });

  if (prodLoading || stockLoading || sheetsLoading) {
    return (
      <div className="min-h-screen bg-[#09090b] text-foreground flex flex-col items-center justify-center gap-4">
        <div className="h-12 w-12 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin" />
        <p className="text-emerald-400 font-medium animate-pulse">Carregando painel de cozinha...</p>
      </div>
    );
  }

  // Filter only requested, planned, in_progress, paused productions
  const activeProductions = productions.filter(
    p => p.status === 'planned' || p.status === 'in_progress' || p.status === 'paused' || p.status === 'requested'
  );

  const handleStartProduction = (id: string) => {
    updateProduction.mutate({ id, status: 'in_progress' });
  };

  const handlePauseProduction = (id: string) => {
    updateProduction.mutate({ id, status: 'paused' });
  };

  const handleOpenCompleteDialog = (prod: any) => {
    setCompleteProductionId(prod.id);
    setActualQuantity(Number(prod.planned_quantity));
  };

  const handleCompleteProduction = () => {
    if (!completeProductionId) return;
    updateProduction.mutate({
      id: completeProductionId,
      status: 'completed',
      actual_quantity: actualQuantity
    });
    setCompleteProductionId(null);
  };

  const handleRegisterWaste = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wasteItemId || !wasteQty || parseFloat(wasteQty) <= 0) {
      toast.error('Preencha todos os campos do desperdício.');
      return;
    }

    const selectedStockItem = productionStock.find(ps => ps.stock_item_id === wasteItemId);
    if (!selectedStockItem || !selectedStockItem.stock_item) return;

    try {
      await createLoss.mutateAsync({
        source_type: 'stock_item',
        source_id: wasteItemId,
        source_name: selectedStockItem.stock_item.name,
        quantity: parseFloat(wasteQty),
        unit: selectedStockItem.stock_item.unit,
        notes: `Registrado pelo app da cozinha: ${wasteNotes}`,
        deductStock: true
      });

      // Send waste alert to n8n
      sendToN8N({
        event: 'perda_registrada_cozinha',
        itemId: wasteItemId,
        itemName: selectedStockItem.stock_item.name,
        quantity: parseFloat(wasteQty),
        unit: selectedStockItem.stock_item.unit,
        notes: wasteNotes,
        user: profile?.email
      }).catch(() => {});

      toast.success('Desperdício registrado e estoque atualizado!');
      setWasteItemId('');
      setWasteQty('');
      setWasteNotes('');
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-[#f4f4f5] flex flex-col font-sans">
      {/* HEADER */}
      <header className="px-4 py-3 border-b border-[#1f1f23] bg-[#0c0c0e] flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Utensils className="h-4.5 w-4.5 text-[#09090b]" />
          </div>
          <div>
            <h1 className="font-bold text-sm leading-tight flex items-center gap-1.5">
              Azura Pro-Cook
              <Badge variant="outline" className="text-[9px] border-emerald-500/30 text-emerald-400 py-0 px-1 bg-emerald-950/20">Cozinha</Badge>
            </h1>
            <p className="text-[10px] text-muted-foreground">Funcionário: {profile?.email?.split('@')[0] || 'Produção'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {voiceSupported && (
            <Button
              size="sm"
              variant="outline"
              className={`h-8 gap-1.5 text-xs rounded-full border-emerald-500/20 hover:bg-emerald-950/20 transition-all duration-300 ${
                isListening ? 'bg-red-950/30 text-red-400 border-red-500/30 animate-pulse' : 'text-emerald-400 bg-emerald-950/10'
              }`}
              onClick={() => toggleListening()}
            >
              {isListening ? (
                <>
                  <MicOff className="h-3.5 w-3.5" /> Ouvindo...
                </>
              ) : (
                <>
                  <Mic className="h-3.5 w-3.5" /> Falar Contagem
                </>
              )}
            </Button>
          )}
        </div>
      </header>

      {/* TRANSCRIPT POPUP WHEN LISTENING */}
      {isListening && (
        <div className="bg-red-950/40 border-b border-red-950 p-3 text-center text-xs animate-pulse text-red-300">
          <p className="font-medium flex items-center justify-center gap-1.5">
            <Volume2 className="h-3.5 w-3.5" /> Fale o insumo e a quantidade (ex: "cinco quilos de arroz")
          </p>
          {transcript && <p className="mt-1 italic text-white text-sm">"{transcript}"</p>}
        </div>
      )}

      {/* VOICE CONFIRMATION DIALOG */}
      <Dialog open={!!pendingConfirmation} onOpenChange={(open) => !open && cancelUpdate()}>
        <DialogContent className="border-[#27272a] bg-[#09090b] text-[#f4f4f5]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-400">
              <Sparkles className="h-5 w-5 text-emerald-400" />
              Confirmar Contagem por Voz
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              A inteligência artificial do Azura interpretou o seguinte comando da cozinha:
            </DialogDescription>
          </DialogHeader>
          {pendingConfirmation && (
            <div className="my-4 p-4 rounded-xl bg-zinc-900/50 border border-zinc-800 space-y-2">
              <p className="text-sm">
                Insumo: <strong className="text-white text-base">{pendingConfirmation.itemName}</strong>
              </p>
              {pendingConfirmation.quantity !== undefined && (
                <p className="text-sm">
                  Quantidade: <strong className="text-emerald-400 text-lg">{pendingConfirmation.quantity} {pendingConfirmation.unit}</strong>
                </p>
              )}
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={cancelUpdate} className="text-zinc-400 hover:text-white">
              <X className="mr-2 h-4 w-4" /> Cancelar
            </Button>
            <Button onClick={confirmUpdate} className="bg-emerald-500 hover:bg-emerald-600 text-black font-semibold">
              <Check className="mr-2 h-4 w-4" /> Confirmar Ajuste
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MAIN LAYOUT WITH TABS */}
      <main className="flex-1 flex flex-col p-4 pb-20">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex-1 flex flex-col">
          {/* TAB CONTENTS */}
          <div className="flex-1">
            {/* TAREFAS DE PRODUÇÃO */}
            <TabsContent value="fila" className="m-0 space-y-3">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Fila de Produção</h2>
                <Badge variant="outline" className="border-emerald-500/20 text-emerald-400 bg-emerald-950/15">
                  {activeProductions.length} ativas
                </Badge>
              </div>

              {activeProductions.length === 0 ? (
                <Card className="border-[#1f1f23] bg-[#0c0c0e]/60 text-center py-10">
                  <CardContent className="space-y-2">
                    <Factory className="h-10 w-10 text-zinc-600 mx-auto mb-2" />
                    <p className="font-semibold text-sm">Fila de produção limpa!</p>
                    <p className="text-xs text-zinc-500">Nenhum lote planejado para agora.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {activeProductions.map((prod) => {
                    const statusColors: Record<string, string> = {
                      planned: 'bg-zinc-800 text-zinc-400 border-zinc-700',
                      requested: 'bg-blue-950/30 text-blue-400 border-blue-500/20',
                      in_progress: 'bg-emerald-950/30 text-emerald-400 border-emerald-500/20',
                      paused: 'bg-amber-950/30 text-amber-400 border-amber-500/20',
                    };

                    return (
                      <Card
                        key={prod.id}
                        className={`border-[#1f1f23] bg-[#0c0c0e] hover:border-emerald-500/20 transition-all duration-300 ${
                          prod.status === 'in_progress' ? 'ring-1 ring-emerald-500/20' : ''
                        }`}
                      >
                        <CardContent className="p-3.5 space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div onClick={() => setSelectedProduction(prod)} className="cursor-pointer flex-1">
                              <div className="flex items-center gap-2">
                                <h3 className="font-bold text-sm text-white hover:underline">{prod.name}</h3>
                                <Badge className={`text-[9px] px-1 py-0 border ${statusColors[prod.status] || ''}`}>
                                  {STATUS_LABELS[prod.status] || prod.status}
                                </Badge>
                              </div>
                              <p className="text-xs text-zinc-400 mt-1 flex items-center gap-1">
                                <Clock className="h-3 w-3" /> Receita: {prod.technical_sheet?.name || 'Não informada'}
                              </p>
                              <p className="text-xs text-zinc-400 mt-0.5">
                                Qtd. Planejada: <span className="text-white font-semibold">{prod.planned_quantity} {prod.technical_sheet?.yield_unit || 'un'}</span>
                              </p>
                            </div>

                            {/* OPERATIONAL BUTTONS - FAST TOUCH */}
                            <div className="flex flex-col gap-1.5 justify-center">
                              {prod.status === 'planned' || prod.status === 'requested' ? (
                                <Button
                                  size="sm"
                                  className="h-8 px-3 bg-emerald-500 hover:bg-emerald-600 text-[#09090b] font-semibold text-xs rounded-lg"
                                  onClick={() => handleStartProduction(prod.id)}
                                >
                                  <Play className="h-3.5 w-3.5 mr-1" /> Começar
                                </Button>
                              ) : null}

                              {prod.status === 'in_progress' ? (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 px-3 border-amber-500/20 hover:bg-amber-950/20 text-amber-400 font-medium text-xs rounded-lg bg-amber-950/5"
                                    onClick={() => handlePauseProduction(prod.id)}
                                  >
                                    <Pause className="h-3.5 w-3.5 mr-1" /> Pausar
                                  </Button>
                                  <Button
                                    size="sm"
                                    className="h-8 px-3 bg-emerald-500 hover:bg-emerald-600 text-[#09090b] font-semibold text-xs rounded-lg"
                                    onClick={() => handleOpenCompleteDialog(prod)}
                                  >
                                    <CheckCircle className="h-3.5 w-3.5 mr-1" /> Concluir
                                  </Button>
                                </>
                              ) : null}

                              {prod.status === 'paused' ? (
                                <Button
                                  size="sm"
                                  className="h-8 px-3 bg-emerald-500 hover:bg-emerald-600 text-[#09090b] font-semibold text-xs rounded-lg"
                                  onClick={() => handleStartProduction(prod.id)}
                                >
                                  <Play className="h-3.5 w-3.5 mr-1" /> Retomar
                                </Button>
                              ) : null}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* ESTOQUE DE PRODUÇÃO (RESTREVADO) */}
            <TabsContent value="estoque" className="m-0 space-y-3">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Insumos na Cozinha</h2>
                <Badge variant="outline" className="border-emerald-500/20 text-emerald-400 bg-emerald-950/15">
                  {productionStock.length} itens
                </Badge>
              </div>

              {productionStock.length === 0 ? (
                <Card className="border-[#1f1f23] bg-[#0c0c0e]/60 text-center py-10">
                  <CardContent className="space-y-2">
                    <Boxes className="h-10 w-10 text-zinc-600 mx-auto mb-2" />
                    <p className="font-semibold text-sm">Estoque de produção vazio!</p>
                    <p className="text-xs text-zinc-500">Transfira insumos do estoque central para começar.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {productionStock.map((item) => {
                    const isLow = Number(item.quantity) < 2; // Simple alert threshold for kitchen

                    return (
                      <Card
                        key={item.id}
                        className={`border-[#1f1f23] bg-[#0c0c0e] hover:border-emerald-500/10 transition-all duration-300 ${
                          isLow ? 'ring-1 ring-amber-500/20 border-amber-500/10' : ''
                        }`}
                      >
                        <CardContent className="p-3.5 flex items-center justify-between gap-4">
                          <div className="min-w-0">
                            <h3 className="font-bold text-sm text-white truncate">{item.stock_item?.name || 'Insumo'}</h3>
                            <p className="text-xs text-zinc-400 mt-0.5">Cat: {item.stock_item?.category || 'Geral'}</p>
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className={`text-base font-bold ${isLow ? 'text-amber-400' : 'text-emerald-400'}`}>
                                {item.quantity}
                              </span>
                              <span className="text-[11px] text-zinc-500">{item.stock_item?.unit || 'un'}</span>
                              {isLow && (
                                <Badge variant="outline" className="text-[8px] py-0 px-1 border-amber-500/30 text-amber-400 bg-amber-950/20 ml-1">
                                  Baixo
                                </Badge>
                              )}
                            </div>
                          </div>

                          {/* FAST COUNTER BUTTONS - TOUCH OPTIMIZED */}
                          <div className="flex items-center gap-1 bg-[#151518] rounded-xl p-1 border border-[#27272a]">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-9 w-9 rounded-lg text-zinc-400 hover:text-white"
                              onClick={() => {
                                const newQty = Math.max(0, Number(item.quantity) - 1);
                                updateQuantity.mutate({ stockItemId: item.stock_item_id, quantity: newQty });
                              }}
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-9 w-9 rounded-lg text-zinc-400 hover:text-white"
                              onClick={() => {
                                const newQty = Number(item.quantity) + 1;
                                updateQuantity.mutate({ stockItemId: item.stock_item_id, quantity: newQty });
                              }}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* RECEITAS / MODO DE PREPARO */}
            <TabsContent value="receitas" className="m-0 space-y-3">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Fichas e Receitas</h2>
                <Badge variant="outline" className="border-emerald-500/20 text-emerald-400 bg-emerald-950/15">
                  {technicalSheets.length} pratos
                </Badge>
              </div>

              {technicalSheets.length === 0 ? (
                <Card className="border-[#1f1f23] bg-[#0c0c0e]/60 text-center py-10">
                  <CardContent className="space-y-2">
                    <FileText className="h-10 w-10 text-zinc-600 mx-auto mb-2" />
                    <p className="font-semibold text-sm">Nenhuma ficha cadastrada!</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {technicalSheets.map((sheet) => (
                    <Card
                      key={sheet.id}
                      className="border-[#1f1f23] bg-[#0c0c0e] hover:border-emerald-500/20 transition-all cursor-pointer"
                      onClick={() => setSelectedRecipe(sheet)}
                    >
                      <CardContent className="p-3.5 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center flex-shrink-0">
                            <Utensils className="h-4.5 w-4.5 text-emerald-400" />
                          </div>
                          <div>
                            <h3 className="font-bold text-sm text-white">{sheet.name}</h3>
                            <p className="text-xs text-zinc-400">Rendimento: {sheet.yield_quantity} {sheet.yield_unit}</p>
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-zinc-500" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* REGISTRO DE DESPERDÍCIO (PERDAS) */}
            <TabsContent value="perdas" className="m-0 space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-1">Registrar Perda / Lixo</h2>
                <p className="text-xs text-zinc-500">Informe produtos descartados ou avariados para manter o estoque e custos exatos.</p>
              </div>

              <Card className="border-[#1f1f23] bg-[#0c0c0e]">
                <CardContent className="p-4">
                  <form onSubmit={handleRegisterWaste} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="item" className="text-xs text-zinc-400">Insumo Descartado</Label>
                      <select
                        id="item"
                        className="w-full bg-[#151518] border border-[#27272a] rounded-xl py-2.5 px-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        value={wasteItemId}
                        onChange={(e) => setWasteItemId(e.target.value)}
                        required
                      >
                        <option value="">Selecione o insumo...</option>
                        {productionStock.map((ps) => (
                          <option key={ps.id} value={ps.stock_item_id} className="bg-[#151518]">
                            {ps.stock_item?.name} (Disponível: {ps.quantity} {ps.stock_item?.unit})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="qty" className="text-xs text-zinc-400">Quantidade Desperdiçada</Label>
                      <Input
                        id="qty"
                        type="number"
                        step="0.01"
                        placeholder="Ex: 0.50"
                        className="bg-[#151518] border-[#27272a] focus:ring-emerald-500 py-5"
                        value={wasteQty}
                        onChange={(e) => setWasteQty(e.target.value)}
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="notes" className="text-xs text-zinc-400">Motivo (Opcional)</Label>
                      <Textarea
                        id="notes"
                        placeholder="Ex: Queimou na chapa, passou da data..."
                        className="bg-[#151518] border-[#27272a] focus:ring-emerald-500 min-h-[80px]"
                        value={wasteNotes}
                        onChange={(e) => setWasteNotes(e.target.value)}
                      />
                    </div>

                    <Button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-600 text-black font-semibold py-5 text-sm rounded-xl">
                      <TrendingDown className="h-4.5 w-4.5 mr-2" /> Registrar Desperdício
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
          </div>

          {/* APP BOTTOM NAVIGATION BAR - APPLE STYLE */}
          <TabsList className="fixed bottom-0 left-0 right-0 h-16 bg-[#0c0c0e] border-t border-[#1f1f23] flex items-center justify-around px-2 z-40 rounded-none shadow-xl">
            <TabsTrigger
              value="fila"
              className="flex flex-col items-center justify-center gap-1 flex-1 py-1 rounded-lg text-zinc-500 hover:text-white data-[state=active]:text-emerald-400 data-[state=active]:bg-transparent"
            >
              <Factory className="h-5 w-5" />
              <span className="text-[10px] leading-none">Fila</span>
            </TabsTrigger>
            <TabsTrigger
              value="estoque"
              className="flex flex-col items-center justify-center gap-1 flex-1 py-1 rounded-lg text-zinc-500 hover:text-white data-[state=active]:text-emerald-400 data-[state=active]:bg-transparent"
            >
              <Boxes className="h-5 w-5" />
              <span className="text-[10px] leading-none">Estoque</span>
            </TabsTrigger>
            <TabsTrigger
              value="receitas"
              className="flex flex-col items-center justify-center gap-1 flex-1 py-1 rounded-lg text-zinc-500 hover:text-white data-[state=active]:text-emerald-400 data-[state=active]:bg-transparent"
            >
              <FileText className="h-5 w-5" />
              <span className="text-[10px] leading-none">Receitas</span>
            </TabsTrigger>
            <TabsTrigger
              value="perdas"
              className="flex flex-col items-center justify-center gap-1 flex-1 py-1 rounded-lg text-zinc-500 hover:text-white data-[state=active]:text-emerald-400 data-[state=active]:bg-transparent"
            >
              <TrendingDown className="h-5 w-5" />
              <span className="text-[10px] leading-none">Lixo/Perdas</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </main>

      {/* DETAIL MODAL: PRODUCTION */}
      <Dialog open={!!selectedProduction} onOpenChange={(open) => !open && setSelectedProduction(null)}>
        <DialogContent className="border-[#27272a] bg-[#09090b] text-[#f4f4f5]">
          <DialogHeader>
            <DialogTitle className="text-white text-base font-bold flex items-center gap-2">
              <Factory className="h-5 w-5 text-emerald-400" />
              {selectedProduction?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs text-zinc-400">Receita Técnica</Label>
              <p className="text-sm font-semibold text-white">{selectedProduction?.technical_sheet?.name || 'Não informada'}</p>
            </div>
            <div>
              <Label className="text-xs text-zinc-400">Modo de Preparo</Label>
              <p className="text-sm text-zinc-300 mt-1 whitespace-pre-line leading-relaxed bg-[#0c0c0e] p-3 rounded-lg border border-zinc-800/50">
                {selectedProduction?.technical_sheet?.preparation_method || 'Nenhuma instrução descrita.'}
              </p>
            </div>
            <div>
              <Label className="text-xs text-zinc-400">Ingredientes Necessários</Label>
              <div className="space-y-1 mt-1">
                {selectedProduction?.technical_sheet?.ingredients?.map((ing: any, i: number) => {
                  const kitchenQty = getProductionStockQuantity(ing.stock_item_id);
                  return (
                    <div key={i} className="flex justify-between items-center text-xs py-1.5 border-b border-zinc-800/40">
                      <span className="text-zinc-300">{ing.stock_item?.name}</span>
                      <span className="font-mono text-white">
                        {ing.quantity} {ing.unit} <span className="text-zinc-500 font-sans">(Cozinha: {kitchenQty})</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setSelectedProduction(null)} className="w-full bg-zinc-800 hover:bg-zinc-700 text-white border-none py-5">
              Fechar Detalhes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DETAIL MODAL: RECIPE */}
      <Dialog open={!!selectedRecipe} onOpenChange={(open) => !open && setSelectedRecipe(null)}>
        <DialogContent className="border-[#27272a] bg-[#09090b] text-[#f4f4f5]">
          <DialogHeader>
            <DialogTitle className="text-white text-base font-bold flex items-center gap-2">
              <Utensils className="h-5 w-5 text-emerald-400" />
              {selectedRecipe?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex gap-4">
              <div className="flex-1">
                <Label className="text-xs text-zinc-400">Rendimento</Label>
                <p className="text-sm font-semibold text-white">{selectedRecipe?.yield_quantity} {selectedRecipe?.yield_unit}</p>
              </div>
              <div className="flex-1">
                <Label className="text-xs text-zinc-400">Categoria</Label>
                <p className="text-sm font-semibold text-white">{selectedRecipe?.production_type === 'insumo' ? 'Insumo Produzido' : 'Produto Final'}</p>
              </div>
            </div>
            <div>
              <Label className="text-xs text-zinc-400">Modo de Preparo</Label>
              <ScrollArea className="h-[140px] mt-1 p-3 rounded-lg border border-zinc-800/50 bg-[#0c0c0e]">
                <p className="text-xs text-zinc-300 whitespace-pre-line leading-relaxed">
                  {selectedRecipe?.preparation_method || 'Nenhuma instrução descrita.'}
                </p>
              </ScrollArea>
            </div>
            <div>
              <Label className="text-xs text-zinc-400">Ingredientes da Receita</Label>
              <div className="space-y-1 mt-1 max-h-[140px] overflow-y-auto">
                {selectedRecipe?.ingredients?.map((ing: any, i: number) => (
                  <div key={i} className="flex justify-between items-center text-xs py-1.5 border-b border-zinc-800/40">
                    <span className="text-zinc-300">{ing.stock_item?.name}</span>
                    <span className="font-mono text-white">{ing.quantity} {ing.unit}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setSelectedRecipe(null)} className="w-full bg-zinc-800 hover:bg-zinc-700 text-white border-none py-5">
              Fechar Ficha
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG: COMPLETE PRODUCTION RUN */}
      <Dialog open={!!completeProductionId} onOpenChange={(open) => !open && setCompleteProductionId(null)}>
        <DialogContent className="border-[#27272a] bg-[#09090b] text-[#f4f4f5]">
          <DialogHeader>
            <DialogTitle className="text-white text-base font-bold">Concluir Lote de Produção</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Informe a quantidade real produzida para alimentar o estoque finalizado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="actual_qty" className="text-xs text-zinc-400">Quantidade Produzida</Label>
              <Input
                id="actual_qty"
                type="number"
                step="0.01"
                className="bg-[#151518] border-[#27272a] focus:ring-emerald-500 py-5 text-white"
                value={actualQuantity}
                onChange={(e) => setActualQuantity(parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setCompleteProductionId(null)} className="text-zinc-400 hover:text-white">
              Cancelar
            </Button>
            <Button onClick={handleCompleteProduction} className="bg-emerald-500 hover:bg-emerald-600 text-black font-semibold">
              Finalizar Lote
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
