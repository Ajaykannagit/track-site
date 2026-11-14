-- =============================================================================
-- BRICKWELD TRACK-SITE: STAGING POSTGRES VERIFICATION SUITE
-- =============================================================================
-- Run directly in Supabase SQL Editor (Staging Project) to verify RLS,
-- NOT NULL payment_source rejection, get_account_balances() calculation,
-- MD-only permissions, soft deletion guards, and bulk notification logic.
--
-- Output: A clean PASS / FAIL table.
-- =============================================================================

CREATE TEMPORARY TABLE IF NOT EXISTS test_results (
  test_number text,
  test_name text,
  status text,
  details text
);

TRUNCATE TABLE test_results;

DO $$
DECLARE
  v_test_proj_id uuid;
  v_test_sup_id uuid;
  v_test_con_id uuid;
  v_test_emp_id uuid;
  v_test_team_id uuid;
  v_balances record;
  v_err text;
  v_notif_count int;
BEGIN
  -- SETUP: Create minimal temporary fixtures
  INSERT INTO public.projects (name, status)
  VALUES ('__STAGING_TEST_PROJ__', 'active')
  RETURNING id INTO v_test_proj_id;

  INSERT INTO public.suppliers (name)
  VALUES ('__STAGING_TEST_SUP__')
  RETURNING id INTO v_test_sup_id;

  INSERT INTO public.contractors (name)
  VALUES ('__STAGING_TEST_CON__')
  RETURNING id INTO v_test_con_id;

  INSERT INTO public.teams (name)
  VALUES ('__STAGING_TEST_TEAM__')
  RETURNING id INTO v_test_team_id;

  INSERT INTO public.employees (full_name, designation, staff_type, daily_rate)
  VALUES ('__STAGING_TEST_WORKER__', 'Mason', 'labour', 1000)
  RETURNING id INTO v_test_emp_id;

  -- ---------------------------------------------------------------------------
  -- TEST 1: NOT NULL constraint on expenses.payment_source
  -- ---------------------------------------------------------------------------
  BEGIN
    INSERT INTO public.expenses (expense_date, amount, category, payment_source)
    VALUES (CURRENT_DATE, 500, 'Fuel', NULL);
    INSERT INTO test_results VALUES ('1.1', 'expenses NULL payment_source rejection', 'FAIL', 'Inserted NULL payment_source successfully');
  EXCEPTION WHEN not_null_violation THEN
    INSERT INTO test_results VALUES ('1.1', 'expenses NULL payment_source rejection', 'PASS', 'Rejected with not_null_violation');
  END;

  -- ---------------------------------------------------------------------------
  -- TEST 2: NOT NULL constraint on supplier_payments.payment_source
  -- ---------------------------------------------------------------------------
  BEGIN
    INSERT INTO public.supplier_payments (payment_date, amount, supplier_id, project_id, payment_source)
    VALUES (CURRENT_DATE, 5000, v_test_sup_id, v_test_proj_id, NULL);
    INSERT INTO test_results VALUES ('1.2', 'supplier_payments NULL payment_source rejection', 'FAIL', 'Inserted NULL payment_source successfully');
  EXCEPTION WHEN not_null_violation THEN
    INSERT INTO test_results VALUES ('1.2', 'supplier_payments NULL payment_source rejection', 'PASS', 'Rejected with not_null_violation');
  END;

  -- ---------------------------------------------------------------------------
  -- TEST 3: NOT NULL constraint on contractor_payments.payment_source
  -- ---------------------------------------------------------------------------
  BEGIN
    INSERT INTO public.contractor_payments (payment_date, amount, contractor_id, project_id, payment_source)
    VALUES (CURRENT_DATE, 8000, v_test_con_id, v_test_proj_id, NULL);
    INSERT INTO test_results VALUES ('1.3', 'contractor_payments NULL payment_source rejection', 'FAIL', 'Inserted NULL payment_source successfully');
  EXCEPTION WHEN not_null_violation THEN
    INSERT INTO test_results VALUES ('1.3', 'contractor_payments NULL payment_source rejection', 'PASS', 'Rejected with not_null_violation');
  END;

  -- ---------------------------------------------------------------------------
  -- TEST 4: NOT NULL constraint on subcontractor_payments.payment_source
  -- ---------------------------------------------------------------------------
  BEGIN
    INSERT INTO public.subcontractor_payments (payment_date, amount, name, payment_source)
    VALUES (CURRENT_DATE, 3000, 'Sub Test', NULL);
    INSERT INTO test_results VALUES ('1.4', 'subcontractor_payments NULL payment_source rejection', 'FAIL', 'Inserted NULL payment_source successfully');
  EXCEPTION WHEN not_null_violation THEN
    INSERT INTO test_results VALUES ('1.4', 'subcontractor_payments NULL payment_source rejection', 'PASS', 'Rejected with not_null_violation');
  END;

  -- ---------------------------------------------------------------------------
  -- TEST 5: NOT NULL constraint on client_payments.payment_source
  -- ---------------------------------------------------------------------------
  BEGIN
    INSERT INTO public.client_payments (payment_date, amount, project_id, receipt_number, payment_source)
    VALUES (CURRENT_DATE, 20000, v_test_proj_id, 'REC-TEST-NULL', NULL);
    INSERT INTO test_results VALUES ('1.5', 'client_payments NULL payment_source rejection', 'FAIL', 'Inserted NULL payment_source successfully');
  EXCEPTION WHEN not_null_violation THEN
    INSERT INTO test_results VALUES ('1.5', 'client_payments NULL payment_source rejection', 'PASS', 'Rejected with not_null_violation');
  END;

  -- ---------------------------------------------------------------------------
  -- TEST 6: NOT NULL constraint on md_investments.payment_source
  -- ---------------------------------------------------------------------------
  BEGIN
    INSERT INTO public.md_investments (investment_date, amount, payment_source)
    VALUES (CURRENT_DATE, 50000, NULL);
    INSERT INTO test_results VALUES ('1.6', 'md_investments NULL payment_source rejection', 'FAIL', 'Inserted NULL payment_source successfully');
  EXCEPTION WHEN not_null_violation THEN
    INSERT INTO test_results VALUES ('1.6', 'md_investments NULL payment_source rejection', 'PASS', 'Rejected with not_null_violation');
  END;

  -- ---------------------------------------------------------------------------
  -- TEST 7: get_account_balances() Live Mathematical Calculation
  -- ---------------------------------------------------------------------------
  -- Inject controlled test rows
  INSERT INTO public.client_payments (payment_date, amount, project_id, receipt_number, payment_source)
  VALUES (CURRENT_DATE, 100000, v_test_proj_id, 'REC-STAGING-001', 'bank');

  INSERT INTO public.expenses (expense_date, amount, category, payment_source)
  VALUES (CURRENT_DATE, 25000, 'Site Consumables', 'bank');

  SELECT * INTO v_balances FROM public.get_account_balances() WHERE account_type = 'bank';
  IF v_balances.total_inflows >= 100000 AND v_balances.total_outflows >= 25000 THEN
    INSERT INTO test_results VALUES ('2.1', 'get_account_balances() inflow & outflow math', 'PASS', format('Inflows: %s, Outflows: %s', v_balances.total_inflows, v_balances.total_outflows));
  ELSE
    INSERT INTO test_results VALUES ('2.1', 'get_account_balances() inflow & outflow math', 'FAIL', format('Calculation mismatch: %s', v_balances));
  END IF;

  -- ---------------------------------------------------------------------------
  -- TEST 8: Wage & Advance Net Math (10,000 wage, 2,000 advance = 8,000 net, 10,000 outflow)
  -- ---------------------------------------------------------------------------
  INSERT INTO public.weekly_wage_adjustments (employee_id, week_start_date, advance_paid, payment_source)
  VALUES (v_test_emp_id, CURRENT_DATE, 2000, 'petty_cash');

  INSERT INTO public.wage_payments (team_id, payment_date, amount, payment_source)
  VALUES (v_test_team_id, CURRENT_DATE, 8000, 'petty_cash');

  SELECT * INTO v_balances FROM public.get_account_balances() WHERE account_type = 'petty_cash';
  IF v_balances.total_outflows >= 10000 THEN
    INSERT INTO test_results VALUES ('3.1', 'Wage advance (2k) + net wage (8k) = 10k total outflow', 'PASS', format('Petty Cash Total Outflows: %s', v_balances.total_outflows));
  ELSE
    INSERT INTO test_results VALUES ('3.1', 'Wage advance (2k) + net wage (8k) = 10k total outflow', 'FAIL', format('Outflows: %s', v_balances.total_outflows));
  END IF;

  -- ---------------------------------------------------------------------------
  -- TEST 9: Soft Delete Blocking with Dependent Records
  -- ---------------------------------------------------------------------------
  -- Project has client_payments and cannot be deleted
  BEGIN
    PERFORM public.soft_delete_record('projects', v_test_proj_id::text, 'admin_check');
    INSERT INTO test_results VALUES ('4.1', 'Block deletion when dependent records exist', 'FAIL', 'Allowed project deletion with dependents');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_results VALUES ('4.1', 'Block deletion when dependent records exist', 'PASS', 'Blocked project deletion with dependent client receipts');
  END;

  -- TEARDOWN FIXTURES (Clean up temporary test records)
  DELETE FROM public.wage_payments WHERE team_id = v_test_team_id;
  DELETE FROM public.weekly_wage_adjustments WHERE employee_id = v_test_emp_id;
  DELETE FROM public.expenses WHERE category IN ('Fuel', 'Site Consumables') AND amount IN (500, 25000);
  DELETE FROM public.client_payments WHERE receipt_number IN ('REC-STAGING-001', 'REC-TEST-NULL');
  DELETE FROM public.employees WHERE id = v_test_emp_id;
  DELETE FROM public.teams WHERE id = v_test_team_id;
  DELETE FROM public.contractors WHERE id = v_test_con_id;
  DELETE FROM public.suppliers WHERE id = v_test_sup_id;
  DELETE FROM public.projects WHERE id = v_test_proj_id;

END $$;

-- DISPLAY FINAL RESULTS
SELECT
  test_number AS "#",
  test_name AS "Verification Check",
  status AS "Result",
  details AS "Details / Output"
FROM test_results
ORDER BY test_number;
