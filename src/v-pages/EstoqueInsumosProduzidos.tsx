import { useState } from 'react';
import { Package, Search, Plus, Calendar, Trash2, Edit, AlertTriangle } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  MobileList,
  MobileListItem,
  MobileListTitle,
  MobileListDetails,
  MobileListBadge,
} from '@/components/ui/mobile-list';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/EmptyState';
import { useProducedInputsStock, ProducedInputWithSheet } from '@/hooks/ops/useProducedInputsStock';
import { useTechnicalSheets } from '@/hooks/ops/useTechnicalSheets';
import { formatInBrasilia, getNow, getTodayStr } from '@/lib/utils';
import { parseSafeDate } from '@/hooks/stock/useExpiryDates';
import { toast } from 'sonner';

export default function EstoqueInsumosProduzidos() {
  const { producedInputs, isLoading, createProducedInput, updateProducedInput, deleteProducedInput, generateBatchCode } = useProducedInputsStock();
  const { sheets } = useTechnicalSheets();

  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ProducedInputWithSheet | null>(null);

  const [formData, setFormData] = useState({
    technicalSheetId: '',
    quantity: '',
    unit: 'unidade',
    batchCode: '',
    expirationDate: '',
    notes: '',
  });

  // Filter only "insumo" type sheets
  const insumoSheets = sheets.filter(sheet =>
    (sheet as any).production_type === 'insumo'
  );

  const filteredInputs = producedInputs.filter(input =>
    input.technical_sheet?.name.toLowerCase().includes(search.toLowerCase()) ||
    input.batch_code.toLowerCase().includes(search.toLowerCase())
  );

  const getExpirationStatus = (expirationDate: string | null): 'ok' | 'warning' | 'expired' => {
    if (!expirationDate) return 'ok';
    const daysUntilExpiry = Math.ceil((parseSafeDate(expirationDate).getTime() - getNow().getTime()) / (1000 * 60 * 60 * 24));
    if (daysUntilExpiry < 0) return 'expired';
    if (daysUntilExpiry <= 3) return 'warning';
    return 'ok';
  };

  const resetForm = () => {
    setFormData({
      technicalSheetId: '',
      quantity: '',
      unit: 'unidade',
      batchCode: '',
      expirationDate: '',
      notes: '',
    });
    setEditingItem(null);
  };

  const openNewDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (item: ProducedInputWithSheet) => {
    setEditingItem(item);
    setFormData({
      technicalSheetId: item.technical_sheet_id,
      quantity: String(item.quantity),
      unit: item.unit,
      batchCode: item.batch_code,
      expirationDate: item.expiration_date || '',
      notes: item.notes || '',
    });
    setDialogOpen(true);
  };

  const handleSheetSelect = (sheetId: string) => {
    const sheet = sheets.find(s => s.id === sheetId);
    setFormData(prev => ({
      ...prev,
      technicalSheetId: sheetId,
      batchCode: prev.batchCode || generateBatchCode(sheet?.name || 'INS'),
      unit: sheet?.yield_unit || 'unidade',
    }));
  };

  const handleSave = async () => {
    if (!formData.technicalSheetId || !formData.quantity) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }

    try {
      if (editingItem) {
        await updateProducedInput.mutateAsync({
          id: editingItem.id,
          quantity: parseFloat(formData.quantity),
          unit: formData.unit,
          batch_code: formData.batchCode,
          expiration_date: formData.expirationDate || null,
          notes: formData.notes || null,
        });
      } else {
        await createProducedInput.mutateAsync({
          technical_sheet_id: formData.technicalSheetId,
          quantity: parseFloat(formData.quantity),
          unit: formData.unit,
          batch_code: formData.batchCode || generateBatchCode('INS'),
          production_date: getTodayStr(),
          expiration_date: formData.expirationDate || null,
          notes: formData.notes || null,
        });
      }
      setDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error(error);
    }
  };

  const handleDelete = async (item: ProducedInputWithSheet) => {
    if (!confirm(`Excluir "${item.technical_sheet?.name}" - Lote ${item.batch_code}?`)) return;
    await deleteProducedInput.mutateAsync(item.id);
  };

  if (isLoading) {
    return (
      <div className="animate-fade-in space-y-4">
        <PageHeader title="Insumos Produzidos" description="Estoque de insumos feitos internamente" />
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  // Handle case where we have no produced inputs after loading
  const isEmpty = !producedInputs || producedInputs.length === 0;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Insumos Produzidos"
        description="Estoque de produções intermediárias (ex: Poolish, Molhos)"
        action={{ label: 'Adicionar', onClick: openNewDialog }}
      />

      {/* Search */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou lote..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{producedInputs.length}</p>
            <p className="text-xs text-muted-foreground">Lotes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-primary">
              {producedInputs.reduce((sum, i) => sum + Number(i.quantity), 0).toFixed(0)}
            </p>
            <p className="text-xs text-muted-foreground">Unidades</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-destructive">
              {producedInputs.filter(i => getExpirationStatus(i.expiration_date) !== 'ok').length}
            </p>
            <p className="text-xs text-muted-foreground">Alertas</p>
          </CardContent>
        </Card>
      </div>

      {/* List */}
      {isEmpty ? (
        <EmptyState
          icon={Package}
          title="Nenhum insumo produzido"
          description="Insumos produzidos aparecem aqui após finalizar produções do tipo 'insumo'"
          action={{ label: 'Adicionar Manual', onClick: openNewDialog }}
        />
      ) : (
        <MobileList>
          {filteredInputs.map((item) => {
            const status = getExpirationStatus(item.expiration_date);

            return (
              <MobileListItem
                key={item.id}
                onClick={() => openEditDialog(item)}
                actions={
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(item);
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                }
              >
                <div className="flex items-center gap-2">
                  <MobileListTitle>{item.technical_sheet?.name || 'Insumo'}</MobileListTitle>
                  <span className="ml-auto text-lg font-bold text-primary">
                    {Number(item.quantity).toFixed(1)} {item.unit}
                  </span>
                </div>

                <MobileListDetails>
                  <span className="font-mono text-xs">{item.batch_code}</span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatInBrasilia(parseSafeDate(item.production_date), 'dd/MM/yyyy')}
                  </span>
                  {item.expiration_date && (
                    <MobileListBadge
                      variant={status === 'expired' ? 'destructive' : status === 'warning' ? 'warning' : 'default'}
                    >
                      {status === 'expired' && <AlertTriangle className="h-3 w-3 mr-1" />}
                      Val: {formatInBrasilia(parseSafeDate(item.expiration_date), 'dd/MM')}
                    </MobileListBadge>
                  )}
                </MobileListDetails>
              </MobileListItem>
            );
          })}
        </MobileList>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Editar Insumo' : 'Adicionar Insumo Produzido'}</DialogTitle>
            <DialogDescription>
              Registre manualmente um insumo produzido
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Ficha Técnica (tipo insumo) *</Label>
              <Select
                value={formData.technicalSheetId}
                onValueChange={handleSheetSelect}
                disabled={!!editingItem}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {insumoSheets.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      Nenhuma ficha técnica do tipo "insumo" encontrada.
                      Crie uma ficha técnica e defina o tipo como "Insumo".
                    </div>
                  ) : (
                    insumoSheets.map(sheet => (
                      <SelectItem key={sheet.id} value={sheet.id}>
                        {sheet.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Quantidade *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.quantity}
                  onChange={(e) => setFormData(prev => ({ ...prev, quantity: e.target.value }))}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label>Unidade</Label>
                <Input
                  value={formData.unit}
                  onChange={(e) => setFormData(prev => ({ ...prev, unit: e.target.value }))}
                  placeholder="kg, L, un..."
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Código do Lote</Label>
              <Input
                value={formData.batchCode}
                onChange={(e) => setFormData(prev => ({ ...prev, batchCode: e.target.value }))}
                placeholder="Gerado automaticamente"
              />
            </div>

            <div className="space-y-2">
              <Label>Data de Validade</Label>
              <Input
                type="date"
                value={formData.expirationDate}
                onChange={(e) => setFormData(prev => ({ ...prev, expirationDate: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Input
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Opcional"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>
              {editingItem ? 'Salvar' : 'Adicionar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
