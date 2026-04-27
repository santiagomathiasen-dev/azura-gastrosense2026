import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { CATEGORY_LABELS, UNIT_LABELS, type StockItem, type StockCategory, type StockUnit } from '@/hooks/stock/useStockItems';
import { useSuppliers } from '@/hooks/purchases/useSuppliers';
import { AlertTriangle, Plus, Trash2 } from 'lucide-react';
import { getNow } from '@/lib/utils';
import { useExpiryDates, parseSafeDate } from '@/hooks/stock/useExpiryDates';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

const formSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(100),
  category: z.enum(['laticinios', 'secos_e_graos', 'hortifruti', 'carnes_e_peixes', 'embalagens', 'limpeza', 'outros'] as const),
  unit: z.enum(['kg', 'g', 'L', 'ml', 'unidade', 'caixa', 'dz'] as const),
  current_quantity: z.coerce.number().min(0).optional(),
  minimum_quantity: z.coerce.number().min(0).optional(),
  unit_price: z.coerce.number().min(0).optional(),
  waste_factor: z.coerce.number().min(0).max(100).optional(),
  expiration_date: z.string().optional(),
  supplier_id: z.string().optional(),
  notes: z.string().max(500).optional(),
});

type FormData = z.infer<typeof formSchema>;

interface StockItemFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: FormData) => void;
  initialData?: StockItem | null;
  isLoading?: boolean;
}

export function StockItemForm({
  open,
  onOpenChange,
  onSubmit,
  initialData,
  isLoading,
}: StockItemFormProps) {
  const { suppliers } = useSuppliers();
  const { expiryDates, addExpiryDate, removeExpiryDate } = useExpiryDates(initialData?.id);
  const [newExpiryDate, setNewExpiryDate] = useState('');
  const [newBatch, setNewBatch] = useState('');
  const [newQty, setNewQty] = useState('');

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      category: 'outros',
      unit: 'unidade',
      current_quantity: '' as any,
      minimum_quantity: '' as any,
      unit_price: '' as any,
      waste_factor: '' as any,
      expiration_date: '',
      supplier_id: '',
      notes: '',
    },
  });

  // Reset form when initialData changes
  useEffect(() => {
    if (open) {
      reset({
        name: initialData?.name || '',
        category: (initialData?.category as StockCategory) || 'outros',
        unit: (initialData?.unit as StockUnit) || 'unidade',
        current_quantity: initialData?.current_quantity ?? ('' as any),
        minimum_quantity: initialData?.minimum_quantity ?? ('' as any),
        unit_price: (initialData as any)?.unit_price ?? ('' as any),
        waste_factor: (initialData as any)?.waste_factor ?? ('' as any),
        expiration_date: (initialData as any)?.expiration_date || '',
        supplier_id: (initialData as any)?.supplier_id || '',
        notes: (initialData as any)?.notes || '',
      });
    }
  }, [open, initialData, reset]);

  const formatItemName = (name: string) => {
    return name
      .trim()
      .split(/\s+/)
      .map((word) => {
        const lower = word.toLowerCase();
        if (['de', 'da', 'do', 'das', 'dos', 'e', 'com', 'sem'].includes(lower)) {
          return lower;
        }
        return lower.charAt(0).toUpperCase() + lower.slice(1);
      })
      .join(' ');
  };

  const handleFormSubmit = (data: FormData) => {
    // Apply defaults and clean up empty strings
    const cleanedData = {
      name: formatItemName(data.name),
      category: data.category,
      unit: data.unit,
      current_quantity: data.current_quantity ?? 0,
      minimum_quantity: data.minimum_quantity ?? 0,
      unit_price: data.unit_price ?? 0,
      waste_factor: data.waste_factor ?? 0,
      supplier_id: data.supplier_id || null,
      expiration_date: data.expiration_date || null,
      notes: data.notes || null,
    };
    onSubmit(cleanedData);
  };

  const onInvalid = () => {
    toast.error('Preencha os campos obrigatórios corretamente.');
  };

  const expirationDate = watch('expiration_date');
  const isExpiringSoon = expirationDate && parseSafeDate(expirationDate) <= new Date(getNow().getTime() + 7 * 24 * 60 * 60 * 1000);
  const isExpired = expirationDate && parseSafeDate(expirationDate) < getNow();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {initialData ? 'Editar Item' : 'Novo Item de Estoque'}
          </DialogTitle>
        <DialogDescription className="sr-only">Detalhes do diálogo</DialogDescription>
</DialogHeader>
        <form onSubmit={handleSubmit(handleFormSubmit, onInvalid)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome *</Label>
            <Input
              id="name"
              {...register('name')}
              placeholder="Ex: Farinha de Trigo"
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Categoria *</Label>
              <Select
                value={watch('category')}
                onValueChange={(value) => setValue('category', value as StockCategory)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Unidade *</Label>
              <Select
                value={watch('unit')}
                onValueChange={(value) => setValue('unit', value as StockUnit)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(UNIT_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="current_quantity">Qtd. Atual</Label>
              <Input
                id="current_quantity"
                type="number"
                step="0.001"
                {...register('current_quantity')}
              />
              {errors.current_quantity && (
                <p className="text-sm text-destructive">{errors.current_quantity.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="minimum_quantity">Qtd. Mínima</Label>
              <Input
                id="minimum_quantity"
                type="number"
                step="0.001"
                {...register('minimum_quantity')}
              />
              {errors.minimum_quantity && (
                <p className="text-sm text-destructive">{errors.minimum_quantity.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="unit_price">Preço (R$)</Label>
              <Input
                id="unit_price"
                type="number"
                step="0.01"
                min="0"
                {...register('unit_price')}
                placeholder="0.00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="waste_factor">Desperdício (%)</Label>
              <Input
                id="waste_factor"
                type="number"
                step="0.1"
                min="0"
                max="100"
                {...register('waste_factor')}
                placeholder="0"
              />
              <p className="text-xs text-muted-foreground">
                Ex: 10% = precisa comprar 10% a mais
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="expiration_date">Data de Validade (opcional)</Label>
            <Input
              id="expiration_date"
              type="date"
              {...register('expiration_date')}
              className={isExpired ? 'border-destructive' : isExpiringSoon ? 'border-yellow-500' : ''}
            />
            <p className="text-xs text-muted-foreground">
              Deixe em branco se não quiser controlar validade
            </p>
            {isExpired && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Produto vencido!
              </p>
            )}
            {!isExpired && isExpiringSoon && (
              <p className="text-sm text-yellow-600 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Vence em menos de 7 dias
              </p>
            )}
          </div>

          {/* Multiple Expiry Dates Section */}
          {initialData?.id && (
            <div className="space-y-2 border-t pt-3">
              <Label className="flex items-center gap-2">
                Datas de Validade
                {expiryDates.length > 0 && (
                  <Badge variant="secondary" className="text-[10px] h-5">{expiryDates.length}</Badge>
                )}
              </Label>

              {/* Existing expiry dates */}
              {expiryDates.filter(ed => Number(ed.quantity) > 0).length > 0 && (
                <div className="space-y-1 max-h-32 overflow-auto">
                  {expiryDates.filter(ed => Number(ed.quantity) > 0).map((ed) => {
                    const expDate = parseSafeDate(ed.expiry_date);
                    const now = getNow();
                    const daysUntil = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                    const expired = daysUntil < 0;
                    const nearExpiry = daysUntil >= 0 && daysUntil <= 7;
                    return (
                      <div
                        key={ed.id}
                        className={`flex items-center gap-2 p-2 rounded-lg text-xs border ${expired ? 'border-destructive/30 bg-destructive/5' :
                          nearExpiry ? 'border-yellow-500/30 bg-yellow-500/5' : 'bg-muted/50'
                          }`}
                      >
                        <div className="flex-1 min-w-0">
                          <span className="font-medium">
                            {expDate.toLocaleDateString('pt-BR')}
                          </span>
                          {ed.batch_name && (
                            <span className="text-muted-foreground ml-1">• Lote: {ed.batch_name}</span>
                          )}
                          {Number(ed.quantity) > 0 && (
                            <span className="text-muted-foreground ml-1">• Qtd: {ed.quantity}</span>
                          )}
                          {expired && (
                            <Badge variant="destructive" className="ml-1 text-[9px] h-4">Vencido</Badge>
                          )}
                          {nearExpiry && (
                            <Badge variant="outline" className="ml-1 text-[9px] h-4 text-yellow-600 border-yellow-500">
                              {daysUntil}d
                            </Badge>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeExpiryDate.mutate(ed.id)}
                          className="p-1 hover:bg-destructive/10 rounded text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Add new expiry date */}
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <Label className="text-[10px] text-muted-foreground">Data</Label>
                  <Input
                    type="date"
                    className="h-8 text-xs"
                    value={newExpiryDate}
                    onChange={(e) => setNewExpiryDate(e.target.value)}
                  />
                </div>
                <div className="w-24">
                  <Label className="text-[10px] text-muted-foreground">Lote</Label>
                  <Input
                    className="h-8 text-xs"
                    placeholder="Lote"
                    value={newBatch}
                    onChange={(e) => setNewBatch(e.target.value)}
                  />
                </div>
                <div className="w-20">
                  <Label className="text-[10px] text-muted-foreground">Qtd</Label>
                  <Input
                    type="number"
                    className="h-8 text-xs"
                    placeholder="0"
                    value={newQty}
                    onChange={(e) => setNewQty(e.target.value)}
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8"
                  disabled={!newExpiryDate}
                  onClick={() => {
                    if (!newExpiryDate || !initialData?.id) return;
                    addExpiryDate.mutate({
                      stock_item_id: initialData.id,
                      expiry_date: newExpiryDate,
                      batch_name: newBatch || undefined,
                      quantity: newQty ? parseFloat(newQty) : undefined,
                    });
                    setNewExpiryDate('');
                    setNewBatch('');
                    setNewQty('');
                  }}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Fornecedor</Label>
            <Select
              value={watch('supplier_id') || 'none'}
              onValueChange={(value) => setValue('supplier_id', value === 'none' ? '' : value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um fornecedor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {suppliers.map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              {...register('notes')}
              placeholder="Observações opcionais..."
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {initialData ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
