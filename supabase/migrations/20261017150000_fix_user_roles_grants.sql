-- ============================================================
-- 20261017150000_fix_user_roles_grants.sql
-- Fix: Grant INSERT, UPDATE, DELETE on public.user_roles to authenticated.
--
-- Root Cause:
-- Initial migration 20260817123052 granted only `SELECT` on `public.user_roles`
-- to the `authenticated` role.
-- When 20261010000000_role_based_access.sql added the RLS policy:
--   CREATE POLICY "user_roles admin write" ON public.user_roles FOR ALL
--     TO authenticated USING (public.is_md()) WITH CHECK (public.is_md());
-- PostgreSQL still blocked INSERT/UPDATE/DELETE at table-level privilege checks
-- with error 42501 ("permission denied for table user_roles") before RLS evaluation.
--
-- Security:
-- Row-Level Security (RLS) is ENABLED on public.user_roles.
-- Policy "user_roles admin write" strictly enforces that only users where
-- public.is_md() returns true can insert, update, or delete rows in user_roles.
-- Ordinary users (supervisors, accounts, viewers) cannot assign, update,
-- or grant themselves any roles.
-- ============================================================

-- 1. Grant write privileges on public.user_roles to authenticated users
GRANT INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;

-- 2. Verify / reinforce RLS and ensure the admin write policy is strictly set
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_roles admin write" ON public.user_roles;

CREATE POLICY "user_roles admin write" ON public.user_roles
  FOR ALL
  TO authenticated
  USING (public.is_md())
  WITH CHECK (public.is_md());

-- 3. Verify / reinforce read policy: MD can see all roles, users can see their own role
DROP POLICY IF EXISTS "user_roles read policy" ON public.user_roles;

CREATE POLICY "user_roles read policy" ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (public.is_md() OR user_id = auth.uid());
