import { useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Edit, Trash2, Package, Search, AlertTriangle } from 'lucide-react';
import { useFinishedProductionsStock, FinishedProductionStock } from '@/hooks/ops/useFinishedProductionsStock';
import { formatQuantity } from '@/lib/utils';
import { useTechnicalSheets } from '@/hooks/ops/useTechnicalSheets';
import { ImageUpload } from '@/components/ImageUpload';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

type PracaType = 'all' | 'gelateria' | 'confeitaria' | 'padaria' | 'praca_quente' | 'bar' | 'sem_praca';

const PRACAS: { value: string; label: string }[] = [
  { value: 'gelateria', label: 'Gelateria' },
  { value: 'confeitaria', label: 'Confeitaria' },
  { value: 'padaria', label: 'Padaria' },
  { value: 'praca_quente', label: 'Praça Quente' },
  { value: 'bar', label: 'Bar' },
];

export default function EstoqueFinalizados() {
  const { finishedStock, isLoading, addFinishedProduction, updateFinishedProduction, deleteFinishedProduction, registerLoss } = useFinishedProductionsStock();
  const { sheets: technicalSheets } = useTechnicalSheets();

  const [search, setSearch] = useState('');
  const [pracaFilter, setPracaFilter] = useState<PracaType>('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<FinishedProductionStock | null>(null);
  const [lossDialogOpen, setLossDialogOpen] = useState(false);
  const [lossItem, setLossItem] = useState<FinishedProductionStock | null>(null);
  const [lossQuantity, setLossQuantity] = useState('1');

  // Unit options for finished products
  const UNIT_OPTIONS = ['unidade', 'kg', 'g', 'L', 'ml', 'fatia', 'porção', 'caixa', 'dz'];

  // Form state
  const [formData, setFormData] = useState({
    technical_sheet_id: '',
    quantity: '',
    unit: '',
    notes: '',
    image_url: '',
  });

  const filteredStock = finishedStock.filter(item => {
    const matchesSearch = item.technical_sheet?.name.toLowerCase().includes(search.toLowerCase());
    const matchesPraca = pracaFilter === 'all'
      || (pracaFilter === 'sem_praca' && !item.praca)
      || item.praca === pracaFilter;
    return matchesSearch && matchesPraca;
  });

  const handleAdd = () => {
    const sheet = technicalSheets.find(s => s.id === formData.technical_sheet_id);
    if (!sheet) return;

    addFinishedProduction.mutate({
      technical_sheet_id: formData.technical_sheet_id,
      quantity: Number(formData.quantity),
      unit: formData.unit || sheet.yield_unit,
      notes: formData.notes || undefined,
      image_url: formData.image_url || undefined,
    }, {
      onSuccess: () => {
        setIsAddDialogOpen(false);
        setFormData({ technical_sheet_id: '', quantity: '', unit: '', notes: '', image_url: '' });
      }
    });
  };

  const handleUpdate = () => {
    if (!editingItem) return;

    updateFinishedProduction.mutate({
      id: editingItem.id,
      quantity: Number(formData.quantity),
      unit: formData.unit || editingItem.unit,
      notes: formData.notes || undefined,
      image_url: formData.image_url || undefined,
    }, {
      onSuccess: () => {
        setEditingItem(null);
        setFormData({ technical_sheet_id: '', quantity: '', unit: '', notes: '', image_url: '' });
      }
    });
  };

  const openEditDialog = (item: FinishedProductionStock) => {
    setEditingItem(item);
    setFormData({
      technical_sheet_id: item.technical_sheet_id,
      quantity: String(item.quantity),
      unit: item.unit || '',
      notes: item.notes || '',
      image_url: item.image_url || '',
    });
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <PageHeader
        title="Produções Finalizadas"
        description="Produções prontas para venda"
      />

      <div className="flex gap-2 mb-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <Input
            placeholder="Buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-7 h-8 text-xs"
          />
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

        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="h-8 text-xs">
              <Plus className="h-3 w-3 mr-1" />
              Adicionar
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-base">Adicionar Produção</DialogTitle>
            <DialogDescription className="sr-only">Detalhes do diálogo</DialogDescription>
</DialogHeader>
            <div className="space-y-3 py-2">
              {/* Image Upload */}
              <div className="flex items-start gap-3">
                <ImageUpload
                  currentImageUrl={formData.image_url || null}
                  onImageUploaded={(url) => setFormData({ ...formData, image_url: url })}
                  onImageRemoved={() => setFormData({ ...formData, image_url: '' })}
                  bucket="finished-production-images"
                  size="md"
                />
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Ficha Técnica</Label>
                  <Select
                    value={formData.technical_sheet_id}
                    onValueChange={(v) => {
                      const sheet = technicalSheets.find(s => s.id === v);
                      setFormData({
                        ...formData,
                        technical_sheet_id: v,
                        unit: sheet?.yield_unit || ''
                      });
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {technicalSheets.map((sheet) => (
                        <SelectItem key={sheet.id} value={sheet.id} className="text-xs">
                          {sheet.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Quantidade</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    placeholder="Ex: 10"
                    className="h-8 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Unidade</Label>
                  <Select
                    value={formData.unit}
                    onValueChange={(v) => setFormData({ ...formData, unit: v })}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {UNIT_OPTIONS.map((unit) => (
                        <SelectItem key={unit} value={unit} className="text-xs">
                          {unit}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Observações</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Opcional..."
                  className="h-16 text-xs resize-none"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setIsAddDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleAdd}
                disabled={!formData.technical_sheet_id || !formData.quantity || addFinishedProduction.isPending}
              >
                Adicionar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingItem} onOpenChange={(open) => !open && setEditingItem(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Editar Quantidade</DialogTitle>
          <DialogDescription className="sr-only">Detalhes do diálogo</DialogDescription>
</DialogHeader>
          <div className="space-y-3 py-2">
            {/* Image Upload */}
            <div className="flex items-start gap-3">
              <ImageUpload
                currentImageUrl={formData.image_url || null}
                onImageUploaded={(url) => setFormData({ ...formData, image_url: url })}
                onImageRemoved={() => setFormData({ ...formData, image_url: '' })}
                bucket="finished-production-images"
                size="md"
              />
              <div className="flex-1 space-y-1">
                <Label className="text-xs">Produto</Label>
                <Input value={editingItem?.technical_sheet?.name || ''} disabled className="h-8 text-xs" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Nova Quantidade</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Unidade</Label>
                <Select
                  value={formData.unit}
                  onValueChange={(v) => setFormData({ ...formData, unit: v })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {UNIT_OPTIONS.map((unit) => (
                      <SelectItem key={unit} value={unit} className="text-xs">
                        {unit}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Observações</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="h-16 text-xs resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditingItem(null)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleUpdate}
              disabled={!formData.quantity || updateFinishedProduction.isPending}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Loss Dialog */}
      <Dialog open={lossDialogOpen} onOpenChange={setLossDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Registrar Perda
            </DialogTitle>
          <DialogDescription className="sr-only">Detalhes do diálogo</DialogDescription>
</DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs">Produto</Label>
              <Input value={lossItem?.technical_sheet?.name || ''} disabled className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Quantidade a perder</Label>
              <Input
                type="number"
                min="1"
                max={lossItem ? Number(lossItem.quantity) : 1}
                step="1"
                value={lossQuantity}
                onChange={(e) => setLossQuantity(e.target.value)}
                className="h-8 text-xs"
              />
              <p className="text-xs text-muted-foreground">
                Disponível: {lossItem ? formatQuantity(Number(lossItem.quantity)) : 0} {lossItem?.unit}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setLossDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => {
                if (lossItem) {
                  registerLoss.mutate({ id: lossItem.id, quantity: Number(lossQuantity) }, {
                    onSuccess: () => {
                      setLossDialogOpen(false);
                      setLossItem(null);
                      setLossQuantity('1');
                    }
                  });
                }
              }}
              disabled={!lossItem || !lossQuantity || Number(lossQuantity) <= 0 || registerLoss.isPending}
            >
              Registrar Perda
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stock Cards - Grid with image on left */}
      <div className="flex-1 overflow-auto">
        {filteredStock.length === 0 ? (
          <Card className="h-full flex items-center justify-center">
            <CardContent className="flex flex-col items-center justify-center py-8">
              <Package className="h-10 w-10 text-muted-foreground mb-3" />
              <h3 className="text-sm font-semibold mb-1">Nenhuma produção</h3>
              <p className="text-xs text-muted-foreground text-center">
                Adicione produções finalizadas
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredStock.map((item) => {
              const imageUrl = item.image_url || item.technical_sheet?.image_url;
              return (
                <Card key={item.id} className="flex overflow-hidden">
                  {/* Image on left */}
                  <div className="w-24 h-24 shrink-0 bg-muted flex items-center justify-center">
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={item.technical_sheet?.name || 'Produto'}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Package className="h-8 w-8 text-muted-foreground" />
                    )}
                  </div>

                  {/* Content on right */}
                  <div className="flex-1 p-3 flex flex-col justify-between min-w-0">
                    <div>
                      <h3 className="font-medium text-sm truncate">
                        {item.technical_sheet?.name || 'Desconhecido'}
                      </h3>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge variant={Number(item.quantity) > 0 ? 'default' : 'destructive'} className="text-xs">
                          {formatQuantity(Number(item.quantity))} {item.unit}
                        </Badge>
                        {item.praca && (
                          <Badge variant="outline" className="text-xs">
                            {PRACAS.find(p => p.value === item.praca)?.label || item.praca}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-1 mt-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => openEditDialog(item)}
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => {
                          setLossItem(item);
                          setLossQuantity('1');
                          setLossDialogOpen(true);
                        }}
                      >
                        <AlertTriangle className="h-3.5 w-3.5" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle className="text-base">Remover item?</AlertDialogTitle>
                            <AlertDialogDescription className="text-xs">
                              Remover "{item.technical_sheet?.name}" do estoque.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteFinishedProduction.mutate(item.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Remover
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
