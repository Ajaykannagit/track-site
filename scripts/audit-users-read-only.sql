-- =============================================================================
-- STEP 1: READ-ONLY AUDIT & DRY-RUN INSPECTION
-- =============================================================================
-- Run this query first in Supabase SQL Editor.
-- It displays every user in auth.users, their assigned role in public.user_roles,
-- their last sign-in timestamp, and their projected status under candidate emails.
--
-- PARAMETERS (Set the 3 candidate emails to test):
-- =============================================================================

WITH candidate_selection AS (
  SELECT
    NULLIF(TRIM(''), '') AS target_md_email,          -- e.g. 'director@brickweld.com'
    NULLIF(TRIM(''), '') AS target_accounts_email,    -- e.g. 'accountant@brickweld.com'
    NULLIF(TRIM(''), '') AS target_supervisor_email  -- e.g. 'supervisor@brickweld.com'
),
user_summary AS (
  SELECT
    u.id AS user_id,
    u.email,
    COALESCE(r.role, 'NO_ROLE') AS role,
    u.last_sign_in_at,
    u.created_at,
    CASE
      WHEN u.email = (SELECT target_md_email FROM candidate_selection) THEN 'PRESERVE (Candidate MD)'
      WHEN u.email = (SELECT target_accounts_email FROM candidate_selection) THEN 'PRESERVE (Candidate Accounts)'
      WHEN u.email = (SELECT target_supervisor_email FROM candidate_selection) THEN 'PRESERVE (Candidate Supervisor)'
      ELSE 'WOULD_BE_DELETED'
    END AS dry_run_action
  FROM auth.users u
  LEFT JOIN public.user_roles r ON r.user_id = u.id
)
SELECT
  user_id,
  email,
  role,
  last_sign_in_at,
  dry_run_action
FROM user_summary
ORDER BY
  CASE
    WHEN dry_run_action LIKE 'PRESERVE%' THEN 1
    WHEN role = 'md' THEN 2
    WHEN role = 'accounts' THEN 3
    WHEN role = 'supervisor' THEN 4
    ELSE 5
  END,
  email;
