import { useState, useRef, useEffect, useCallback } from 'react';
import { FileText, Upload, Loader2, Check, AlertTriangle, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useStockItems, type StockCategory, type StockUnit } from '@/hooks/useStockItems';
import { formatQuantity, cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface InvoiceImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = 'upload' | 'ai_processing' | 'mapping' | 'saving';

interface ExtractionItem {
  id?: string;
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  category?: string;
}

interface MappedItem extends ExtractionItem {
  matchedId: string | 'new' | null;
  category?: StockCategory;
}

export function InvoiceImportDialog({
  open,
  onOpenChange,
}: InvoiceImportDialogProps) {
  const { items: existingItems, processInvoiceImport } = useStockItems();
  const [step, setStep] = useState<Step>('upload');
  const [isProcessing, setIsProcessing] = useState(false);
  const [importId, setImportId] = useState<string | null>(null);
  const [nfeData, setNfeData] = useState<any>(null);
  const [mappedItems, setMappedItems] = useState<MappedItem[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = useCallback(() => {
    setStep('upload');
    setNfeData(null);
    setMappedItems([]);
    setImportId(null);
    setIsProcessing(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const handleComplete = useCallback((data: any) => {
    setNfeData(data);
    
    // Auto-match items by name
    const initialMapping = data.items.map((item: any) => {
      const match = existingItems.find(
        ei => ei.name.toLowerCase() === item.name.toLowerCase()
      );
      return {
        ...item,
        matchedId: match ? match.id : null,
        category: match ? match.category as StockCategory : (item.category || 'outros') as StockCategory
      };
    });
    
    setMappedItems(initialMapping);
    setStep('mapping');
    toast.success('Nota Fiscal processada pela IA!');
  }, [existingItems]);

  // Realtime Subscription
  useEffect(() => {
    if (!importId || step !== 'ai_processing') return;

    const channel = supabase
      .channel('invoice_import_status')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'invoice_imports',
          filter: `id=eq.${importId}`,
        },
        (payload) => {
          const newRecord = payload.new as any;
          console.log('Realtime Status Update:', newRecord.status);
          
          if (newRecord.status === 'completed' && newRecord.extracted_data) {
            handleComplete(newRecord.extracted_data);
          } else if (newRecord.status === 'error') {
            toast.error(newRecord.error_message || 'Erro no processamento da IA');
            resetState();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [importId, step, handleComplete, resetState]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const resp = await fetch('/api/invoices/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error);

      setImportId(result.importId);
      setStep('ai_processing');
    } catch (err: any) {
      toast.error(`Erro no upload: ${err.message}`);
      setIsProcessing(false);
    }
  };

  const handleConfirmImport = async () => {
    const unmapped = mappedItems.filter(i => !i.matchedId);
    if (unmapped.length > 0) {
      toast.error(`Ainda existem ${unmapped.length} itens não mapeados.`);
      return;
    }

    setIsProcessing(true);
    setStep('saving');

    try {
      await processInvoiceImport.mutateAsync({
        nfeData,
        mappedItems
      });

      onOpenChange(false);
      resetState();
    } catch (error) {
      // Error handled by mutation toast
    } finally {
      setIsProcessing(false);
    }
  };

  const updateMapping = (index: number, matchedId: string | 'new' | null) => {
    setMappedItems(prev => {
      const next = [...prev];
      next[index] = { ...next[index], matchedId };
      return next;
    });
  };

  const updateCategory = (index: number, category: StockCategory) => {
    setMappedItems(prev => {
      const next = [...prev];
      next[index] = { ...next[index], category };
      return next;
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if(!o) resetState(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Importar Nota Fiscal (Flash AI)
          </DialogTitle>
          <DialogDescription>
            Upgrade: Extração ultra-rápida via Gemini Flash com processamento em segundo plano.
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
               onClick={() => !isProcessing && fileInputRef.current?.click()}>
            {isProcessing ? (
              <Loader2 className="h-10 w-10 text-primary animate-spin mb-4" />
            ) : (
              <Upload className="h-10 w-10 text-muted-foreground mb-4" />
            )}
            <p className="text-sm font-medium">
              {isProcessing ? 'Enviando arquivo...' : 'Clique para selecionar o arquivo (XML, PDF ou Foto)'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Sua nota será processada em background</p>
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileChange}
              className="hidden"
              disabled={isProcessing}
            />
          </div>
        )}

        {step === 'ai_processing' && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <div className="relative">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-primary">AI</div>
            </div>
            <div className="text-center">
              <p className="font-medium">O Gemini Flash está analisando sua nota...</p>
              <p className="text-xs text-muted-foreground">Isso geralmente leva menos de 10 segundos.</p>
            </div>
          </div>
        )}

        {step === 'mapping' && nfeData && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 p-3 bg-muted rounded-lg text-sm">
              <div>
                <p className="text-muted-foreground text-xs uppercase font-bold">Fornecedor</p>
                <p className="font-medium truncate">{nfeData.supplierName}</p>
                <p className="text-xs text-muted-foreground">{nfeData.supplierCnpj || 'CNPJ não identificado'}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs uppercase font-bold">Nota Fiscal</p>
                <p className="font-medium">Nº {nfeData.invoiceNumber}</p>
                <p className="text-xs text-muted-foreground">Valor: R$ {nfeData.totalValue.toFixed(2)}</p>
              </div>
            </div>

            <ScrollArea className="h-[40vh] border rounded-md p-2">
              <div className="space-y-3">
                {mappedItems.map((item, index) => (
                  <div key={index} className="p-3 border rounded-lg bg-background hover:border-primary/30 transition-colors">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1 min-w-0 mr-4">
                        <p className="text-sm font-bold truncate" title={item.name}>{item.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatQuantity(item.quantity)} {item.unit} • R$ {item.unitPrice.toFixed(2)}/un
                        </p>
                      </div>
                      <Badge variant={item.matchedId ? 'default' : 'destructive'} className="shrink-0 text-[10px] h-5">
                        {item.matchedId === 'new' ? 'Novo Cadastro' : item.matchedId ? 'Mapeado' : 'Não Mapeado'}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 gap-2">
                      <Select
                        value={item.matchedId || ''}
                        onValueChange={(val) => updateMapping(index, val)}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Selecione o item no sistema..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="new" className="font-bold text-primary">
                            <Plus className="h-3 w-3 mr-2 inline" />
                            Cadastrar como novo item
                          </SelectItem>
                          {existingItems.map(ei => (
                            <SelectItem key={ei.id} value={ei.id}>
                              {ei.name} ({formatQuantity(Number(ei.current_quantity))} {ei.unit})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {item.matchedId === 'new' && (
                        <Select
                          value={item.category || 'outros'}
                          onValueChange={(val) => updateCategory(index, val as StockCategory)}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Categoria..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="laticinios">Laticínios</SelectItem>
                            <SelectItem value="secos_e_graos">Secos e Grãos</SelectItem>
                            <SelectItem value="hortifruti">Hortifruti</SelectItem>
                            <SelectItem value="carnes_e_peixes">Carnes e Peixes</SelectItem>
                            <SelectItem value="embalagens">Embalagens</SelectItem>
                            <SelectItem value="limpeza">Limpeza</SelectItem>
                            <SelectItem value="outros">Outros</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {step === 'saving' && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-muted-foreground">Finalizando importação e atualizando estoque...</p>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {step === 'mapping' && (
            <>
              <Button variant="outline" onClick={() => setStep('upload')} disabled={isProcessing}>
                Reiniciar
              </Button>
              <Button onClick={handleConfirmImport} disabled={isProcessing}>
                {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                Confirmar Entrada
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
