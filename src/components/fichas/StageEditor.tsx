import { useState } from 'react';
import { Plus, Trash2, GripVertical, Clock, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useTechnicalSheetStages, StageWithSteps, TechnicalSheetStageStep } from '@/hooks/useTechnicalSheetStages';
import { toast } from 'sonner';

interface StageEditorProps {
  technicalSheetId: string;
}

export function StageEditor({ technicalSheetId }: StageEditorProps) {
  const {
    stages,
    isLoading,
    createStage,
    updateStage,
    deleteStage,
    createStep,
    updateStep,
    deleteStep,
  } = useTechnicalSheetStages(technicalSheetId);

  const [expandedStages, setExpandedStages] = useState<Set<string>>(new Set());
  const [newStageName, setNewStageName] = useState('');
  const [editingStep, setEditingStep] = useState<{ stageId: string; description: string } | null>(null);

  const toggleStage = (stageId: string) => {
    const newExpanded = new Set(expandedStages);
    if (newExpanded.has(stageId)) {
      newExpanded.delete(stageId);
    } else {
      newExpanded.add(stageId);
    }
    setExpandedStages(newExpanded);
  };

  const handleAddStage = async () => {
    if (!newStageName.trim()) {
      toast.error('Digite o nome da etapa');
      return;
    }

    await createStage.mutateAsync({
      technical_sheet_id: technicalSheetId,
      name: newStageName.trim(),
      description: null,
      order_index: stages.length,
      duration_minutes: null,
    });

    setNewStageName('');
    toast.success('Etapa adicionada!');
  };

  const handleDeleteStage = async (stageId: string, stageName: string) => {
    if (!confirm(`Excluir a etapa "${stageName}" e todos os seus passos?`)) return;
    await deleteStage.mutateAsync(stageId);
  };

  const handleAddStep = async (stageId: string) => {
    if (!editingStep?.description.trim()) {
      toast.error('Digite a descrição do passo');
      return;
    }

    const stage = stages.find(s => s.id === stageId);
    const orderIndex = stage?.steps.length || 0;

    await createStep.mutateAsync({
      stage_id: stageId,
      description: editingStep.description.trim(),
      order_index: orderIndex,
      duration_minutes: null,
      notes: null,
    });

    setEditingStep(null);
    toast.success('Passo adicionado!');
  };

  const handleDeleteStep = async (stepId: string) => {
    await deleteStep.mutateAsync(stepId);
  };

  if (isLoading) {
    return <div className="text-center py-4 text-muted-foreground">Carregando etapas...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-base font-medium">Etapas de Produção</Label>
      </div>

      {/* Existing Stages */}
      {stages.length > 0 && (
        <div className="space-y-3">
          {stages.map((stage, index) => (
            <Collapsible
              key={stage.id}
              open={expandedStages.has(stage.id)}
              onOpenChange={() => toggleStage(stage.id)}
            >
              <Card>
                <CardHeader className="py-3">
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center gap-2 cursor-pointer">
                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                      {expandedStages.has(stage.id) ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      <CardTitle className="text-sm flex-1">
                        Etapa {index + 1}: {stage.name}
                      </CardTitle>
                      <span className="text-xs text-muted-foreground">
                        {stage.steps.length} passos
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteStage(stage.id, stage.name);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CollapsibleTrigger>
                </CardHeader>

                <CollapsibleContent>
                  <CardContent className="pt-0 space-y-3">
                    {/* Steps */}
                    {stage.steps.map((step, stepIndex) => (
                      <div
                        key={step.id}
                        className="flex items-start gap-2 p-2 rounded-md bg-muted/50"
                      >
                        <span className="text-sm font-medium text-muted-foreground min-w-[24px]">
                          {stepIndex + 1}.
                        </span>
                        <p className="text-sm flex-1">{step.description}</p>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleDeleteStep(step.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}

                    {/* Add Step */}
                    {editingStep?.stageId === stage.id ? (
                      <div className="flex gap-2">
                        <Input
                          placeholder="Descrição do passo..."
                          value={editingStep.description}
                          onChange={(e) => setEditingStep({ ...editingStep, description: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAddStep(stage.id);
                            if (e.key === 'Escape') setEditingStep(null);
                          }}
                          autoFocus
                        />
                        <Button size="sm" onClick={() => handleAddStep(stage.id)}>
                          Adicionar
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingStep(null)}>
                          Cancelar
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => setEditingStep({ stageId: stage.id, description: '' })}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Adicionar Passo
                      </Button>
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          ))}
        </div>
      )}

      {/* Add New Stage */}
      <div className="flex gap-2">
        <Input
          placeholder="Nome da nova etapa (ex: Poolish, Massa Final...)"
          value={newStageName}
          onChange={(e) => setNewStageName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAddStage();
          }}
        />
        <Button onClick={handleAddStage} disabled={createStage.isPending}>
          <Plus className="h-4 w-4 mr-2" />
          Etapa
        </Button>
      </div>

      {stages.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          Adicione etapas para definir o passo a passo da produção.
          <br />
          Exemplo: Poolish → Massa Final → Modelagem → Fermentação
        </p>
      )}
    </div>
  );
}
