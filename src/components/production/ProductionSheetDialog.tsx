
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useTechnicalSheet } from '@/hooks/ops/useTechnicalSheet';
import { useTechnicalSheetStages } from '@/hooks/ops/useTechnicalSheetStages';
import { StageDisplay } from '@/components/fichas/StageDisplay';
import { ForecastProductionOrder } from '@/hooks/financial/useForecastProductionOrders';
import { Skeleton } from '@/components/ui/skeleton';
import { parseSafeDate } from '@/hooks/stock/useExpiryDates';
import { Calculator, Clock, Users, AlertTriangle } from 'lucide-react';

interface ProductionSheetDialogProps {
    order: ForecastProductionOrder | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function ProductionSheetDialog({ order, open, onOpenChange }: ProductionSheetDialogProps) {
    const sheetId = order?.technical_sheet_id;

    const { data: sheet, isLoading: sheetLoading } = useTechnicalSheet(sheetId || null);
    const { stages, isLoading: stagesLoading } = useTechnicalSheetStages(sheetId);

    const isLoading = sheetLoading || stagesLoading;

    if (!order) return null;

    // Calculate scale factor
    // Scale = Production Quantity / Recipe Yield
    // Example: Order 200 cookies / Recipe yields 50 cookies = Scale 4x
    const scaleFactor = sheet && sheet.yield_quantity > 0
        ? order.net_quantity / sheet.yield_quantity
        : 1;

    // Scale ingredients
    const scaledIngredients = (sheet?.ingredients || []).map(ing => ({
        ...ing,
        quantity: ing.quantity * scaleFactor,
        total_cost: (ing.stock_item?.unit_price || 0) * ing.quantity * scaleFactor
    }));

    // Scale output (for display)
    const scaledYield = (sheet?.yield_quantity || 0) * scaleFactor;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <div className="flex items-start justify-between pr-8">
                        <div>
                            <DialogTitle className="text-xl">
                                {sheet?.name || 'Carregando...'}
                            </DialogTitle>
                            <DialogDescription>
                                Ordem de Produção: {parseSafeDate(order.production_date).toLocaleDateString()}
                            </DialogDescription>
                        </div>
                        <Badge variant={
                            order.status === 'completed' ? 'secondary' :
                                order.status === 'in_progress' ? 'default' : 'outline'
                        }>
                            {order.status === 'pending' ? 'Pendente' :
                                order.status === 'in_progress' ? 'Em Progresso' :
                                    order.status === 'completed' ? 'Concluído' : 'Cancelado'}
                        </Badge>
                    </div>
                </DialogHeader>

                {isLoading ? (
                    <div className="space-y-4 py-4">
                        <Skeleton className="h-20 w-full" />
                        <Skeleton className="h-60 w-full" />
                    </div>
                ) : sheet ? (
                    <ScrollArea className="flex-1 pr-4 -mr-4">
                        <div className="space-y-6 py-2">
                            {/* Warning if scaling is huge */}
                            {scaleFactor > 10 && (
                                <div className="bg-yellow-500/10 border border-yellow-200 text-yellow-700 p-3 rounded-lg flex items-center gap-2 text-sm">
                                    <AlertTriangle className="h-4 w-4" />
                                    Atenção: Esta receita está escalada em {scaleFactor.toFixed(1)}x o tamanho original.
                                </div>
                            )}

                            {/* Production Info Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-center">
                                    <div className="flex items-center justify-center gap-2 text-primary font-medium mb-1">
                                        <Calculator className="h-4 w-4" />
                                        Produção Total
                                    </div>
                                    <div className="text-2xl font-bold">
                                        {typeof order.net_quantity === 'number'
                                            ? order.net_quantity.toLocaleString('pt-BR')
                                            : order.net_quantity}
                                        <span className="text-sm font-normal text-muted-foreground ml-1">
                                            {sheet.yield_unit}
                                        </span>
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-1">
                                        Receita base: {sheet.yield_quantity} {sheet.yield_unit} (x{scaleFactor.toFixed(2)})
                                    </div>
                                </div>

                                <div className="bg-secondary/10 border border-secondary/20 rounded-lg p-3 text-center">
                                    <div className="flex items-center justify-center gap-2 text-secondary-foreground font-medium mb-1">
                                        <Clock className="h-4 w-4" />
                                        Tempo Estimado
                                    </div>
                                    <div className="text-2xl font-bold">
                                        {sheet.preparation_time ? (sheet.preparation_time).toFixed(0) : '--'}
                                        <span className="text-sm font-normal text-muted-foreground ml-1">min</span>
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-1">
                                        Por lote (não escala linearmente)
                                    </div>
                                </div>

                                <div className="bg-muted/30 border border-muted rounded-lg p-3 text-center">
                                    <div className="flex items-center justify-center gap-2 text-muted-foreground font-medium mb-1">
                                        <Users className="h-4 w-4" />
                                        Validade
                                    </div>
                                    <div className="text-xl font-bold">
                                        {sheet.shelf_life_hours || '--'}
                                        <span className="text-sm font-normal text-muted-foreground ml-1">horas</span>
                                    </div>
                                </div>
                            </div>

                            <Separator />

                            {/* Recipe Display (Ingredients & Stages) */}
                            <div>
                                <h3 className="text-lg font-semibold mb-4">Ingredientes & Preparo (Escalado)</h3>
                                <StageDisplay
                                    stages={stages}
                                    ingredients={scaledIngredients}
                                />
                            </div>

                            {/* Legacy Preparation Method */}
                            {sheet.preparation_method && stages.length === 0 && (
                                <div className="mt-6">
                                    <h3 className="text-lg font-semibold mb-2">Modo de Preparo</h3>
                                    <div className="whitespace-pre-wrap text-muted-foreground bg-muted/20 p-4 rounded-lg">
                                        {sheet.preparation_method}
                                    </div>
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                ) : (
                    <div className="py-8 text-center text-muted-foreground">
                        Ficha técnica não encontrada.
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
