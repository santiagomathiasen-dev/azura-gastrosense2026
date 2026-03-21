import { useState, useRef } from 'react';
import { FileText, Upload, Camera, Loader2 } from 'lucide-react';
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
import { supabase } from '@/integrations/supabase/client';
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
  const [isProcessing, setIsProcessing] = useState(false);
  const [fileName, setFileName] = useState<string>('');
  const [ingredients, setIngredients] = useState<ExtractedIngredient[]>([]);
  const [summary, setSummary] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setStep('upload');
    setFileName('');
    setIngredients([]);
    setSummary('');
    setIsProcessing(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Limite reduzido para 2MB — payloads maiores causam WORKER_LIMIT (546) na Edge Function
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Arquivo muito grande. Máximo 2MB. Tente comprimir o PDF ou reduzir a imagem.');
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
    setIsProcessing(true);
    setStep('processing');

    try {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Processamento demorou mais que 5 minutos. Tente um arquivo menor ou recarregue a página.')), 300000);
      });

      const processTask = async () => {
        let fileType: 'image' | 'pdf' | 'text';
        let content: string;

        if (file.type.startsWith('image/')) {
          fileType = 'image';
          // Compressão agressiva: máx 800px, qualidade 0.6 para minimizar payload
          content = await compressImage(file, 800, 0.6);
        } else if (file.type === 'application/pdf') {
          fileType = 'pdf';
          content = await fileToBase64(file);
        } else if (file.type === 'text/plain') {
          fileType = 'text';
          content = await file.text();
        } else {
          throw new Error('Tipo de arquivo não suportado');
        }

        console.log(`Processing ${fileType} (${(content.length / 1024).toFixed(1)}KB base64) via supabase.functions.invoke`);

        const { data, error: funcError } = await supabase.functions.invoke('extract-ingredients', {
          body: { fileType, content, extractRecipe: false, mimeType: file.type },
        });

        if (funcError) throw new Error(funcError.message);
        console.log("Extraction output:", data);
        return data;
      };

      const data = await Promise.race([processTask(), timeoutPromise]) as any;

      if (data?.error) {
        toast.error(data.error);
        setStep('upload');
        return;
      }

      // Set extracted data
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
      const message = err instanceof Error ? err.message : 'Erro ao processar arquivo';
      toast.error(message);
      setStep('upload');
    } finally {
      setIsProcessing(false);
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
              Formatos aceitos: JPG, PNG, PDF, TXT (máx. 5MB)
            </p>
          </div>
        )}

        {step === 'processing' && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-muted-foreground">Processando arquivo com IA...</p>
            {fileName && (
              <p className="text-sm text-muted-foreground">{fileName}</p>
            )}
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
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const skipResize = file.size < 1024 * 1024; // Less than 1MB
    const isHeic = file.type.toLowerCase().includes('heic') || file.name.toLowerCase().endsWith('.heic');

    // For images (that are large, and NOT HEIC), resize them before base64 encoding to reduce payload size
    if (!skipResize && !isHeic && file.type.startsWith('image/')) {
      const img = new window.Image();
      const objectUrl = URL.createObjectURL(file);
      let isResolved = false;

      const resolveFallback = () => {
        if (isResolved) return;
        isResolved = true;
        URL.revokeObjectURL(objectUrl);
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.includes(',') ? result.split(',')[1] : result);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      };

      const fallbackTimer = setTimeout(resolveFallback, 3000);

      img.onload = () => {
        if (isResolved) return;
        clearTimeout(fallbackTimer);
        isResolved = true;
        URL.revokeObjectURL(objectUrl);
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const MAX_SIZE = 1200; // max width/height

        if (width > height && width > MAX_SIZE) {
          height *= MAX_SIZE / width;
          width = MAX_SIZE;
        } else if (height > MAX_SIZE) {
          width *= MAX_SIZE / height;
          height = MAX_SIZE;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.7);
          resolve(dataUrl.split(',')[1]);
        } else {
          resolveFallback(); // if canvas context fails
        }
      };

      img.onerror = () => {
        if (isResolved) return;
        clearTimeout(fallbackTimer);
        resolveFallback();
      };

      img.src = objectUrl;
    } else {
      // For PDFs, Text, small images, or HEIC
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.includes(',') ? result.split(',')[1] : result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    }
  });
}

/**
 * Compresses an image to JPEG with max dimension and quality to keep
 * the base64 payload small and avoid WORKER_LIMIT (546) on Edge Functions.
 */
function compressImage(file: File, maxPx = 800, quality = 0.6): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxPx || height > maxPx) {
          if (width > height) {
            height = Math.round(height * maxPx / width);
            width = maxPx;
          } else {
            width = Math.round(width * maxPx / height);
            height = maxPx;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas context unavailable'));
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl.split(',')[1]);
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
