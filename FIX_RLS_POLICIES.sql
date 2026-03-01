-- ========================================================
-- FIX RLS POLICIES FOR COLLABORATOR ACCESS
-- ========================================================
-- Ensure the helper function exists and is robust
CREATE OR REPLACE FUNCTION public.get_owner_id() RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE v_gestor_id uuid;
BEGIN
SELECT gestor_id INTO v_gestor_id
FROM public.profiles
WHERE id = auth.uid();
RETURN COALESCE(v_gestor_id, auth.uid());
END;
$$;
CREATE OR REPLACE FUNCTION public.can_access_owner_data(data_owner_id uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$ BEGIN RETURN get_owner_id() = data_owner_id;
END;
$$;
-- 1. stock_items
DROP POLICY IF EXISTS "Users can view their own stock items" ON public.stock_items;
DROP POLICY IF EXISTS "Users can insert their own stock items" ON public.stock_items;
DROP POLICY IF EXISTS "Users can update their own stock items" ON public.stock_items;
DROP POLICY IF EXISTS "Users can delete their own stock items" ON public.stock_items;
CREATE POLICY "Users can view accessible stock items" ON public.stock_items FOR
SELECT USING (can_access_owner_data(user_id));
CREATE POLICY "Users can insert stock items for their org" ON public.stock_items FOR
INSERT WITH CHECK (user_id = get_owner_id());
CREATE POLICY "Users can update accessible stock items" ON public.stock_items FOR
UPDATE USING (can_access_owner_data(user_id));
CREATE POLICY "Users can delete accessible stock items" ON public.stock_items FOR DELETE USING (can_access_owner_data(user_id));
-- 2. stock_movements
DROP POLICY IF EXISTS "Users can view their own stock movements" ON public.stock_movements;
DROP POLICY IF EXISTS "Users can insert their own stock movements" ON public.stock_movements;
CREATE POLICY "Users can view accessible stock movements" ON public.stock_movements FOR
SELECT USING (can_access_owner_data(user_id));
CREATE POLICY "Users can insert stock movements for their org" ON public.stock_movements FOR
INSERT WITH CHECK (user_id = get_owner_id());
-- 3. technical_sheets
DROP POLICY IF EXISTS "Users can view their own technical sheets" ON public.technical_sheets;
DROP POLICY IF EXISTS "Users can insert their own technical sheets" ON public.technical_sheets;
DROP POLICY IF EXISTS "Users can update their own technical sheets" ON public.technical_sheets;
DROP POLICY IF EXISTS "Users can delete their own technical sheets" ON public.technical_sheets;
CREATE POLICY "Users can view accessible technical sheets" ON public.technical_sheets FOR
SELECT USING (can_access_owner_data(user_id));
CREATE POLICY "Users can insert technical sheets for their org" ON public.technical_sheets FOR
INSERT WITH CHECK (user_id = get_owner_id());
CREATE POLICY "Users can update accessible technical sheets" ON public.technical_sheets FOR
UPDATE USING (can_access_owner_data(user_id));
CREATE POLICY "Users can delete accessible technical sheets" ON public.technical_sheets FOR DELETE USING (can_access_owner_data(user_id));
-- 4. technical_sheet_ingredients (Linked to technical_sheets ownership)
DROP POLICY IF EXISTS "Users can view their own sheet ingredients" ON public.technical_sheet_ingredients;
DROP POLICY IF EXISTS "Users can insert their own sheet ingredients" ON public.technical_sheet_ingredients;
DROP POLICY IF EXISTS "Users can update their own sheet ingredients" ON public.technical_sheet_ingredients;
DROP POLICY IF EXISTS "Users can delete their own sheet ingredients" ON public.technical_sheet_ingredients;
CREATE POLICY "Users can view accessible sheet ingredients" ON public.technical_sheet_ingredients FOR
SELECT USING (
        EXISTS (
            SELECT 1
            FROM public.technical_sheets ts
            WHERE ts.id = technical_sheet_id
                AND can_access_owner_data(ts.user_id)
        )
    );
CREATE POLICY "Users can insert sheet ingredients for their org" ON public.technical_sheet_ingredients FOR
INSERT WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.technical_sheets ts
            WHERE ts.id = technical_sheet_id
                AND ts.user_id = get_owner_id()
        )
    );
CREATE POLICY "Users can update accessible sheet ingredients" ON public.technical_sheet_ingredients FOR
UPDATE USING (
        EXISTS (
            SELECT 1
            FROM public.technical_sheets ts
            WHERE ts.id = technical_sheet_id
                AND can_access_owner_data(ts.user_id)
        )
    );
CREATE POLICY "Users can delete accessible sheet ingredients" ON public.technical_sheet_ingredients FOR DELETE USING (
    EXISTS (
        SELECT 1
        FROM public.technical_sheets ts
        WHERE ts.id = technical_sheet_id
            AND can_access_owner_data(ts.user_id)
    )
);
-- 5. productions
DROP POLICY IF EXISTS "Users can view their own productions" ON public.productions;
DROP POLICY IF EXISTS "Users can insert their own productions" ON public.productions;
DROP POLICY IF EXISTS "Users can update their own productions" ON public.productions;
DROP POLICY IF EXISTS "Users can delete their own productions" ON public.productions;
CREATE POLICY "Users can view accessible productions" ON public.productions FOR
SELECT USING (can_access_owner_data(user_id));
CREATE POLICY "Users can insert productions for their org" ON public.productions FOR
INSERT WITH CHECK (user_id = get_owner_id());
CREATE POLICY "Users can update accessible productions" ON public.productions FOR
UPDATE USING (can_access_owner_data(user_id));
CREATE POLICY "Users can delete accessible productions" ON public.productions FOR DELETE USING (can_access_owner_data(user_id));
-- 6. purchase_list_items
DROP POLICY IF EXISTS "Users can view their own purchase items" ON public.purchase_list_items;
DROP POLICY IF EXISTS "Users can insert their own purchase items" ON public.purchase_list_items;
DROP POLICY IF EXISTS "Users can update their own purchase items" ON public.purchase_list_items;
DROP POLICY IF EXISTS "Users can delete their own purchase items" ON public.purchase_list_items;
CREATE POLICY "Users can view accessible purchase items" ON public.purchase_list_items FOR
SELECT USING (can_access_owner_data(user_id));
CREATE POLICY "Users can insert purchase items for their org" ON public.purchase_list_items FOR
INSERT WITH CHECK (user_id = get_owner_id());
CREATE POLICY "Users can update accessible purchase items" ON public.purchase_list_items FOR
UPDATE USING (can_access_owner_data(user_id));
CREATE POLICY "Users can delete accessible purchase items" ON public.purchase_list_items FOR DELETE USING (can_access_owner_data(user_id));
-- 7. purchase_schedule
DROP POLICY IF EXISTS "Users can view their own purchase schedule" ON public.purchase_schedule;
DROP POLICY IF EXISTS "Users can insert their own purchase schedule" ON public.purchase_schedule;
DROP POLICY IF EXISTS "Users can update their own purchase schedule" ON public.purchase_schedule;
DROP POLICY IF EXISTS "Users can delete their own purchase schedule" ON public.purchase_schedule;
CREATE POLICY "Users can view accessible purchase schedule" ON public.purchase_schedule FOR
SELECT USING (can_access_owner_data(user_id));
CREATE POLICY "Users can insert purchase schedule for their org" ON public.purchase_schedule FOR
INSERT WITH CHECK (user_id = get_owner_id());
CREATE POLICY "Users can update accessible purchase schedule" ON public.purchase_schedule FOR
UPDATE USING (can_access_owner_data(user_id));
CREATE POLICY "Users can delete accessible purchase schedule" ON public.purchase_schedule FOR DELETE USING (can_access_owner_data(user_id));
-- 8. sale_products
DROP POLICY IF EXISTS "Users can view their own sale products" ON public.sale_products;
DROP POLICY IF EXISTS "Users can insert their own sale products" ON public.sale_products;
DROP POLICY IF EXISTS "Users can update their own sale products" ON public.sale_products;
DROP POLICY IF EXISTS "Users can delete their own sale products" ON public.sale_products;
CREATE POLICY "Users can view accessible sale products" ON public.sale_products FOR
SELECT USING (can_access_owner_data(user_id));
CREATE POLICY "Users can insert sale products for their org" ON public.sale_products FOR
INSERT WITH CHECK (user_id = get_owner_id());
CREATE POLICY "Users can update accessible sale products" ON public.sale_products FOR
UPDATE USING (can_access_owner_data(user_id));
CREATE POLICY "Users can delete accessible sale products" ON public.sale_products FOR DELETE USING (can_access_owner_data(user_id));
-- 9. finished_productions_stock
DROP POLICY IF EXISTS "Users can view their own finished productions stock" ON public.finished_productions_stock;
DROP POLICY IF EXISTS "Users can insert their own finished productions stock" ON public.finished_productions_stock;
DROP POLICY IF EXISTS "Users can update their own finished productions stock" ON public.finished_productions_stock;
DROP POLICY IF EXISTS "Users can delete their own finished productions stock" ON public.finished_productions_stock;
CREATE POLICY "Users can view accessible finished productions stock" ON public.finished_productions_stock FOR
SELECT USING (can_access_owner_data(user_id));
CREATE POLICY "Users can insert finished productions stock for their org" ON public.finished_productions_stock FOR
INSERT WITH CHECK (user_id = get_owner_id());
CREATE POLICY "Users can update accessible finished productions stock" ON public.finished_productions_stock FOR
UPDATE USING (can_access_owner_data(user_id));
CREATE POLICY "Users can delete accessible finished productions stock" ON public.finished_productions_stock FOR DELETE USING (can_access_owner_data(user_id));