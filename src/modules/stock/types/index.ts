import type { Database } from '@/integrations/supabase/types';

export type StockItem = Database['public']['Tables']['stock_items']['Row'];
export type StockItemInsert = Database['public']['Tables']['stock_items']['Insert'];
export type StockItemUpdate = Database['public']['Tables']['stock_items']['Update'];
export type StockCategory = Database['public']['Enums']['stock_category'];
export type StockUnit = Database['public']['Enums']['stock_unit'];

export interface StockStatus {
    status: 'green' | 'yellow' | 'red';
    label: string;
    color: string;
}

export interface StockItemWithSupplier extends StockItem {
    suppliers?: {
        name: string;
    } | null;
}

export const CATEGORY_LABELS: Record<StockCategory, string> = {
    laticinios: 'Laticínios',
    secos_e_graos: 'Secos e Grãos',
    hortifruti: 'Hortifruti',
    carnes_e_peixes: 'Carnes e Peixes',
    embalagens: 'Embalagens',
    limpeza: 'Limpeza',
    outros: 'Outros',
};

export const UNIT_LABELS: Record<StockUnit, string> = {
    kg: 'kg',
    g: 'g',
    L: 'L',
    ml: 'ml',
    unidade: 'un',
    caixa: 'cx',
    dz: 'dz',
};
