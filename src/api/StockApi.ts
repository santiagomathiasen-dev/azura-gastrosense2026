import { BaseApiService } from './BaseApiService';
import { StockItem, StockItemInsert, StockItemUpdate } from '@/modules/stock/types';

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
        return this.post<StockItem>(item);
    }

    async update(id: string, updates: StockItemUpdate): Promise<StockItem> {
        return this.patch<StockItem>(id, updates);
    }

    async remove(id: string): Promise<void> {
        return this.delete(id);
    }
}

export const stockApi = new StockApi();
