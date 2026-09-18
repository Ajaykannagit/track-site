-- ============================================================
-- BRICKWELD PVT LTD — Production Enhancements Migration
-- Applied on top of the base schema (20260817123052...)
-- Run: npx supabase db push   OR paste into Supabase SQL Editor
-- ============================================================

-- ============================================================
-- 1. SUPPLIER PAYMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.supplier_payments (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        uuid        NOT NULL REFERENCES public.projects(id)         ON DELETE CASCADE,
  supplier_id       uuid        NOT NULL REFERENCES public.suppliers(id)        ON DELETE CASCADE,
  po_id             uuid                 REFERENCES public.purchase_orders(id)  ON DELETE SET NULL,
  payment_date      date        NOT NULL DEFAULT current_date,
  amount            numeric(14,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  payment_method    text,
  reference_number  text,
  remarks           text,
  is_demo           boolean     NOT NULL DEFAULT false,
  created_by        uuid,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_by        uuid,
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_supplier  ON public.supplier_payments(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_project   ON public.supplier_payments(project_id);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_po        ON public.supplier_payments(po_id);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_date      ON public.supplier_payments(payment_date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_payments TO authenticated;
GRANT ALL ON public.supplier_payments TO service_role;
ALTER TABLE public.supplier_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "supplier_payments read all"     ON public.supplier_payments;
DROP POLICY IF EXISTS "supplier_payments finance write" ON public.supplier_payments;
CREATE POLICY "supplier_payments read all" ON public.supplier_payments
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "supplier_payments finance write" ON public.supplier_payments
  FOR ALL TO authenticated
  USING (public.can_write_finance()) WITH CHECK (public.can_write_finance());
DROP TRIGGER IF EXISTS set_updated_at_supplier_payments ON public.supplier_payments;
CREATE TRIGGER set_updated_at_supplier_payments
  BEFORE UPDATE ON public.supplier_payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 2. CASH CLOSING ACCOUNT TYPE
-- ============================================================
ALTER TABLE public.cash_closing ADD COLUMN IF NOT EXISTS account_type text NOT NULL DEFAULT 'petty_cash';
DROP INDEX IF EXISTS uniq_cash_closing;
CREATE UNIQUE INDEX uniq_cash_closing ON public.cash_closing(
  closing_date,
  COALESCE(project_id, '00000000-0000-0000-0000-000000000000'::uuid),
  account_type
);

-- ============================================================
-- 3. MATERIAL NAME ON INDENTS AND EXPENSES
-- ============================================================
ALTER TABLE public.material_requests ADD COLUMN IF NOT EXISTS material_name text;
ALTER TABLE public.expenses          ADD COLUMN IF NOT EXISTS material_name text;

-- ============================================================
-- 4. EXPENSE CATEGORIES — COMPLETE LIST
-- ============================================================
INSERT INTO public.expense_categories (name) VALUES
  ('Machinery Rent'), ('Electricity'), ('Water Charges'), ('Site Security'),
  ('Stationery'), ('Medical / First Aid'), ('Bank Charges'),
  ('Telephone / Internet'), ('Travel'), ('Professional Fees')
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- 5. EMPLOYEES — USEFUL EXTRA COLUMNS
-- ============================================================
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS bank_account      text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS aadhar_number     text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS pf_number         text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS esic_number       text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS emergency_contact text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS joining_date      date;

-- ============================================================
-- 6. PROJECTS — EXTRA FIELDS
-- ============================================================
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS completion_percent      numeric(5,2) DEFAULT 0 CHECK (completion_percent BETWEEN 0 AND 100);
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS actual_completion_date  date;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS project_manager         text;

-- ============================================================
-- 7. CONTRACTOR BILLS — RETENTION TRACKING
-- ============================================================
ALTER TABLE public.contractor_bills ADD COLUMN IF NOT EXISTS retention_percent numeric(5,2) DEFAULT 0;
ALTER TABLE public.contractor_bills ADD COLUMN IF NOT EXISTS retention_amount  numeric(14,2) DEFAULT 0;

-- ============================================================
-- 8. HELPER VIEWS
-- ============================================================
CREATE OR REPLACE VIEW public.v_project_summary AS
SELECT
  p.id, p.project_code, p.name, p.status, p.completion_percent, p.quotation_amount,
  COALESCE(po_t.v,0)  AS po_value,
  COALESCE(grn_t.v,0) AS received_value,
  COALESCE(sup_t.v,0) AS supplier_paid,
  COALESCE(cb_g.v,0)  AS contractor_billed_gross,
  COALESCE(cb_n.v,0)  AS contractor_billed_net,
  COALESCE(con_t.v,0) AS contractor_paid,
  COALESCE(exp_t.v,0) AS other_expenses,
  COALESCE(grn_t.v,0) + COALESCE(cb_n.v,0) + COALESCE(exp_t.v,0) AS estimated_cost,
  p.quotation_amount - COALESCE(grn_t.v,0) - COALESCE(cb_n.v,0) - COALESCE(exp_t.v,0) AS estimated_profit
FROM public.projects p
LEFT JOIN (SELECT project_id, SUM(total_amount) v FROM public.purchase_orders    GROUP BY 1) po_t  ON po_t.project_id  = p.id
LEFT JOIN (SELECT project_id, SUM(total_amount) v FROM public.material_receipts  GROUP BY 1) grn_t ON grn_t.project_id = p.id
LEFT JOIN (SELECT project_id, SUM(amount)        v FROM public.supplier_payments  GROUP BY 1) sup_t ON sup_t.project_id = p.id
LEFT JOIN (SELECT project_id, SUM(gross_amount)  v FROM public.contractor_bills   GROUP BY 1) cb_g  ON cb_g.project_id  = p.id
LEFT JOIN (SELECT project_id, SUM(net_amount)    v FROM public.contractor_bills   GROUP BY 1) cb_n  ON cb_n.project_id  = p.id
LEFT JOIN (SELECT project_id, SUM(amount)        v FROM public.contractor_payments GROUP BY 1) con_t ON con_t.project_id = p.id
LEFT JOIN (SELECT project_id, SUM(amount)        v FROM public.expenses            GROUP BY 1) exp_t ON exp_t.project_id = p.id;
GRANT SELECT ON public.v_project_summary TO authenticated;

CREATE OR REPLACE VIEW public.v_supplier_outstanding AS
SELECT s.id AS supplier_id, s.name AS supplier_name,
  COALESCE(grn.v,0) AS total_received, COALESCE(paid.v,0) AS total_paid,
  COALESCE(grn.v,0) - COALESCE(paid.v,0) AS outstanding
FROM public.suppliers s
LEFT JOIN (SELECT supplier_id, SUM(total_amount) v FROM public.material_receipts WHERE supplier_id IS NOT NULL GROUP BY 1) grn  ON grn.supplier_id  = s.id
LEFT JOIN (SELECT supplier_id, SUM(amount)        v FROM public.supplier_payments                                GROUP BY 1) paid ON paid.supplier_id = s.id;
GRANT SELECT ON public.v_supplier_outstanding TO authenticated;

CREATE OR REPLACE VIEW public.v_contractor_outstanding AS
SELECT c.id AS contractor_id, c.name AS contractor_name,
  COALESCE(billed.v,0) AS total_billed_net, COALESCE(paid.v,0) AS total_paid,
  COALESCE(billed.v,0) - COALESCE(paid.v,0) AS outstanding
FROM public.contractors c
LEFT JOIN (SELECT contractor_id, SUM(net_amount) v FROM public.contractor_bills    GROUP BY 1) billed ON billed.contractor_id = c.id
LEFT JOIN (SELECT contractor_id, SUM(amount)     v FROM public.contractor_payments GROUP BY 1) paid   ON paid.contractor_id   = c.id;
GRANT SELECT ON public.v_contractor_outstanding TO authenticated;

-- ============================================================
-- 9. CONFIGURABLE SETTINGS
-- ============================================================
INSERT INTO public.app_settings (key, value, description) VALUES
  ('company_info',
   '{"name":"Brickweld Pvt Ltd","tagline":"Civil - Interior - Fabrication","phone":"","email":"","address":"","gst":"","pan":""}',
   'Company details shown on exports and reports.'),
  ('attendance_rules',
   '{"standard_working_hours":8,"half_day_hours":4,"ot_minimum_hours":1}',
   'Configurable attendance calculation rules.'),
  ('payment_methods',
   '["cash","bank","upi","cheque","dd","neft","rtgs","imps"]',
   'Allowed payment method options.')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- 10. DEMO DATA
-- ============================================================

-- 10a. Payroll runs
INSERT INTO public.payroll (id, project_id, period_month, period_year, status, total_gross, total_deductions, total_net, remarks, is_demo)
VALUES
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01','22222222-2222-2222-2222-222222222201',8,2026,'approved',385200,19260,365940,'August 2026 payroll (DEMO)',true),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02','22222222-2222-2222-2222-222222222201',9,2026,'draft',   385200,19260,365940,'September 2026 payroll (DEMO)',true)
ON CONFLICT DO NOTHING;

-- 10b. Payroll items (Aug run)
INSERT INTO public.payroll_items (payroll_id, employee_id, working_days, present_days, leave_days, ot_hours, wage_rate, gross_amount, deductions, net_amount)
VALUES
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01','33333333-3333-3333-3333-333333333301',26,25,1,10, 950, 24950,1248,23702),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01','33333333-3333-3333-3333-333333333302',26,26,0, 8, 700, 18920, 946,17974),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01','33333333-3333-3333-3333-333333333303',26,24,2,12,1050, 26760,1338,25422),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01','33333333-3333-3333-3333-333333333304',26,25,1,14,1100, 29460,1473,27987),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01','33333333-3333-3333-3333-333333333305',26,26,0, 0,28000,28000, 2800,25200),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01','33333333-3333-3333-3333-333333333306',26,26,0, 0,42000,42000, 4200,37800),
  -- Sep run
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02','33333333-3333-3333-3333-333333333301',26,23,3, 6, 950, 22570,1129,21441),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02','33333333-3333-3333-3333-333333333302',26,25,1, 4, 700, 17860, 893,16967),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02','33333333-3333-3333-3333-333333333303',26,26,0, 8,1050, 28340,1417,26923),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02','33333333-3333-3333-3333-333333333304',26,24,2,10,1100, 27800,1390,26410),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02','33333333-3333-3333-3333-333333333305',26,26,0, 0,28000,28000, 2800,25200),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02','33333333-3333-3333-3333-333333333306',26,26,0, 0,42000,42000, 4200,37800)
ON CONFLICT DO NOTHING;

-- 10c. Supplier payments
INSERT INTO public.supplier_payments (project_id, supplier_id, po_id, payment_date, amount, payment_method, reference_number, remarks, is_demo)
VALUES
  ('22222222-2222-2222-2222-222222222201','55555555-5555-5555-5555-555555555501','77777777-7777-7777-7777-777777777701',
   current_date - 1, 126000, 'bank', 'NEFT-20260917-001', 'Payment against PO-0001 cement delivery (DEMO)', true),
  ('22222222-2222-2222-2222-222222222202','55555555-5555-5555-5555-555555555502', NULL,
   current_date - 3, 45000, 'upi', 'UPI-20260915-002', 'Advance to Kavitha Hardware (DEMO)', true)
ON CONFLICT DO NOTHING;

-- 10d. Cash closing with account_type
INSERT INTO public.cash_closing (project_id, closing_date, account_type, opening_cash, cash_received, cash_expenses, other_transactions, closing_cash, remarks, is_demo)
VALUES
  ('22222222-2222-2222-2222-222222222201', current_date - 2, 'petty_cash',   25000,  50000, 17000, 0,  58000,'Petty cash PRJ-001 (DEMO)',   true),
  ('22222222-2222-2222-2222-222222222201', current_date - 2, 'bank_account', 850000,200000,171000, 0, 879000,'Bank account PRJ-001 (DEMO)', true),
  ('22222222-2222-2222-2222-222222222201', current_date - 1, 'petty_cash',   58000,      0, 12500, 0,  45500,'Petty cash PRJ-001 (DEMO)',   true),
  ('22222222-2222-2222-2222-222222222201', current_date - 1, 'bank_account', 879000,100000,126000, 0, 853000,'Bank account PRJ-001 (DEMO)', true)
ON CONFLICT DO NOTHING;

-- 10e. Contractor payment (so Flow tab shows non-zero Paid value)
INSERT INTO public.contractor_payments (project_id, contractor_id, bill_id, payment_date, amount, payment_method, reference_number, remarks, is_demo)
SELECT '22222222-2222-2222-2222-222222222201','44444444-4444-4444-4444-444444444401',
  cb.id, current_date, 100000, 'bank', 'NEFT-20260918-003','Part payment CB-0001 (DEMO)', true
FROM public.contractor_bills cb WHERE cb.bill_number = 'CB-0001'
ON CONFLICT DO NOTHING;

-- 10f. Expenses with material_name
INSERT INTO public.expenses (project_id, expense_date, category, description, material_name, amount, payment_method, is_demo)
VALUES
  ('22222222-2222-2222-2222-222222222201', current_date - 4,'Machinery Rent','JCB hire for excavation (DEMO)',    NULL,         18000,'bank', true),
  ('22222222-2222-2222-2222-222222222201', current_date - 3,'Site Consumables','Binding wire purchase (DEMO)',    'Binding Wire 18G', 3200,'cash', true),
  ('22222222-2222-2222-2222-222222222202', current_date - 2,'Electricity',   'EB bill payment (DEMO)',            NULL,         12400,'bank', true),
  ('22222222-2222-2222-2222-222222222202', current_date - 1,'Machinery Rent','Concrete pump hire (DEMO)',         NULL,         22000,'bank', true)
ON CONFLICT DO NOTHING;

-- 10g. Material indents with material_name
INSERT INTO public.material_requests (request_number, project_id, material_name, request_date, required_date, status, total_amount, remarks, is_demo)
VALUES
  ('MR-0002','22222222-2222-2222-2222-222222222202','River Sand',              current_date-2, current_date+3,'submitted',48000,'Sand for plastering 2nd floor (DEMO)',true),
  ('MR-0003','22222222-2222-2222-2222-222222222201','CPVC Pipes 1"',           current_date-1, current_date+5,'draft',    15000,'Plumbing first floor bathrooms (DEMO)',true)
ON CONFLICT DO NOTHING;

-- ============================================================
-- END OF MIGRATION
-- ============================================================
