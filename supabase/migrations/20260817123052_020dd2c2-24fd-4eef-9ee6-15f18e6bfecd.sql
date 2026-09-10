
-- ENUMS
CREATE TYPE public.app_role AS ENUM ('md','supervisor','accounts','viewer');
CREATE TYPE public.project_status AS ENUM ('planning','active','on_hold','completed','cancelled');
CREATE TYPE public.employee_type AS ENUM ('labour','office');
CREATE TYPE public.attendance_kind AS ENUM ('labour','office','contractor');
CREATE TYPE public.attendance_status AS ENUM ('present','absent','half_day','leave','holiday');
CREATE TYPE public.doc_status AS ENUM ('draft','submitted','verified','approved','md_approved','payment_approved','ordered','partially_received','received','paid','closed','rejected');

-- HELPERS
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); NEW.updated_by = auth.uid(); RETURN NEW; END; $$;

-- PROFILES & ROLES
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  email text,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.can_write_finance() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(),'md') OR public.has_role(auth.uid(),'accounts');
$$;

CREATE OR REPLACE FUNCTION public.can_write_site() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(),'md') OR public.has_role(auth.uid(),'accounts') OR public.has_role(auth.uid(),'supervisor');
$$;

CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "own profile write" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid() OR public.has_role(auth.uid(),'md'));
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "roles read" ON public.user_roles FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name',''), NEW.email)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role,'viewer'))
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- SETTINGS (configurable business rules)
CREATE TABLE public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings read" ON public.app_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "settings write" ON public.app_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'md')) WITH CHECK (public.has_role(auth.uid(),'md'));

-- CLIENTS
CREATE TABLE public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL, address text, contact_person text, phone text, email text,
  is_demo boolean NOT NULL DEFAULT false,
  created_by uuid, created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now()
);

-- PROJECTS
CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_code text NOT NULL UNIQUE,
  house_number text,
  name text NOT NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  quotation_amount numeric(14,2) NOT NULL DEFAULT 0,
  agreement_details text,
  details text,
  start_date date, expected_completion_date date,
  site_address text, latitude numeric(10,7), longitude numeric(10,7),
  status public.project_status NOT NULL DEFAULT 'planning',
  is_demo boolean NOT NULL DEFAULT false,
  created_by uuid, created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_projects_status ON public.projects(status);

CREATE TABLE public.project_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  doc_type text NOT NULL,
  file_path text NOT NULL, file_name text, mime_type text, size_bytes bigint,
  created_by uuid, created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_projdocs_project ON public.project_documents(project_id);

CREATE TABLE public.project_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  category text NOT NULL,
  budget_amount numeric(14,2) NOT NULL DEFAULT 0,
  notes text,
  created_by uuid, created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, category)
);

CREATE TABLE public.project_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, user_id)
);

-- EMPLOYEES / LABOUR
CREATE TABLE public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_code text NOT NULL UNIQUE,
  full_name text NOT NULL,
  employee_type public.employee_type NOT NULL DEFAULT 'labour',
  designation text, phone text, address text,
  wage_type text NOT NULL DEFAULT 'daily',
  wage_rate numeric(12,2) NOT NULL DEFAULT 0,
  ot_rate_per_hour numeric(12,2),
  active boolean NOT NULL DEFAULT true,
  is_demo boolean NOT NULL DEFAULT false,
  created_by uuid, created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now()
);

-- CONTRACTORS
CREATE TABLE public.contractors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_code text NOT NULL UNIQUE,
  name text NOT NULL, address text, phone text, email text,
  contractor_type text, bank_details text,
  active boolean NOT NULL DEFAULT true,
  is_demo boolean NOT NULL DEFAULT false,
  created_by uuid, created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now()
);

-- ATTENDANCE
CREATE TABLE public.attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind public.attendance_kind NOT NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  contractor_id uuid REFERENCES public.contractors(id) ON DELETE SET NULL,
  attendance_date date NOT NULL,
  status public.attendance_status NOT NULL DEFAULT 'present',
  working_hours numeric(6,2) NOT NULL DEFAULT 0,
  ot_hours numeric(6,2) NOT NULL DEFAULT 0,
  workforce_count integer,
  wage_rate numeric(12,2) NOT NULL DEFAULT 0,
  calculated_wage numeric(12,2) NOT NULL DEFAULT 0,
  photo_path text,
  remarks text,
  is_demo boolean NOT NULL DEFAULT false,
  created_by uuid, created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT attendance_hours_nonneg CHECK (working_hours >= 0 AND ot_hours >= 0)
);
CREATE UNIQUE INDEX uniq_attendance_emp ON public.attendance(employee_id, project_id, attendance_date) WHERE employee_id IS NOT NULL;
CREATE UNIQUE INDEX uniq_attendance_con ON public.attendance(contractor_id, project_id, attendance_date) WHERE contractor_id IS NOT NULL;
CREATE INDEX idx_attendance_date ON public.attendance(attendance_date);
CREATE INDEX idx_attendance_project ON public.attendance(project_id);

-- PAYROLL
CREATE TABLE public.payroll (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  period_month integer NOT NULL, period_year integer NOT NULL,
  status public.doc_status NOT NULL DEFAULT 'draft',
  total_gross numeric(14,2) NOT NULL DEFAULT 0,
  total_deductions numeric(14,2) NOT NULL DEFAULT 0,
  total_net numeric(14,2) NOT NULL DEFAULT 0,
  remarks text,
  is_demo boolean NOT NULL DEFAULT false,
  created_by uuid, created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.payroll_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_id uuid NOT NULL REFERENCES public.payroll(id) ON DELETE CASCADE,
  employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  working_days numeric(6,2) NOT NULL DEFAULT 0,
  present_days numeric(6,2) NOT NULL DEFAULT 0,
  leave_days numeric(6,2) NOT NULL DEFAULT 0,
  ot_hours numeric(8,2) NOT NULL DEFAULT 0,
  wage_rate numeric(12,2) NOT NULL DEFAULT 0,
  gross_amount numeric(14,2) NOT NULL DEFAULT 0,
  deductions numeric(14,2) NOT NULL DEFAULT 0,
  net_amount numeric(14,2) NOT NULL DEFAULT 0,
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- SUPPLIERS / MATERIALS
CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL, address text, phone text, email text, gst_number text,
  active boolean NOT NULL DEFAULT true,
  is_demo boolean NOT NULL DEFAULT false,
  created_by uuid, created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.material_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number text NOT NULL UNIQUE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  request_date date NOT NULL DEFAULT current_date,
  required_date date,
  status public.doc_status NOT NULL DEFAULT 'draft',
  photo_path text, remarks text,
  total_amount numeric(14,2) NOT NULL DEFAULT 0,
  is_demo boolean NOT NULL DEFAULT false,
  created_by uuid, created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.material_request_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.material_requests(id) ON DELETE CASCADE,
  material text NOT NULL, specification text, unit text,
  quantity numeric(14,3) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  rate numeric(14,2) NOT NULL DEFAULT 0 CHECK (rate >= 0),
  amount numeric(14,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number text NOT NULL UNIQUE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  request_id uuid REFERENCES public.material_requests(id) ON DELETE SET NULL,
  po_date date NOT NULL DEFAULT current_date,
  status public.doc_status NOT NULL DEFAULT 'draft',
  subtotal numeric(14,2) NOT NULL DEFAULT 0,
  tax_percent numeric(6,2) NOT NULL DEFAULT 0,
  tax_amount numeric(14,2) NOT NULL DEFAULT 0,
  total_amount numeric(14,2) NOT NULL DEFAULT 0,
  terms text, remarks text,
  is_demo boolean NOT NULL DEFAULT false,
  created_by uuid, created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  material text NOT NULL, specification text, unit text,
  quantity numeric(14,3) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  rate numeric(14,2) NOT NULL DEFAULT 0 CHECK (rate >= 0),
  amount numeric(14,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.material_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number text NOT NULL UNIQUE,
  po_id uuid REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  receipt_date date NOT NULL DEFAULT current_date,
  photo_path text, remarks text,
  total_amount numeric(14,2) NOT NULL DEFAULT 0,
  is_demo boolean NOT NULL DEFAULT false,
  created_by uuid, created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.material_receipt_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id uuid NOT NULL REFERENCES public.material_receipts(id) ON DELETE CASCADE,
  po_item_id uuid REFERENCES public.purchase_order_items(id) ON DELETE SET NULL,
  material text NOT NULL, unit text,
  ordered_quantity numeric(14,3) NOT NULL DEFAULT 0,
  received_quantity numeric(14,3) NOT NULL DEFAULT 0 CHECK (received_quantity >= 0),
  rate numeric(14,2) NOT NULL DEFAULT 0,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- MACHINES
CREATE TABLE public.machines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL, machine_code text UNIQUE, description text,
  is_demo boolean NOT NULL DEFAULT false,
  created_by uuid, created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.machine_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id uuid NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  inward_at timestamptz, outward_at timestamptz,
  quantity numeric(12,2), hours numeric(12,2), remarks text,
  is_demo boolean NOT NULL DEFAULT false,
  created_by uuid, created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now()
);

-- WORK ORDERS / MB / BILLS
CREATE TABLE public.work_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_number text NOT NULL UNIQUE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  contractor_id uuid NOT NULL REFERENCES public.contractors(id) ON DELETE CASCADE,
  work_description text,
  wo_date date NOT NULL DEFAULT current_date,
  contract_amount numeric(14,2) NOT NULL DEFAULT 0,
  rate numeric(14,2) NOT NULL DEFAULT 0,
  quantity numeric(14,3) NOT NULL DEFAULT 0,
  unit text,
  start_date date, end_date date,
  conditions jsonb NOT NULL DEFAULT '[]'::jsonb,
  status public.doc_status NOT NULL DEFAULT 'draft',
  remarks text,
  is_demo boolean NOT NULL DEFAULT false,
  created_by uuid, created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.measurement_books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mb_number text NOT NULL UNIQUE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  work_order_id uuid REFERENCES public.work_orders(id) ON DELETE SET NULL,
  contractor_id uuid REFERENCES public.contractors(id) ON DELETE SET NULL,
  mb_date date NOT NULL DEFAULT current_date,
  total_amount numeric(14,2) NOT NULL DEFAULT 0,
  photo_path text, remarks text,
  status public.doc_status NOT NULL DEFAULT 'draft',
  is_demo boolean NOT NULL DEFAULT false,
  created_by uuid, created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.measurement_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mb_id uuid NOT NULL REFERENCES public.measurement_books(id) ON DELETE CASCADE,
  work_description text NOT NULL, measurement text, unit text,
  quantity numeric(14,3) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  rate numeric(14,2) NOT NULL DEFAULT 0 CHECK (rate >= 0),
  amount numeric(14,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.contractor_bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_number text NOT NULL UNIQUE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  contractor_id uuid NOT NULL REFERENCES public.contractors(id) ON DELETE CASCADE,
  work_order_id uuid REFERENCES public.work_orders(id) ON DELETE SET NULL,
  mb_ids uuid[] NOT NULL DEFAULT '{}',
  bill_date date NOT NULL DEFAULT current_date,
  gross_amount numeric(14,2) NOT NULL DEFAULT 0,
  deductions numeric(14,2) NOT NULL DEFAULT 0,
  net_amount numeric(14,2) NOT NULL DEFAULT 0,
  status public.doc_status NOT NULL DEFAULT 'draft',
  verified_by uuid, verified_at timestamptz,
  approved_by uuid, approved_at timestamptz,
  payment_approved_by uuid, payment_approved_at timestamptz,
  document_path text, remarks text,
  is_demo boolean NOT NULL DEFAULT false,
  created_by uuid, created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.contractor_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id uuid REFERENCES public.contractor_bills(id) ON DELETE SET NULL,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  contractor_id uuid NOT NULL REFERENCES public.contractors(id) ON DELETE CASCADE,
  payment_date date NOT NULL DEFAULT current_date,
  amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  payment_method text, reference_number text, remarks text,
  is_demo boolean NOT NULL DEFAULT false,
  created_by uuid, created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now()
);

-- EXPENSES & CASH
CREATE TABLE public.expense_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true
);

CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  expense_date date NOT NULL DEFAULT current_date,
  category text NOT NULL,
  description text,
  amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  payment_method text,
  receipt_path text,
  remarks text,
  is_demo boolean NOT NULL DEFAULT false,
  created_by uuid, created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_expenses_date ON public.expenses(expense_date);
CREATE INDEX idx_expenses_project ON public.expenses(project_id);

CREATE TABLE public.cash_closing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  closing_date date NOT NULL,
  opening_cash numeric(14,2) NOT NULL DEFAULT 0,
  cash_received numeric(14,2) NOT NULL DEFAULT 0,
  cash_expenses numeric(14,2) NOT NULL DEFAULT 0,
  other_transactions numeric(14,2) NOT NULL DEFAULT 0,
  closing_cash numeric(14,2) NOT NULL DEFAULT 0,
  remarks text,
  is_demo boolean NOT NULL DEFAULT false,
  created_by uuid, created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uniq_cash_closing ON public.cash_closing(closing_date, COALESCE(project_id,'00000000-0000-0000-0000-000000000000'::uuid));

-- AUDIT
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL, record_id uuid, action text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  performed_by uuid, performed_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit read" ON public.audit_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'md') OR public.has_role(auth.uid(),'accounts'));
CREATE POLICY "audit insert" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (performed_by = auth.uid());

-- GRANTS + RLS + POLICIES + updated_at triggers for domain tables
DO $$
DECLARE t text;
  site_tables text[] := ARRAY['attendance','material_requests','material_request_items','material_receipts','material_receipt_items','measurement_books','measurement_items','machine_movements','machines','project_documents'];
  admin_tables text[] := ARRAY['projects','clients','project_budgets','project_assignments','employees','contractors','suppliers','expense_categories'];
  finance_tables text[] := ARRAY['payroll','payroll_items','purchase_orders','purchase_order_items','work_orders','contractor_bills','contractor_payments','expenses','cash_closing'];
  all_tables text[];
BEGIN
  all_tables := site_tables || admin_tables || finance_tables;
  FOREACH t IN ARRAY all_tables LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "read all" ON public.%I FOR SELECT TO authenticated USING (true)', t);
  END LOOP;

  FOREACH t IN ARRAY site_tables LOOP
    EXECUTE format('CREATE POLICY "site write" ON public.%I FOR ALL TO authenticated USING (public.can_write_site()) WITH CHECK (public.can_write_site())', t);
  END LOOP;
  FOREACH t IN ARRAY finance_tables LOOP
    EXECUTE format('CREATE POLICY "finance write" ON public.%I FOR ALL TO authenticated USING (public.can_write_finance()) WITH CHECK (public.can_write_finance())', t);
  END LOOP;
  FOREACH t IN ARRAY admin_tables LOOP
    EXECUTE format('CREATE POLICY "admin write" ON public.%I FOR ALL TO authenticated USING (public.has_role(auth.uid(),''md'')) WITH CHECK (public.has_role(auth.uid(),''md''))', t);
  END LOOP;

  FOR t IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    JOIN pg_attribute a ON a.attrelid=c.oid AND a.attname='updated_at'
    WHERE n.nspname='public' AND c.relkind='r' LOOP
    EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t);
  END LOOP;
END $$;

-- DEFAULT CONFIGURABLE SETTINGS
INSERT INTO public.app_settings(key, value, description) VALUES
 ('payroll_rules', '{"ot_applicable_for_office": false, "ot_multiplier": null, "standard_working_hours_per_day": 8, "half_day_factor": 0.5, "monthly_working_days": null}', 'Configurable wage/OT rules. Null values must be set by an administrator before use.'),
 ('pnl_rules', '{"include_material_receipts": true, "include_material_po_when_no_receipt": false, "include_labour_wages": true, "include_contractor_bills": true, "include_other_expenses": true, "estimate_source": "quotation_amount"}', 'Configurable Project P&L composition.'),
 ('tax_rules', '{"default_po_tax_percent": 0}', 'Configurable purchase order tax.'),
 ('budget_categories', '["material","labour","contractor","other"]', 'Configurable budget categories.'),
 ('work_order_conditions', '["Condition 1","Condition 2","Condition 3","Condition 4"]', 'Configurable work order condition labels.');

INSERT INTO public.expense_categories(name) VALUES ('Fuel'),('Transport'),('Site Consumables'),('Food'),('Tools'),('Miscellaneous');

-- DEMO DATA
INSERT INTO public.clients (id, name, address, contact_person, phone, is_demo) VALUES
 ('11111111-1111-1111-1111-111111111101','Ramesh Kumar (DEMO)','12 Anna Nagar, Chennai','Ramesh Kumar','+91 98400 11111', true),
 ('11111111-1111-1111-1111-111111111102','Sunrise Developers (DEMO)','MG Road, Coimbatore','Latha S','+91 98400 22222', true);

INSERT INTO public.projects (id, project_code, house_number, name, client_id, quotation_amount, start_date, expected_completion_date, site_address, latitude, longitude, status, details, is_demo) VALUES
 ('22222222-2222-2222-2222-222222222201','PRJ-001','H-104','Kumar Residence (DEMO)','11111111-1111-1111-1111-111111111101',8500000,'2025-04-01','2026-10-30','Plot 104, Thoraipakkam, Chennai',12.9250000,80.2300000,'active','G+1 residential villa', true),
 ('22222222-2222-2222-2222-222222222202','PRJ-002','H-207','Sunrise Apartments Block B (DEMO)','11111111-1111-1111-1111-111111111102',24500000,'2025-01-15','2026-12-31','Saravanampatti, Coimbatore',11.0830000,77.0000000,'active','12-unit apartment block', true),
 ('22222222-2222-2222-2222-222222222203','PRJ-003','H-018','Lakeview Farmhouse (DEMO)','11111111-1111-1111-1111-111111111101',5200000,'2024-06-01','2025-08-30','Ottiyambakkam, Chennai',12.8900000,80.1900000,'completed','Single floor farmhouse', true);

INSERT INTO public.project_budgets (project_id, category, budget_amount) VALUES
 ('22222222-2222-2222-2222-222222222201','material',3800000),
 ('22222222-2222-2222-2222-222222222201','labour',1600000),
 ('22222222-2222-2222-2222-222222222201','contractor',1500000),
 ('22222222-2222-2222-2222-222222222201','other',400000),
 ('22222222-2222-2222-2222-222222222202','material',11000000),
 ('22222222-2222-2222-2222-222222222202','labour',4500000),
 ('22222222-2222-2222-2222-222222222202','contractor',4200000),
 ('22222222-2222-2222-2222-222222222202','other',900000);

INSERT INTO public.employees (id, employee_code, full_name, employee_type, designation, wage_type, wage_rate, ot_rate_per_hour, is_demo) VALUES
 ('33333333-3333-3333-3333-333333333301','LAB-001','Murugan P (DEMO)','labour','Mason','daily',950,120,true),
 ('33333333-3333-3333-3333-333333333302','LAB-002','Selvam R (DEMO)','labour','Helper','daily',700,90,true),
 ('33333333-3333-3333-3333-333333333303','LAB-003','Anand K (DEMO)','labour','Bar Bender','daily',1050,130,true),
 ('33333333-3333-3333-3333-333333333304','LAB-004','Vijay M (DEMO)','labour','Carpenter','daily',1100,140,true),
 ('33333333-3333-3333-3333-333333333305','OFF-001','Priya N (DEMO)','office','Accounts Assistant','monthly',28000,null,true),
 ('33333333-3333-3333-3333-333333333306','OFF-002','Karthik S (DEMO)','office','Site Engineer','monthly',42000,null,true);

INSERT INTO public.contractors (id, contractor_code, name, phone, contractor_type, address, is_demo) VALUES
 ('44444444-4444-4444-4444-444444444401','CON-001','SRI Plastering Works (DEMO)','+91 90000 11111','Plastering','Chennai',true),
 ('44444444-4444-4444-4444-444444444402','CON-002','Balaji Electricals (DEMO)','+91 90000 22222','Electrical','Coimbatore',true);

INSERT INTO public.suppliers (id, name, phone, address, is_demo) VALUES
 ('55555555-5555-5555-5555-555555555501','Anand Steel & Cement (DEMO)','+91 91000 11111','Chennai',true),
 ('55555555-5555-5555-5555-555555555502','Kavitha Hardware (DEMO)','+91 91000 22222','Coimbatore',true);

INSERT INTO public.attendance (kind, project_id, employee_id, attendance_date, status, working_hours, ot_hours, wage_rate, calculated_wage, is_demo)
SELECT 'labour','22222222-2222-2222-2222-222222222201', e.id, d::date, 'present', 8, 2, e.wage_rate, e.wage_rate + 2*COALESCE(e.ot_rate_per_hour,0), true
FROM public.employees e, generate_series(current_date - 6, current_date, interval '1 day') d
WHERE e.employee_type='labour';

INSERT INTO public.attendance (kind, project_id, contractor_id, attendance_date, status, workforce_count, remarks, is_demo)
SELECT 'contractor','22222222-2222-2222-2222-222222222201','44444444-4444-4444-4444-444444444401', d::date,'present', 6,'Plastering first floor', true
FROM generate_series(current_date - 4, current_date, interval '1 day') d;

INSERT INTO public.attendance (kind, project_id, employee_id, attendance_date, status, working_hours, wage_rate, calculated_wage, is_demo)
SELECT 'office', NULL, e.id, d::date,'present', 8, e.wage_rate, 0, true
FROM public.employees e, generate_series(current_date - 4, current_date, interval '1 day') d
WHERE e.employee_type='office';

INSERT INTO public.expenses (project_id, expense_date, category, description, amount, payment_method, is_demo) VALUES
 ('22222222-2222-2222-2222-222222222201', current_date - 3,'Fuel','Diesel for site generator (DEMO)',4500,'cash',true),
 ('22222222-2222-2222-2222-222222222201', current_date - 2,'Transport','Sand transport (DEMO)',12500,'cash',true),
 ('22222222-2222-2222-2222-222222222202', current_date - 1,'Site Consumables','Curing compound (DEMO)',8200,'bank',true),
 ('22222222-2222-2222-2222-222222222202', current_date,'Food','Labour food expenses (DEMO)',3600,'cash',true);

INSERT INTO public.cash_closing (project_id, closing_date, opening_cash, cash_received, cash_expenses, closing_cash, remarks, is_demo) VALUES
 ('22222222-2222-2222-2222-222222222201', current_date - 1, 50000, 100000, 17000, 133000,'DEMO', true),
 ('22222222-2222-2222-2222-222222222201', current_date, 133000, 0, 4500, 128500,'DEMO', true);

INSERT INTO public.material_requests (id, request_number, project_id, request_date, status, remarks, total_amount, is_demo) VALUES
 ('66666666-6666-6666-6666-666666666601','MR-0001','22222222-2222-2222-2222-222222222201', current_date - 5,'submitted','Urgent for slab work (DEMO)',270000,true);
INSERT INTO public.material_request_items (request_id, material, specification, unit, quantity, rate, amount) VALUES
 ('66666666-6666-6666-6666-666666666601','Cement','OPC 53 Grade','bag',300,420,126000),
 ('66666666-6666-6666-6666-666666666601','Steel','Fe500D 12mm','kg',2000,72,144000);

INSERT INTO public.purchase_orders (id, po_number, project_id, supplier_id, request_id, po_date, status, subtotal, tax_percent, tax_amount, total_amount, is_demo) VALUES
 ('77777777-7777-7777-7777-777777777701','PO-0001','22222222-2222-2222-2222-222222222201','55555555-5555-5555-5555-555555555501','66666666-6666-6666-6666-666666666601', current_date - 4,'ordered',270000,0,0,270000,true);
INSERT INTO public.purchase_order_items (id, po_id, material, specification, unit, quantity, rate, amount) VALUES
 ('77777777-7777-7777-7777-7777777777a1','77777777-7777-7777-7777-777777777701','Cement','OPC 53 Grade','bag',300,420,126000),
 ('77777777-7777-7777-7777-7777777777a2','77777777-7777-7777-7777-777777777701','Steel','Fe500D 12mm','kg',2000,72,144000);

INSERT INTO public.material_receipts (id, receipt_number, po_id, project_id, supplier_id, receipt_date, total_amount, remarks, is_demo) VALUES
 ('88888888-8888-8888-8888-888888888801','GRN-0001','77777777-7777-7777-7777-777777777701','22222222-2222-2222-2222-222222222201','55555555-5555-5555-5555-555555555501', current_date - 2, 126000,'Partial delivery (DEMO)', true);
INSERT INTO public.material_receipt_items (receipt_id, po_item_id, material, unit, ordered_quantity, received_quantity, rate, amount) VALUES
 ('88888888-8888-8888-8888-888888888801','77777777-7777-7777-7777-7777777777a1','Cement','bag',300,300,420,126000);

INSERT INTO public.work_orders (id, work_order_number, project_id, contractor_id, work_description, contract_amount, rate, quantity, unit, conditions, status, is_demo) VALUES
 ('99999999-9999-9999-9999-999999999901','WO-0001','22222222-2222-2222-2222-222222222201','44444444-4444-4444-4444-444444444401','Internal & external plastering (DEMO)',450000,180,2500,'sqft','["Work to be completed as per schedule","Material supplied by owner","Payment against measurement","Safety compliance mandatory"]','approved',true);

INSERT INTO public.measurement_books (id, mb_number, project_id, work_order_id, contractor_id, mb_date, total_amount, status, is_demo) VALUES
 ('99999999-9999-9999-9999-999999999911','MB-0001','22222222-2222-2222-2222-222222222201','99999999-9999-9999-9999-999999999901','44444444-4444-4444-4444-444444444401', current_date - 3, 216000,'submitted', true);
INSERT INTO public.measurement_items (mb_id, work_description, measurement, unit, quantity, rate, amount) VALUES
 ('99999999-9999-9999-9999-999999999911','Ground floor internal plastering','40 x 30','sqft',1200,180,216000);

INSERT INTO public.contractor_bills (bill_number, project_id, contractor_id, work_order_id, mb_ids, bill_date, gross_amount, deductions, net_amount, status, is_demo) VALUES
 ('CB-0001','22222222-2222-2222-2222-222222222201','44444444-4444-4444-4444-444444444401','99999999-9999-9999-9999-999999999901', ARRAY['99999999-9999-9999-9999-999999999911'::uuid], current_date - 1, 216000, 6000, 210000,'submitted', true);

INSERT INTO public.machines (id, name, machine_code, is_demo) VALUES
 ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa01','JCB 3DX','MC-001',true),
 ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa02','Concrete Mixer','MC-002',true);
INSERT INTO public.machine_movements (machine_id, project_id, inward_at, outward_at, hours, remarks, is_demo) VALUES
 ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa01','22222222-2222-2222-2222-222222222201', now() - interval '2 days', now() - interval '1 day', 9,'Excavation (DEMO)', true);
