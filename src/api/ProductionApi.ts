import { BaseApiService } from './BaseApiService';
import { Production, ProductionInsert, ProductionUpdate, ProductionWithSheet } from '@/modules/production/types';

export class ProductionApi extends BaseApiService {
    protected get endpoint(): string {
        return 'productions';
    }

    async getAll(ownerId: string): Promise<ProductionWithSheet[]> {
        // Note: Complex join logic from hook
        const query = `select=*,technical_sheet:technical_sheets(id,name,yield_quantity,yield_unit,preparation_method,ingredients:technical_sheet_ingredients(stock_item_id,quantity,unit,stage_id,stock_item:stock_items(name)))&order=scheduled_date.asc&limit=500`;
        return this.get<ProductionWithSheet>(query);
    }

    async create(production: ProductionInsert): Promise<Production> {
        return this.post<Production>(production);
    }

    async update(id: string, updates: ProductionUpdate): Promise<Production> {
        return this.patch<Production>(id, updates);
    }

    async remove(id: string): Promise<void> {
        return this.delete(id);
    }
}

export const productionApi = new ProductionApi();
