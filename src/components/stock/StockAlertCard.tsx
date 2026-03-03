import { AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { StockItem } from '@/hooks/useStockItems';
import { UNIT_LABELS } from '@/hooks/useStockItems';
import { StockService } from '@/modules/stock/services/StockService';

interface StockAlertCardProps {
  items: StockItem[];
}

export function StockAlertCard({ items }: StockAlertCardProps) {
  const criticalItems = items.filter(
    (item) => StockService.getStockStatus(Number(item.current_quantity), Number(item.minimum_quantity)) === 'red'
  );
  const warningItems = items.filter(
    (item) => StockService.getStockStatus(Number(item.current_quantity), Number(item.minimum_quantity)) === 'yellow'
  );

  if (criticalItems.length === 0 && warningItems.length === 0) return null;

  return (
    <Card className="mb-6 border-warning/50 bg-warning/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2 text-warning">
          <AlertTriangle className="h-5 w-5" />
          {criticalItems.length + warningItems.length} {criticalItems.length + warningItems.length === 1 ? 'item' : 'itens'} com estoque baixo
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {criticalItems.map((item) => (
            <Badge key={item.id} variant="outline" className="border-destructive text-destructive">
              {item.name}: {Number(item.current_quantity).toFixed(3)} {UNIT_LABELS[item.unit as keyof typeof UNIT_LABELS]}
            </Badge>
          ))}
          {warningItems.map((item) => (
            <Badge key={item.id} variant="outline" className="border-warning text-warning">
              {item.name}: {Number(item.current_quantity).toFixed(3)} {UNIT_LABELS[item.unit as keyof typeof UNIT_LABELS]}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
