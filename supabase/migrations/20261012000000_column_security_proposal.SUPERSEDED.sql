-- =========================================================================
-- Column-Level Security (CLS) Enforcement for Restricted Roles
-- Protects quotation_amount from Viewer, and wage_rate/ot_rate from Supervisor & Viewer
-- =========================================================================

-- Option A: Column-Level Permissions (REVOKE column SELECT from authenticated,
-- then GRANT column SELECT to specific roles or create filtered views).
--
-- Postgres Row Level Security (RLS) filters rows, not columns.
-- To restrict specific columns from being returned across the wire via PostgREST:
-- 1. Create a secure public view or function for non-financial operations.
-- OR
-- 2. Revoke sensitive column access and grant through views/stored procedures.

-- Safe, proposed implementation:
-- Views for operational access:

-- 1. Projects view for Viewer/Supervisor (strips quotation_amount):
CREATE OR REPLACE VIEW public.projects_sanitized AS
SELECT
  id,
  project_code,
  house_number,
  name,
  client_id,
  CASE
    WHEN public.is_finance_user() THEN quotation_amount
    ELSE 0
  END AS quotation_amount,
  agreement_details,
  details,
  start_date,
  expected_completion_date,
  site_address,
  latitude,
  longitude,
  status,
  is_demo,
  created_by,
  created_at,
  updated_by,
  updated_at
FROM public.projects;

GRANT SELECT ON public.projects_sanitized TO authenticated;

-- 2. Employees view for Supervisor/Viewer (strips wage_rate and ot_rate_per_hour):
CREATE OR REPLACE VIEW public.employees_sanitized AS
SELECT
  id,
  employee_code,
  full_name,
  employee_type,
  designation,
  phone,
  address,
  wage_type,
  CASE
    WHEN public.is_finance_user() THEN wage_rate
    ELSE 0
  END AS wage_rate,
  CASE
    WHEN public.is_finance_user() THEN ot_rate_per_hour
    ELSE NULL
  END AS ot_rate_per_hour,
  team_id,
  photo_url,
  emergency_contact,
  active,
  is_demo,
  created_by,
  created_at,
  updated_by,
  updated_at
FROM public.employees;

GRANT SELECT ON public.employees_sanitized TO authenticated;
