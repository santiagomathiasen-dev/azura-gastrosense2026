import { BaseApiService } from './BaseApiService';
import { Supplier, SupplierInsert, SupplierUpdate } from '@/modules/supplier/types';

export class SupplierApi extends BaseApiService {
    protected get endpoint(): string {
        return 'suppliers';
    }

    async getAll(): Promise<Supplier[]> {
        return this.get<Supplier>(`select=*&order=name.asc&limit=500`);
    }

    async create(supplier: SupplierInsert): Promise<Supplier> {
        return this.post<Supplier>(supplier);
    }

    async update(id: string, updates: SupplierUpdate): Promise<Supplier> {
        return this.patch<Supplier>(id, updates);
    }

    async remove(id: string): Promise<void> {
        return this.delete(id);
    }
}

export const supplierApi = new SupplierApi();
