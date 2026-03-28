import { BaseApiService } from './BaseApiService';
import { TechnicalSheet, TechnicalSheetInsert, TechnicalSheetUpdate } from '@/modules/technical-sheets/types';

export class TechnicalSheetApi extends BaseApiService {
    protected get endpoint(): string {
        return 'technical_sheets';
    }

    async getAll(): Promise<any[]> {
        const query = `select=*,ingredients:technical_sheet_ingredients(*,stock_item:stock_items(name,unit,unit_price))&order=name&limit=1000`;
        return this.get<any>(query);
    }

    async create(sheet: TechnicalSheetInsert): Promise<TechnicalSheet> {
        return this.post<TechnicalSheet>(sheet);
    }

    async update(id: string, updates: TechnicalSheetUpdate): Promise<TechnicalSheet> {
        return this.patch<TechnicalSheet>(id, updates);
    }

    async remove(id: string): Promise<void> {
        return this.delete(id);
    }
}

export const technicalSheetApi = new TechnicalSheetApi();
