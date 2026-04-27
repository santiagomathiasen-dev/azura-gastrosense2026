import { DollarSign, Calculator, Scale, Clock, Users, Factory, FileText, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { parseSafeDate } from '@/hooks/stock/useExpiryDates';

interface ReceitaIngrediente {
  id: string;
  ingredienteId: string;
  nome: string;
  quantidade: number;
  unidade: string;
  preco: number;
}

interface Receita {
  id: string;
  nome: string;
  categoria: string;
  tempoPreparo: number;
  rendimento: number;
  ingredientes: ReceitaIngrediente[];
  modoPreparo: string;
}

interface Producao {
  id: string;
  receita: string;
  quantidade: number;
  dataAgendada: string;
  horaAgendada: string;
  status: 'agendada' | 'em_andamento' | 'concluida';
}

interface ProductionPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  producao: Producao | null;
  receita: Receita | null;
  onStartProduction: () => void;
}

export function ProductionPreviewDialog({
  open,
  onOpenChange,
  producao,
  receita,
  onStartProduction,
}: ProductionPreviewDialogProps) {
  if (!producao || !receita) return null;

  // Calculate multiplier based on production quantity vs recipe yield
  const multiplicador = producao.quantidade / receita.rendimento;

  // Calculate scaled ingredients
  const ingredientesAjustados = receita.ingredientes.map(ing => ({
    ...ing,
    quantidadeOriginal: ing.quantidade,
    quantidadeAjustada: ing.quantidade * multiplicador,
    custoOriginal: ing.quantidade * ing.preco,
    custoAjustado: ing.quantidade * multiplicador * ing.preco,
  }));

  const custoTotalOriginal = receita.ingredientes.reduce(
    (total, ing) => total + ing.quantidade * ing.preco,
    0
  );

  const custoTotalAjustado = ingredientesAjustados.reduce(
    (total, ing) => total + ing.custoAjustado,
    0
  );

  const custoPorcaoOriginal = custoTotalOriginal / receita.rendimento;
  const custoPorcaoAjustado = custoTotalAjustado / producao.quantidade;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-xl">{receita.nome}</DialogTitle>
              <DialogDescription className="sr-only">Detalhes do diálogo</DialogDescription>
<p className="text-sm text-muted-foreground mt-0.5">
                Ficha Técnica para Produção
              </p>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[65vh] pr-4">
          <div className="space-y-6 py-4">
            {/* Production Info */}
            <div className="p-4 rounded-lg bg-warning/5 border border-warning/20">
              <div className="flex items-center gap-2 mb-3">
                <Factory className="h-5 w-5 text-warning" />
                <span className="font-medium">Detalhes da Produção</span>
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Quantidade</p>
                  <p className="font-bold text-lg">{producao.quantidade} unidades</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Data</p>
                  <p className="font-medium">
                    {parseSafeDate(producao.dataAgendada).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Horário</p>
                  <p className="font-medium">{producao.horaAgendada || '--:--'}</p>
                </div>
              </div>
            </div>

            {/* Recipe info */}
            <div className="flex flex-wrap gap-4">
              <Badge variant="secondary" className="text-sm">
                {receita.categoria}
              </Badge>
              <span className="flex items-center gap-1 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                {receita.tempoPreparo} min
              </span>
              <span className="flex items-center gap-1 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                {receita.rendimento} porções (receita original)
              </span>
              <Badge variant="outline" className="text-sm bg-primary/5">
                Multiplicador: {multiplicador.toFixed(2)}x
              </Badge>
            </div>

            {/* Cost comparison */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-muted/50 border">
                <p className="text-sm text-muted-foreground mb-1">Receita Original</p>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Custo Total</p>
                    <p className="font-medium">R$ {custoTotalOriginal.toFixed(2)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Custo/Porção</p>
                    <p className="font-medium">R$ {custoPorcaoOriginal.toFixed(2)}</p>
                  </div>
                </div>
              </div>
              <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                <p className="text-sm text-muted-foreground mb-1">Produção Ajustada</p>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Custo Total</p>
                    <p className="font-bold text-primary text-lg">R$ {custoTotalAjustado.toFixed(2)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Custo/Porção</p>
                    <p className="font-bold text-primary">R$ {custoPorcaoAjustado.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="h-4 w-4 text-primary" />
                  <span className="text-sm text-muted-foreground">Custo Total Produção</span>
                </div>
                <p className="text-xl font-bold text-primary">
                  R$ {custoTotalAjustado.toFixed(2)}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-green-500/5 border border-green-500/20">
                <div className="flex items-center gap-2 mb-1">
                  <Calculator className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-muted-foreground">Custo/Unidade</span>
                </div>
                <p className="text-xl font-bold text-green-600">
                  R$ {custoPorcaoAjustado.toFixed(2)}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-muted">
                <div className="flex items-center gap-2 mb-1">
                  <Scale className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Ingredientes</span>
                </div>
                <p className="text-xl font-bold">
                  {receita.ingredientes.length}
                </p>
              </div>
            </div>

            {/* Ingredients Table */}
            <div>
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <Scale className="h-4 w-4" />
                Ingredientes Ajustados para Produção
              </h4>
              <div className="rounded-lg border divide-y">
                {ingredientesAjustados.map((ing) => (
                  <div key={ing.id} className="flex justify-between items-center p-3">
                    <span className="font-medium">{ing.nome}</span>
                    <span className="text-primary font-medium">
                      {ing.quantidadeAjustada.toFixed(2)} {ing.unidade}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Preparation method */}
            <div>
              <h4 className="font-medium mb-2">Modo de Preparo</h4>
              <p className="text-sm text-muted-foreground leading-relaxed p-4 rounded-lg bg-muted/50">
                {receita.modoPreparo}
              </p>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          {producao.status === 'agendada' && (
            <Button onClick={onStartProduction} className="gap-2">
              <Play className="h-4 w-4" />
              Iniciar Produção
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
