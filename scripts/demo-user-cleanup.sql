-- =============================================================================
-- BRICKWELD TRACK-SITE: PARAMETERIZED SAFE USER CLEANUP SCRIPT
-- =============================================================================
-- ⚠️  CRITICAL SAFETY GATES:
--     1. v_confirm_execution MUST be explicitly set to TRUE.
--     2. User emails are PARAMETERS supplied by you (no hardcoded guesses).
--     3. Validates that ALL THREE users exist before touching anything.
--     4. Validates that among the 3 users, there is EXACTLY 1 MD, 1 Accounts, 1 Supervisor.
--     5. Checks that the preserved MD is NOT deleted, ensuring the system is never left without an MD.
--     6. If any check fails, the transaction is immediately ABORTED with RAISE EXCEPTION.
-- =============================================================================

DO $$
DECLARE
  -- ===========================================================================
  -- 1. INPUT PARAMETERS (SUPPLY CONFIRMED LIVE EMAILS HERE)
  -- ===========================================================================
  v_confirm_execution   boolean := FALSE; -- MUST BE SET TO TRUE TO RUN
  p_md_email            text    := '';    -- e.g. 'actual_md@brickweld.com'
  p_accounts_email      text    := '';    -- e.g. 'actual_acc@brickweld.com'
  p_supervisor_email    text    := '';    -- e.g. 'actual_sup@brickweld.com'

  -- Internal validation variables
  v_md_id           uuid;
  v_accounts_id     uuid;
  v_supervisor_id   uuid;
  v_md_role         text;
  v_accounts_role   text;
  v_supervisor_role text;
  v_keep_ids        uuid[];
  v_deleted_count   int;
  v_total_md_count  int;
BEGIN
  -- SAFETY CHECK 1: Confirmation flag
  IF NOT v_confirm_execution THEN
    RAISE EXCEPTION 'SAFETY STOP: v_confirm_execution is FALSE. Inspect users first and supply confirmed parameters before setting to TRUE.';
  END IF;

  -- SAFETY CHECK 2: Non-empty parameters
  IF COALESCE(TRIM(p_md_email), '') = '' OR 
     COALESCE(TRIM(p_accounts_email), '') = '' OR 
     COALESCE(TRIM(p_supervisor_email), '') = '' THEN
    RAISE EXCEPTION 'ABORTING: You must supply all three non-empty user email parameters: p_md_email, p_accounts_email, p_supervisor_email.';
  END IF;

  -- SAFETY CHECK 3: Ensure distinct emails supplied
  IF p_md_email = p_accounts_email OR p_md_email = p_supervisor_email OR p_accounts_email = p_supervisor_email THEN
    RAISE EXCEPTION 'ABORTING: All three candidate emails must be distinct accounts.';
  END IF;

  -- 2. Fetch Users and verify existence
  SELECT u.id, r.role INTO v_md_id, v_md_role
  FROM auth.users u
  LEFT JOIN public.user_roles r ON r.user_id = u.id
  WHERE LOWER(u.email) = LOWER(TRIM(p_md_email));

  SELECT u.id, r.role INTO v_accounts_id, v_accounts_role
  FROM auth.users u
  LEFT JOIN public.user_roles r ON r.user_id = u.id
  WHERE LOWER(u.email) = LOWER(TRIM(p_accounts_email));

  SELECT u.id, r.role INTO v_supervisor_id, v_supervisor_role
  FROM auth.users u
  LEFT JOIN public.user_roles r ON r.user_id = u.id
  WHERE LOWER(u.email) = LOWER(TRIM(p_supervisor_email));

  IF v_md_id IS NULL THEN
    RAISE EXCEPTION 'ABORTING: Preserved MD user "%" does not exist in auth.users!', p_md_email;
  END IF;
  IF v_accounts_id IS NULL THEN
    RAISE EXCEPTION 'ABORTING: Preserved Accounts user "%" does not exist in auth.users!', p_accounts_email;
  END IF;
  IF v_supervisor_id IS NULL THEN
    RAISE EXCEPTION 'ABORTING: Preserved Supervisor user "%" does not exist in auth.users!', p_supervisor_email;
  END IF;

  -- SAFETY CHECK 4: Verify exact role alignment
  IF v_md_role != 'md' THEN
    RAISE EXCEPTION 'ABORTING: User "%" does not have the "md" role (found role: "%")!', p_md_email, COALESCE(v_md_role, 'NONE');
  END IF;
  IF v_accounts_role != 'accounts' THEN
    RAISE EXCEPTION 'ABORTING: User "%" does not have the "accounts" role (found role: "%")!', p_accounts_email, COALESCE(v_accounts_role, 'NONE');
  END IF;
  IF v_supervisor_role != 'supervisor' THEN
    RAISE EXCEPTION 'ABORTING: User "%" does not have the "supervisor" role (found role: "%")!', p_supervisor_email, COALESCE(v_supervisor_role, 'NONE');
  END IF;

  -- SAFETY CHECK 5: Ensure system is not left without an MD
  SELECT count(*) INTO v_total_md_count FROM public.user_roles WHERE role = 'md';
  IF v_total_md_count < 1 THEN
    RAISE EXCEPTION 'ABORTING: Database integrity failure — zero MDs found!';
  END IF;

  v_keep_ids := ARRAY[v_md_id, v_accounts_id, v_supervisor_id];

  RAISE NOTICE 'VALIDATION PASSED: Exactly 3 target users verified (MD: %, Accounts: %, Supervisor: %). Proceeding with cleanup...',
    p_md_email, p_accounts_email, p_supervisor_email;

  -- 3. Cleanup surplus records
  -- A. User Roles
  DELETE FROM public.user_roles
  WHERE NOT (user_id = ANY(v_keep_ids));

  -- B. Profiles (if exists)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
    EXECUTE 'DELETE FROM public.profiles WHERE NOT (id = ANY($1))' USING v_keep_ids;
  END IF;

  -- C. Auth Sessions and Identities
  DELETE FROM auth.sessions WHERE NOT (user_id = ANY(v_keep_ids));
  DELETE FROM auth.identities WHERE NOT (user_id = ANY(v_keep_ids));

  -- D. Auth Users
  WITH deleted AS (
    DELETE FROM auth.users
    WHERE NOT (id = ANY(v_keep_ids))
    RETURNING id
  )
  SELECT count(*) INTO v_deleted_count FROM deleted;

  RAISE NOTICE 'SUCCESS: Cleanup complete. Removed % surplus user(s). Exactly 3 authorized demo users preserved.', v_deleted_count;
END $$;
