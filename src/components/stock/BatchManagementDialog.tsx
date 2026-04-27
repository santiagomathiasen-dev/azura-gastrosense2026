import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trash2, Plus, Calendar, Package, Hash } from 'lucide-react';
import { useExpiryDates, parseSafeDate } from '@/hooks/stock/useExpiryDates';
import { toast } from 'sonner';

interface BatchManagementDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    stockItemId: string;
    stockItemName: string;
}

export function BatchManagementDialog({
    open,
    onOpenChange,
    stockItemId,
    stockItemName
}: BatchManagementDialogProps) {
    const { expiryDates, addExpiryDate, removeExpiryDate, updateExpiryQuantity } = useExpiryDates(stockItemId);
    const [newDate, setNewDate] = useState('');
    const [newBatch, setNewBatch] = useState('');
    const [newQty, setNewQty] = useState('');

    const handleAdd = async () => {
        if (!newDate) {
            toast.error('Informe a data de validade');
            return;
        }

        try {
            await addExpiryDate.mutateAsync({
                stock_item_id: stockItemId,
                expiry_date: newDate,
                batch_name: newBatch || undefined,
                quantity: newQty ? parseFloat(newQty) : 0,
            });

            setNewDate('');
            setNewBatch('');
            setNewQty('');
        } catch (error: any) {
            toast.error(`Erro ao adicionar lote: ${error?.message ?? 'Tente novamente'}`);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col overflow-hidden">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        Gerenciar Lotes: {stockItemName}
                    </DialogTitle>
                <DialogDescription className="sr-only">Detalhes do diálogo</DialogDescription>
</DialogHeader>

                <div className="flex-1 overflow-y-auto space-y-4 py-4 pr-2">
                    {/* Add New Batch Form - Compact Horizontal */}
                    <div className="p-3 bg-muted/50 rounded-lg border border-dashed border-primary/30">
                        <p className="text-xs font-semibold mb-2 uppercase text-primary">Adicionar Novo Lote</p>
                        <div className="grid grid-cols-12 gap-2 items-end">
                            <div className="col-span-4 space-y-1">
                                <Label className="text-[10px]">Data de Validade</Label>
                                <Input
                                    type="date"
                                    className="h-8 text-xs"
                                    value={newDate}
                                    onChange={(e) => setNewDate(e.target.value)}
                                />
                            </div>
                            <div className="col-span-4 space-y-1">
                                <Label className="text-[10px]">Lote (opcional)</Label>
                                <Input
                                    placeholder="Nº Lote"
                                    className="h-8 text-xs"
                                    value={newBatch}
                                    onChange={(e) => setNewBatch(e.target.value)}
                                />
                            </div>
                            <div className="col-span-3 space-y-1">
                                <Label className="text-[10px]">Qtd</Label>
                                <Input
                                    type="number"
                                    placeholder="0"
                                    className="h-8 text-xs"
                                    value={newQty}
                                    onChange={(e) => setNewQty(e.target.value)}
                                />
                            </div>
                            <div className="col-span-1">
                                <Button size="icon" className="h-8 w-8" onClick={handleAdd} disabled={addExpiryDate.isPending}>
                                    <Plus className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Existing Batches List */}
                    <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase text-muted-foreground">Lotes Ativos ({expiryDates.length})</p>
                        {expiryDates.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground border rounded-lg bg-background">
                                Nenhum lote cadastrado
                            </div>
                        ) : (
                            <div className="grid gap-2">
                                {expiryDates.filter(b => Number(b.quantity) > 0).map((batch) => (
                                    <div key={batch.id} className="flex items-center gap-3 p-3 bg-background rounded-lg border shadow-sm group">
                                        <div className="flex-1 grid grid-cols-12 gap-2">
                                            <div className="col-span-5 flex items-center gap-2">
                                                <Calendar className="h-3 w-3 text-muted-foreground" />
                                                <span className="font-medium text-sm">
                                                    {parseSafeDate(batch.expiry_date).toLocaleDateString('pt-BR')}
                                                </span>
                                            </div>
                                            <div className="col-span-4 flex items-center gap-2 truncate">
                                                <Hash className="h-3 w-3 text-muted-foreground" />
                                                <span className="text-xs text-muted-foreground">
                                                    {batch.batch_name || 's/ lote'}
                                                </span>
                                            </div>
                                            <div className="col-span-3 flex items-center gap-2 group/qty">
                                                <Package className="h-3 w-3 text-muted-foreground" />
                                                <Input
                                                    type="number"
                                                    defaultValue={batch.quantity}
                                                    className="h-7 text-xs w-full px-1 border-transparent hover:border-muted group-hover/qty:border-muted focus:border-primary bg-transparent"
                                                    onBlur={(e) => {
                                                        const val = parseFloat(e.target.value);
                                                        if (!isNaN(val) && val !== batch.quantity) {
                                                            updateExpiryQuantity.mutate({ id: batch.id, quantity: val });
                                                        }
                                                    }}
                                                />
                                            </div>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-destructive opacity-20 group-hover:opacity-100 transition-opacity"
                                            onClick={() => removeExpiryDate.mutate(batch.id)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter className="border-t pt-4">
                    <Button variant="outline" className="w-full" onClick={() => onOpenChange(false)}>
                        Fechar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
