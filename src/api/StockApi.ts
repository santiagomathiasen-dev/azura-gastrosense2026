import { BaseApiService } from './BaseApiService';
import { StockItem, StockItemInsert, StockItemUpdate } from '@/modules/stock/types';

const VALID_CATEGORIES = new Set(['laticinios', 'secos_e_graos', 'hortifruti', 'carnes_e_peixes', 'embalagens', 'limpeza', 'outros']);
const VALID_UNITS = new Set(['kg', 'g', 'L', 'ml', 'unidade', 'caixa', 'dz']);

const UNIT_MAP: Record<string, string> = {
    l: 'L', litro: 'L', litros: 'L',
    quilos: 'kg', quilo: 'kg', kilos: 'kg', kilo: 'kg',
    grama: 'g', gramas: 'g',
    mililitro: 'ml', mililitros: 'ml',
    un: 'unidade', und: 'unidade', unid: 'unidade', unidades: 'unidade',
    cx: 'caixa', caixas: 'caixa',
    duzia: 'dz', duzias: 'dz',
};

function normalizeUnit(unit: string | null | undefined): string {
    if (!unit || unit === 'null') return 'unidade';
    const u = unit.trim();
    if (VALID_UNITS.has(u)) return u;
    return UNIT_MAP[u.toLowerCase()] || 'unidade';
}

function normalizeCategory(cat: string | null | undefined): string {
    if (!cat || cat === 'null') return 'outros';
    const c = cat.trim().toLowerCase();
    if (VALID_CATEGORIES.has(c)) return c;
    return 'outros';
}

export class StockApi extends BaseApiService {
    protected get endpoint(): string {
        return 'stock_items';
    }

    async getAll(ownerId: string): Promise<StockItem[]> {
        return this.get<StockItem>(`select=*&order=name.asc&limit=2000`);
    }

    async getById(id: string): Promise<StockItem | null> {
        return this.getOne<StockItem>(`id=eq.${id}&select=*`);
    }

    async create(item: StockItemInsert): Promise<StockItem> {
        const normalized = {
            ...item,
            unit: normalizeUnit(item.unit as string),
            category: normalizeCategory(item.category as string),
        };
        return this.post<StockItem>(normalized);
    }

    async update(id: string, updates: StockItemUpdate): Promise<StockItem> {
        return this.patch<StockItem>(id, updates);
    }

    async remove(id: string): Promise<void> {
        return this.delete(id);
    }
}

export const stockApi = new StockApi();
