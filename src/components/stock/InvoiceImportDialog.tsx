import { useState, useRef, useEffect, useCallback } from 'react';
import { FileText, Upload, Loader2, Check, AlertTriangle, Plus, Search, RefreshCw, Camera, AlignLeft } from 'lucide-react';
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
import { useStockItems, type StockCategory, type StockUnit } from '@/hooks/stock/useStockItems';
import { formatQuantity, cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { parseNfeXml } from '@/lib/xml-parser';
import { scanQrCode } from '@/lib/qr-reader';
import { convertPdfToImage, extractTextFromPdf } from '@/lib/pdf-handler';

interface InvoiceImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = 'upload' | 'ai_processing' | 'mapping' | 'saving';
type ProcessingStage = 'reading' | 'sending' | 'processing' | null;
type ExtractMode = 'nfe' | 'visual_list' | 'text_data';

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

// Compress image and return as File (JPEG). Falls back to original on error.
function compressImageToFile(file: File, maxPx = 1200, quality = 0.75): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxPx || height > maxPx) {
        if (width > height) { height = Math.round(height * maxPx / width); width = maxPx; }
        else { width = Math.round(width * maxPx / height); height = maxPx; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => resolve(new File([blob!], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' })),
        'image/jpeg', quality
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
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
  const [extractMode, setExtractMode] = useState<ExtractMode>('nfe');

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

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90_000);

    try {
      setProcessingStage('reading');
      let fileToSend: File = file;

      // RULE 2: Force XML for NFe
      if (extractMode === 'nfe') {
        if (file.name.toLowerCase().endsWith('.xml')) {
           setProcessingStage('processing');
           const text = await file.text();
           const parsed = parseNfeXml(text);
           setProcessingStage(null);
           handleComplete(parsed);
           return;
        }

        // RULE 1: QR Code
        if (file.type.startsWith('image/')) {
           const qr = await scanQrCode(file);
           if (qr) {
             toast.success('Capturei a chave de acesso via QR Code!');
             toast.info(`O sistema irá baixar o XML oficial da chave: ${qr}. (Simulação Ativa)`, { duration: 8000 });
             setStep('upload'); 
             setIsProcessing(false);
             setProcessingStage(null);
             return;
           } else {
             throw new Error('Não encontrei um QR code nesta foto. Por favor, envie o arquivo XML oficial para registrar a nota com precisão.');
           }
        }

        // Reject PDF for NFe
        if (file.type === 'application/pdf') {
          throw new Error('Rejeitado: Envie o XML. A leitura de PDF de DANFE com IA foi desativada para evitar erros. Use o XML (100% preciso) ou foto do QR Code.');
        }
      }

      // RULE 3: visual_list -> Convert PDF to JPG Image natively
      if (extractMode === 'visual_list' && fileToSend.type === 'application/pdf') {
        toast.info('Construindo imagem de alta resolução do PDF...');
        fileToSend = await convertPdfToImage(fileToSend);
      }

      // RULE 4: text_data -> Extract raw text from PDF deterministically
      if (extractMode === 'text_data' && fileToSend.type === 'application/pdf') {
        toast.info('Extraindo texto bruto do PDF via OCR Clássico...');
        const rawText = await extractTextFromPdf(fileToSend);
        fileToSend = new File([rawText], fileToSend.name.replace('.pdf', '.txt'), { type: 'text/plain' });
      }

      // Compress images client-side to reduce upload bandwidth (skips if it became text. applies to images/PDF-Images)
      if (fileToSend.type.startsWith('image/')) {
        fileToSend = await compressImageToFile(fileToSend, 1200, 0.75);
      }

      setProcessingStage('sending');
      const formData = new FormData();
      formData.append('file', fileToSend, fileToSend.name);
      formData.append('extractRecipe', 'false');
      formData.append('saveToDb', 'true');
      formData.append('extractMode', extractMode); // Send the mode to Backend for processing rules

      const res = await fetch('/api/invoices/upload', {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Erro HTTP ${res.status}`);
      }

      setProcessingStage('processing');
      const extractedData = await res.json();

      if (extractedData?.error) throw new Error(extractedData.error);

      if (extractedData.importId) setImportId(extractedData.importId);

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
  }, [handleComplete, extractMode]);

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
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <Button 
                variant={extractMode === 'nfe' ? 'default' : 'outline'} 
                onClick={() => setExtractMode('nfe')}
                className="h-auto py-3 px-2 flex flex-col gap-1 items-center justify-center text-xs"
              >
                <FileText className="h-4 w-4" />
                <span className="text-center font-bold">Nota Fiscal<br/><span className="font-normal opacity-80">(XML/QR Code)</span></span>
              </Button>
              <Button 
                variant={extractMode === 'visual_list' ? 'default' : 'outline'} 
                onClick={() => setExtractMode('visual_list')}
                className="h-auto py-3 px-2 flex flex-col gap-1 items-center justify-center text-xs"
              >
                <Camera className="h-4 w-4" />
                <span className="text-center font-bold">Listas/Tabelas<br/><span className="font-normal opacity-80">(IA Visual)</span></span>
              </Button>
              <Button 
                variant={extractMode === 'text_data' ? 'default' : 'outline'} 
                onClick={() => setExtractMode('text_data')}
                className="h-auto py-3 px-2 flex flex-col gap-1 items-center justify-center text-xs"
              >
                <AlignLeft className="h-4 w-4" />
                <span className="text-center font-bold">Fichas Longas<br/><span className="font-normal opacity-80">(IA Texto)</span></span>
              </Button>
            </div>

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
