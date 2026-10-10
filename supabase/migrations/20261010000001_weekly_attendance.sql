-- MIGRATION: Weekly Attendance Sheet, Teams, Managed Sites, & Wage Adjustments (Update 3)

-- 1. Create Teams Table
CREATE TABLE IF NOT EXISTS public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  leader_name text,
  leader_employee_id uuid,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Create Managed Sites Table
CREATE TABLE IF NOT EXISTS public.sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  code text,
  is_active boolean NOT NULL DEFAULT true,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Enhance Employees Table
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS photo_url text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS emergency_contact text;

-- 4. Enhance Attendance Table
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS in_time text;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS out_time text;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS site_name text;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS day_value numeric(3,2) DEFAULT 1.0;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS is_leave boolean DEFAULT false;

-- 5. Create Weekly Wage Adjustments Table (bus/petrol, advances per worker per week)
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

-- 6. Enable RLS and Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teams TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sites TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.weekly_wage_adjustments TO authenticated;

GRANT ALL ON public.teams TO service_role;
GRANT ALL ON public.sites TO service_role;
GRANT ALL ON public.weekly_wage_adjustments TO service_role;

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_wage_adjustments ENABLE ROW LEVEL SECURITY;

-- Read & Write Policies
CREATE POLICY "teams read policy" ON public.teams FOR SELECT TO authenticated USING (true);
CREATE POLICY "teams write policy" ON public.teams FOR ALL TO authenticated USING (public.is_operations_user()) WITH CHECK (public.is_operations_user());

CREATE POLICY "sites read policy" ON public.sites FOR SELECT TO authenticated USING (true);
CREATE POLICY "sites write policy" ON public.sites FOR ALL TO authenticated USING (public.is_operations_user()) WITH CHECK (public.is_operations_user());

CREATE POLICY "weekly_wage_adjustments read policy" ON public.weekly_wage_adjustments FOR SELECT TO authenticated USING (public.is_finance_user());
CREATE POLICY "weekly_wage_adjustments write policy" ON public.weekly_wage_adjustments FOR ALL TO authenticated USING (public.is_finance_user()) WITH CHECK (public.is_finance_user());

-- 7. Seed Initial Default Managed Sites
INSERT INTO public.sites (name, code) VALUES
  ('Site 637', 'S637'),
  ('Site 3033', 'S3033'),
  ('Kelamangalam', 'KLM'),
  ('Kolar', 'KLR'),
  ('Head Office', 'HO')
ON CONFLICT (name) DO NOTHING;

-- 8. Seed Default Teams
INSERT INTO public.teams (name) VALUES
  ('Vinoth Team'),
  ('Eranna Team'),
  ('Sathish Team (Kolar)'),
  ('Krishna team')
ON CONFLICT (name) DO NOTHING;
