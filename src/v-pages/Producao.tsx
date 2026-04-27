import { useState, useMemo, useEffect } from 'react';
import { Factory, Search, Calendar as CalendarIcon, Play, CheckCircle2, Clock, Eye, ChevronLeft, ChevronRight, XCircle, ListChecks, Check, ChevronDown, Loader2, PauseCircle, TrendingUp, DollarSign } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { toast } from 'sonner';
import {
  MobileList,
  MobileListItem,
  MobileListTitle,
  MobileListDetails,
  MobileListBadge,
} from '@/components/ui/mobile-list';
import { useProductions, ProductionWithSheet, STATUS_LABELS, ProductionStatus } from '@/hooks/ops/useProductions';
import { useTechnicalSheets } from '@/hooks/ops/useTechnicalSheets';
import { useTechnicalSheetStages, StageWithSteps } from '@/hooks/ops/useTechnicalSheetStages';
import { useProductionStepExecution } from '@/hooks/ops/useProductionStepExecution';
import { useProductionStageExecution } from '@/hooks/ops/useProductionStageExecution';
import { ProductionExecutionDialog } from '@/components/production/ProductionExecutionDialog';
import { ProductionReportDialog } from '@/components/production/ProductionReportDialog';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, addDays, addWeeks, addMonths, addYears, subDays, subWeeks, subMonths, subYears, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn, getNow, formatInBrasilia } from '@/lib/utils';

type PeriodType = 'day' | 'week' | 'month' | 'year';
type PracaType = 'all' | 'gelateria' | 'confeitaria' | 'padaria' | 'praca_quente' | 'bar' | 'sem_praca';

const PRACAS: { value: string; label: string }[] = [
  { value: 'gelateria', label: 'Gelateria' },
  { value: 'confeitaria', label: 'Confeitaria' },
  { value: 'padaria', label: 'Padaria' },
  { value: 'praca_quente', label: 'Praça Quente' },
  { value: 'bar', label: 'Bar' },
];

const statusConfig: Record<ProductionStatus, { label: string; icon: typeof CalendarIcon; variant: 'default' | 'warning' | 'success' | 'destructive' }> = {
  requested: { label: 'Solicitada', icon: Clock, variant: 'warning' },
  planned: { label: 'Planejada', icon: CalendarIcon, variant: 'default' },
  in_progress: { label: 'Em andamento', icon: Play, variant: 'warning' },
  completed: { label: 'Concluída', icon: CheckCircle2, variant: 'success' },
  cancelled: { label: 'Cancelada', icon: XCircle, variant: 'destructive' },
  paused: { label: 'Pausada', icon: PauseCircle, variant: 'warning' },
};

export default function Producao() {
  const { productions, isLoading, createProduction, updateProduction } = useProductions();
  const { sheets } = useTechnicalSheets();

  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [selectedProducao, setSelectedProducao] = useState<ProductionWithSheet | null>(null);
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [executionDialogOpen, setExecutionDialogOpen] = useState(false);
  const [actualQuantity, setActualQuantity] = useState('');
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [pracaFilter, setPracaFilter] = useState<PracaType>('all');
  const [reportOpen, setReportOpen] = useState(false);

  // Period filter state
  const [periodType, setPeriodType] = useState<PeriodType>('week');
  const [currentDate, setCurrentDate] = useState(getNow());

  const [formData, setFormData] = useState({
    technicalSheetId: '',
    name: '',
    plannedQuantity: '',
    scheduledDate: '',
    praca: '' as string,
  });

  // Calculate period boundaries
  const periodBoundaries = useMemo(() => {
    switch (periodType) {
      case 'day':
        return { start: startOfDay(currentDate), end: endOfDay(currentDate) };
      case 'week':
        return { start: startOfWeek(currentDate, { locale: ptBR }), end: endOfWeek(currentDate, { locale: ptBR }) };
      case 'month':
        return { start: startOfMonth(currentDate), end: endOfMonth(currentDate) };
      case 'year':
        return { start: startOfYear(currentDate), end: endOfYear(currentDate) };
    }
  }, [periodType, currentDate]);

  // Format period label
  const periodLabel = useMemo(() => {
    switch (periodType) {
      case 'day':
        return format(currentDate, "EEEE, d 'de' MMMM", { locale: ptBR });
      case 'week':
        return `${format(periodBoundaries.start, "d MMM", { locale: ptBR })} - ${format(periodBoundaries.end, "d MMM yyyy", { locale: ptBR })}`;
      case 'month':
        return format(currentDate, "MMMM 'de' yyyy", { locale: ptBR });
      case 'year':
        return format(currentDate, "yyyy", { locale: ptBR });
    }
  }, [periodType, currentDate, periodBoundaries]);

  // Navigate period
  const navigatePeriod = (direction: 'prev' | 'next') => {
    switch (periodType) {
      case 'day':
        setCurrentDate(direction === 'next' ? addDays(currentDate, 1) : subDays(currentDate, 1));
        break;
      case 'week':
        setCurrentDate(direction === 'next' ? addWeeks(currentDate, 1) : subWeeks(currentDate, 1));
        break;
      case 'month':
        setCurrentDate(direction === 'next' ? addMonths(currentDate, 1) : subMonths(currentDate, 1));
        break;
      case 'year':
        setCurrentDate(direction === 'next' ? addYears(currentDate, 1) : subYears(currentDate, 1));
        break;
    }
  };

  // Handle calendar date selection
  const handleCalendarSelect = (date: Date | undefined) => {
    if (date) {
      setCurrentDate(date);
      setCalendarOpen(false);
    }
  };

  const parseProductionDate = (dateStr: string): Date => {
    const parts = dateStr?.split('-');
    if (parts?.length === 3) {
      const [y, m, d] = parts.map(Number);
      if (!isNaN(y) && !isNaN(m) && !isNaN(d)) return new Date(Date.UTC(y, m - 1, d));
    }
    return new Date();
  };

  // Filter productions by period and search
  const filteredProducoes = useMemo(() => {
    return productions.filter(prod => {
      const prodDate = parseProductionDate(prod.scheduled_date);
      const inPeriod = isWithinInterval(prodDate, { start: periodBoundaries.start, end: periodBoundaries.end });
      const matchesSearch = prod.name.toLowerCase().includes(search.toLowerCase());
      const matchesPraca = pracaFilter === 'all'
        || (pracaFilter === 'sem_praca' && !prod.praca)
        || prod.praca === pracaFilter;
      return inPeriod && matchesSearch && matchesPraca;
    });
  }, [productions, periodBoundaries, search, pracaFilter]);

  const producoesPorStatus = {
    late: productions.filter(p => {
      if (p.status === 'completed' || p.status === 'cancelled') return false;
      return parseProductionDate(p.scheduled_date) < startOfDay(getNow());
    }),
    requested: filteredProducoes.filter(p => p.status === 'requested'),
    planned: filteredProducoes.filter(p => p.status === 'planned'),
    in_progress: filteredProducoes.filter(p => p.status === 'in_progress' || p.status === 'paused'),
    completed: filteredProducoes.filter(p => p.status === 'completed'),
    cancelled: filteredProducoes.filter(p => p.status === 'cancelled'),
  };

  const openNewDialog = () => {
    setFormData({ technicalSheetId: '', name: '', plannedQuantity: '', scheduledDate: '', praca: '' });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.technicalSheetId || !formData.plannedQuantity || !formData.scheduledDate) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }

    const selectedSheet = sheets.find(s => s.id === formData.technicalSheetId);
    const name = formData.name || selectedSheet?.name || 'Produção';

    await createProduction.mutateAsync({
      technical_sheet_id: formData.technicalSheetId,
      name,
      planned_quantity: parseFloat(formData.plannedQuantity),
      scheduled_date: formData.scheduledDate,
      ...(formData.praca ? { praca: formData.praca } : {}),
    } as any);

    setDialogOpen(false);
  };

  const updateStatus = async (id: string, newStatus: ProductionStatus, actualQty?: number) => {
    await updateProduction.mutateAsync({
      id,
      status: newStatus,
      ...(actualQty !== undefined && { actual_quantity: actualQty })
    });
  };

  const openPreview = (producao: ProductionWithSheet) => {
    setSelectedProducao(producao);
    setPreviewOpen(true);
  };

  const handleStartFromPreview = async () => {
    if (selectedProducao) {
      await updateStatus(selectedProducao.id, 'in_progress');
      setPreviewOpen(false);
      // Open execution dialog for step-by-step
      setExecutionDialogOpen(true);
    }
  };

  const openExecutionDialog = (producao: ProductionWithSheet) => {
    setSelectedProducao(producao);
    setExecutionDialogOpen(true);
  };

  const openCompleteDialog = (producao: ProductionWithSheet) => {
    setSelectedProducao(producao);
    setActualQuantity(String(producao.planned_quantity));
    setCompleteDialogOpen(true);
  };

  const handleCompleteProduction = async () => {
    if (!selectedProducao) return;

    const qty = parseFloat(actualQuantity);
    if (isNaN(qty) || qty <= 0) {
      toast.error('Informe uma quantidade válida (maior que zero)');
      return;
    }

    await updateStatus(selectedProducao.id, 'completed', qty);
    setCompleteDialogOpen(false);
    setPreviewOpen(false);
    toast.success('Produção finalizada com sucesso!');
  };

  const handleSheetSelect = (sheetId: string) => {
    const sheet = sheets.find(s => s.id === sheetId);
    setFormData(prev => ({
      ...prev,
      technicalSheetId: sheetId,
      name: sheet?.name || '',
    }));
  };

  const renderProducaoItem = (producao: ProductionWithSheet) => {
    const config = statusConfig[producao.status];
    const StatusIcon = config.icon;

    return (
      <MobileListItem
        key={producao.id}
        onClick={() => openPreview(producao)}
        actions={
          <div className="flex flex-col gap-1">
            {producao.status === 'planned' && (
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  openPreview(producao);
                }}
              >
                <Play className="h-3 w-3" />
              </Button>
            )}
            {(producao.status === 'in_progress' || producao.status === 'paused') && (
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  openExecutionDialog(producao);
                }}
                title="Passo a passo"
              >
                <ListChecks className="h-3 w-3" />
              </Button>
            )}
            {producao.status === 'in_progress' && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    updateStatus(producao.id, 'paused');
                  }}
                  title="Pausar"
                >
                  <PauseCircle className="h-3 w-3" />
                </Button>
                <Button
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    openCompleteDialog(producao);
                  }}
                >
                  <CheckCircle2 className="h-3 w-3" />
                </Button>
              </>
            )}
            {producao.status === 'paused' && (
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  updateStatus(producao.id, 'in_progress');
                }}
                title="Retomar"
              >
                <Play className="h-3 w-3" />
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                openPreview(producao);
              }}
            >
              <Eye className="h-3 w-3" />
            </Button>
          </div>
        }
      >
        <div className="flex items-center gap-2 flex-wrap">
          <MobileListTitle>{producao.name}</MobileListTitle>
          <MobileListBadge variant={config.variant}>
            <StatusIcon className="h-3 w-3 mr-1" />
            {config.label}
          </MobileListBadge>
          {producao.praca && (
            <Badge variant="outline" className="text-xs">
              {PRACAS.find(p => p.value === producao.praca)?.label || producao.praca}
            </Badge>
          )}
        </div>

        <MobileListDetails>
          <span className="flex items-center gap-1">
            <Factory className="h-3 w-3" />
            {producao.status === 'completed' && producao.actual_quantity !== null ? (
              <span>
                <span className="text-muted-foreground line-through mr-1">{producao.planned_quantity}</span>
                <span className="font-semibold text-success">{producao.actual_quantity}</span> {producao.technical_sheet?.yield_unit || 'un'}
              </span>
            ) : (
              <span>{producao.planned_quantity} {producao.technical_sheet?.yield_unit || 'un'}</span>
            )}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {(() => {
              const [year, month, day] = producao.scheduled_date.split('-').map(Number);
              return formatInBrasilia(new Date(year, month - 1, day), "dd/MM/yyyy");
            })()}
          </span>
        </MobileListDetails>
      </MobileListItem>
    );
  };

  if (isLoading) {
    return (
      <div className="animate-fade-in space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <PageHeader
        title="Produções"
        description="Gerencie produções"
        action={{ label: 'Nova', onClick: openNewDialog }}
      />

      {/* Period Filter - Compact */}
      <div className="flex flex-wrap gap-2 mb-2">
        <Select value={periodType} onValueChange={(v) => setPeriodType(v as PeriodType)}>
          <SelectTrigger className="w-[90px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="day" className="text-xs">Dia</SelectItem>
            <SelectItem value="week" className="text-xs">Semana</SelectItem>
            <SelectItem value="month" className="text-xs">Mês</SelectItem>
            <SelectItem value="year" className="text-xs">Ano</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigatePeriod('prev')}>
            <ChevronLeft className="h-3 w-3" />
          </Button>
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="h-8 min-w-[140px] justify-center text-xs gap-1">
                <CalendarIcon className="h-3 w-3" />
                {periodLabel}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="center">
              <Calendar
                mode="single"
                selected={currentDate}
                onSelect={handleCalendarSelect}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigatePeriod('next')}>
            <ChevronRight className="h-3 w-3" />
          </Button>
        </div>

        <Select value={pracaFilter} onValueChange={(v) => setPracaFilter(v as PracaType)}>
          <SelectTrigger className="w-[120px] h-8 text-xs">
            <SelectValue placeholder="Praça" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">Todas</SelectItem>
            {PRACAS.map(p => (
              <SelectItem key={p.value} value={p.value} className="text-xs">{p.label}</SelectItem>
            ))}
            <SelectItem value="sem_praca" className="text-xs">Sem praça</SelectItem>
          </SelectContent>
        </Select>

        <div className="relative flex-1 min-w-[120px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <Input
            placeholder="Buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-7 h-8 text-xs"
          />
        </div>
      </div>

      {/* Content - Scrollable */}
      <div className="flex-1 overflow-auto">{
        filteredProducoes.length === 0 ? (
          <EmptyState
            icon={Factory}
            title="Nenhuma produção"
            description="Agende uma nova produção"
            action={{ label: 'Agendar', onClick: openNewDialog }}
          />
        ) : (
          <div className="space-y-3">
            {/* Atrasadas */}
            {producoesPorStatus.late.length > 0 && (
              <Card className="border-destructive/30 bg-destructive/5 mb-4">
                <CardHeader className="p-3 pb-0">
                  <CardTitle className="text-sm font-semibold text-destructive flex items-center gap-2">
                    <Clock className="h-4 w-4 animate-pulse" />
                    Produções Atrasadas ({producoesPorStatus.late.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3">
                  <MobileList>
                    {producoesPorStatus.late.map(renderProducaoItem)}
                  </MobileList>
                </CardContent>
              </Card>
            )}

            {/* Solicitações */}
            {producoesPorStatus.requested.length > 0 && (
              <div>
                <h3 className="font-medium mb-2 text-xs flex items-center gap-1">
                  <Clock className="h-3 w-3 text-warning" />
                  Solicitações ({producoesPorStatus.requested.length})
                </h3>
                <MobileList>
                  {producoesPorStatus.requested.map(renderProducaoItem)}
                </MobileList>
              </div>
            )}

            {/* Planejadas */}
            {producoesPorStatus.planned.length > 0 && (
              <div>
                <h3 className="font-medium mb-2 text-xs flex items-center gap-1">
                  <CalendarIcon className="h-3 w-3 text-primary" />
                  Planejadas ({producoesPorStatus.planned.length})
                </h3>
                <MobileList>
                  {producoesPorStatus.planned.map(renderProducaoItem)}
                </MobileList>
              </div>
            )}

            {/* Em Andamento */}
            {producoesPorStatus.in_progress.length > 0 && (
              <div>
                <h3 className="font-medium mb-2 text-xs flex items-center gap-1">
                  <Play className="h-3 w-3 text-warning" />
                  Em Andamento ({producoesPorStatus.in_progress.length})
                </h3>
                <MobileList>
                  {producoesPorStatus.in_progress.map(renderProducaoItem)}
                </MobileList>
              </div>
            )}

            {/* Concluídas */}
            {producoesPorStatus.completed.length > 0 && (
              <div>
                <h3 className="font-medium mb-2 text-xs flex items-center gap-1 text-muted-foreground">
                  <CheckCircle2 className="h-3 w-3 text-success" />
                  Concluídas ({producoesPorStatus.completed.length})
                </h3>
                <MobileList>
                  {producoesPorStatus.completed.map(renderProducaoItem)}
                </MobileList>
              </div>
            )}

            {/* Canceladas */}
            {producoesPorStatus.cancelled.length > 0 && (
              <div>
                <h3 className="font-medium mb-2 text-xs flex items-center gap-1 text-muted-foreground">
                  <XCircle className="h-3 w-3 text-destructive" />
                  Canceladas ({producoesPorStatus.cancelled.length})
                </h3>
                <MobileList>
                  {producoesPorStatus.cancelled.map(renderProducaoItem)}
                </MobileList>
              </div>
            )}
          </div>
        )
      }
      </div>

      {/* Dialog Nova Produção */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Produção</DialogTitle>
            <DialogDescription>
              Agende uma nova produção
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Ficha Técnica *</Label>
              <Select
                value={formData.technicalSheetId}
                onValueChange={handleSheetSelect}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a ficha técnica" />
                </SelectTrigger>
                <SelectContent>
                  {sheets.length === 0 ? (
                    <div className="py-6 text-center text-sm text-muted-foreground">
                      Nenhuma ficha técnica cadastrada.
                      <br />
                      Vá até a aba "Fichas Técnicas" para criar uma.
                    </div>
                  ) : (
                    sheets.map((sheet) => (
                      <SelectItem key={sheet.id} value={sheet.id}>
                        {sheet.name} {sheet.yield_quantity && `(${sheet.yield_quantity} ${sheet.yield_unit})`}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Nome da Produção</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Produção Semanal de Pães"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quantidade">Quantidade *</Label>
                <Input
                  id="quantidade"
                  type="number"
                  value={formData.plannedQuantity}
                  onChange={(e) => setFormData({ ...formData, plannedQuantity: e.target.value })}
                  placeholder="Ex: 50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="data">Data *</Label>
                <Input
                  id="data"
                  type="date"
                  value={formData.scheduledDate}
                  onChange={(e) => setFormData({ ...formData, scheduledDate: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Praça</Label>
              <Select value={formData.praca} onValueChange={(v) => setFormData({ ...formData, praca: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a praça (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  {PRACAS.map(p => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={createProduction.isPending}>
              Agendar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Production Preview Dialog */}
      <ProductionPreviewSheet
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        producao={selectedProducao}
        onStartProduction={handleStartFromPreview}
        onComplete={() => {
          if (selectedProducao) {
            openCompleteDialog(selectedProducao);
          }
        }}
        onUpdateDate={async (newDate: string) => {
          if (selectedProducao) {
            await updateProduction.mutateAsync({ id: selectedProducao.id, scheduled_date: newDate });
          }
        }}
        isUpdating={updateProduction.isPending}
        onOpenReport={() => setReportOpen(true)}
      />

      {/* Complete Production Dialog */}
      <Dialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Finalizar Produção</DialogTitle>
            <DialogDescription>
              Informe a quantidade real produzida
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedProducao && (
              <>
                <div className="p-4 rounded-lg bg-muted">
                  <p className="text-sm text-muted-foreground">Produção</p>
                  <p className="font-semibold text-lg">{selectedProducao.name}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                    <p className="text-sm text-muted-foreground">Quantidade Planejada</p>
                    <p className="font-bold text-xl text-primary">
                      {selectedProducao.planned_quantity} {selectedProducao.technical_sheet?.yield_unit || 'un'}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="actualQty">Quantidade Produzida *</Label>
                    <Input
                      id="actualQty"
                      type="number"
                      value={actualQuantity}
                      onChange={(e) => setActualQuantity(e.target.value)}
                      placeholder="Ex: 48"
                      className="text-lg font-semibold"
                    />
                    <p className="text-xs text-muted-foreground">
                      {selectedProducao.technical_sheet?.yield_unit || 'unidades'}
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleCompleteProduction}
              disabled={updateProduction.isPending}
              className="gap-2"
            >
              <CheckCircle2 className="h-4 w-4" />
              Finalizar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Production Execution Dialog (Step by Step) */}
      <ProductionExecutionDialog
        open={executionDialogOpen}
        onOpenChange={setExecutionDialogOpen}
        production={selectedProducao}
        onComplete={() => {
          setExecutionDialogOpen(false);
          if (selectedProducao) {
            openCompleteDialog(selectedProducao);
          }
        }}
      />

      {/* Production Report Dialog */}
      <ProductionReportDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        production={selectedProducao}
      />
    </div>
  );
}

// Inline preview component with full technical sheet, stages, steps and completion checkboxes
function ProductionPreviewSheet({
  open,
  onOpenChange,
  producao,
  onStartProduction,
  onComplete,
  onUpdateDate,
  isUpdating,
  onOpenReport,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  producao: ProductionWithSheet | null;
  onStartProduction: () => void;
  onComplete: () => void;
  onUpdateDate: (newDate: string) => Promise<void>;
  isUpdating: boolean;
  onOpenReport: () => void;
}) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [expandedStages, setExpandedStages] = useState<Set<string>>(new Set());

  const { stages, isLoading: stagesLoading } = useTechnicalSheetStages(
    producao?.technical_sheet?.id
  );

  const {
    stepExecutions,
    isLoading: executionsLoading,
    initializeStepExecutions,
    toggleStepCompletion,
    isStepCompleted,
    getCompletionPercentage,
  } = useProductionStepExecution(producao?.id);

  const {
    stageExecutions,
    startStage,
    finishStage,
    getStageExecution,
  } = useProductionStageExecution(producao?.id);

  const { updateProduction } = useProductions();

  // Initialize executions & expand all stages when dialog opens
  useEffect(() => {
    if (open && producao && stages.length > 0) {
      const allStepIds = stages.flatMap(stage => stage.steps.map(step => step.id));
      if (allStepIds.length > 0 && (producao.status === 'in_progress' || producao.status === 'completed')) {
        initializeStepExecutions.mutate({ productionId: producao.id, stepIds: allStepIds });
      }
      setExpandedStages(new Set(stages.map(s => s.id)));
    }
  }, [open, producao?.id, stages.length]);

  if (!producao || !producao.technical_sheet) return null;

  const sheet = producao.technical_sheet;
  const multiplier = Number(producao.planned_quantity) / Number(sheet.yield_quantity);
  const canEditDate = producao.status === 'planned' || producao.status === 'in_progress';
  const canMarkSteps = producao.status === 'in_progress';
  const showProgress = producao.status === 'in_progress' || producao.status === 'paused';

  const [year, month, day] = producao.scheduled_date.split('-').map(Number);
  const scheduledDate = new Date(year, month - 1, day);
  const today = startOfDay(getNow());
  const isOverdue = producao.status === 'planned' && scheduledDate < today;

  const totalSteps = stages.reduce((sum, stage) => sum + stage.steps.length, 0);
  const completionPercentage = getCompletionPercentage(totalSteps);

  const handleDateSelect = async (date: Date | undefined) => {
    if (date) {
      const formattedDate = format(date, 'yyyy-MM-dd');
      if (formattedDate !== producao.scheduled_date) {
        await onUpdateDate(formattedDate);
      }
      setCalendarOpen(false);
    }
  };

  const toggleStage = (stageId: string) => {
    const next = new Set(expandedStages);
    if (next.has(stageId)) next.delete(stageId);
    else next.add(stageId);
    setExpandedStages(next);
  };

  const handleStepToggle = async (stepId: string) => {
    if (!canMarkSteps) return;
    const currentlyCompleted = isStepCompleted(stepId);
    await toggleStepCompletion.mutateAsync({ stepId, completed: !currentlyCompleted });
  };

  const getStageCompletionCount = (stage: StageWithSteps): [number, number] => {
    const completed = stage.steps.filter(step => isStepCompleted(step.id)).length;
    return [completed, stage.steps.length];
  };

  // Get ingredients for a specific stage
  const getStageIngredients = (stageId: string) => {
    return sheet.ingredients.filter((ing: any) => ing.stage_id === stageId);
  };

  // Get ingredients without a stage
  const unstagedIngredients = sheet.ingredients.filter((ing: any) => !ing.stage_id);

  const handleCompleteFirstStage = async () => {
    if (stages.length === 0) return;
    const firstStage = stages[0];
    const stepsToComplete = firstStage.steps.filter(step => !isStepCompleted(step.id));

    if (stepsToComplete.length === 0) {
      toast.info('A primeira etapa já está concluída');
      return;
    }

    try {
      for (const step of stepsToComplete) {
        await toggleStepCompletion.mutateAsync({ stepId: step.id, completed: true });
      }
      toast.success('Primeira etapa concluída com sucesso!');
    } catch (error) {
      console.error('Error completing stage:', error);
      toast.error('Erro ao concluir primeira etapa');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl">{producao.name}</DialogTitle>
        <DialogDescription className="sr-only">Detalhes do diálogo</DialogDescription>
</DialogHeader>

        <div className="space-y-4 py-2 flex-1 overflow-y-auto">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
              <p className="text-muted-foreground text-xs">Planejado</p>
              <p className="font-bold text-lg text-primary">{producao.planned_quantity} {sheet.yield_unit}</p>
            </div>
            {producao.status === 'completed' && producao.actual_quantity !== null && (
              <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                <p className="text-muted-foreground text-xs">Produzido</p>
                <p className="font-bold text-lg text-green-600">{producao.actual_quantity} {sheet.yield_unit}</p>
              </div>
            )}
            <div className={cn(
              "p-3 rounded-lg",
              isOverdue ? "bg-destructive/10 border border-destructive/30" : "bg-muted"
            )}>
              <p className={cn("text-xs", isOverdue ? "text-destructive" : "text-muted-foreground")}>
                Data {isOverdue && "(Atrasada)"}
              </p>
              {canEditDate ? (
                <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                  <PopoverTrigger asChild>
                    <button className={cn("font-medium flex items-center gap-1 hover:opacity-80", isOverdue ? "text-destructive" : "")} disabled={isUpdating}>
                      {format(scheduledDate, "dd/MM/yy", { locale: ptBR })}
                      <CalendarIcon className={cn("h-3 w-3", isOverdue ? "text-destructive/70" : "text-muted-foreground")} />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={scheduledDate} onSelect={handleDateSelect} initialFocus className="pointer-events-auto" locale={ptBR} />
                  </PopoverContent>
                </Popover>
              ) : (
                <p className="font-medium">{format(scheduledDate, "dd/MM/yy", { locale: ptBR })}</p>
              )}
            </div>
            <div className="p-3 rounded-lg bg-muted">
              <p className="text-muted-foreground text-xs">Multiplicador</p>
              <p className="font-medium">{multiplier.toFixed(2)}x</p>
            </div>
          </div>

          {/* Progress Bar (only for in_progress or paused) */}
          {showProgress && totalSteps > 0 && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Progresso</span>
                <span className="font-medium">{completionPercentage}%</span>
              </div>
              <Progress value={completionPercentage} className="h-2" />
            </div>
          )}

          {/* Stages with ingredients + steps */}
          {stagesLoading || executionsLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : stages.length === 0 ? (
            /* No stages — show flat ingredient list */
            <div>
              <h4 className="font-medium mb-2 text-sm">Ingredientes Necessários</h4>
              <div className="rounded-lg border divide-y text-sm">
                {sheet.ingredients.map((ing: any, idx: number) => (
                  <div key={idx} className="flex justify-between items-center p-2.5">
                    <span>{ing.stock_item?.name || 'Item'}</span>
                    <span className="font-medium text-primary">
                      {(Number(ing.quantity) * multiplier).toFixed(2)} {ing.unit}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Unstaged ingredients */}
              {unstagedIngredients.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2 text-sm">Ingredientes Gerais</h4>
                  <div className="rounded-lg border divide-y text-sm">
                    {unstagedIngredients.map((ing: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-center p-2.5">
                        <span>{ing.stock_item?.name || 'Item'}</span>
                        <span className="font-medium text-primary">
                          {(Number(ing.quantity) * multiplier).toFixed(2)} {ing.unit}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {stages.map((stage, stageIndex) => {
                const [completed, total] = getStageCompletionCount(stage);
                const isStageComplete = completed === total && total > 0;
                const isExpanded = expandedStages.has(stage.id);
                const stageIngredients = getStageIngredients(stage.id);

                return (
                  <Collapsible key={stage.id} open={isExpanded} onOpenChange={() => toggleStage(stage.id)}>
                    <CollapsibleTrigger asChild>
                      <div className={cn(
                        "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors hover:bg-muted/50",
                        isStageComplete && "border-green-500/30 bg-green-500/5"
                      )}>
                        {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">Etapa {stageIndex + 1}: {stage.name}</span>
                            {isStageComplete && <Check className="h-4 w-4 text-green-500" />}
                          </div>
                          {stage.description && <p className="text-xs text-muted-foreground truncate">{stage.description}</p>}
                        </div>
                        {total > 0 && (
                          <Badge variant={isStageComplete ? 'default' : 'secondary'} className="shrink-0 text-xs">
                            {completed}/{total}
                          </Badge>
                        )}
                        {stage.duration_minutes && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
                            <Clock className="h-3 w-3" />{stage.duration_minutes}min
                          </span>
                        )}
                        {producao.status === 'in_progress' && (
                          <div className="flex gap-1 ml-2" onClick={(e) => e.stopPropagation()}>
                            {!getStageExecution(stage.id)?.started_at ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-[10px] px-2 gap-1 border-primary/30 hover:bg-primary/5"
                                onClick={() => startStage.mutate(stage.id)}
                                disabled={startStage.isPending}
                              >
                                <Play className="h-3 w-3" /> Iniciar etapa
                              </Button>
                            ) : !getStageExecution(stage.id)?.finished_at ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-[10px] px-2 gap-1 border-success/30 hover:bg-success/5 text-success"
                                onClick={() => finishStage.mutate(stage.id)}
                                disabled={finishStage.isPending}
                              >
                                <Check className="h-3 w-3" /> Concluir etapa
                              </Button>
                            ) : (
                              <Badge variant="outline" className="h-7 text-[10px] text-success border-success/30 bg-success/5">
                                <Check className="h-3 w-3 mr-1" /> Etapa finalizada
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="ml-7 mt-2 space-y-2">
                        {/* Stage ingredients */}
                        {stageIngredients.length > 0 && (
                          <div className="rounded-lg border divide-y text-sm bg-muted/30">
                            <div className="p-2 text-xs font-medium text-muted-foreground">Ingredientes desta etapa</div>
                            {stageIngredients.map((ing: any, idx: number) => (
                              <div key={idx} className="flex justify-between items-center p-2.5">
                                <span className="text-sm">{ing.stock_item?.name || 'Item'}</span>
                                <span className="font-medium text-primary text-sm">
                                  {(Number(ing.quantity) * multiplier).toFixed(2)} {ing.unit}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Stage steps with checkboxes */}
                        {stage.steps.map((step, stepIndex) => {
                          const stepCompleted = isStepCompleted(step.id);
                          return (
                            <div
                              key={step.id}
                              className={cn(
                                "flex items-start gap-3 p-3 rounded-lg border transition-all",
                                stepCompleted ? "bg-green-500/5 border-green-500/20" : "bg-card"
                              )}
                            >
                              <Checkbox
                                checked={stepCompleted}
                                onCheckedChange={() => handleStepToggle(step.id)}
                                disabled={!canMarkSteps}
                                className="mt-0.5"
                              />
                              <div className="flex-1 min-w-0">
                                <p className={cn("text-sm", stepCompleted && "line-through text-muted-foreground")}>
                                  <span className="font-medium">{stepIndex + 1}.</span> {step.description}
                                </p>
                                {step.notes && <p className="text-xs text-muted-foreground mt-1">{step.notes}</p>}
                              </div>
                              {step.duration_minutes && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
                                  <Clock className="h-3 w-3" />{step.duration_minutes}min
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

          {/* Production Costs Adjusted */}
          <div className="grid grid-cols-2 gap-4">
            <Card className="border-primary/20 bg-primary/10">
              <CardContent className="p-3 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <DollarSign className="h-4 w-4 text-primary" />
                  <span className="text-[10px] uppercase font-bold text-primary">Custo Total da Produção</span>
                </div>
                <p className="text-lg font-bold text-primary">
                  R$ {(multiplier * (sheet.ingredients?.reduce((sum: number, ing: any) => sum + (ing.total_cost || 0), 0) || 0)).toFixed(2)}
                </p>
                <p className="text-[9px] text-muted-foreground">
                  Para {producao.planned_quantity} {sheet.yield_unit}
                </p>
              </CardContent>
            </Card>
            <Card className="border-accent/20 bg-accent/10">
              <CardContent className="p-3 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <TrendingUp className="h-4 w-4 text-accent-foreground" />
                  <span className="text-[10px] uppercase font-bold text-accent-foreground">Custo Unitário</span>
                </div>
                <p className="text-lg font-bold text-accent-foreground">
                  R$ {(sheet.ingredients?.reduce((sum: number, ing: any) => sum + (ing.total_cost || 0), 0) / Number(sheet.yield_quantity || 1) || 0).toFixed(2)}
                </p>
                <p className="text-[9px] text-muted-foreground uppercase">
                  Por {sheet.yield_unit}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Preparation Method */}
          {sheet.preparation_method && (
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Modo de Preparo</h4>
              <div className="p-4 rounded-lg bg-muted/50 text-xs whitespace-pre-wrap leading-relaxed">
                {sheet.preparation_method}
              </div>
            </div>
          )}

          {producao.notes && (
            <div>
              <h4 className="font-medium mb-1 text-sm">Observações</h4>
              <p className="text-sm text-muted-foreground">{producao.notes}</p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <div className="flex-1 flex gap-2">
            {producao.status === 'completed' && (
              <Button
                variant="outline"
                size="sm"
                onClick={onOpenReport}
                className="gap-2"
              >
                <TrendingUp className="h-4 w-4" />
                Relatório
              </Button>
            )}
            {producao.status === 'in_progress' && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updateProduction.mutate({ id: producao.id, status: 'paused' })}
                  disabled={updateProduction.isPending}
                  className="gap-2"
                >
                  <PauseCircle className="h-4 w-4" />
                  Pausar
                </Button>
                {stages.length > 0 && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleCompleteFirstStage}
                    disabled={toggleStepCompletion.isPending}
                    className="gap-2"
                  >
                    <Check className="h-4 w-4" />
                    Concluir 1ª Etapa
                  </Button>
                )}
              </>
            )}
            {producao.status === 'paused' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => updateProduction.mutate({ id: producao.id, status: 'in_progress' })}
                disabled={updateProduction.isPending}
                className="gap-2 text-warning border-warning hover:bg-warning/10"
              >
                <Play className="h-4 w-4" />
                Retomar
              </Button>
            )}
          </div>

          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          {producao.status === 'requested' && (
            <Button
              onClick={() => updateProduction.mutate({ id: producao.id, status: 'planned' })}
              className="gap-2"
              disabled={updateProduction.isPending}
            >
              <Check className="h-4 w-4" />Confirmar Solicitação
            </Button>
          )}
          {producao.status === 'planned' && (
            <Button onClick={onStartProduction} className="gap-2">
              <Play className="h-4 w-4" />Iniciar
            </Button>
          )}
          {producao.status === 'in_progress' && (
            <Button onClick={onComplete} className="gap-2" disabled={completionPercentage < 100 && totalSteps > 0}>
              <CheckCircle2 className="h-4 w-4" />Concluir
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
