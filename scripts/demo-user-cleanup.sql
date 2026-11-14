-- =============================================================================
-- BRICKWELD TRACK-SITE: DEMO USER CLEANUP SCRIPT (HANDOVER PREPARATION)
-- =============================================================================
-- ⚠️  WARNING: THIS SCRIPT CLEANS SURPLUS TEST USERS.
--     LEAVES EXACTLY THREE USERS: 1 MD, 1 ACCOUNTS, 1 SUPERVISOR.
--     ALL OTHER USERS ARE REMOVED FROM auth.users, auth.identities, user_roles, profiles.
--
--     SAFETY GATE: You must set v_confirm_execution := TRUE before running!
-- =============================================================================

DO $$
DECLARE
  v_confirm_execution boolean := FALSE; -- CHANGE TO TRUE ONLY AFTER VERIFYING CANDIDATES!
  
  -- Target users to preserve (Replace with exact IDs or Emails confirmed by User)
  v_md_email text := 'director@brickweld.com';
  v_accounts_email text := 'accountant@brickweld.com';
  v_supervisor_email text := 'supervisor@brickweld.com';

  v_md_id uuid;
  v_accounts_id uuid;
  v_supervisor_id uuid;
  v_keep_ids uuid[];
  v_deleted_count int;
BEGIN
  IF NOT v_confirm_execution THEN
    RAISE EXCEPTION 'SAFETY STOP: v_confirm_execution is FALSE. Please inspect auth.users first and set v_confirm_execution := TRUE to proceed with user cleanup.';
  END IF;

  -- 1. Locate the users to keep
  SELECT id INTO v_md_id FROM auth.users WHERE email = v_md_email;
  SELECT id INTO v_accounts_id FROM auth.users WHERE email = v_accounts_email;
  SELECT id INTO v_supervisor_id FROM auth.users WHERE email = v_supervisor_email;

  -- If specific supervisor email not found, find any existing user with 'supervisor' role
  IF v_supervisor_id IS NULL THEN
    SELECT user_id INTO v_supervisor_id FROM public.user_roles WHERE role = 'supervisor' LIMIT 1;
  END IF;

  -- Verify at least MD and Accounts users exist
  IF v_md_id IS NULL THEN
    RAISE EXCEPTION 'ABORTING: MD user (%) not found in auth.users!', v_md_email;
  END IF;
  IF v_accounts_id IS NULL THEN
    RAISE EXCEPTION 'ABORTING: Accounts user (%) not found in auth.users!', v_accounts_email;
  END IF;

  -- Build array of IDs to keep
  v_keep_ids := ARRAY[v_md_id, v_accounts_id];
  IF v_supervisor_id IS NOT NULL THEN
    v_keep_ids := array_append(v_keep_ids, v_supervisor_id);
  END IF;

  RAISE NOTICE 'Preserving users: MD (%), Accounts (%), Supervisor (%)', v_md_id, v_accounts_id, v_supervisor_id;

  -- 2. Delete surplus user roles
  DELETE FROM public.user_roles
  WHERE NOT (user_id = ANY(v_keep_ids));

  -- 3. Delete surplus profiles if table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
    EXECUTE 'DELETE FROM public.profiles WHERE NOT (id = ANY($1))' USING v_keep_ids;
  END IF;

  -- 4. Delete surplus auth identities and sessions
  DELETE FROM auth.identities
  WHERE NOT (user_id = ANY(v_keep_ids));

  DELETE FROM auth.sessions
  WHERE NOT (user_id = ANY(v_keep_ids));

  -- 5. Delete surplus auth.users
  WITH deleted AS (
    DELETE FROM auth.users
    WHERE NOT (id = ANY(v_keep_ids))
    RETURNING id
  )
  SELECT count(*) INTO v_deleted_count FROM deleted;

  RAISE NOTICE 'SUCCESS: User cleanup complete. Removed % surplus users. Exactly preserved 3 demo users.', v_deleted_count;
END $$;
