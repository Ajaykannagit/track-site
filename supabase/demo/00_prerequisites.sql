-- ============================================================
-- 00_prerequisites.sql
-- Run this BEFORE 01_demo_seed.sql.
-- Safe to run more than once. All statements are idempotent.
-- Target: hosted Supabase at https://bcfirpcfowqaueqayksz.supabase.co
-- ============================================================

-- 1. Ensure migrations 20261010000001 through 20261010000003 tables exist.
--    These are the new tables added by Updates 3, 4, and 6.

-- teams
CREATE TABLE IF NOT EXISTS public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  leader_name text,
  leader_employee_id uuid,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- sites
CREATE TABLE IF NOT EXISTS public.sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  code text,
  is_active boolean NOT NULL DEFAULT true,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- extra columns on employees
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS photo_url text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS emergency_contact text;

-- extra columns on attendance
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS in_time text;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS out_time text;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS site_name text;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS day_value numeric(3,2) DEFAULT 1.0;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS is_leave boolean DEFAULT false;

-- weekly_wage_adjustments
CREATE TABLE IF NOT EXISTS public.weekly_wage_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  week_start_date date NOT NULL,
  bus_petrol numeric(10,2) NOT NULL DEFAULT 0,
  advance_paid numeric(10,2) NOT NULL DEFAULT 0,
  remarks text,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, week_start_date)
);

-- project_quotations
CREATE TABLE IF NOT EXISTS public.project_quotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  quotation_number text,
  title text NOT NULL,
  description text,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  quotation_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'approved',
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- subcontractor_payments
CREATE TABLE IF NOT EXISTS public.subcontractor_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  work_description text,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  payment_date date NOT NULL,
  week_start_date date NOT NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'job_done')),
  remarks text,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Grants (safe to re-run; PostgreSQL ignores duplicate grants)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teams TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sites TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.weekly_wage_adjustments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_quotations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subcontractor_payments TO authenticated;

GRANT ALL ON public.teams TO service_role;
GRANT ALL ON public.sites TO service_role;
GRANT ALL ON public.weekly_wage_adjustments TO service_role;
GRANT ALL ON public.project_quotations TO service_role;
GRANT ALL ON public.subcontractor_payments TO service_role;

-- 3. RLS (DO NOTHING if already enabled; CREATE POLICY errors if duplicate — wrap in exception blocks)
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_wage_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subcontractor_payments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "teams read policy" ON public.teams FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "teams write policy" ON public.teams FOR ALL TO authenticated USING (public.is_operations_user()) WITH CHECK (public.is_operations_user());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "sites read policy" ON public.sites FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "sites write policy" ON public.sites FOR ALL TO authenticated USING (public.is_operations_user()) WITH CHECK (public.is_operations_user());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "weekly_wage_adjustments read policy" ON public.weekly_wage_adjustments FOR SELECT TO authenticated USING (public.is_finance_user());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "weekly_wage_adjustments write policy" ON public.weekly_wage_adjustments FOR ALL TO authenticated USING (public.is_finance_user()) WITH CHECK (public.is_finance_user());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "project_quotations read policy" ON public.project_quotations FOR SELECT TO authenticated USING (public.is_finance_user());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "project_quotations write policy" ON public.project_quotations FOR ALL TO authenticated USING (public.is_finance_user()) WITH CHECK (public.is_finance_user());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Finance users can manage subcontractor payments" ON public.subcontractor_payments FOR ALL TO authenticated USING (public.is_finance_user()) WITH CHECK (public.is_finance_user());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4. Indexes (safe to re-run)
CREATE INDEX IF NOT EXISTS idx_project_quotations_project_id ON public.project_quotations(project_id);
CREATE INDEX IF NOT EXISTS subcontractor_payments_week_idx ON public.subcontractor_payments(week_start_date);
CREATE INDEX IF NOT EXISTS subcontractor_payments_project_idx ON public.subcontractor_payments(project_id);

-- Done. You may now run 01_demo_seed.sql.
