import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useOwnerId } from './useOwnerId';
import { toast } from 'sonner';
import { supabaseFetch } from '@/lib/supabase-fetch';

export interface FinancialExpense {
    id: string;
    description: string;
    amount: number;
    category: 'fixed' | 'variable';
    type: 'invoice' | 'service' | 'other';
    date: string;
    status: 'paid' | 'pending';
    invoice_number?: string;
    document_url?: string;
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
            try {
                const data = await supabaseFetch('financial_expenses?select=*&order=date.desc');
                return (Array.isArray(data) ? data : data ? [data] : []) as FinancialExpense[];
            } catch (err) {
                console.error('Error fetching expenses:', err);
                return [];
            }
        },
        enabled: !!ownerId,
        staleTime: 10 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
    });

    const { data: payroll = [], isLoading: payrollLoading } = useQuery({
        queryKey: ['payroll', ownerId],
        queryFn: async () => {
            if (!ownerId) return [];
            try {
                const data = await supabaseFetch('payroll_entries?select=*&order=date.desc');
                return (Array.isArray(data) ? data : data ? [data] : []) as PayrollEntry[];
            } catch (err) {
                console.error('Error fetching payroll:', err);
                return [];
            }
        },
        enabled: !!ownerId,
        staleTime: 10 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
    });

    const addExpense = useMutation({
        mutationFn: async (expense: Omit<FinancialExpense, 'id'>) => {
            if (!ownerId) throw new Error('Owner ID not found');
            const data = await supabaseFetch('financial_expenses', {
                method: 'POST',
                headers: { 'Prefer': 'return=representation' },
                body: JSON.stringify({ ...expense, user_id: ownerId })
            });
            return Array.isArray(data) ? data[0] : data;
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
            const data = await supabaseFetch('payroll_entries', {
                method: 'POST',
                headers: { 'Prefer': 'return=representation' },
                body: JSON.stringify({ ...entry, user_id: ownerId })
            });
            return Array.isArray(data) ? data[0] : data;
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
