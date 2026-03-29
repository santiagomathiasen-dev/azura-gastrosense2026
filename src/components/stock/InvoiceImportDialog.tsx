import { useState, useRef, useEffect, useCallback } from 'react';
import { FileText, Upload, Loader2, Check, AlertTriangle, Plus, Search, RefreshCw } from 'lucide-react';
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
type ProcessingStage = 'reading' | 'sending' | 'processing' | null;

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

// ── helpers ────────────────────────────────────────────────────────────────

// Converts any file to a raw base64 string (no data: prefix).
// Gemini supports application/pdf natively, so we send the full binary — works
// for both digital and scanned/image-based PDFs, unlike text extraction.
function pdfToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = () => reject(new Error('Falha ao ler PDF'));
    reader.readAsDataURL(file);
  });
}

async function compressImage(file: File, maxWidth = 800, quality = 0.6): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const scale = Math.min(1, maxWidth / img.width);
      const canvas = document.createElement('canvas');
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas não suportado')); return; }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      resolve(dataUrl.split(',')[1]);
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Falha ao ler imagem')); };
    img.src = objectUrl;
  });
}

// ── component ──────────────────────────────────────────────────────────────

export function InvoiceImportDialog({
  open,
  onOpenChange,
}: InvoiceImportDialogProps) {
  const { items: existingItems, processInvoiceImport } = useStockItems();
  const [step, setStep] = useState<Step>('upload');
  const [processingStage, setProcessingStage] = useState<ProcessingStage>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importId, setImportId] = useState<string | null>(null);
  const [nfeData, setNfeData] = useState<any>(null);
  const [mappedItems, setMappedItems] = useState<MappedItem[]>([]);
  const [lastFile, setLastFile] = useState<File | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = useCallback(() => {
    setStep('upload');
    setProcessingStage(null);
    setNfeData(null);
    setMappedItems([]);
    setImportId(null);
    setIsProcessing(false);
    setLastFile(null);
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

  // Realtime Subscription (legacy fallback — not used in the direct Edge Function flow)
  useEffect(() => {
    if (!importId || step !== 'ai_processing') return;

    let mounted = true;

    const channel = supabase
      .channel(`invoice_import_status_${importId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'invoice_imports',
          filter: `id=eq.${importId}`,
        },
        (payload) => {
          if (!mounted) return;
          const newRecord = payload.new as any;

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
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [importId, step, handleComplete, resetState]);

  const processFile = useCallback(async (file: File) => {
    setLastFile(file);
    setIsProcessing(true);
    setStep('ai_processing');

    // Timeout de 90s — Gemini pode ter até 3 retries com 15-45s de espera
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90_000);

    try {
      let content: string;
      let fileType: string;
      let mimeType: string;

      const isPdf = file.type === 'application/pdf';
      const isImage = file.type.startsWith('image/');

      if (isPdf) {
        // Envia PDF via Supabase Storage para evitar limite de 1MB do Edge Function.
        // PDF em base64 costuma ultrapassar o limite → erro 546 WORKER_LIMIT.
        setProcessingStage('reading');
        const { data: { session } } = await supabase.auth.getSession();
        const uid = session?.user?.id;
        if (!uid) throw new Error('Usuário não autenticado.');
        const tempPath = `${uid}/temp_${Date.now()}_${file.name}`;
        const { error: uploadErr } = await supabase.storage.from('invoices').upload(tempPath, file);
        if (uploadErr) throw new Error(`Falha ao preparar arquivo: ${uploadErr.message}`);
        // Passa o path — Edge Function baixa diretamente do Storage
        setProcessingStage('sending');
        const { data: extractedData, error: extractError } = await supabase.functions.invoke(
          'extract-ingredients',
          { body: { storagePath: tempPath, fileType: 'pdf', mimeType: 'application/pdf', extractRecipe: false } }
        );
        clearTimeout(timeout);
        if (extractError) throw new Error(`Erro na extração: ${extractError.message}`);
        if (extractedData?.error) throw new Error(extractedData.error);
        setProcessingStage('processing');
        const { data: { session: s2 } } = await supabase.auth.getSession();
        if (s2?.user) {
          const { data: importRecord } = await supabase.from('invoice_imports').insert({
            user_id: s2.user.id, status: 'completed',
            supplier_name: extractedData.fornecedor ?? null,
            invoice_number: extractedData.numero_nota ?? null,
            emission_date: extractedData.data_emissao ?? null,
            total_value: extractedData.valor_total ?? null,
            items_count: extractedData.ingredients?.length ?? 0,
            extracted_data: extractedData,
          }).select('id').single();
          if (importRecord?.id) setImportId(importRecord.id);
        }
        const normalized = {
          supplierName: extractedData.fornecedor ?? 'Fornecedor não identificado',
          supplierCnpj: null, invoiceNumber: extractedData.numero_nota ?? '-',
          totalValue: extractedData.valor_total ?? 0,
          items: (extractedData.ingredients ?? []).map((ing: any) => ({
            name: ing.name, quantity: ing.quantity, unit: ing.unit,
            unitPrice: ing.price ?? 0, category: ing.category,
          })),
        };
        setProcessingStage(null);
        handleComplete(normalized);
        return; // handled above — skip rest of processFile
      } else if (isImage) {
        // Comprime imagem — reduz payload em ~70%
        setProcessingStage('reading');
        content = await compressImage(file);
        fileType = 'image';
        mimeType = 'image/jpeg';
      } else {
        throw new Error('Tipo de arquivo não suportado. Use PDF ou imagem.');
      }

      // 3. Envia para Edge Function
      setProcessingStage('sending');
      const { data: extractedData, error: extractError } = await supabase.functions.invoke(
        'extract-ingredients',
        {
          body: { content, fileType, mimeType, extractRecipe: false },
        }
      );

      clearTimeout(timeout);

      if (extractError) throw new Error(`Erro na extração: ${extractError.message}`);
      if (extractedData?.error) throw new Error(extractedData.error);

      // 4. Processa resultado
      setProcessingStage('processing');

      // Salva registro no banco
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: importRecord } = await supabase
          .from('invoice_imports')
          .insert({
            user_id: session.user.id,
            status: 'completed',
            supplier_name: extractedData.fornecedor ?? null,
            invoice_number: extractedData.numero_nota ?? null,
            emission_date: extractedData.data_emissao ?? null,
            total_value: extractedData.valor_total ?? null,
            items_count: extractedData.ingredients?.length ?? 0,
            extracted_data: extractedData,
          })
          .select('id')
          .single();
        if (importRecord?.id) setImportId(importRecord.id);
      }

      // Normaliza campos para o formato interno
      const normalized = {
        supplierName: extractedData.fornecedor ?? 'Fornecedor não identificado',
        supplierCnpj: null,
        invoiceNumber: extractedData.numero_nota ?? '-',
        totalValue: extractedData.valor_total ?? 0,
        items: (extractedData.ingredients ?? []).map((ing: any) => ({
          name: ing.name,
          quantity: ing.quantity,
          unit: ing.unit,
          unitPrice: ing.price ?? 0,
          category: ing.category,
        })),
      };

      setProcessingStage(null);
      handleComplete(normalized);
    } catch (err: any) {
      clearTimeout(timeout);
      const isTimeout = err?.name === 'AbortError';
      toast.error(
        isTimeout
          ? 'Tempo limite excedido (90s). Verifique sua conexão e tente novamente.'
          : `Erro ao processar nota: ${err.message}`
      );
      setStep('upload');
      setProcessingStage(null);
      setIsProcessing(false);
    }
  }, [handleComplete]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
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
            <div className="text-center space-y-1">
              {processingStage === 'reading' && (
                <>
                  <p className="font-medium">Lendo arquivo...</p>
                  <p className="text-xs text-muted-foreground">Extraindo texto localmente</p>
                </>
              )}
              {processingStage === 'sending' && (
                <>
                  <p className="font-medium">Enviando para IA...</p>
                  <p className="text-xs text-muted-foreground">Payload otimizado — menos de 10KB</p>
                </>
              )}
              {(processingStage === 'processing' || !processingStage) && (
                <>
                  <p className="font-medium">Processando com IA...</p>
                  <p className="text-xs text-muted-foreground">Gemini está analisando sua nota</p>
                </>
              )}
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
          {step === 'upload' && lastFile && (
            <Button variant="outline" onClick={() => processFile(lastFile)} disabled={isProcessing}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Tentar novamente
            </Button>
          )}
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
