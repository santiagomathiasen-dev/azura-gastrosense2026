import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { CATEGORY_LABELS, UNIT_LABELS, type StockCategory, type StockUnit } from '@/hooks/stock/useStockItems';
import type { ExtractedIngredient } from '@/hooks/purchases/useIngredientImport';

interface IngredientConfirmationListProps {
  ingredients: ExtractedIngredient[];
  onToggle: (index: number) => void;
  onUpdate: (index: number, updates: Partial<ExtractedIngredient>) => void;
  onRemove: (index: number) => void;
}

export function IngredientConfirmationList({
  ingredients,
  onToggle,
  onUpdate,
  onRemove,
}: IngredientConfirmationListProps) {
  if (ingredients.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Nenhum ingrediente encontrado no documento.
      </div>
    );
  }

  return (
    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
      {ingredients.map((ingredient, index) => (
        <div
          key={index}
          className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${ingredient.selected ? 'bg-muted/50 border-primary/30' : 'bg-muted/20 border-transparent opacity-60'
            }`}
        >
          <Checkbox
            checked={ingredient.selected}
            onCheckedChange={() => onToggle(index)}
            className="mt-2"
          />

          <div className="flex-1 space-y-2">
            {/* Nome do ingrediente */}
            <Input
              value={ingredient.name}
              onChange={(e) => onUpdate(index, { name: e.target.value })}
              placeholder="Nome do ingrediente"
              className="font-medium"
            />

            {/* Quantidade, Unidade, Categoria */}
            <div className="flex gap-2">
              <Input
                type="number"
                value={ingredient.quantity || ''}
                onChange={(e) => onUpdate(index, { quantity: Number(e.target.value) || 0 })}
                placeholder="Qtd"
                className="w-20"
              />

              <Select
                value={ingredient.unit}
                onValueChange={(value) => onUpdate(index, { unit: value as StockUnit })}
              >
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(UNIT_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={ingredient.category}
                onValueChange={(value) => onUpdate(index, { category: value as StockCategory })}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Preço e Fornecedor */}
            <div className="flex gap-2">
              <div className="relative w-28">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                <Input
                  type="number"
                  step="0.01"
                  value={ingredient.price ?? ''}
                  onChange={(e) => onUpdate(index, { price: e.target.value ? Number(e.target.value) : null })}
                  placeholder="0,00"
                  className="pl-8"
                />
              </div>

              <Input
                value={ingredient.supplier ?? ''}
                onChange={(e) => onUpdate(index, { supplier: e.target.value || null })}
                placeholder="Fornecedor (opcional)"
                className="flex-1"
              />

              <Input
                type="date"
                value={ingredient.expiration_date || ''}
                onChange={(e) => onUpdate(index, { expiration_date: e.target.value || null })}
                className="w-36"
              />
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => onRemove(index)}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  );
}
