import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { format, differenceInMinutes } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Clock, CheckCircle2, AlertTriangle, TrendingUp } from "lucide-react";
import { ProductionWithSheet } from "@/hooks/ops/useProductions";
import { useTechnicalSheetStages } from "@/hooks/ops/useTechnicalSheetStages";
import { useProductionStageExecution } from "@/hooks/ops/useProductionStageExecution";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

interface ProductionReportDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    production: ProductionWithSheet | null;
}

export function ProductionReportDialog({
    open,
    onOpenChange,
    production,
}: ProductionReportDialogProps) {
    const { stages } = useTechnicalSheetStages(production?.technical_sheet?.id);
    const { stageExecutions } = useProductionStageExecution(production?.id);

    if (!production) return null;

    const getStageStats = (stageId: string) => {
        const execution = stageExecutions.find((e) => e.stage_id === stageId);
        const stage = stages.find((s) => s.id === stageId);

        if (!execution || !execution.started_at || !execution.finished_at) {
            return {
                actualDuration: null,
                plannedDuration: stage?.duration_minutes || 0,
                difference: null,
                status: 'pending'
            };
        }

        const actualDuration = differenceInMinutes(
            new Date(execution.finished_at),
            new Date(execution.started_at)
        );
        const plannedDuration = stage?.duration_minutes || 0;
        const difference = actualDuration - plannedDuration;

        return {
            actualDuration,
            plannedDuration,
            difference,
            status: 'completed'
        };
    };

    const totalPlanned = stages.reduce((acc, s) => acc + (s.duration_minutes || 0), 0);
    const totalActual = stages.reduce((acc, s) => {
        const stats = getStageStats(s.id);
        return acc + (stats.actualDuration || 0);
    }, 0);

    const efficiency = totalPlanned > 0 ? (totalPlanned / totalActual) * 100 : 0;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Relatório de Produção</DialogTitle>
                    <DialogDescription>
                        Desempenho da produção: {production.name}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 rounded-lg bg-primary/5 border border-primary/10">
                            <span className="text-xs text-muted-foreground block mb-1">Tempo Total Real</span>
                            <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-primary" />
                                <span className="text-2xl font-bold">{totalActual} min</span>
                            </div>
                            <span className="text-xs text-muted-foreground block mt-1">Planejado: {totalPlanned} min</span>
                        </div>
                        <div className="p-4 rounded-lg bg-success/5 border border-success/10">
                            <span className="text-xs text-muted-foreground block mb-1">Eficiência</span>
                            <div className="flex items-center gap-2">
                                <TrendingUp className="h-4 w-4 text-success" />
                                <span className="text-2xl font-bold">{totalActual > 0 ? Math.round(efficiency) : 0}%</span>
                            </div>
                            <span className="text-xs text-muted-foreground block mt-1">Tempo real vs planejado</span>
                        </div>
                    </div>

                    {/* Efficiency Bar */}
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Progresso de Tempo</span>
                            <span className="font-medium">{totalActual > 0 && totalPlanned > 0 ? (totalActual > totalPlanned ? 'Acima do prazo' : 'Dentro do prazo') : '-'}</span>
                        </div>
                        <Progress
                            value={totalActual > 0 ? Math.min(efficiency, 100) : 0}
                            className={totalActual > totalPlanned ? "bg-destructive/20" : "bg-success/20"}
                        />
                    </div>

                    {/* Stage Breakdown */}
                    <div className="space-y-3">
                        <h4 className="font-semibold text-sm flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4" /> Detalhamento por Etapa
                        </h4>
                        <div className="space-y-2">
                            {stages.map((stage) => {
                                const stats = getStageStats(stage.id);
                                const isDelayed = stats.difference && stats.difference > 0;

                                return (
                                    <div key={stage.id} className="p-3 rounded-lg border bg-card/50 flex flex-col gap-2">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <span className="font-medium text-sm">{stage.name}</span>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-xs text-muted-foreground">Planejado: {stage.duration_minutes || 0}m</span>
                                                    {stats.actualDuration !== null && (
                                                        <span className="text-xs font-medium">Real: {stats.actualDuration}m</span>
                                                    )}
                                                </div>
                                            </div>
                                            {stats.status === 'completed' ? (
                                                <Badge variant={isDelayed ? "destructive" : "default"} className="text-[10px]">
                                                    {isDelayed ? `+${stats.difference}m` : `${stats.difference}m`}
                                                </Badge>
                                            ) : (
                                                <Badge variant="secondary" className="text-[10px]">Pendente</Badge>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {production.actual_quantity !== null && (
                        <div className="p-4 rounded-lg bg-muted/50 border">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-sm font-medium">Rendimento Real</span>
                                <span className="text-sm font-bold">{production.actual_quantity} / {production.planned_quantity} {production.technical_sheet?.yield_unit}</span>
                            </div>
                            <Progress
                                value={(production.actual_quantity / production.planned_quantity) * 100}
                                className="h-2"
                            />
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
