import { StockStatus, StockItemSchema, StockItemInsertSchema, StockItem } from '../types';

export class StockService {
    /**
     * Validates a stock item.
     */
    static validateItem(item: any): StockItem {
        return StockItemSchema.parse(item);
    }

    /**
     * Validates a partial stock item for creation.
     */
    static validateInsert(item: any) {
        return StockItemInsertSchema.parse(item);
    }

    /**
     * Calculates the status of a stock item based on current and minimum quantities.
     */
    static getStockStatus(currentQty: number, minimumQty: number, isExpired?: boolean): 'green' | 'yellow' | 'red' {
        if (isExpired || currentQty <= minimumQty) return 'red';
        if (currentQty <= minimumQty * 1.2) return 'yellow';
        return 'green';
    }

    /**
     * Returns a detailed status object with labels and colors.
     */
    static getDetailedStatus(currentQty: number, minimumQty: number, isExpired?: boolean): StockStatus {
        const status = this.getStockStatus(currentQty, minimumQty, isExpired);

        switch (status) {
            case 'red':
                return { status: 'red', label: 'Crítico', color: 'text-red-600 bg-red-100' };
            case 'yellow':
                return { status: 'yellow', label: 'Alerta', color: 'text-yellow-600 bg-yellow-100' };
            case 'green':
            default:
                return { status: 'green', label: 'Ok', color: 'text-green-600 bg-green-100' };
        }
    }

    /**
     * Filters items that need attention.
     */
    static getItemsInAlert<T extends { current_quantity?: any; minimum_quantity?: any; is_expired?: boolean }>(items: T[]): T[] {
        return items.filter(item =>
            this.getStockStatus(Number(item.current_quantity), Number(item.minimum_quantity), item.is_expired) !== 'green'
        );
    }
}
