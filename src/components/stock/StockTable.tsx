import { useState, useCallback } from 'react';
import { MoreHorizontal, Pencil, Trash2, ArrowUpDown, Check, X, ArrowRightLeft, Calendar, Mic, Package } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { cn, formatQuantity } from '@/lib/utils';
import type {
  StockItem,
  StockCategory,
} from '@/hooks/useStockItems';
import { CATEGORY_LABELS, UNIT_LABELS } from '@/hooks/useStockItems';
import { StockService } from '@/modules/stock/services/StockService';
import { parseSafeDate } from '@/hooks/useExpiryDates';
import { getNow } from '@/lib/utils';
import {
  MobileList,
  MobileListItem,
  MobileListTitle,
  MobileListDetails,
  MobileListBadge,
} from '@/components/ui/mobile-list';

interface StockItemWithProjection extends StockItem {
  projectedQuantity?: number;
  projectedConsumption?: number;
}

interface StockTableProps {
  items: StockItemWithProjection[];
  onMovement: (item: StockItem) => void;
  onEdit: (item: StockItem) => void;
  onDelete: (item: StockItem) => void;
  onCountedQuantityChange?: (itemId: string, quantity: number) => void;
  onTransfer?: (item: StockItem) => void;
  isVoiceActive?: boolean;
  activeVoiceItemId?: string | null;
  onVoiceToggle?: (itemId: string) => void;
  onManageBatches?: (item: StockItem) => void;
  expiryMap?: Record<string, string>;
}

export function StockTable({
  items,
  onMovement,
  onEdit,
  onDelete,
  onCountedQuantityChange,
  onTransfer,
  onManageBatches,
  isVoiceActive,
  activeVoiceItemId,
  onVoiceToggle,
  expiryMap = {}
}: StockTableProps) {
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');

  const handleStartEdit = (item: StockItemWithProjection, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingItemId(item.id);
    setEditValue(Number(item.current_quantity).toFixed(3));
  };

  const handleConfirmEdit = (itemId: string) => {
    const quantity = parseFloat(editValue);
    if (!isNaN(quantity) && quantity >= 0 && onCountedQuantityChange) {
      onCountedQuantityChange(itemId, quantity);
    }
    setEditingItemId(null);
    setEditValue('');
  };

  const handleCancelEdit = () => {
    setEditingItemId(null);
    setEditValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent, itemId: string) => {
    if (e.key === 'Enter') {
      handleConfirmEdit(itemId);
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  if (items.length === 0) {
    return (
      <EmptyState
        icon={Package}
        title="Nenhum item no estoque"
        description="Adicione ingredientes e insumos para começar a controlar seu estoque."
      />
    );
  }

  return (
    <MobileList>
      {items.map((item) => {
        const currentQty = Number(item.current_quantity);
        const minQty = Number(item.minimum_quantity);
        const isExpired = currentQty > 0 && expiryMap[item.id] && parseSafeDate(expiryMap[item.id]) < getNow();
        const status = StockService.getStockStatus(currentQty, minQty, !!isExpired);
        const unitLabel = UNIT_LABELS[item.unit as keyof typeof UNIT_LABELS];
        const categoryLabel = CATEGORY_LABELS[item.category as StockCategory];
        const isEditing = editingItemId === item.id;

        return (
          <MobileListItem
            key={item.id}
            className={cn(
              "py-2",
              status === 'red' && 'border-destructive/50 bg-destructive/5',
              status === 'yellow' && 'border-warning/50 bg-warning/5'
            )}
            actions={
              <div className="flex items-center gap-1">
                {onVoiceToggle && (
                  <Button
                    variant={isVoiceActive && activeVoiceItemId === item.id ? "destructive" : "outline"}
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onVoiceToggle(item.id);
                    }}
                    className={cn(isVoiceActive && activeVoiceItemId === item.id && "animate-pulse")}
                  >
                    <Mic className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onMovement(item);
                  }}
                >
                  <ArrowUpDown className="h-4 w-4" />
                </Button>
                {onTransfer && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onTransfer(item);
                    }}
                    title="Transferir para outro estoque"
                  >
                    <ArrowRightLeft className="h-4 w-4" />
                  </Button>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {onManageBatches && (
                      <DropdownMenuItem onClick={() => onManageBatches(item)}>
                        <Calendar className="h-4 w-4 mr-2" />
                        Gerenciar Lotes
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => onEdit(item)}>
                      <Pencil className="h-4 w-4 mr-2" />
                      Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => onDelete(item)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            }
          >
            {/* Linha 1: Nome e Status */}
            <div className="flex items-center gap-2">
              <MobileListTitle className="flex items-center gap-2">
                {item.name}
                {currentQty > 0 && expiryMap[item.id] && (() => {
                  const expiryDate = parseSafeDate(expiryMap[item.id]);
                  const today = getNow();
                  const diffTime = expiryDate.getTime() - today.getTime();
                  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                  return (
                    <div
                      className={cn(
                        "flex flex-col items-center justify-center min-w-[34px] h-8 rounded border text-[7px] font-bold leading-none uppercase shrink-0 cursor-pointer hover:bg-muted transition-colors",
                        diffDays < 0 ? "bg-destructive/10 border-destructive/30 text-destructive" :
                          diffDays <= 7 ? "bg-orange-100 border-orange-200 text-orange-600" :
                            "bg-secondary/50 border-muted-foreground/20 text-muted-foreground"
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onManageBatches) onManageBatches(item);
                      }}
                    >
                      <span className="mb-0.5 opacity-70">Val</span>
                      <span className="text-[9px]">{expiryDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
                    </div>
                  );
                })()}
              </MobileListTitle>
              <MobileListBadge
                variant={status === 'green' ? 'success' : status === 'yellow' ? 'warning' : 'destructive'}
              >
                {status === 'green' ? 'OK' : status === 'yellow' ? 'Baixo' : 'Crítico'}
              </MobileListBadge>
            </div>

            {/* Linha 2: Categoria, Fornecedor, Quantidades - Compact */}
            <MobileListDetails className="text-xs gap-1.5 flex-wrap">
              <span className="bg-secondary px-1 py-0.5 rounded text-[10px]">{categoryLabel}</span>
              {(item as any).supplier?.name && (
                <span className="text-muted-foreground italic truncate max-w-[100px]">
                  {(item as any).supplier.name}
                </span>
              )}
              <span>Atual: <strong>{formatQuantity(currentQty)}{unitLabel}</strong></span>
              {isEditing ? (
                <span className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                  <Input
                    type="number"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, item.id)}
                    className="w-16 h-5 text-xs px-1"
                    step="0.001"
                    min="0"
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                  <Button variant="ghost" size="icon" className="h-4 w-4" onClick={(e) => { e.stopPropagation(); handleConfirmEdit(item.id); }}>
                    <Check className="h-3 w-3 text-green-600" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-4 w-4" onClick={(e) => { e.stopPropagation(); handleCancelEdit(); }}>
                    <X className="h-3 w-3 text-destructive" />
                  </Button>
                </span>
              ) : (
                <button className="hover:underline" onClick={(e) => handleStartEdit(item, e)}>
                  Contada: <strong>{formatQuantity(currentQty)}</strong>
                </button>
              )}
              <span>Mín: {formatQuantity(minQty)}{unitLabel}</span>
            </MobileListDetails>
          </MobileListItem>
        );
      })}
    </MobileList>
  );
}
