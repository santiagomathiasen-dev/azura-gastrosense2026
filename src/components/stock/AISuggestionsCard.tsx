import { Check, X, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { StockSuggestion } from '@/hooks/stock/useStockAI';
import type { StockItem } from '@/hooks/stock/useStockItems';

interface AISuggestionsCardProps {
  suggestions: StockSuggestion[];
  message: string;
  stockItems: StockItem[];
  onConfirm: (suggestion: StockSuggestion) => void;
  onReject: (index: number) => void;
  onClear: () => void;
}

export function AISuggestionsCard({
  suggestions,
  message,
  stockItems,
  onConfirm,
  onReject,
  onClear,
}: AISuggestionsCardProps) {
  if (suggestions.length === 0) return null;

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'entry':
        return { label: 'Entrada', variant: 'default' as const };
      case 'exit':
        return { label: 'Saída', variant: 'destructive' as const };
      case 'adjustment':
        return { label: 'Ajuste', variant: 'secondary' as const };
      default:
        return { label: action, variant: 'outline' as const };
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600';
    if (confidence >= 0.5) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <Card className="mb-6 border-primary/30 bg-primary/5">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-primary" />
            Sugestões da IA
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClear}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        {message && (
          <CardDescription>{message}</CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {suggestions.map((suggestion, index) => {
            const matchedItem = suggestion.matchedItemId
              ? stockItems.find((item) => item.id === suggestion.matchedItemId)
              : null;
            const actionInfo = getActionLabel(suggestion.action);

            return (
              <div
                key={index}
                className="flex items-center justify-between p-3 rounded-lg bg-background border"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">
                      {matchedItem?.name || suggestion.itemName}
                    </span>
                    <Badge variant={actionInfo.variant} className="text-xs">
                      {actionInfo.label}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span>
                      {suggestion.quantity} {suggestion.unit}
                    </span>
                    <span className={getConfidenceColor(suggestion.confidence)}>
                      {Math.round(suggestion.confidence * 100)}% confiança
                    </span>
                    {!matchedItem && (
                      <span className="text-destructive">Item não encontrado</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onReject(index)}
                    className="h-8 w-8 text-destructive hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onConfirm(suggestion)}
                    disabled={!matchedItem}
                    className="h-8 w-8 text-green-600 hover:text-green-600"
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
