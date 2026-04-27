import { useState, useEffect } from 'react';
import { Check, Clock, ChevronRight, ChevronDown, Loader2, PauseCircle, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useTechnicalSheetStages, StageWithSteps } from '@/hooks/ops/useTechnicalSheetStages';
import { useProductionStepExecution } from '@/hooks/ops/useProductionStepExecution';
import { useProductions, ProductionWithSheet } from '@/hooks/ops/useProductions';

interface ProductionExecutionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  production: ProductionWithSheet | null;
  onComplete: () => void;
}

export function ProductionExecutionDialog({
  open,
  onOpenChange,
  production,
  onComplete,
}: ProductionExecutionDialogProps) {
  const [expandedStages, setExpandedStages] = useState<Set<string>>(new Set());

  const { stages, isLoading: stagesLoading } = useTechnicalSheetStages(
    production?.technical_sheet?.id
  );

  const { updateProduction } = useProductions();
  const {
    stepExecutions,
    isLoading: executionsLoading,
    initializeStepExecutions,
    toggleStepCompletion,
    isStepCompleted,
    getCompletionPercentage,
  } = useProductionStepExecution(production?.id);

  // Initialize step executions when dialog opens
  useEffect(() => {
    if (open && production && stages.length > 0) {
      const allStepIds = stages.flatMap(stage => stage.steps.map(step => step.id));
      if (allStepIds.length > 0) {
        initializeStepExecutions.mutate({
          productionId: production.id,
          stepIds: allStepIds
        });
      }

      // Expand first stage by default
      if (stages.length > 0) {
        setExpandedStages(new Set([stages[0].id]));
      }
    }
  }, [open, production?.id, stages.length]);

  if (!production || !production.technical_sheet) return null;

  const totalSteps = stages.reduce((sum, stage) => sum + stage.steps.length, 0);
  const completionPercentage = getCompletionPercentage(totalSteps);
  const allCompleted = completionPercentage === 100;

  const toggleStage = (stageId: string) => {
    const newExpanded = new Set(expandedStages);
    if (newExpanded.has(stageId)) {
      newExpanded.delete(stageId);
    } else {
      newExpanded.add(stageId);
    }
    setExpandedStages(newExpanded);
  };

  const handleStepToggle = async (stepId: string) => {
    if (production.status !== 'in_progress') return;
    const currentlyCompleted = isStepCompleted(stepId);
    await toggleStepCompletion.mutateAsync({
      stepId,
      completed: !currentlyCompleted
    });
  };

  const getStageCompletionCount = (stage: StageWithSteps): [number, number] => {
    const completed = stage.steps.filter(step => isStepCompleted(step.id)).length;
    return [completed, stage.steps.length];
  };

  const multiplier = production.planned_quantity / production.technical_sheet.yield_quantity;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <div className="space-y-2">
            <DialogTitle className="text-xl">{production.name}</DialogTitle>
            <DialogDescription className="sr-only">Detalhes do diálogo</DialogDescription>
<div className="flex items-center justify-between">
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">
                  {production.planned_quantity} {production.technical_sheet.yield_unit}
                </span>
                {multiplier !== 1 && (
                  <Badge variant="outline">Multiplicador: {multiplier.toFixed(2)}x</Badge>
                )}
              </div>
              {production.status === 'paused' && (
                <Badge variant="warning" className="animate-pulse">PAUSADA</Badge>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Progresso</span>
            <span className="font-medium">{completionPercentage}%</span>
          </div>
          <Progress value={completionPercentage} className="h-2" />
        </div>

        <ScrollArea className="max-h-[50vh] pr-4">
          {(stagesLoading || executionsLoading) ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : stages.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>Esta ficha técnica não possui etapas definidas.</p>
              <p className="text-sm mt-1">Adicione etapas na página de Fichas Técnicas.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {stages.map((stage, stageIndex) => {
                const [completed, total] = getStageCompletionCount(stage);
                const isStageComplete = completed === total && total > 0;
                const isExpanded = expandedStages.has(stage.id);

                return (
                  <Collapsible
                    key={stage.id}
                    open={isExpanded}
                    onOpenChange={() => toggleStage(stage.id)}
                  >
                    <CollapsibleTrigger asChild>
                      <div
                        className={`
                          flex items-center gap-3 p-3 rounded-lg border cursor-pointer
                          transition-colors hover:bg-muted/50
                          ${isStageComplete ? 'border-green-500/30 bg-green-500/5' : ''}
                        `}
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                        )}

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              Etapa {stageIndex + 1}: {stage.name}
                            </span>
                            {isStageComplete && (
                              <Check className="h-4 w-4 text-green-500" />
                            )}
                          </div>
                          {stage.description && (
                            <p className="text-xs text-muted-foreground truncate">
                              {stage.description}
                            </p>
                          )}
                        </div>

                        <Badge variant={isStageComplete ? 'default' : 'secondary'} className="shrink-0">
                          {completed}/{total}
                        </Badge>

                        {stage.duration_minutes && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
                            <Clock className="h-3 w-3" />
                            {stage.duration_minutes}min
                          </span>
                        )}
                      </div>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <div className="ml-7 mt-2 space-y-1">
                        {stage.steps.map((step, stepIndex) => {
                          const stepCompleted = isStepCompleted(step.id);

                          return (
                            <div
                              key={step.id}
                              className={`
                                flex items-start gap-3 p-3 rounded-lg border
                                transition-all
                                ${stepCompleted ? 'bg-green-500/5 border-green-500/20' : 'bg-card'}
                              `}
                            >
                              <Checkbox
                                checked={stepCompleted}
                                onCheckedChange={() => handleStepToggle(step.id)}
                                disabled={production.status !== 'in_progress'}
                                className="mt-0.5"
                              />

                              <div className="flex-1 min-w-0">
                                <p className={`text-sm ${stepCompleted ? 'line-through text-muted-foreground' : ''}`}>
                                  <span className="font-medium">{stepIndex + 1}.</span> {step.description}
                                </p>
                                {step.notes && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {step.notes}
                                  </p>
                                )}
                              </div>

                              {step.duration_minutes && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
                                  <Clock className="h-3 w-3" />
                                  {step.duration_minutes}min
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="gap-2">
          <div className="flex-1 flex gap-2">
            {production.status === 'in_progress' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => updateProduction.mutate({ id: production.id, status: 'paused' })}
                disabled={updateProduction.isPending}
                className="gap-2"
              >
                <PauseCircle className="h-4 w-4" />
                Pausar
              </Button>
            )}
            {production.status === 'paused' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => updateProduction.mutate({ id: production.id, status: 'in_progress' })}
                disabled={updateProduction.isPending}
                className="gap-2 text-warning border-warning hover:bg-warning/10"
              >
                <Play className="h-4 w-4" />
                Retomar
              </Button>
            )}
          </div>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          {allCompleted && (
            <Button onClick={onComplete} className="gap-2" disabled={production.status === 'paused'}>
              <Check className="h-4 w-4" />
              Finalizar Produção
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog >
  );
}
