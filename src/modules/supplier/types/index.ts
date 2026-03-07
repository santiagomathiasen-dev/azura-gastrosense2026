import { z } from 'zod';

export const SupplierSchema = z.object({
    id: z.string().uuid(),
    user_id: z.string().uuid(),
    name: z.string().min(2, "O nome deve ter pelo menos 2 caracteres"),
    contact_name: z.string().nullable().optional(),
    email: z.string().email("E-mail inválido").nullable().optional(),
    phone: z.string().nullable().optional(),
    whatsapp: z.string().nullable().optional(),
    whatsapp_number: z.string().nullable().optional(),
    address: z.string().nullable().optional(),
    category: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    // Added extended columns
    cnpj_cpf: z.string().nullable().optional(),
    average_delivery_days: z.number().nullable().optional(),
    quality_rating: z.number().nullable().optional(),
    payment_method: z.string().nullable().optional(),
    zip_code: z.string().nullable().optional(),
    city: z.string().nullable().optional(),
    state: z.string().nullable().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
});

export const SupplierInsertSchema = SupplierSchema.omit({
    id: true,
    created_at: true,
    updated_at: true
});

export type Supplier = z.infer<typeof SupplierSchema>;
export type SupplierInsert = z.infer<typeof SupplierInsertSchema>;
export type SupplierUpdate = Partial<SupplierInsert>;
