import { z } from 'zod';

export const ProductionStatusSchema = z.enum([
    'requested',
    'planned',
    'in_progress',
    'completed',
    'cancelled',
    'paused'
]);

export const ProductionPeriodSchema = z.enum([
    'day',
    'week',
    'month',
    'year',
    'custom'
]);

export const ProductionStockItemSchema = z.object({
    id: z.string().uuid(),
    user_id: z.string().uuid(),
    stock_item_id: z.string().uuid(),
    quantity: z.number().min(0),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
    stock_item: z.any().optional(), // Flexible for joins
});

export const StockTransferSchema = z.object({
    id: z.string().uuid(),
    user_id: z.string().uuid(),
    stock_item_id: z.string().uuid(),
    quantity: z.number().positive(),
    direction: z.enum(['to_production', 'to_central']),
    notes: z.string().nullable().optional(),
    created_at: z.string().optional(),
});

export const ProductionSchema = z.object({
    id: z.string().uuid(),
    user_id: z.string().uuid(),
    technical_sheet_id: z.string().uuid(),
    name: z.string().min(2, "O nome deve ter pelo menos 2 caracteres"),
    status: ProductionStatusSchema,
    planned_quantity: z.number().positive(),
    actual_quantity: z.number().min(0).nullable().optional(),
    scheduled_date: z.string(),
    completed_at: z.string().nullable().optional(),
    praca: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
});

export const ProductionInsertSchema = ProductionSchema.omit({
    id: true,
    created_at: true,
    updated_at: true
});

export type ProductionStatus = z.infer<typeof ProductionStatusSchema>;
export type ProductionPeriod = z.infer<typeof ProductionPeriodSchema>;
export type ProductionStockItem = z.infer<typeof ProductionStockItemSchema>;
export type StockTransfer = z.infer<typeof StockTransferSchema>;
export type Production = z.infer<typeof ProductionSchema>;
export type ProductionInsert = z.infer<typeof ProductionInsertSchema>;
export type ProductionUpdate = Partial<ProductionInsert>;

export interface ProductionWithSheet extends Production {
    technical_sheet: {
        id: string;
        name: string;
        yield_quantity: number;
        yield_unit: string;
        preparation_method: string | null;
        production_type?: 'insumo' | 'final';
        shelf_life_hours?: number | null;
        ingredients: {
            stock_item_id: string;
            quantity: number;
            unit: string;
            stage_id?: string | null;
            stock_item: { name: string; unit?: string; unit_price?: number | null } | null;
        }[];
    } | null;
}
