import { useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Trash2, TrendingDown, Search, Package, PackageCheck, AlertCircle } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { useLosses, LossInput } from '@/hooks/stock/useLosses';
import { useStockItems } from '@/hooks/stock/useStockItems';
import { useFinishedProductionsStock } from '@/hooks/ops/useFinishedProductionsStock';
import { useProductCosts } from '@/hooks/financial/useProductCosts';
import { formatInBrasilia, formatQuantity } from '@/lib/utils';

const SOURCE_TYPE_LABELS: Record<string, string> = {
  stock_item: 'Insumo',
  finished_production: 'Produção Finalizada',
};

export default function Perdas() {
  const { losses, isLoading, createLoss, deleteLoss } = useLosses();
  const { items: stockItems } = useStockItems();
  const { finishedStock } = useFinishedProductionsStock();
  const { productCosts } = useProductCosts();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [sourceType, setSourceType] = useState<string>('stock_item');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [deductStock, setDeductStock] = useState(true);

  const filteredLosses = losses.filter(l =>
    l.source_name.toLowerCase().includes(search.toLowerCase())
  );

  const totalLosses = losses.reduce((sum, l) => sum + (l.estimated_value || 0), 0);

  const getAvailableItems = () => {
    if (sourceType === 'stock_item') {
      return stockItems.map(i => ({
        id: i.id,
        name: i.name,
        unit: i.unit,
        unitPrice: i.unit_price || 0,
      }));
    }
    return finishedStock.map(f => {
      // Try to find the cost from productCosts based on the technical sheet
      const costInfo = productCosts.find(cp => cp.id === f.technical_sheet_id);
      return {
        id: f.id,
        name: f.technical_sheet?.name || 'Sem nome',
        unit: f.unit,
        unitPrice: costInfo?.totalCost || 0,
      };
    });
  };

  const handleSubmit = () => {
    const items = getAvailableItems();
    const selected = items.find(i => i.id === selectedItemId);
    if (!selected || !quantity) return;

    const qty = parseFloat(quantity);
    const input: LossInput = {
      source_type: sourceType,
      source_id: selectedItemId,
      source_name: selected.name,
      quantity: qty,
      unit: selected.unit,
      estimated_value: selected.unitPrice * qty,
      notes: notes || undefined,
    };

    createLoss.mutate({ ...input, deductStock }, {
      onSuccess: () => {
        setIsDialogOpen(false);
        resetForm();
      },
    });
  };

  const resetForm = () => {
    setSourceType('stock_item');
    setSelectedItemId('');
    setQuantity('');
    setNotes('');
    setDeductStock(true);
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <PageHeader
        title="Perdas"
        description="Registre perdas de insumos e produções finalizadas"
      />

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar perdas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={() => setIsDialogOpen(true)} size="lg" className="w-full sm:w-auto">
          <Plus className="h-5 w-5 mr-2" />
          Registrar Perda
        </Button>
      </div>

      {/* Summary */}
      <Card>
        <CardContent className="p-4 flex items-center gap-3">
          <TrendingDown className="h-6 w-6 text-destructive" />
          <div>
            <p className="text-sm text-muted-foreground">Total de Perdas</p>
            <p className="text-xl font-bold text-destructive">R$ {totalLosses.toFixed(2)}</p>
          </div>
          <Badge variant="destructive" className="ml-auto">{losses.length} registros</Badge>
        </CardContent>
      </Card>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : filteredLosses.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhuma perda registrada.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Qtd</TableHead>
                    <TableHead>Unid.</TableHead>
                    <TableHead className="text-right">Valor Est.</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLosses.map((loss) => (
                    <TableRow key={loss.id}>
                      <TableCell className="text-sm">
                        {formatInBrasilia(loss.created_at, 'dd/MM/yyyy')}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {loss.source_type === 'stock_item' ? (
                            <><Package className="h-3 w-3 mr-1" />Insumo</>
                          ) : (
                            <><PackageCheck className="h-3 w-3 mr-1" />Produção</>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{loss.source_name}</TableCell>
                      <TableCell className="text-right">{formatQuantity(loss.quantity)}</TableCell>
                      <TableCell>{loss.unit}</TableCell>
                      <TableCell className="text-right text-destructive">
                        R$ {(loss.estimated_value || 0).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                        {loss.notes || '-'}
                      </TableCell>
                      <TableCell>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remover perda?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta ação não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteLoss.mutate(loss.id)}>
                                Remover
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(o) => { setIsDialogOpen(o); if (!o) resetForm(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Perda</DialogTitle>
          <DialogDescription className="sr-only">Detalhes do diálogo</DialogDescription>
</DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={sourceType} onValueChange={(v) => { setSourceType(v); setSelectedItemId(''); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="stock_item">Insumo</SelectItem>
                  <SelectItem value="finished_production">Produção Finalizada</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Item</Label>
              <Select value={selectedItemId} onValueChange={setSelectedItemId}>
                <SelectTrigger><SelectValue placeholder="Selecione o item" /></SelectTrigger>
                <SelectContent>
                  {getAvailableItems().map(item => (
                    <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Quantidade</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="Ex: 2.5"
              />
            </div>

            <div className="flex items-center space-x-2 py-2">
              <Checkbox
                id="deductStock"
                checked={deductStock}
                onCheckedChange={(checked) => setDeductStock(checked as boolean)}
              />
              <Label htmlFor="deductStock" className="text-sm font-medium cursor-pointer">
                Abater automaticamente do estoque
              </Label>
            </div>

            <div className="space-y-2">
              <Label>Motivo (opcional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: Produto vencido, quebra, etc."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsDialogOpen(false); resetForm(); }}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!selectedItemId || !quantity || createLoss.isPending}
            >
              {createLoss.isPending ? 'Salvando...' : 'Registrar Perda'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
