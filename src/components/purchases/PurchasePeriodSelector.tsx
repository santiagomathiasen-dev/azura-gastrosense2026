import { useState, useMemo, useEffect, useRef } from 'react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, addDays, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, ChevronLeft, ChevronRight, Factory } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import type { ProductionWithSheet } from '@/hooks/ops/useProductions';
import { getNow, formatInBrasilia } from '@/lib/utils';

export type PeriodType = 'day' | 'week' | 'month' | 'year';

interface PurchasePeriodSelectorProps {
  productions: ProductionWithSheet[];
  onPeriodChange: (startDate: Date, endDate: Date, productions: ProductionWithSheet[]) => void;
}

const PERIOD_LABELS: Record<PeriodType, string> = {
  day: 'Dia',
  week: 'Semana',
  month: 'Mês',
  year: 'Ano',
};

export function PurchasePeriodSelector({ productions, onPeriodChange }: PurchasePeriodSelectorProps) {
  const [periodType, setPeriodType] = useState<PeriodType>('week');
  const [referenceDate, setReferenceDate] = useState(getNow());

  // Calculate period bounds based on type and reference date
  const { startDate, endDate, periodLabel } = useMemo(() => {
    let start: Date;
    let end: Date;
    let label: string;

    switch (periodType) {
      case 'day':
        start = startOfDay(referenceDate);
        end = endOfDay(referenceDate);
        label = formatInBrasilia(referenceDate, "EEEE, dd 'de' MMMM");
        break;
      case 'week':
        start = startOfWeek(referenceDate, { weekStartsOn: 1 }); // Monday
        end = endOfWeek(referenceDate, { weekStartsOn: 1 });
        label = `${formatInBrasilia(start, 'dd/MM')} - ${formatInBrasilia(end, 'dd/MM/yyyy')}`;
        break;
      case 'month':
        start = startOfMonth(referenceDate);
        end = endOfMonth(referenceDate);
        label = formatInBrasilia(referenceDate, "MMMM 'de' yyyy");
        break;
      case 'year':
        start = startOfYear(referenceDate);
        end = endOfYear(referenceDate);
        label = formatInBrasilia(referenceDate, 'yyyy');
        break;
      default:
        start = startOfWeek(referenceDate, { weekStartsOn: 1 });
        end = endOfWeek(referenceDate, { weekStartsOn: 1 });
        label = `${formatInBrasilia(start, 'dd/MM')} - ${formatInBrasilia(end, 'dd/MM/yyyy')}`;
    }

    return { startDate: start, endDate: end, periodLabel: label };
  }, [periodType, referenceDate]);

  // Filter productions within the selected period
  const filteredProductions = useMemo(() => {
    return productions.filter(prod => {
      const prodDate = new Date(prod.scheduled_date);
      return isWithinInterval(prodDate, { start: startDate, end: endDate });
    });
  }, [productions, startDate, endDate]);

  // Calculate suggested purchase date (2-3 days before first production)
  const suggestedPurchaseDate = useMemo(() => {
    if (filteredProductions.length === 0) return null;

    // Sort by scheduled date
    const sorted = [...filteredProductions].sort(
      (a, b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime()
    );

    const firstProductionDate = new Date(sorted[0].scheduled_date);
    // Suggest 2 days before, but not in the past
    const suggested = addDays(firstProductionDate, -2);
    const today = startOfDay(getNow());

    return suggested < today ? today : suggested;
  }, [filteredProductions]);

  // Navigate periods
  const navigatePeriod = (direction: 'prev' | 'next') => {
    const multiplier = direction === 'prev' ? -1 : 1;
    let newDate: Date;

    switch (periodType) {
      case 'day':
        newDate = addDays(referenceDate, 1 * multiplier);
        break;
      case 'week':
        newDate = addDays(referenceDate, 7 * multiplier);
        break;
      case 'month':
        newDate = new Date(referenceDate);
        newDate.setMonth(newDate.getMonth() + (1 * multiplier));
        break;
      case 'year':
        newDate = new Date(referenceDate);
        newDate.setFullYear(newDate.getFullYear() + (1 * multiplier));
        break;
      default:
        newDate = referenceDate;
    }

    setReferenceDate(newDate);
  };

  // Track if this is the first render to avoid calling before productions load
  const isInitialMount = useRef(true);

  // Notify parent of period/filter changes once productions are ready
  useEffect(() => {
    if (productions.length > 0 || !isInitialMount.current) {
      onPeriodChange(startDate, endDate, filteredProductions);
    }
    isInitialMount.current = false;
  }, [startDate, endDate, filteredProductions]);

  const goToToday = () => {
    setReferenceDate(getNow());
  };

  return (
    <Card className="mb-4">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          Período de Produção
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {/* Period Type Selector */}
        <div className="flex items-center gap-2">
          <Select value={periodType} onValueChange={(v) => setPeriodType(v as PeriodType)}>
            <SelectTrigger className="w-32 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">{PERIOD_LABELS.day}</SelectItem>
              <SelectItem value="week">{PERIOD_LABELS.week}</SelectItem>
              <SelectItem value="month">{PERIOD_LABELS.month}</SelectItem>
              <SelectItem value="year">{PERIOD_LABELS.year}</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center gap-1 flex-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigatePeriod('prev')}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium flex-1 text-center capitalize">
              {periodLabel}
            </span>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigatePeriod('next')}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <Button variant="outline" size="sm" className="h-8" onClick={goToToday}>
            Hoje
          </Button>
        </div>

        {/* Productions Summary */}
        <div className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2">
            <Factory className="h-4 w-4 text-primary" />
            <span className="text-sm">
              <strong>{filteredProductions.length}</strong> produção(ões) planejada(s)
            </span>
          </div>
          {filteredProductions.length > 0 && (
            <Badge variant="outline" className="text-xs">
              {filteredProductions.filter(p => p.status === 'planned').length} pendentes
            </Badge>
          )}
        </div>

        {/* Suggested Purchase Date */}
        {suggestedPurchaseDate && filteredProductions.length > 0 && (
          <div className="flex items-center gap-2 p-2 bg-primary/10 rounded-lg">
            <Calendar className="h-4 w-4 text-primary" />
            <span className="text-xs">
              <strong>Data sugerida para compra:</strong>{' '}
              {formatInBrasilia(suggestedPurchaseDate, "EEEE, dd/MM")}
            </span>
          </div>
        )}

        {/* Production List Preview */}
        {filteredProductions.length > 0 && (
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {filteredProductions.slice(0, 5).map(prod => (
              <div key={prod.id} className="flex items-center justify-between text-xs p-1.5 bg-background rounded border">
                <span className="font-medium truncate flex-1">{prod.name}</span>
                <span className="text-muted-foreground">
                  {formatInBrasilia(prod.scheduled_date, 'dd/MM')} • {prod.planned_quantity} un
                </span>
              </div>
            ))}
            {filteredProductions.length > 5 && (
              <span className="text-xs text-muted-foreground">
                +{filteredProductions.length - 5} produção(ões)
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
