import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useOwnerId } from './useOwnerId';
import { toast } from 'sonner';

export interface FinancialExpense {
    id: string;
    description: string;
    amount: number;
    category: 'fixed' | 'variable';
    type: 'invoice' | 'service' | 'other';
    date: string;
    status: 'paid' | 'pending';
    invoice_number?: string;
}

export interface PayrollEntry {
    id: string;
    collaborator_id: string;
    collaborator_name: string;
    type: 'salary' | 'freelance' | 'bonus';
    amount: number;
    date: string;
    status: 'paid' | 'pending';
}

export function useFinancials() {
    const { user } = useAuth();
    const { ownerId } = useOwnerId();
    const queryClient = useQueryClient();

    // For now, we simulate these tables using common queries or local storage fallback
    // since they might not exist yet in the database schema.

    const { data: expenses = [], isLoading: expensesLoading } = useQuery({
        queryKey: ['financial_expenses', ownerId],
        queryFn: async () => {
            if (!ownerId) return [];

            // Attempt to fetch from a hypothetical table, fallback to empty
            const { data, error } = await supabase
                .from('financial_expenses' as any)
                .select('*')
                .eq('owner_id', ownerId);

            if (error) {
                console.warn('financial_expenses table not found, using empty list');
                return [] as unknown as FinancialExpense[];
            }
            return data as unknown as FinancialExpense[];
        },
        enabled: !!ownerId,
    });

    const { data: payroll = [], isLoading: payrollLoading } = useQuery({
        queryKey: ['payroll', ownerId],
        queryFn: async () => {
            if (!ownerId) return [];

            const { data, error } = await supabase
                .from('payroll_entries' as any)
                .select('*')
                .eq('owner_id', ownerId);

            if (error) {
                console.warn('payroll_entries table not found, using empty list');
                return [] as unknown as PayrollEntry[];
            }
            return data as unknown as PayrollEntry[];
        },
        enabled: !!ownerId,
    });

    const addExpense = useMutation({
        mutationFn: async (expense: Omit<FinancialExpense, 'id'>) => {
            const { data, error } = await supabase
                .from('financial_expenses' as any)
                .insert([{ ...expense, owner_id: ownerId }])
                .select()
                .single();
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['financial_expenses'] });
            toast.success('Gasto registrado com sucesso!');
        }
    });

    const addPayroll = useMutation({
        mutationFn: async (entry: Omit<PayrollEntry, 'id'>) => {
            const { data, error } = await supabase
                .from('payroll_entries' as any)
                .insert([{ ...entry, owner_id: ownerId }])
                .select()
                .single();
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['payroll'] });
            toast.success('Lançamento de folha registrado!');
        }
    });

    return {
        expenses,
        payroll,
        isLoading: expensesLoading || payrollLoading,
        addExpense,
        addPayroll
    };
}
