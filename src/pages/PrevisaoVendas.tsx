import { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useOwnerId } from '@/hooks/useOwnerId';
import {
    CalendarClock,
    Plus,
    Trash2,
    Zap,
    ChefHat,
    Clock,
    CheckCircle2,
    Play,
    AlertTriangle,
    Calendar as CalendarIcon,
    ArrowRight,
    History,
    Printer,
    Sparkles,
    Upload
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn, getNow } from '@/lib/utils';
import { format, addDays, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';

import { useSalesForecasts } from '@/hooks/useSalesForecasts';
import { useForecastExplosion } from '@/hooks/useForecastExplosion';
import { parseSafeDate } from '@/hooks/useExpiryDates';
import {
    useForecastProductionOrders,
    PRACA_LABELS,
    FORECAST_STATUS_LABELS,
    ForecastProductionOrder,
} from '@/hooks/useForecastProductionOrders';
import { useSaleProducts } from '@/hooks/useSaleProducts';
import { ProductionSheetDialog } from '@/components/production/ProductionSheetDialog';
import { useSalesProductionHistory, ProductionHistoryItem } from '@/hooks/useSalesProductionHistory';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { AIImportDialog } from '@/components/AIImportDialog';
import { ExtractedIngredient } from '@/hooks/useIngredientImport';
import { useEvents, CalendarEvent } from '@/hooks/useEvents';

// ---- Forecast Input Tab ----

function ForecastInputTab() {
    const [targetDate, setTargetDate] = useState<Date>(addDays(getNow(), 1));
    const [showDialog, setShowDialog] = useState(false);
    const [showSuggestDialog, setShowSuggestDialog] = useState(false);
    const [showAIDialog, setShowAIDialog] = useState(false);
    const [baseDate, setBaseDate] = useState<Date>(subDays(getNow(), 1));
    const [periodType, setPeriodType] = useState<'day' | 'week' | 'month' | 'year'>('week');
    const [selectedProductId, setSelectedProductId] = useState('');
    const [quantity, setQuantity] = useState('');

    const dateStr = format(targetDate, 'yyyy-MM-dd');
    const { forecasts, isLoading, createForecast, deleteForecast, generateForecast } = useSalesForecasts(dateStr);
    const { saleProducts = [] } = useSaleProducts();
    const { explode } = useForecastExplosion();
    const { events } = useEvents();

    const activeEvents = events.filter(e => e.event_date === dateStr);

    const handleAddForecast = () => {
        if (!selectedProductId || !quantity) {
            toast.error('Selecione um produto e informe a quantidade.');
            return;
        }
        createForecast.mutate({
            sale_product_id: selectedProductId,
            target_date: dateStr,
            forecasted_quantity: parseInt(quantity, 10),
        });
        setShowDialog(false);
        setSelectedProductId('');
        setQuantity('');
    };

    const handleConfirmAIImport = async (ingredients: ExtractedIngredient[]) => {
        // Find matching sale products by name (rudimentary mapping based exclusively on AI ingredients returned)
        const newForecastsToCreate: any[] = [];
        let notFoundNames: string[] = [];

        for (const ing of ingredients) {
            const match = saleProducts.find((p: any) => p.name.toLowerCase() === ing.name.toLowerCase());
            if (match) {
                newForecastsToCreate.push({
                    sale_product_id: match.id,
                    target_date: dateStr,
                    forecasted_quantity: ing.quantity
                });
            } else {
                notFoundNames.push(ing.name);
            }
        }

        if (newForecastsToCreate.length > 0) {
            // we create each individually since our mutation expects an object
            const promises = newForecastsToCreate.map(f =>
                createForecast.mutateAsync(f)
            );
            await Promise.all(promises);
            toast.success(`Foram lidos e cadastrados ${newForecastsToCreate.length} produtos de venda!`);
        } else {
            toast.info('A IA leu os dados, mas não encontrou correspondência exata de nomes de "Produtos de Venda". Revise o que foi importado.');
        }

        if (notFoundNames.length > 0) {
            toast.warning(`Os produtos abaixo não tinham Produto de Venda atrelado ou os nomes não batiam com a tela Produtos para Venda: ${notFoundNames.join(', ')}`);
        }
    };

    const handleExplode = () => {
        if (forecasts.length === 0) {
            toast.error('Adicione pelo menos uma previsão antes de gerar ordens.');
            return;
        }
        explode.mutate(dateStr);
    };

    const handleGenerateSuggestion = () => {
        generateForecast.mutate({
            targetDate: dateStr,
            baseDate: format(baseDate, 'yyyy-MM-dd'),
            bufferPercent: 10,
            periodType,
        });
        setShowSuggestDialog(false);
    };

    const PERIOD_DESCRIPTIONS: Record<string, string> = {
        day: 'vendas e perdas do dia selecionado',
        week: 'consumo total dos últimos 7 dias até a data selecionada',
        month: 'consumo total dos últimos 30 dias até a data selecionada',
        year: 'consumo total do último ano até a data selecionada',
    };

    return (
        <div className="space-y-4">
            {/* Date selector */}
            <div className="flex items-center gap-3 flex-wrap">
                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="outline" className="gap-2">
                            <CalendarIcon className="h-4 w-4" />
                            {format(targetDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                            mode="single"
                            selected={targetDate}
                            onSelect={(d) => d && setTargetDate(d)}
                            locale={ptBR}
                        />
                    </PopoverContent>
                </Popover>

                <Button size="sm" variant="outline" onClick={() => setTargetDate(addDays(getNow(), 1))}>
                    Amanhã
                </Button>
                <Button size="sm" variant="outline" onClick={() => setTargetDate(addDays(getNow(), 2))}>
                    Depois de amanhã
                </Button>

                {activeEvents.length > 0 && (
                    <div className="flex gap-2">
                        {activeEvents.map(ev => (
                            <Badge key={ev.id} className="bg-amber-100 text-amber-800 border-amber-200 gap-1 py-1">
                                <AlertTriangle className="h-3.3 w-3.5" />
                                {ev.title} ({ev.multiplier}x)
                            </Badge>
                        ))}
                    </div>
                )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 flex-wrap">
                <Button onClick={() => setShowDialog(true)} className="gap-2">
                    <Plus className="h-4 w-4" /> Adicionar Manualmente
                </Button>
                <Button onClick={() => setShowSuggestDialog(true)} variant="secondary" className="gap-2">
                    <History className="h-4 w-4" /> Sugerir do Histórico
                </Button>
                <Button onClick={() => setShowAIDialog(true)} variant="secondary" className="gap-2 bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400">
                    <Sparkles className="h-4 w-4" /> Importar Relatório (IA)
                </Button>
                <Button
                    onClick={handleExplode}
                    variant="default"
                    className="gap-2 bg-orange-600 hover:bg-orange-700"
                    disabled={explode.isPending || forecasts.length === 0}
                >
                    <Zap className="h-4 w-4" />
                    {explode.isPending ? 'Gerando...' : 'Gerar Ordens de Produção'}
                </Button>
            </div>

            {/* Forecast List */}
            {isLoading ? (
                <div className="space-y-2">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                </div>
            ) : forecasts.length === 0 ? (
                <EmptyState
                    icon={CalendarClock}
                    title="Nenhuma previsão para esta data"
                    description="Adicione previsões de venda para gerar as ordens de produção automaticamente."
                />
            ) : (
                <div className="grid gap-2">
                    {forecasts.map((f) => (
                        <Card key={f.id} className="hover:shadow-md transition-shadow">
                            <CardContent className="p-3 flex items-center justify-between">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                                        <ChefHat className="h-5 w-5 text-primary" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-medium truncate">
                                            {(f.sale_product as any)?.name || 'Produto'}
                                        </p>
                                        <p className="text-sm text-muted-foreground">
                                            Previsão: <strong>{f.forecasted_quantity}</strong> unid.
                                        </p>
                                    </div>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-destructive hover:text-destructive"
                                    onClick={() => deleteForecast.mutate(f.id)}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Add Forecast Dialog */}
            <Dialog open={showDialog} onOpenChange={setShowDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Adicionar Previsão de Venda</DialogTitle>
                        <DialogDescription>
                            Para {format(targetDate, "EEEE, dd/MM/yyyy", { locale: ptBR })}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Produto de Venda</Label>
                            <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione o produto" />
                                </SelectTrigger>
                                <SelectContent>
                                    {saleProducts.map((p: any) => (
                                        <SelectItem key={p.id} value={p.id}>
                                            {p.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Quantidade prevista</Label>
                            <Input
                                type="number"
                                min="1"
                                value={quantity}
                                onChange={(e) => setQuantity(e.target.value)}
                                placeholder="Ex: 50"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowDialog(false)}>
                            Cancelar
                        </Button>
                        <Button onClick={handleAddForecast} disabled={createForecast.isPending}>
                            {createForecast.isPending ? 'Salvando...' : 'Salvar'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Suggestion Dialog */}
            <Dialog open={showSuggestDialog} onOpenChange={setShowSuggestDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Gerar Sugestão Baseada em Histórico</DialogTitle>
                        <DialogDescription>
                            O sistema analisará o {PERIOD_DESCRIPTIONS[periodType]} e sugerirá a quantidade total necessária para cobrir o mesmo período, com margem de 10%.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Período de análise:</Label>
                            <Select value={periodType} onValueChange={(v) => setPeriodType(v as any)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="day">Dia</SelectItem>
                                    <SelectItem value="week">Semana (7 dias)</SelectItem>
                                    <SelectItem value="month">Mês (30 dias)</SelectItem>
                                    <SelectItem value="year">Ano (365 dias)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Data de referência:</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {baseDate ? format(baseDate, "EEEE, dd 'de' MMMM", { locale: ptBR }) : <span>Selecione uma data</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={baseDate}
                                        onSelect={(d) => d && setBaseDate(d)}
                                        locale={ptBR}
                                    />
                                </PopoverContent>
                            </Popover>
                            <p className="text-xs text-muted-foreground">
                                {periodType === 'day'
                                    ? 'As vendas e perdas deste dia serão usadas como base.'
                                    : `O sistema calculará o consumo total do período até esta data.`
                                }
                            </p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowSuggestDialog(false)}>
                            Cancelar
                        </Button>
                        <Button onClick={handleGenerateSuggestion} disabled={generateForecast.isPending}>
                            {generateForecast.isPending ? 'Gerando...' : 'Gerar Sugestão'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AIImportDialog
                open={showAIDialog}
                onOpenChange={setShowAIDialog}
                onConfirmImport={handleConfirmAIImport}
                title="Importar Relatório de Vendas (IA)"
                description="Envie um PDF ou imagem de um relatório de vendas (Loyverse, iFood, etc). A IA extrairá as quantidades vendidas para adicionar na previsão de produção."
                extractRecipe={false}
            />
        </div>
    );
}

// ---- Production Orders Tab (Kitchen Screen) ----

function ProductionOrdersTab() {
    const [selectedDate, setSelectedDate] = useState<Date>(getNow());
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const [selectedOrder, setSelectedOrder] = useState<any>(null);
    const [sheetDialogOpen, setSheetDialogOpen] = useState(false);

    const { orders, ordersByPraca, summary, isLoading, updateOrderStatus } =
        useForecastProductionOrders(dateStr);

    const statusColor = (status: string) => {
        switch (status) {
            case 'pending': return 'bg-red-500/10 text-red-600 border-red-200';
            case 'in_progress': return 'bg-yellow-500/10 text-yellow-600 border-yellow-200';
            case 'completed': return 'bg-green-500/10 text-green-600 border-green-200';
            case 'cancelled': return 'bg-gray-500/10 text-gray-500 border-gray-200';
            default: return '';
        }
    };

    const statusIcon = (status: string) => {
        switch (status) {
            case 'pending': return <Clock className="h-4 w-4" />;
            case 'in_progress': return <Play className="h-4 w-4" />;
            case 'completed': return <CheckCircle2 className="h-4 w-4" />;
            default: return null;
        }
    };

    const nextStatus = (current: string): 'pending' | 'in_progress' | 'completed' | 'cancelled' => {
        switch (current) {
            case 'pending': return 'in_progress';
            case 'in_progress': return 'completed';
            default: return current as any;
        }
    };

    return (
        <div className="space-y-4">
            {/* Date navigation */}
            <div className="flex items-center gap-3 flex-wrap">
                <Button
                    size="sm"
                    variant={dateStr === format(getNow(), 'yyyy-MM-dd') ? 'default' : 'outline'}
                    onClick={() => setSelectedDate(getNow())}
                >
                    Hoje
                </Button>
                <Button
                    size="sm"
                    variant={dateStr === format(addDays(getNow(), 1), 'yyyy-MM-dd') ? 'default' : 'outline'}
                    onClick={() => setSelectedDate(addDays(getNow(), 1))}
                >
                    Amanhã
                </Button>
                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-2">
                            <CalendarIcon className="h-4 w-4" />
                            {format(selectedDate, "dd/MM/yyyy", { locale: ptBR })}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                            mode="single"
                            selected={selectedDate}
                            onSelect={(d) => d && setSelectedDate(d)}
                            locale={ptBR}
                        />
                    </PopoverContent>
                </Popover>

                {orders.length > 0 && (
                    <Button
                        size="sm"
                        variant="secondary"
                        className="gap-2 ml-auto"
                        onClick={() => window.print()}
                    >
                        <Printer className="h-4 w-4" /> Imprimir Lista
                    </Button>
                )}
            </div>

            {/* Summary badges */}
            {orders.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                    <Badge variant="outline">Total: {summary.total}</Badge>
                    <Badge className="bg-red-500/10 text-red-600 border-red-200">
                        Pendente: {summary.pending}
                    </Badge>
                    <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-200">
                        Em andamento: {summary.inProgress}
                    </Badge>
                    <Badge className="bg-green-500/10 text-green-600 border-green-200">
                        Concluído: {summary.completed}
                    </Badge>
                </div>
            )}

            {/* Orders grouped by praça */}
            {isLoading ? (
                <div className="space-y-3">
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                </div>
            ) : orders.length === 0 ? (
                <EmptyState
                    icon={ChefHat}
                    title="Nenhuma ordem de produção"
                    description={`Não há ordens para ${format(selectedDate, "dd/MM/yyyy")}. Use a aba "Previsão" para criar previsões e gerar ordens.`}
                />
            ) : (
                <div className="space-y-4">
                    {(Object.entries(ordersByPraca) as [string, ForecastProductionOrder[]][]).map(([praca, pracaOrders]) => (
                        <Card key={praca}>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <ChefHat className="h-4 w-4 text-primary" />
                                    {PRACA_LABELS[praca] || praca}
                                    <Badge variant="secondary" className="ml-auto">
                                        {pracaOrders.length} {pracaOrders.length === 1 ? 'item' : 'itens'}
                                    </Badge>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                {pracaOrders.map((order) => (
                                    <div
                                        key={order.id}
                                        className={cn(
                                            'flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer hover:shadow-md',
                                            statusColor(order.status)
                                        )}
                                        onClick={() => {
                                            setSelectedOrder(order);
                                            setSheetDialogOpen(true);
                                        }}
                                    >
                                        <div className="flex items-center gap-3 min-w-0 flex-1">
                                            <div className="flex-shrink-0">
                                                {statusIcon(order.status)}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-medium text-sm truncate">
                                                    {order.technical_sheet?.name || 'Sub-receita'}
                                                </p>
                                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                    <span>
                                                        Produzir: <strong>{typeof order.net_quantity === 'number' ? order.net_quantity.toLocaleString('pt-BR') : order.net_quantity}</strong>{' '}
                                                        {order.technical_sheet?.yield_unit || 'un'}
                                                    </span>
                                                    {order.existing_stock > 0 && (
                                                        <span className="text-green-600">
                                                            (estoque: {typeof order.existing_stock === 'number' ? order.existing_stock.toLocaleString('pt-BR') : order.existing_stock})
                                                        </span>
                                                    )}
                                                    <ArrowRight className="h-3 w-3" />
                                                    <span>
                                                        Consumo:{' '}
                                                        {format(parseSafeDate(order.target_consumption_date), 'dd/MM')}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Status action button */}
                                        {order.status !== 'completed' && order.status !== 'cancelled' && (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="ml-2 flex-shrink-0 gap-1"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    updateOrderStatus.mutate({
                                                        id: order.id,
                                                        status: nextStatus(order.status),
                                                    });
                                                }}
                                            >
                                                {order.status === 'pending' ? (
                                                    <>
                                                        <Play className="h-3 w-3" /> Iniciar
                                                    </>
                                                ) : (
                                                    <>
                                                        <CheckCircle2 className="h-3 w-3" /> Concluir
                                                    </>
                                                )}
                                            </Button>
                                        )}
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            <ProductionSheetDialog
                open={sheetDialogOpen}
                onOpenChange={setSheetDialogOpen}
                order={selectedOrder}
            />
        </div>
    );
}

// ---- History Analysis Tab ----

function HistoryAnalysisTab() {
    const [baseDate, setBaseDate] = useState<Date>(getNow());
    const [days, setDays] = useState('7');
    const [targetDate, setTargetDate] = useState<Date>(addDays(getNow(), 1));

    const { data: history = [], isLoading } = useSalesProductionHistory(baseDate, parseInt(days, 10));
    const queryClient = useQueryClient();
    const { ownerId } = useOwnerId();

    const handleCreateSchedule = async () => {
        if (!ownerId) return;
        if (history.length === 0) {
            toast.error('Não há dados históricos para gerar cronograma.');
            return;
        }

        const dateStr = format(targetDate, 'yyyy-MM-dd');

        try {
            // Delete existing pending orders for date
            await supabase
                .from('forecast_production_orders')
                .delete()
                .eq('user_id', ownerId)
                .eq('target_consumption_date', dateStr)
                .eq('status', 'pending');

            const ordersToInsert = history
                .filter(item => item.toProduce > 0)
                .map(item => ({
                    user_id: ownerId,
                    technical_sheet_id: item.technicalSheetId,
                    production_date: format(getNow(), 'yyyy-MM-dd'),
                    target_consumption_date: dateStr,
                    required_quantity: item.totalSales, // Or whatever logic the user wants
                    existing_stock: item.currentStock,
                    net_quantity: item.toProduce,
                    praca: 'praca_quente' as any, // Default
                    status: 'pending' as const,
                }));

            if (ordersToInsert.length === 0) {
                toast.info('Não há itens com necessidade de produção.');
                return;
            }

            const { error } = await supabase
                .from('forecast_production_orders')
                .insert(ordersToInsert);

            if (error) throw error;

            queryClient.invalidateQueries({ queryKey: ['forecast_production_orders'] });
            toast.success(`Cronograma gerado com ${ordersToInsert.length} ordens!`);
        } catch (err: any) {
            toast.error(`Erro ao gerar cronograma: ${err.message}`);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3 flex-wrap bg-primary/5 p-4 rounded-lg border">
                <div className="space-y-1">
                    <Label className="text-xs uppercase text-muted-foreground">Base de análise</Label>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="w-[180px] justify-start text-left font-normal">
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {format(baseDate, "dd/MM/yyyy")}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                                mode="single"
                                selected={baseDate}
                                onSelect={(d) => d && setBaseDate(d)}
                                locale={ptBR}
                            />
                        </PopoverContent>
                    </Popover>
                </div>

                <div className="space-y-1">
                    <Label className="text-xs uppercase text-muted-foreground">Período (dias)</Label>
                    <Select value={days} onValueChange={setDays}>
                        <SelectTrigger className="w-[120px] h-9">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="7">7 dias</SelectItem>
                            <SelectItem value="15">15 dias</SelectItem>
                            <SelectItem value="30">30 dias</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-1">
                    <Label className="text-xs uppercase text-muted-foreground">Data para Produção</Label>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="w-[180px] justify-start text-left font-normal border-primary/30">
                                <ChefHat className="mr-2 h-4 w-4 text-primary" />
                                {format(targetDate, "dd/MM/yyyy")}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                                mode="single"
                                selected={targetDate}
                                onSelect={(d) => d && setTargetDate(d)}
                                locale={ptBR}
                            />
                        </PopoverContent>
                    </Popover>
                </div>

                <Button
                    className="ml-auto gap-2 bg-primary hover:bg-primary/90"
                    onClick={handleCreateSchedule}
                    disabled={isLoading || history.length === 0}
                >
                    <Zap className="h-4 w-4" /> Gerar Cronograma
                </Button>
            </div>

            <Card>
                <CardHeader className="py-4">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <History className="h-5 w-5 text-primary" />
                        Análise de Necessidade de Produção
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Ficha Técnica</TableHead>
                                    <TableHead className="text-center">Vendas Realizadas</TableHead>
                                    <TableHead className="text-center">Produção Utilizada</TableHead>
                                    <TableHead className="text-center">Estoque Atual</TableHead>
                                    <TableHead className="text-center bg-primary/5 text-primary font-bold">Produção a Realizar</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-32 text-center">
                                            <Skeleton className="h-4 w-[200px] mx-auto mb-2" />
                                            <Skeleton className="h-4 w-[150px] mx-auto" />
                                        </TableCell>
                                    </TableRow>
                                ) : history.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                                            Nenhum dado encontrado para o período selecionado.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    history.map((item) => (
                                        <TableRow key={item.technicalSheetId}>
                                            <TableCell className="font-medium">{item.name}</TableCell>
                                            <TableCell className="text-center">{item.totalSales.toLocaleString()} {item.unit}</TableCell>
                                            <TableCell className="text-center">{item.productionUsed.toLocaleString()} {item.unit}</TableCell>
                                            <TableCell className="text-center">{item.currentStock.toLocaleString()} {item.unit}</TableCell>
                                            <TableCell className="text-center font-bold text-primary bg-primary/5">
                                                {item.toProduce > 0 ? (
                                                    <Badge className="bg-orange-500 hover:bg-orange-600">
                                                        {item.toProduce.toLocaleString()} {item.unit}
                                                    </Badge>
                                                ) : (
                                                    <span className="text-green-600 flex items-center justify-center gap-1">
                                                        <CheckCircle2 className="h-4 w-4" /> Estoque OK
                                                    </span>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

// ---- Events Tab ----

function EventsTab() {
    const { events, isLoading, createEvent, deleteEvent } = useEvents();
    const [showAddDialog, setShowAddDialog] = useState(false);
    const [title, setTitle] = useState('');
    const [date, setDate] = useState<Date>(getNow());
    const [multiplier, setMultiplier] = useState('1.5');

    const handleAdd = () => {
        if (!title || !multiplier) return;
        createEvent.mutate({
            title,
            event_date: format(date, 'yyyy-MM-dd'),
            multiplier: parseFloat(multiplier),
            description: '',
        });
        setShowAddDialog(false);
        setTitle('');
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Eventos e Datas Especiais</h3>
                <Button onClick={() => setShowAddDialog(true)} className="gap-2">
                    <Plus className="h-4 w-4" /> Novo Evento
                </Button>
            </div>

            {isLoading ? (
                <Skeleton className="h-24 w-full" />
            ) : events.length === 0 ? (
                <Card className="bg-muted/30">
                    <CardContent className="p-8 text-center">
                        <CalendarIcon className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-20" />
                        <p className="text-muted-foreground">Nenhum evento agendado.</p>
                        <p className="text-sm text-muted-foreground/60">Agende feriados ou eventos para ajustar a demanda automaticamente.</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {events.map((event) => (
                        <Card key={event.id}>
                            <CardContent className="p-4 flex justify-between items-start">
                                <div>
                                    <p className="font-bold text-lg">{event.title}</p>
                                    <p className="text-sm text-muted-foreground">
                                        Data: {format(parseSafeDate(event.event_date), 'dd/MM/yyyy')}
                                    </p>
                                    <Badge variant="secondary" className="mt-2 text-xs">
                                        Fator: {event.multiplier}x
                                    </Badge>
                                </div>
                                <Button variant="ghost" size="icon" onClick={() => deleteEvent.mutate(event.id)}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Agendar Evento</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Nome do Evento (ex: Carnaval, Feriado)</Label>
                            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Natal" />
                        </div>
                        <div className="space-y-2">
                            <Label>Data</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {format(date, "dd/MM/yyyy")}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar mode="single" selected={date} onSelect={d => d && setDate(d)} locale={ptBR} />
                                </PopoverContent>
                            </Popover>
                        </div>
                        <div className="space-y-2">
                            <Label>Fator de ajuste (multiplicador de vendas)</Label>
                            <Input type="number" step="0.1" value={multiplier} onChange={e => setMultiplier(e.target.value)} />
                            <p className="text-xs text-muted-foreground">1.5 aumentará a previsão em 50%. 0.8 diminuirá em 20%.</p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancelar</Button>
                        <Button onClick={handleAdd}>Salvar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

// ---- Main Page ----

export default function PrevisaoVendas() {
    return (
        <div className="space-y-4">
            <PageHeader
                title="Previsão de Vendas & Produção"
                description="Defina previsões de vendas e gere automaticamente as ordens de produção por praça."
            />
            <Tabs defaultValue="previsao" className="w-full">
                <TabsList className="grid w-full grid-cols-4 max-w-2xl">
                    <TabsTrigger value="previsao" className="gap-2">
                        <CalendarClock className="h-4 w-4" /> Previsão
                    </TabsTrigger>
                    <TabsTrigger value="eventos" className="gap-2">
                        <CalendarIcon className="h-4 w-4" /> Eventos
                    </TabsTrigger>
                    <TabsTrigger value="historico" className="gap-2">
                        <History className="h-4 w-4" /> Histórico
                    </TabsTrigger>
                    <TabsTrigger value="ordens" className="gap-2">
                        <ChefHat className="h-4 w-4" /> Ordens de Produção
                    </TabsTrigger>
                </TabsList>
                <TabsContent value="previsao">
                    <ForecastInputTab />
                </TabsContent>
                <TabsContent value="eventos">
                    <EventsTab />
                </TabsContent>
                <TabsContent value="historico">
                    <HistoryAnalysisTab />
                </TabsContent>
                <TabsContent value="ordens">
                    <ProductionOrdersTab />
                </TabsContent>
            </Tabs>
        </div>
    );
}
