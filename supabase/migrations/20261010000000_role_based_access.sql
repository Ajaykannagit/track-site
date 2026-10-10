-- MIGRATION: Role-Based Access Enforcement (Update 1)
-- MD: Full access to all data, financials, cash, spend, office expenses, role management.
-- Accounts: Operational + Financial access for projects, materials, attendance wages, bills, quotations. No MD-level dashboard cash/profit/loss or office expense.
-- Supervisor: Operational site data (attendance, materials/workers/projects list). No wage/cost/financial data.
-- Viewer: Read-only access to projects metadata only (no financial/money figures, no attendance, no expenses).

-- 1. Helper security functions
CREATE OR REPLACE FUNCTION public.is_md() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'md');
$$;

CREATE OR REPLACE FUNCTION public.is_finance_user() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'md') OR public.has_role(auth.uid(), 'accounts');
$$;

CREATE OR REPLACE FUNCTION public.is_operations_user() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'md') OR public.has_role(auth.uid(), 'accounts') OR public.has_role(auth.uid(), 'supervisor');
$$;

GRANT EXECUTE ON FUNCTION public.is_md() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_finance_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_operations_user() TO authenticated;

-- 2. Drop old permissive "read all" policies on sensitive financial/admin tables
DROP POLICY IF EXISTS "read all" ON public.expenses;
DROP POLICY IF EXISTS "read all" ON public.cash_closing;
DROP POLICY IF EXISTS "read all" ON public.payroll;
DROP POLICY IF EXISTS "read all" ON public.payroll_items;
DROP POLICY IF EXISTS "read all" ON public.contractor_bills;
DROP POLICY IF EXISTS "read all" ON public.contractor_payments;
DROP POLICY IF EXISTS "read all" ON public.purchase_orders;
DROP POLICY IF EXISTS "read all" ON public.purchase_order_items;
DROP POLICY IF EXISTS "read all" ON public.supplier_payments;
DROP POLICY IF EXISTS "read all" ON public.account_transfers;
DROP POLICY IF EXISTS "read all" ON public.attendance;
DROP POLICY IF EXISTS "read all" ON public.employees;
DROP POLICY IF EXISTS "read all" ON public.contractors;
DROP POLICY IF EXISTS "read all" ON public.suppliers;
DROP POLICY IF EXISTS "roles read" ON public.user_roles;

-- 3. Apply strict RLS SELECT policies

-- Expenses: MD has access to all expenses (including office expenses). Accounts has access to project expenses only.
CREATE POLICY "expenses read policy" ON public.expenses FOR SELECT TO authenticated
  USING (public.is_md() OR (public.is_finance_user() AND project_id IS NOT NULL));

-- Cash closing: MD only
CREATE POLICY "cash_closing read policy" ON public.cash_closing FOR SELECT TO authenticated
  USING (public.is_md());

-- Account transfers: MD and Accounts only
CREATE POLICY "account_transfers read policy" ON public.account_transfers FOR SELECT TO authenticated
  USING (public.is_finance_user());

-- Payroll & Payroll items: MD and Accounts only
CREATE POLICY "payroll read policy" ON public.payroll FOR SELECT TO authenticated
  USING (public.is_finance_user());

CREATE POLICY "payroll_items read policy" ON public.payroll_items FOR SELECT TO authenticated
  USING (public.is_finance_user());

-- Contractor bills & payments: MD and Accounts only
CREATE POLICY "contractor_bills read policy" ON public.contractor_bills FOR SELECT TO authenticated
  USING (public.is_finance_user());

CREATE POLICY "contractor_payments read policy" ON public.contractor_payments FOR SELECT TO authenticated
  USING (public.is_finance_user());

-- Purchase orders & items: MD and Accounts only
CREATE POLICY "purchase_orders read policy" ON public.purchase_orders FOR SELECT TO authenticated
  USING (public.is_finance_user());

CREATE POLICY "purchase_order_items read policy" ON public.purchase_order_items FOR SELECT TO authenticated
  USING (public.is_finance_user());

-- Supplier payments: MD and Accounts only
CREATE POLICY "supplier_payments read policy" ON public.supplier_payments FOR SELECT TO authenticated
  USING (public.is_finance_user());

-- Attendance: MD, Accounts, and Supervisor only (Viewer has no attendance access)
CREATE POLICY "attendance read policy" ON public.attendance FOR SELECT TO authenticated
  USING (public.is_operations_user());

-- Employees, Contractors, Suppliers: MD, Accounts, and Supervisor only (Viewer has no worker/contractor master access)
CREATE POLICY "employees read policy" ON public.employees FOR SELECT TO authenticated
  USING (public.is_operations_user());

CREATE POLICY "contractors read policy" ON public.contractors FOR SELECT TO authenticated
  USING (public.is_operations_user());

CREATE POLICY "suppliers read policy" ON public.suppliers FOR SELECT TO authenticated
  USING (public.is_operations_user());

-- User roles: MD can view all roles; any authenticated user can view their own roles
CREATE POLICY "user_roles read policy" ON public.user_roles FOR SELECT TO authenticated
  USING (public.is_md() OR user_id = auth.uid());

CREATE POLICY "user_roles admin write" ON public.user_roles FOR ALL TO authenticated
  USING (public.is_md())
  WITH CHECK (public.is_md());
