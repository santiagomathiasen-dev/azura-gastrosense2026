import { useState, useRef, useCallback } from 'react';
import { Upload, FileImage, FileSpreadsheet, FileText, X, Loader2, CheckCircle2, Sparkles, Plus, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useIngredientImport, type ExtractedIngredient, type RecipeData } from '@/hooks/useIngredientImport';
import { IngredientConfirmationList } from '@/components/ingredients/IngredientConfirmationList';

interface AIImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (ingredients: ExtractedIngredient[], recipeData?: RecipeData) => Promise<void>;
  title?: string;
  description?: string;
  extractRecipe?: boolean;
}

interface FileWithStatus {
  file: File;
  status: 'pending' | 'processing' | 'done' | 'error';
  preview?: string;
  extractedCount?: number;
  error?: string;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_FILES = 1;
const ACCEPTED_TYPES = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'image/gif': ['.gif'],
  'application/pdf': ['.pdf'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
};

const ACCEPTED_MIME_TYPES = Object.keys(ACCEPTED_TYPES).join(',');

type Step = 'upload' | 'processing' | 'confirm';

export function AIImportDialog({
  open,
  onOpenChange,
  onImport,
  title = 'Importar com IA',
  description = 'Envie imagens, PDFs ou planilhas Excel para importar dados em massa.',
  extractRecipe = false,
}: AIImportDialogProps) {
  const [files, setFiles] = useState<FileWithStatus[]>([]);
  const [step, setStep] = useState<Step>('upload');
  const [isSaving, setIsSaving] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [processedCount, setProcessedCount] = useState(0);
  const [allExtractedIngredients, setAllExtractedIngredients] = useState<ExtractedIngredient[]>([]);
  const [combinedRecipeData, setCombinedRecipeData] = useState<RecipeData | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { extractFromFile } = useIngredientImport();

  const resetState = () => {
    setFiles([]);
    setStep('upload');
    setIsSaving(false);
    setProcessedCount(0);
    setAllExtractedIngredients([]);
    setCombinedRecipeData(null);
  };

  const handleClose = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    resetState();
    onOpenChange(false);
  };

  const validateFile = (file: File): boolean => {
    if (file.size > MAX_FILE_SIZE) {
      toast.error(`${file.name}: Arquivo muito grande (máx 5MB)`);
      return false;
    }
    const isValidType = Object.keys(ACCEPTED_TYPES).includes(file.type);
    if (!isValidType) {
      toast.error(`${file.name}: Tipo não suportado`);
      return false;
    }
    return true;
  };

  const addFiles = (newFiles: FileList | File[]) => {
    const validFiles: FileWithStatus[] = [];

    for (const file of Array.from(newFiles)) {
      if (files.length + validFiles.length >= MAX_FILES) {
        toast.error(`Máximo de ${MAX_FILES} arquivos por vez`);
        break;
      }

      if (!validateFile(file)) continue;

      // Check for duplicates
      if (files.some(f => f.file.name === file.name && f.file.size === file.size)) {
        continue;
      }

      const fileWithStatus: FileWithStatus = {
        file,
        status: 'pending',
      };

      // Create preview for images
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setFiles(prev => prev.map(f =>
            f.file === file ? { ...f, preview: e.target?.result as string } : f
          ));
        };
        reader.readAsDataURL(file);
      }

      validFiles.push(fileWithStatus);
    }

    if (validFiles.length > 0) {
      setFiles(prev => [...prev, ...validFiles]);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(e.target.files);
    }
    // Reset input so same file can be selected again
    e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      addFiles(e.dataTransfer.files);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleExtractAll = async () => {
    if (files.length === 0) return;

    // Cancel any previous run
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setStep('processing');
    setProcessedCount(0);

    const extractedIngredients: ExtractedIngredient[] = [];
    let lastRecipeData: RecipeData | null = null;

    for (let i = 0; i < files.length; i++) {
      if (controller.signal.aborted) break;

      const fileItem = files[i];

      // Update file status to processing
      setFiles(prev => prev.map((f, idx) =>
        idx === i ? { ...f, status: 'processing' } : f
      ));

      try {
        const result = await extractFromFile(fileItem.file, extractRecipe);

        if (controller.signal.aborted) break;

        if (result && result.ingredients.length > 0) {
          const ingredientsWithSource = result.ingredients.map(ing => ({
            ...ing,
            selected: true,
          }));

          extractedIngredients.push(...ingredientsWithSource);

          if (result.recipeData) {
            lastRecipeData = result.recipeData;
          }

          setFiles(prev => prev.map((f, idx) =>
            idx === i ? { ...f, status: 'done', extractedCount: result.ingredients.length } : f
          ));
        } else {
          setFiles(prev => prev.map((f, idx) =>
            idx === i ? { ...f, status: 'error', error: 'Nenhum ingrediente encontrado' } : f
          ));
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setFiles(prev => prev.map((f, idx) =>
            idx === i ? { ...f, status: 'error', error: 'Erro ao processar' } : f
          ));
        }
      }

      setProcessedCount(i + 1);
    }

    if (controller.signal.aborted) return;

    setAllExtractedIngredients(extractedIngredients);
    setCombinedRecipeData(lastRecipeData);

    if (extractedIngredients.length > 0) {
      setStep('confirm');
    } else {
      toast.error('Nenhum ingrediente foi extraído dos arquivos.');
      setStep('upload');
    }
  };

  const handleCancel = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    onOpenChange(false);
  }, [onOpenChange]);

  const toggleIngredient = (index: number) => {
    setAllExtractedIngredients(prev =>
      prev.map((ing, i) => (i === index ? { ...ing, selected: !ing.selected } : ing))
    );
  };

  const updateIngredient = (index: number, updates: Partial<ExtractedIngredient>) => {
    setAllExtractedIngredients(prev =>
      prev.map((ing, i) => (i === index ? { ...ing, ...updates } : ing))
    );
  };

  const removeIngredient = (index: number) => {
    setAllExtractedIngredients(prev => prev.filter((_, i) => i !== index));
  };

  const handleConfirmImport = async () => {
    const selected = allExtractedIngredients.filter(i => i.selected);
    if (selected.length === 0) {
      toast.error('Selecione pelo menos um ingrediente para importar.');
      return;
    }

    setIsSaving(true);
    try {
      await onImport(selected, combinedRecipeData || undefined);
      toast.success(`${selected.length} ingrediente(s) importado(s) com sucesso!`);
      handleClose();
    } catch (error) {
      toast.error('Erro ao salvar ingredientes. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) {
      return <FileImage className="h-5 w-5 text-primary" />;
    }
    if (file.type === 'application/pdf') {
      return <FileText className="h-5 w-5 text-destructive" />;
    }
    return <FileSpreadsheet className="h-5 w-5 text-green-600" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const selectedCount = allExtractedIngredients.filter(i => i.selected).length;
  const progressPercent = files.length > 0 ? (processedCount / files.length) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === 'confirm' && <CheckCircle2 className="h-5 w-5 text-green-600" />}
            {step === 'confirm' ? 'Confirmar Ingredientes' : title}
          </DialogTitle>
          <DialogDescription>
            {step === 'confirm'
              ? `${allExtractedIngredients.length} ingredientes extraídos de ${files.length} arquivo(s). Revise antes de salvar.`
              : description}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden py-4">
          {/* Upload Step */}
          {step === 'upload' && (
            <div className="space-y-4">
              {/* Drop Zone */}
              <div
                onClick={() => inputRef.current?.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`
                  relative cursor-pointer rounded-lg border-2 border-dashed p-6
                  transition-colors duration-200 text-center
                  ${isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}
                `}
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept={ACCEPTED_MIME_TYPES}
                  onChange={handleInputChange}
                  className="hidden"
                />

                <div className="flex flex-col items-center gap-2">
                  <div className="flex items-center gap-2">
                    <Upload className="h-8 w-8 text-muted-foreground" />
                    <Plus className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-medium text-sm">
                      Clique ou arraste um arquivo
                    </p>
                    <p className="text-xs text-muted-foreground">
                      JPG, PNG, PDF ou Excel até 5MB
                    </p>
                  </div>
                </div>
              </div>

              {/* File List */}
              {files.length > 0 && (
                <div className="space-y-2 max-h-[250px] overflow-y-auto">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{files.length} arquivo(s) selecionado(s)</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setFiles([])}
                      className="text-destructive hover:text-destructive"
                    >
                      Limpar todos
                    </Button>
                  </div>
                  {files.map((item, index) => (
                    <div
                      key={`${item.file.name}-${index}`}
                      className="flex items-center gap-3 p-2 rounded-lg bg-muted/50"
                    >
                      {item.preview ? (
                        <img
                          src={item.preview}
                          alt=""
                          className="h-10 w-10 rounded object-cover"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                          {getFileIcon(item.file)}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(item.file.size)}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeFile(index)}
                        className="h-8 w-8"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Accepted formats */}
              <div className="flex flex-wrap gap-2 justify-center">
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                  <FileImage className="h-3 w-3" /> Imagens
                </span>
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                  <FileText className="h-3 w-3" /> PDF
                </span>
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                  <FileSpreadsheet className="h-3 w-3" /> Excel
                </span>
              </div>
            </div>
          )}

          {/* Processing Step */}
          {step === 'processing' && (
            <div className="space-y-4">
              <div className="flex flex-col items-center justify-center py-6 gap-4">
                <div className="relative">
                  <Loader2 className="h-12 w-12 animate-spin text-primary" />
                  <Sparkles className="h-5 w-5 text-primary absolute -top-1 -right-1 animate-pulse" />
                </div>
                <div className="text-center">
                  <p className="font-medium">Processando arquivos...</p>
                  <p className="text-sm text-muted-foreground">
                    {processedCount} de {files.length} arquivo(s)
                  </p>
                </div>
                <Progress value={progressPercent} className="w-full max-w-xs" />
              </div>

              {/* Processing Status List */}
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {files.map((item, index) => (
                  <div
                    key={`${item.file.name}-${index}`}
                    className="flex items-center gap-3 p-2 rounded-lg bg-muted/30"
                  >
                    {getFileIcon(item.file)}
                    <span className="flex-1 text-sm truncate">{item.file.name}</span>
                    {item.status === 'pending' && (
                      <Badge variant="secondary">Aguardando</Badge>
                    )}
                    {item.status === 'processing' && (
                      <Badge variant="default" className="gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Processando
                      </Badge>
                    )}
                    {item.status === 'done' && (
                      <Badge variant="outline" className="text-green-600 border-green-600">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        {item.extractedCount} itens
                      </Badge>
                    )}
                    {item.status === 'error' && (
                      <Badge variant="destructive" className="gap-1">
                        <AlertCircle className="h-3 w-3" />
                        Erro
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Confirmation Step */}
          {step === 'confirm' && (
            <IngredientConfirmationList
              ingredients={allExtractedIngredients}
              onToggle={toggleIngredient}
              onUpdate={updateIngredient}
              onRemove={removeIngredient}
            />
          )}
        </div>

        <div className="flex justify-between items-center gap-2 pt-4 border-t">
          {step === 'confirm' && (
            <p className="text-sm text-muted-foreground">
              {selectedCount} de {allExtractedIngredients.length} selecionado(s)
            </p>
          )}
          {step === 'upload' && files.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {files.length} arquivo(s) pronto(s) para análise
            </p>
          )}
          <div className="flex gap-2 ml-auto">
            {step === 'confirm' && (
              <Button
                variant="outline"
                onClick={() => {
                  setStep('upload');
                  setAllExtractedIngredients([]);
                }}
                disabled={isSaving}
              >
                Voltar
              </Button>
            )}
            <Button variant="outline" onClick={handleClose} disabled={step === 'processing' || isSaving}>
              Cancelar
            </Button>
            {step === 'upload' && (
              <Button onClick={handleExtractAll} disabled={files.length === 0}>
                <Sparkles className="h-4 w-4 mr-2" />
                Analisar {files.length > 0 && `(${files.length})`}
              </Button>
            )}
            {step === 'confirm' && (
              <Button onClick={handleConfirmImport} disabled={selectedCount === 0 || isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Confirmar ({selectedCount})
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
