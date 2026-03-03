import {
    ProductionStatus,
    ProductionWithSheet
} from '../types';

export interface DeductionPlan {
    fromProduction: number;
    fromCentral: number;
    insufficient: number;
    batchDeductions: { batchId: string; take: number }[];
}

export class ProductionService {
    /**
     * Calculates the multiplier for an ingredient based on planned quantity vs yield.
     */
    static getMultiplier(plannedQuantity: number, yieldQuantity: number): number {
        if (yieldQuantity <= 0) return 0;
        return plannedQuantity / yieldQuantity;
    }

    /**
     * Calculates the needed quantity for an ingredient including waste factor.
     */
    static calculateNeededQuantity(
        baseIngredientQuantity: number,
        multiplier: number,
        wasteFactorPercentage: number = 0
    ): number {
        const baseQty = baseIngredientQuantity * multiplier;
        const wasteFactor = wasteFactorPercentage / 100;
        return baseQty * (1 + wasteFactor);
    }

    /**
     * Plans how to deduct stock for a single ingredient.
     * Priority: Production Stock -> Central Stock -> Purchase Order
     */
    static planStockDeduction(
        neededQty: number,
        availableInProduction: number,
        availableInCentral: number,
        expiryBatches: { id: string; quantity: number }[]
    ): DeductionPlan {
        let remaining = neededQty;
        const plan: DeductionPlan = {
            fromProduction: 0,
            fromCentral: 0,
            insufficient: 0,
            batchDeductions: []
        };

        // 1. Use from production stock
        if (availableInProduction > 0) {
            const take = Math.min(availableInProduction, remaining);
            plan.fromProduction = take;
            remaining -= take;
        }

        // 2. Use from central stock
        if (remaining > 0 && availableInCentral > 0) {
            const take = Math.min(availableInCentral, remaining);
            plan.fromCentral = take;

            // Calculate batch deductions for central stock
            let batchRemaining = take;
            for (const batch of expiryBatches) {
                if (batchRemaining <= 0) break;
                const batchTake = Math.min(batchRemaining, batch.quantity);
                plan.batchDeductions.push({ batchId: batch.id, take: batchTake });
                batchRemaining -= batchTake;
            }

            remaining -= take;
        }

        // 3. Any remaining is insufficient
        plan.insufficient = remaining;

        return plan;
    }

    /**
     * Validates if status transition is allowed.
     */
    static isStarting(oldStatus: ProductionStatus, newStatus: ProductionStatus): boolean {
        return (oldStatus === 'planned' || oldStatus === 'requested') && newStatus === 'in_progress';
    }

    /**
     * Validates if production is completing.
     */
    static isCompleting(oldStatus: ProductionStatus, newStatus: ProductionStatus): boolean {
        return (oldStatus === 'in_progress' || oldStatus === 'paused') && newStatus === 'completed';
    }

    /**
     * Logic to determine batch codes for produced inputs.
     */
    static generateBatchCode(sheetName: string): string {
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const random = Math.random().toString(36).substring(2, 6).toUpperCase();
        return `${sheetName.substring(0, 3).toUpperCase()}-${dateStr}-${random}`;
    }
}
