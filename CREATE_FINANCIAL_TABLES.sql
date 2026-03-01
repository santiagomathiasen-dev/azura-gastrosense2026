-- ============================================
-- CRIAÇÃO DE TABELAS FINANCEIRAS E FOLHA
-- ============================================
-- 1. Tabela de Gastos/Despesas
CREATE TABLE IF NOT EXISTS public.financial_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    amount NUMERIC NOT NULL DEFAULT 0,
    category TEXT NOT NULL CHECK (category IN ('fixed', 'variable')),
    type TEXT NOT NULL DEFAULT 'other' CHECK (type IN ('invoice', 'service', 'other')),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('paid', 'pending')),
    invoice_number TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
-- 2. Tabela de Folha de Pagamento (Payroll)
CREATE TABLE IF NOT EXISTS public.payroll_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    collaborator_id UUID NOT NULL REFERENCES public.collaborators(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL DEFAULT 0,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    type TEXT NOT NULL DEFAULT 'salary' CHECK (type IN ('salary', 'freelance', 'bonus')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('paid', 'pending')),
    payslip_data JSONB DEFAULT '{}'::jsonb,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
-- 3. Políticas de RLS
ALTER TABLE public.financial_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_entries ENABLE ROW LEVEL SECURITY;
-- Políticas para financial_expenses
CREATE POLICY "Users can view their own expenses" ON public.financial_expenses FOR
SELECT USING (
        user_id = auth.uid()
        OR user_id IN (
            SELECT gestor_id
            FROM public.profiles
            WHERE id = auth.uid()
        )
    );
CREATE POLICY "Users can insert their own expenses" ON public.financial_expenses FOR
INSERT WITH CHECK (
        user_id = auth.uid()
        OR user_id IN (
            SELECT gestor_id
            FROM public.profiles
            WHERE id = auth.uid()
        )
    );
CREATE POLICY "Users can update their own expenses" ON public.financial_expenses FOR
UPDATE USING (
        user_id = auth.uid()
        OR user_id IN (
            SELECT gestor_id
            FROM public.profiles
            WHERE id = auth.uid()
        )
    );
CREATE POLICY "Users can delete their own expenses" ON public.financial_expenses FOR DELETE USING (
    user_id = auth.uid()
    OR user_id IN (
        SELECT gestor_id
        FROM public.profiles
        WHERE id = auth.uid()
    )
);
-- Políticas para payroll_entries
CREATE POLICY "Users can view their own payroll" ON public.payroll_entries FOR
SELECT USING (
        user_id = auth.uid()
        OR user_id IN (
            SELECT gestor_id
            FROM public.profiles
            WHERE id = auth.uid()
        )
    );
CREATE POLICY "Users can insert their own payroll" ON public.payroll_entries FOR
INSERT WITH CHECK (
        user_id = auth.uid()
        OR user_id IN (
            SELECT gestor_id
            FROM public.profiles
            WHERE id = auth.uid()
        )
    );
CREATE POLICY "Users can update their own payroll" ON public.payroll_entries FOR
UPDATE USING (
        user_id = auth.uid()
        OR user_id IN (
            SELECT gestor_id
            FROM public.profiles
            WHERE id = auth.uid()
        )
    );
CREATE POLICY "Users can delete their own payroll" ON public.payroll_entries FOR DELETE USING (
    user_id = auth.uid()
    OR user_id IN (
        SELECT gestor_id
        FROM public.profiles
        WHERE id = auth.uid()
    )
);
-- 4. Índices para performance
CREATE INDEX IF NOT EXISTS idx_financial_expenses_user_id ON public.financial_expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_payroll_entries_user_id ON public.payroll_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_payroll_entries_collaborator_id ON public.payroll_entries(collaborator_id);