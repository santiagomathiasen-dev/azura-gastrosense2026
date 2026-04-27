import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import type { StageWithSteps } from '@/hooks/ops/useTechnicalSheetStages';
import type { TechnicalSheetIngredient } from '@/hooks/ops/useTechnicalSheets';

interface StageDisplayProps {
  stages: StageWithSteps[];
  ingredients: (TechnicalSheetIngredient & {
    stock_item: { name: string; unit: string } | null;
    stage_id?: string | null;
    total_cost?: number;
  })[];
}

export function StageDisplay({ stages, ingredients }: StageDisplayProps) {
  const [expandedStages, setExpandedStages] = useState<Set<string>>(
    new Set(stages.map(s => s.id))
  );

  const toggleStage = (stageId: string) => {
    const newExpanded = new Set(expandedStages);
    if (newExpanded.has(stageId)) {
      newExpanded.delete(stageId);
    } else {
      newExpanded.add(stageId);
    }
    setExpandedStages(newExpanded);
  };

  // Get ingredients for a specific stage
  const getStageIngredients = (stageId: string) => {
    return ingredients.filter(ing => ing.stage_id === stageId);
  };

  // Get ingredients without a stage (legacy or general)
  const getUnassignedIngredients = () => {
    return ingredients.filter(ing => !ing.stage_id);
  };

  const unassignedIngredients = getUnassignedIngredients();

  if (stages.length === 0 && unassignedIngredients.length === 0) {
    return (
      <div className="text-center py-4 text-muted-foreground border rounded-lg">
        <p className="text-sm">Nenhum ingrediente ou etapa cadastrada.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Show unassigned ingredients first if any */}
      {unassignedIngredients.length > 0 && stages.length === 0 && (
        <div>
          <h4 className="font-medium mb-3">Ingredientes</h4>
          <div className="border rounded-lg divide-y">
            {unassignedIngredients.map((ing) => (
              <div key={ing.id} className="flex justify-between items-center p-3">
                <span className="font-medium text-sm">{ing.stock_item?.name || 'Item removido'}</span>
                <div className="text-right flex items-baseline gap-3">
                  <span className="text-base font-bold">
                    {ing.quantity} {ing.unit}
                  </span>
                  {ing.total_cost && ing.total_cost > 0 && (
                    <span className="text-xs text-muted-foreground">
                      R$ {ing.total_cost.toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Show stages */}
      {stages.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-medium">Partes da Receita</h4>
          {stages.map((stage, index) => {
            const stageIngredients = getStageIngredients(stage.id);
            const isExpanded = expandedStages.has(stage.id);

            return (
              <Collapsible
                key={stage.id}
                open={isExpanded}
                onOpenChange={() => toggleStage(stage.id)}
              >
                <Card className="border-l-4 border-l-primary/50">
                  <CardHeader className="py-3">
                    <CollapsibleTrigger asChild>
                      <div className="flex items-center gap-2 cursor-pointer">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                        <CardTitle className="text-sm flex-1">
                          {index + 1}ª Parte: {stage.name}
                        </CardTitle>
                        <span className="text-xs text-muted-foreground">
                          {stageIngredients.length} ingredientes
                        </span>
                      </div>
                    </CollapsibleTrigger>
                  </CardHeader>

                  <CollapsibleContent>
                    <CardContent className="pt-0 space-y-4">
                      {/* Ingredients */}
                      {stageIngredients.length > 0 && (
                        <div className="border rounded-lg divide-y bg-background">
                          {stageIngredients.map((ing) => (
                            <div key={ing.id} className="flex justify-between items-center p-2 text-sm">
                              <span className="font-medium">{ing.stock_item?.name || 'Item removido'}</span>
                              <div className="text-right flex items-baseline gap-2">
                                <span className="font-bold">
                                  {ing.quantity} {ing.unit}
                                </span>
                                {ing.total_cost && ing.total_cost > 0 && (
                                  <span className="text-xs text-muted-foreground">
                                    R$ {ing.total_cost.toFixed(2)}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {stageIngredients.length === 0 && (
                        <p className="text-xs text-muted-foreground">Sem ingredientes nesta parte.</p>
                      )}

                      {/* Preparation steps */}
                      {stage.steps && stage.steps.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-muted-foreground">Modo de Preparo:</p>
                          <ol className="list-decimal list-inside space-y-1 text-sm pl-2">
                            {stage.steps.map((step) => (
                              <li key={step.id} className="leading-relaxed">
                                {step.description}
                              </li>
                            ))}
                          </ol>
                        </div>
                      )}

                      {/* Stage description as preparation method fallback */}
                      {stage.description && (!stage.steps || stage.steps.length === 0) && (
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-muted-foreground">Modo de Preparo:</p>
                          <p className="text-sm whitespace-pre-wrap leading-relaxed">
                            {stage.description}
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            );
          })}
        </div>
      )}

      {/* Show unassigned ingredients below stages if there are stages */}
      {unassignedIngredients.length > 0 && stages.length > 0 && (
        <div>
          <h4 className="font-medium mb-3 text-muted-foreground">Ingredientes Gerais</h4>
          <div className="border rounded-lg divide-y">
            {unassignedIngredients.map((ing) => (
              <div key={ing.id} className="flex justify-between items-center p-3">
                <span className="font-medium text-sm">{ing.stock_item?.name || 'Item removido'}</span>
                <div className="text-right flex items-baseline gap-3">
                  <span className="text-base font-bold">
                    {ing.quantity} {ing.unit}
                  </span>
                  {ing.total_cost && ing.total_cost > 0 && (
                    <span className="text-xs text-muted-foreground">
                      R$ {ing.total_cost.toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
