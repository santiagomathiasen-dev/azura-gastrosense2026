import { useState, useRef } from 'react';
import { FileText, Upload, Camera, Loader2, RefreshCw } from 'lucide-react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import type { StockCategory, StockUnit } from '@/hooks/useStockItems';

export interface ExtractedIngredient {
  name: string;
  quantity: number;
  unit: StockUnit;
  category: StockCategory;
  price?: number | null;
  supplier?: string | null;
  minimum_quantity?: number | null;
  expiration_date?: string | null;
  selected?: boolean;
}

interface IngredientFileImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (ingredients: ExtractedIngredient[]) => Promise<void>;
}

type Step = 'upload' | 'processing' | 'review';
type ProcessingStage = 'reading' | 'sending' | 'processing' | null;

const categoryLabels: Record<StockCategory, string> = {
  laticinios: 'Laticínios',
  secos_e_graos: 'Secos e Grãos',
  hortifruti: 'Hortifruti',
  carnes_e_peixes: 'Carnes e Peixes',
  embalagens: 'Embalagens',
  limpeza: 'Limpeza',
  outros: 'Outros',
};

const unitLabels: Record<StockUnit, string> = {
  kg: 'kg',
  g: 'g',
  L: 'L',
  ml: 'ml',
  unidade: 'un',
  caixa: 'cx',
  dz: 'dz',
};

export function IngredientFileImportDialog({
  open,
  onOpenChange,
  onImport,
}: IngredientFileImportDialogProps) {
  const [step, setStep] = useState<Step>('upload');
  const [processingStage, setProcessingStage] = useState<ProcessingStage>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [fileName, setFileName] = useState<string>('');
  const [lastFile, setLastFile] = useState<File | null>(null);
  const [ingredients, setIngredients] = useState<ExtractedIngredient[]>([]);
  const [summary, setSummary] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setStep('upload');
    setProcessingStage(null);
    setFileName('');
    setLastFile(null);
    setIngredients([]);
    setSummary('');
    setIsProcessing(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Arquivo muito grande. Máximo 10MB.');
      return;
    }

    // Check file type
    const validTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'application/pdf',
      'text/plain',
    ];

    if (!validTypes.includes(file.type)) {
      toast.error('Tipo de arquivo não suportado. Use imagem, PDF ou texto.');
      return;
    }

    setFileName(file.name);
    await processFile(file);
  };

  const processFile = async (file: File) => {
    setLastFile(file);
    setIsProcessing(true);
    setStep('processing');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90_000);

    try {
      setProcessingStage('reading');
      let fileToSend: File = file;

      if (file.type.startsWith('image/')) {
        fileToSend = await compressImageToFile(file, 1200, 0.75);
      }

      setProcessingStage('sending');
      const formData = new FormData();
      formData.append('file', fileToSend, fileToSend.name);
      formData.append('extractRecipe', 'false');

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
      const data = await res.json();

      if (data?.error) {
        toast.error(data.error);
        setStep('upload');
        return;
      }

      const extractedIngredients = (data.ingredients || []).map((ing: ExtractedIngredient) => ({
        ...ing,
        selected: true,
      }));

      setIngredients(extractedIngredients);
      setSummary(data.summary || '');
      setStep('review');

      if (extractedIngredients.length > 0) {
        toast.success(`Extraídos ${extractedIngredients.length} ingredientes!`);
      } else {
        toast.info(data.summary || 'Nenhum ingrediente encontrado. Verifique o arquivo.');
      }
    } catch (err) {
      clearTimeout(timeout);
      const message = err instanceof Error ? err.message : 'Erro ao processar arquivo';
      toast.error(message);
      setStep('upload');
    } finally {
      setIsProcessing(false);
      setProcessingStage(null);
    }
  };

  const toggleIngredient = (index: number) => {
    setIngredients((prev) =>
      prev.map((ing, i) =>
        i === index ? { ...ing, selected: !ing.selected } : ing
      )
    );
  };

  const toggleAll = (selected: boolean) => {
    setIngredients((prev) => prev.map((ing) => ({ ...ing, selected })));
  };

  const updateIngredient = (index: number, updates: Partial<ExtractedIngredient>) => {
    setIngredients((prev) =>
      prev.map((ing, i) =>
        i === index ? { ...ing, ...updates } : ing
      )
    );
  };

  const handleConfirmImport = async () => {
    const selectedIngredients = ingredients.filter((ing) => ing.selected);

    if (selectedIngredients.length === 0) {
      toast.error('Selecione pelo menos um ingrediente');
      return;
    }

    setIsProcessing(true);
    try {
      await onImport(selectedIngredients);
      onOpenChange(false);
      resetState();
    } catch (error) {
      console.error('Error importing ingredients:', error);
      toast.error('Erro ao importar ingredientes');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      resetState();
    }
    onOpenChange(open);
  };

  const selectedCount = ingredients.filter(i => i.selected).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Importar Ingredientes de Arquivo
          </DialogTitle>
          <DialogDescription>
            Envie uma foto, PDF ou arquivo de texto com os ingredientes. A IA extrairá os dados automaticamente.
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Camera option */}
              <div>
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileChange}
                  className="hidden"
                  id="ingredient-camera-input"
                />
                <div
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted transition-colors"
                >
                  <Camera className="h-8 w-8 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Câmera</span>
                </div>
              </div>

              {/* File upload option */}
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,application/pdf,text/plain,.txt"
                  onChange={handleFileChange}
                  className="hidden"
                  id="ingredient-file-input"
                />
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted transition-colors"
                >
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Arquivo</span>
                </div>
              </div>
            </div>

            <p className="text-xs text-center text-muted-foreground">
              Formatos aceitos: JPG, PNG, PDF, TXT (máx. 10MB)
            </p>
          </div>
        )}

        {step === 'processing' && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
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
                  <p className="text-xs text-muted-foreground">Payload otimizado</p>
                </>
              )}
              {(processingStage === 'processing' || !processingStage) && (
                <>
                  <p className="font-medium">Processando com IA...</p>
                  <p className="text-xs text-muted-foreground">{fileName}</p>
                </>
              )}
            </div>
          </div>
        )}

        {step === 'review' && (
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-4 py-4">
              {/* Ingredients */}
              {ingredients.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="select-all-ingredients"
                        checked={ingredients.length > 0 && ingredients.every(i => i.selected)}
                        onCheckedChange={(checked) => toggleAll(!!checked)}
                      />
                      <Label htmlFor="select-all-ingredients" className="cursor-pointer">
                        Ingredientes Extraídos
                      </Label>
                    </div>
                    <Badge variant="secondary">{selectedCount} selecionados</Badge>
                  </div>
                  <div className="border rounded-lg divide-y">
                    {ingredients.map((ing, index) => (
                      <div
                        key={index}
                        className="p-3 hover:bg-muted/50 space-y-2"
                      >
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={ing.selected}
                            onCheckedChange={() => toggleIngredient(index)}
                          />
                          <div className="flex-1 min-w-0">
                            <Input
                              value={ing.name}
                              onChange={(e) => updateIngredient(index, { name: e.target.value })}
                              className="font-medium h-8"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2 pl-7">
                          <div>
                            <Label className="text-xs text-muted-foreground">Quantidade</Label>
                            <Input
                              type="number"
                              value={ing.quantity}
                              onChange={(e) => updateIngredient(index, { quantity: parseFloat(e.target.value) || 0 })}
                              className="h-8"
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Unidade</Label>
                            <Select
                              value={ing.unit}
                              onValueChange={(value) => updateIngredient(index, { unit: value as StockUnit })}
                            >
                              <SelectTrigger className="h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(unitLabels).map(([value, label]) => (
                                  <SelectItem key={value} value={value}>{label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Categoria</Label>
                            <Select
                              value={ing.category}
                              onValueChange={(value) => updateIngredient(index, { category: value as StockCategory })}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(categoryLabels).map(([value, label]) => (
                                  <SelectItem key={value} value={value}>{label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="col-span-3 mt-2">
                            <Label className="text-xs text-muted-foreground">Validade</Label>
                            <Input
                              type="date"
                              value={ing.expiration_date || ''}
                              onChange={(e) => updateIngredient(index, { expiration_date: e.target.value })}
                              className="h-8"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {ingredients.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Nenhum ingrediente foi extraído do arquivo.</p>
                  <p className="text-sm">Tente com outro arquivo ou formato.</p>
                </div>
              )}

              {summary && (
                <p className="text-sm text-muted-foreground italic">{summary}</p>
              )}
            </div>
          </ScrollArea>
        )}

        {step === 'upload' && lastFile && (
          <DialogFooter>
            <Button variant="outline" onClick={() => processFile(lastFile)} disabled={isProcessing}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Tentar novamente
            </Button>
          </DialogFooter>
        )}

        {step === 'review' && (
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => resetState()}
              disabled={isProcessing}
            >
              Voltar
            </Button>
            <Button
              onClick={handleConfirmImport}
              disabled={isProcessing || selectedCount === 0}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importando...
                </>
              ) : (
                `Importar ${selectedCount} Ingredientes`
              )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
// Compress image and return as File (JPEG). Falls back to original on error.
function compressImageToFile(file: File, maxPx = 1200, quality = 0.75): Promise<File> {
  return new Promise((resolve) => {
    const img = new window.Image();
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
