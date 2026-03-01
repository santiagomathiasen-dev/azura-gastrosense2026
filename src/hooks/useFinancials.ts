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
    payslip_data?: {
        base_salary: number;
        overtime: number;
        bonuses: number;
        deductions: number;
        net_salary: number;
    };
}

export function useFinancials() {
    const { ownerId } = useOwnerId();
    const queryClient = useQueryClient();

    const { data: expenses = [], isLoading: expensesLoading } = useQuery({
        queryKey: ['financial_expenses', ownerId],
        queryFn: async () => {
            if (!ownerId) return [];
            const { data, error } = await supabase
                .from('financial_expenses' as any)
                .select('*')
                .eq('user_id', ownerId)
                .order('date', { ascending: false });

            if (error) {
                console.error('Error fetching expenses:', error);
                return [];
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
                .eq('user_id', ownerId)
                .order('date', { ascending: false });

            if (error) {
                console.error('Error fetching payroll:', error);
                return [];
            }
            return data as unknown as PayrollEntry[];
        },
        enabled: !!ownerId,
    });

    const addExpense = useMutation({
        mutationFn: async (expense: Omit<FinancialExpense, 'id'>) => {
            if (!ownerId) throw new Error('Owner ID not found');
            const { data, error } = await supabase
                .from('financial_expenses' as any)
                .insert([{ ...expense, user_id: ownerId }])
                .select()
                .single();
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['financial_expenses'] });
            toast.success('Gasto registrado com sucesso!');
        },
        onError: (error) => {
            console.error('Error adding expense:', error);
            toast.error('Falha ao registrar gasto: ' + error.message);
        }
    });

    const addPayroll = useMutation({
        mutationFn: async (entry: Omit<PayrollEntry, 'id'>) => {
            if (!ownerId) throw new Error('Owner ID not found');
            const { data, error } = await supabase
                .from('payroll_entries' as any)
                .insert([{ ...entry, user_id: ownerId }])
                .select()
                .single();
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['payroll'] });
            toast.success('Lançamento de folha registrado!');
        },
        onError: (error) => {
            console.error('Error adding payroll:', error);
            toast.error('Falha ao registrar folha: ' + error.message);
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
