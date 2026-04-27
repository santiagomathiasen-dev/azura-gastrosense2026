import { useState, useEffect, useMemo } from 'react';
import { Plus, Minus, RefreshCw, Calendar, Check, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { type StockItem, UNIT_LABELS } from '@/hooks/stock/useStockItems';
import { type MovementType } from '@/hooks/stock/useStockMovements';
import { useExpiryDates, parseSafeDate } from '@/hooks/stock/useExpiryDates';
import { cn } from '@/lib/utils';

interface StockMovementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: StockItem | null;
  onSubmit: (data: {
    type: MovementType;
    quantity: number;
    notes?: string;
    deductions?: { id: string; quantity: number }[];
  }) => void;
  isLoading?: boolean;
}

export function StockMovementDialog({
  open,
  onOpenChange,
  item,
  onSubmit,
  isLoading,
}: StockMovementDialogProps) {
  const [type, setType] = useState<MovementType>('entry');
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');

  // Expiry dates logic
  const { expiryDates, isLoading: expiryLoading } = useExpiryDates(item?.id);
  const [selectedDeductions, setSelectedDeductions] = useState<Record<string, number>>({});
  const [autoDeductionEnabled, setAutoDeductionEnabled] = useState(true);

  // Filter only batches with quantity > 0
  const availableBatches = useMemo(() => {
    return expiryDates.filter(d => Number(d.quantity) > 0);
  }, [expiryDates]);

  // Reset state when dialog opens or item changes
  useEffect(() => {
    if (open) {
      setType('entry');
      setQuantity('');
      setNotes('');
      setSelectedDeductions({});
      setAutoDeductionEnabled(true);
    }
  }, [open, item]);

  // Automatic FIFO deduction suggestion
  useEffect(() => {
    if (type === 'exit' && autoDeductionEnabled && quantity) {
      const qty = parseFloat(quantity);
      if (isNaN(qty) || qty <= 0) {
        setSelectedDeductions({});
        return;
      }

      let remaining = qty;
      const newDeductions: Record<string, number> = {};

      // FIFO: expiryDates is already sorted by date ASC
      for (const batch of availableBatches) {
        if (remaining <= 0) break;
        const take = Math.min(remaining, Number(batch.quantity));
        newDeductions[batch.id] = take;
        remaining -= take;
      }

      setSelectedDeductions(newDeductions);
    }
  }, [type, quantity, availableBatches, autoDeductionEnabled]);

  const handleSubmit = () => {
    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) return;

    const deductions = Object.entries(selectedDeductions)
      .filter(([_, q]) => q > 0)
      .map(([id, q]) => ({ id, quantity: q }));

    onSubmit({
      type,
      quantity: qty,
      notes: notes || undefined,
      deductions: type === 'exit' ? deductions : undefined
    });

    onOpenChange(false);
  };

  if (!item) return null;

  const unitLabel = UNIT_LABELS[item.unit as keyof typeof UNIT_LABELS];
  const totalDeducted = Object.values(selectedDeductions).reduce((sum, q) => sum + q, 0);
  const qtyNum = parseFloat(quantity) || 0;
  const isDeductionMismatch = type === 'exit' && Math.abs(totalDeducted - qtyNum) > 0.001;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Movimentação de Estoque</DialogTitle>
          <DialogDescription>{item.name}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="p-3 rounded-lg bg-muted flex items-center justify-between">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-bold">Estoque atual</p>
              <p className="text-xl font-bold">
                {Number(item.current_quantity).toFixed(2)} <span className="text-sm font-normal text-muted-foreground">{unitLabel}</span>
              </p>
            </div>
            {availableBatches.length > 0 && (
              <div className="text-right">
                <p className="text-[10px] text-muted-foreground uppercase font-bold">Próx. Vencimento</p>
                <Badge variant="outline" className="text-[10px]">
                  {parseSafeDate(availableBatches[0].expiry_date).toLocaleDateString()}
                </Badge>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Tipo de movimentação</Label>
            <Select value={type} onValueChange={(v) => setType(v as MovementType)}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="entry">
                  <span className="flex items-center gap-2">
                    <Plus className="h-4 w-4 text-green-500" />
                    Entrada
                  </span>
                </SelectItem>
                <SelectItem value="exit">
                  <span className="flex items-center gap-2">
                    <Minus className="h-4 w-4 text-destructive" />
                    Saída
                  </span>
                </SelectItem>
                <SelectItem value="adjustment">
                  <span className="flex items-center gap-2">
                    <RefreshCw className="h-4 w-4 text-primary" />
                    Ajuste (define valor exato)
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="quantity" className="text-xs">
              {type === 'adjustment' ? 'Nova quantidade' : 'Quantidade'} ({unitLabel})
            </Label>
            <Input
              id="quantity"
              type="number"
              step="0.001"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="0"
              className="h-9"
            />
          </div>

          {/* Expiry Batch Selection for Exits */}
          {type === 'exit' && availableBatches.length > 0 && (
            <div className="space-y-3 p-3 border rounded-lg bg-orange-50/30 border-orange-200">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold flex items-center gap-1.5 text-orange-700">
                  <Calendar className="h-3.5 w-3.5" />
                  Confirmar Lotes de Saída
                </h4>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[10px] px-2"
                  onClick={() => setAutoDeductionEnabled(!autoDeductionEnabled)}
                >
                  {autoDeductionEnabled ? "Ajuste Manual" : "Usar FIFO (Auto)"}
                </Button>
              </div>

              <div className="space-y-2">
                {availableBatches.map(batch => (
                  <div key={batch.id} className="flex items-center justify-between gap-2 bg-white/50 p-2 rounded border border-orange-100">
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold truncate">
                        {batch.batch_name || "Lote s/ nome"}
                      </p>
                      <p className="text-[9px] text-muted-foreground uppercase">
                        Venc: {parseSafeDate(batch.expiry_date).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <p className="text-[8px] text-muted-foreground uppercase">Disponível</p>
                        <p className="text-[10px] font-medium">{Number(batch.quantity).toFixed(2)}</p>
                      </div>
                      <Input
                        type="number"
                        className="h-7 w-16 text-[10px] px-1"
                        value={selectedDeductions[batch.id] || ''}
                        onChange={(e) => {
                          setAutoDeductionEnabled(false);
                          const val = parseFloat(e.target.value) || 0;
                          setSelectedDeductions(prev => ({
                            ...prev,
                            [batch.id]: Math.min(val, Number(batch.quantity))
                          }));
                        }}
                        placeholder="0"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className={cn(
                "flex items-center justify-between p-1.5 rounded text-[10px]",
                isDeductionMismatch ? "bg-destructive/10 text-destructive" : "bg-green-100 text-green-700"
              )}>
                <span className="font-bold uppercase">Total Confirmado:</span>
                <span className="font-bold">{totalDeducted.toFixed(2)} / {qtyNum.toFixed(2)}</span>
              </div>

              {isDeductionMismatch && (
                <p className="text-[9px] text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  A soma dos lotes deve ser igual à quantidade de saída.
                </p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="notes" className="text-xs">Observações</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Opcional..."
              rows={2}
              className="text-xs resize-none"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            size="sm"
            disabled={isLoading || !quantity || (type === 'exit' && availableBatches.length > 0 && isDeductionMismatch)}
          >
            Confirmar Movimentação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
