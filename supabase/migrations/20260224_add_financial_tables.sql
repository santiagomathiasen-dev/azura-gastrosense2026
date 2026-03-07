-- Criação do Enum para Categoria de Despesa
CREATE TYPE "public"."expense_category" AS ENUM ('fixed', 'variable');
CREATE TYPE "public"."expense_type" AS ENUM ('invoice', 'service', 'other');
CREATE TYPE "public"."financial_status" AS ENUM ('paid', 'pending');
CREATE TYPE "public"."payroll_type" AS ENUM ('salary', 'freelance', 'bonus');
-- Tabela financial_expenses
CREATE TABLE IF NOT EXISTS "public"."financial_expenses" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" uuid NOT NULL,
    "description" text NOT NULL,
    "amount" numeric NOT NULL DEFAULT 0,
    "category" "public"."expense_category" NOT NULL,
    "type" "public"."expense_type" NOT NULL,
    "date" date NOT NULL,
    "status" "public"."financial_status" NOT NULL DEFAULT 'pending',
    "invoice_number" text,
    "document_url" text,
    "created_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    "updated_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT "financial_expenses_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "financial_expenses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE
);
-- Tabela payroll_entries
CREATE TABLE IF NOT EXISTS "public"."payroll_entries" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" uuid NOT NULL,
    "collaborator_id" uuid NOT NULL,
    "collaborator_name" text NOT NULL,
    "type" "public"."payroll_type" NOT NULL,
    "amount" numeric NOT NULL DEFAULT 0,
    "date" date NOT NULL,
    "status" "public"."financial_status" NOT NULL DEFAULT 'pending',
    "payslip_data" jsonb,
    "created_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    "updated_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT "payroll_entries_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "payroll_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE,
    CONSTRAINT "payroll_entries_collaborator_id_fkey" FOREIGN KEY ("collaborator_id") REFERENCES "public"."collaborators"("id") ON DELETE CASCADE
);
-- Ativar RLS
ALTER TABLE "public"."financial_expenses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."payroll_entries" ENABLE ROW LEVEL SECURITY;
-- Políticas de RLS para financial_expenses
CREATE POLICY "Users can insert their own expenses or admin/gestor can." ON "public"."financial_expenses" FOR
INSERT WITH CHECK (can_access_owner_data(user_id));
CREATE POLICY "Users can view their own expenses or admin/gestor can." ON "public"."financial_expenses" FOR
SELECT USING (can_access_owner_data(user_id));
CREATE POLICY "Users can update their own expenses or admin/gestor can." ON "public"."financial_expenses" FOR
UPDATE USING (can_access_owner_data(user_id));
CREATE POLICY "Users can delete their own expenses or admin/gestor can." ON "public"."financial_expenses" FOR DELETE USING (can_access_owner_data(user_id));
-- Políticas de RLS para payroll_entries
CREATE POLICY "Users can insert their own payroll entries or admin/gestor can." ON "public"."payroll_entries" FOR
INSERT WITH CHECK (can_access_owner_data(user_id));
CREATE POLICY "Users can view their own payroll entries or admin/gestor can." ON "public"."payroll_entries" FOR
SELECT USING (can_access_owner_data(user_id));
CREATE POLICY "Users can update their own payroll entries or admin/gestor can." ON "public"."payroll_entries" FOR
UPDATE USING (can_access_owner_data(user_id));
CREATE POLICY "Users can delete their own payroll entries or admin/gestor can." ON "public"."payroll_entries" FOR DELETE USING (can_access_owner_data(user_id));