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
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import type { ExtractedIngredient, RecipeData } from '@/hooks/useIngredientImport';

interface RecipeFileImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (
    recipeData: RecipeData,
    ingredients: ExtractedIngredient[]
  ) => Promise<void>;
}

type Step = 'upload' | 'processing' | 'review';
type ProcessingStage = 'reading' | 'sending' | 'processing' | null;

export function RecipeFileImportDialog({
  open,
  onOpenChange,
  onImport,
}: RecipeFileImportDialogProps) {
  const [step, setStep] = useState<Step>('upload');
  const [processingStage, setProcessingStage] = useState<ProcessingStage>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [lastFile, setLastFile] = useState<File | null>(null);

  // Extracted data
  const [recipeData, setRecipeData] = useState<RecipeData>({});
  const [ingredients, setIngredients] = useState<ExtractedIngredient[]>([]);
  const [summary, setSummary] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setStep('upload');
    setProcessingStage(null);
    setPreview(null);
    setFileName('');
    setLastFile(null);
    setRecipeData({});
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

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      setPreview(base64);
    };
    reader.readAsDataURL(file);

    // Process the file
    await processFile(file);
  };

  const processFile = async (file: File) => {
    setIsProcessing(true);
    setLastFile(file);
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
      formData.append('extractRecipe', 'true');

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

      setRecipeData({
        recipeName: data.recipeName || '',
        preparationMethod: data.preparationMethod || '',
        yieldQuantity: data.yieldQuantity,
        preparationTime: data.preparationTime,
      });

      setStep('review');

      if (extractedIngredients.length > 0) {
        toast.success(`Extraídos ${extractedIngredients.length} ingredientes!`);
      } else {
        toast.info('Nenhum ingrediente encontrado. Verifique o arquivo.');
      }
    } catch (err) {
      clearTimeout(timeout);
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

  const handleConfirmImport = async () => {
    const selectedIngredients = ingredients.filter((ing) => ing.selected);

    // Allow import even without recipe name - use default
    const finalRecipeData = {
      ...recipeData,
      recipeName: recipeData.recipeName?.trim() || 'Receita Importada',
    };

    setIsProcessing(true);
    try {
      await onImport(finalRecipeData, selectedIngredients);
      onOpenChange(false);
      resetState();
    } catch (error) {
      console.error('Error importing recipe:', error);
      toast.error('Erro ao importar receita');
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

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Importar Receita de Arquivo
          </DialogTitle>
          <DialogDescription>
            Envie uma foto, PDF ou arquivo de texto com a receita. A IA extrairá os dados automaticamente.
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
                  id="recipe-camera-input"
                />
                <label
                  htmlFor="recipe-camera-input"
                  className="flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted transition-colors"
                >
                  <Camera className="h-8 w-8 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Câmera</span>
                </label>
              </div>

              {/* File upload option */}
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,application/pdf,text/plain,.txt"
                  onChange={handleFileChange}
                  className="hidden"
                  id="recipe-file-input"
                />
                <label
                  htmlFor="recipe-file-input"
                  className="flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted transition-colors"
                >
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Arquivo</span>
                </label>
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
            <p className="text-muted-foreground">
              {processingStage === 'reading' && 'Lendo arquivo...'}
              {processingStage === 'sending' && 'Enviando para IA...'}
              {processingStage === 'processing' && 'Processando com IA...'}
              {!processingStage && 'Processando arquivo com IA...'}
            </p>
            {fileName && (
              <p className="text-sm text-muted-foreground">{fileName}</p>
            )}
          </div>
        )}

        {step === 'review' && (
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-4 py-4">
              {/* Recipe Name */}
              <div className="space-y-2">
                <Label htmlFor="recipe-name">Nome da Receita *</Label>
                <Input
                  id="recipe-name"
                  value={recipeData.recipeName || ''}
                  onChange={(e) =>
                    setRecipeData({ ...recipeData, recipeName: e.target.value })
                  }
                  placeholder="Ex: Bolo de Chocolate"
                />
              </div>

              {/* Time and Yield */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="prep-time">Tempo (min)</Label>
                  <Input
                    id="prep-time"
                    type="number"
                    value={recipeData.preparationTime || ''}
                    onChange={(e) =>
                      setRecipeData({
                        ...recipeData,
                        preparationTime: parseInt(e.target.value) || undefined,
                      })
                    }
                    placeholder="60"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="yield">Rendimento</Label>
                  <Input
                    id="yield"
                    type="number"
                    value={recipeData.yieldQuantity || ''}
                    onChange={(e) =>
                      setRecipeData({
                        ...recipeData,
                        yieldQuantity: parseInt(e.target.value) || undefined,
                      })
                    }
                    placeholder="12"
                  />
                </div>
              </div>

              {/* Financial and Sectorization */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="markup">Markup (ex: 3.5)</Label>
                  <Input
                    id="markup"
                    type="number"
                    step="0.1"
                    value={recipeData.markup || ''}
                    onChange={(e) =>
                      setRecipeData({
                        ...recipeData,
                        markup: parseFloat(e.target.value) || undefined,
                      })
                    }
                    placeholder="3.0"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="praca">Setor / Praça</Label>
                  <Input
                    id="praca"
                    value={recipeData.praca || ''}
                    onChange={(e) =>
                      setRecipeData({
                        ...recipeData,
                        praca: e.target.value,
                      })
                    }
                    placeholder="Cozinha Quente"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="labor-cost" className="text-[10px]">Mão de Obra</Label>
                  <Input
                    id="labor-cost"
                    type="number"
                    step="0.01"
                    className="h-8"
                    value={recipeData.labor_cost || ''}
                    onChange={(e) =>
                      setRecipeData({
                        ...recipeData,
                        labor_cost: parseFloat(e.target.value) || undefined,
                      })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="energy-cost" className="text-[10px]">Energia/Gás</Label>
                  <Input
                    id="energy-cost"
                    type="number"
                    step="0.01"
                    className="h-8"
                    value={recipeData.energy_cost || ''}
                    onChange={(e) =>
                      setRecipeData({
                        ...recipeData,
                        energy_cost: parseFloat(e.target.value) || undefined,
                      })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="other-costs" className="text-[10px]">Outros</Label>
                  <Input
                    id="other-costs"
                    type="number"
                    step="0.01"
                    className="h-8"
                    value={recipeData.other_costs || ''}
                    onChange={(e) =>
                      setRecipeData({
                        ...recipeData,
                        other_costs: parseFloat(e.target.value) || undefined,
                      })
                    }
                  />
                </div>
              </div>

              {/* Preparation Method */}
              <div className="space-y-2">
                <Label htmlFor="prep-method">Modo de Preparo</Label>
                <Textarea
                  id="prep-method"
                  value={recipeData.preparationMethod || ''}
                  onChange={(e) =>
                    setRecipeData({
                      ...recipeData,
                      preparationMethod: e.target.value,
                    })
                  }
                  placeholder="Passo a passo da receita..."
                  rows={4}
                />
              </div>

              {/* Ingredients */}
              {ingredients.length > 0 && (
                <div className="space-y-2">
                  <Label>Ingredientes Extraídos ({ingredients.filter(i => i.selected).length} selecionados)</Label>
                  <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
                    {ingredients.map((ing, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-3 p-3 hover:bg-muted/50"
                      >
                        <Checkbox
                          checked={ing.selected}
                          onCheckedChange={() => toggleIngredient(index)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{ing.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {ing.quantity > 0 ? `${ing.quantity} ${ing.unit}` : ing.unit}
                            {ing.price && ing.price > 0 && ` • R$ ${ing.price.toFixed(2)}`}
                            {ing.expiration_date && ` • Val: ${ing.expiration_date}`}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {summary && (
                <p className="text-sm text-muted-foreground italic">{summary}</p>
              )}
            </div>
          </ScrollArea>
        )}

        <DialogFooter className="mt-4">
          {step === 'upload' && lastFile && (
            <Button
              variant="outline"
              onClick={() => processFile(lastFile)}
              disabled={isProcessing}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Tentar novamente
            </Button>
          )}
          {step === 'review' && (
            <Button
              variant="outline"
              onClick={() => {
                setStep('upload');
              }}
              disabled={isProcessing}
            >
              Voltar
            </Button>
          )}
          <Button
            onClick={step === 'review' ? handleConfirmImport : undefined}
            disabled={step !== 'review' || isProcessing}
            className={step !== 'review' ? 'hidden' : ''}
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Importando...
              </>
            ) : (
              'Importar Receita'
            )}
          </Button>
        </DialogFooter>
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
