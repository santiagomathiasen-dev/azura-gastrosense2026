import { z } from 'zod';

export const TechnicalSheetIngredientSchema = z.object({
    id: z.string().uuid().optional(),
    technical_sheet_id: z.string().uuid().optional(),
    stock_item_id: z.string().uuid(),
    quantity: z.number().min(0, "A quantidade não pode ser negativa"),
    unit: z.string().optional(),
    cost: z.number().min(0).optional(),
    stage_id: z.string().uuid().nullable().optional(),
    stock_item: z.object({
        name: z.string(),
        unit: z.string(),
        unit_price: z.number().nullable().optional(),
    }).optional(),
});

export const TechnicalSheetSchema = z.object({
    id: z.string().uuid(),
    user_id: z.string().uuid(),
    name: z.string().min(2, "O nome deve ter pelo menos 2 caracteres"),
    description: z.string().nullable().optional(),
    yield_quantity: z.number().min(0.001, "O rendimento deve ser maior que zero"),
    yield_unit: z.string(),
    category: z.string().nullable().optional(),
    total_cost: z.number().min(0).optional(),
    unit_cost: z.number().min(0).optional(),

    // Missing fields added
    production_type: z.enum(['insumo', 'final']).default('final'),
    minimum_stock: z.number().min(0).default(0),
    video_url: z.string().url().nullable().optional(),
    labor_cost: z.number().min(0).default(0),
    energy_cost: z.number().min(0).default(0),
    other_costs: z.number().min(0).default(0),
    markup: z.number().min(0).default(0),
    target_price: z.number().min(0).nullable().optional(),
    preparation_time: z.number().min(0).nullable().optional(),
    preparation_method: z.string().nullable().optional(),
    shelf_life_hours: z.number().min(0).nullable().optional(),
    lead_time_hours: z.number().min(0).nullable().optional(),
    image_url: z.string().url().nullable().optional(),
    praca: z.string().nullable().optional(),

    created_at: z.string().optional(),
    updated_at: z.string().optional(),
    ingredients: z.array(TechnicalSheetIngredientSchema).optional(),
});

export const TechnicalSheetInsertSchema = TechnicalSheetSchema.omit({
    id: true,
    created_at: true,
    updated_at: true,
    total_cost: true,
    unit_cost: true,
    ingredients: true
});

export type TechnicalSheet = z.infer<typeof TechnicalSheetSchema>;
export type TechnicalSheetInsert = z.infer<typeof TechnicalSheetInsertSchema>;
export type TechnicalSheetUpdate = Partial<TechnicalSheetInsert>;
export type TechnicalSheetIngredient = z.infer<typeof TechnicalSheetIngredientSchema>;
