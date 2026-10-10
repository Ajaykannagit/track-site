-- ============================================================
-- Update 7: Standalone Idempotent Seed Script
-- benchmark week: 13.09.2026 to 19.09.2026
-- All records created/updated marked with is_demo = true
-- ============================================================

DO $$
DECLARE
  -- Team IDs
  v_team_vinoth uuid;
  v_team_eranna uuid;
  v_team_sathish uuid;
  v_team_krishna uuid;

  -- Employee IDs
  v_emp_vinoth uuid;
  v_emp_krishna uuid;
  v_emp_eranna uuid;
  v_emp_ragunath uuid;
  v_emp_sanjay uuid;
  v_emp_gowtham uuid;
  v_emp_narasamma uuid;
  v_emp_ravi uuid;
  v_emp_madesh uuid;
  v_emp_sathish uuid;
  v_emp_beema uuid;
  v_emp_rammappa uuid;

  -- Site IDs
  v_site_637 uuid;
  v_site_3033 uuid;
  v_site_klm uuid;
  v_site_klr uuid;

  -- Dates
  v_week_start date := '2026-09-13'; -- Sunday
  v_day0 date := '2026-09-13';
  v_day1 date := '2026-09-14';
  v_day2 date := '2026-09-15';
  v_day3 date := '2026-09-16';
  v_day4 date := '2026-09-17';
  v_day5 date := '2026-09-18';
  v_day6 date := '2026-09-19';

  -- Project ID (for Subcontractor demo payments)
  v_project_id uuid;
BEGIN

  -- ------------------------------------------------------------
  -- 1. Ensure Teams exist with is_demo = true
  -- ------------------------------------------------------------
  INSERT INTO public.teams (name, is_demo)
  VALUES ('Vinoth Team', true)
  ON CONFLICT (name) DO UPDATE SET is_demo = true
  RETURNING id INTO v_team_vinoth;

  INSERT INTO public.teams (name, is_demo)
  VALUES ('Eranna Team', true)
  ON CONFLICT (name) DO UPDATE SET is_demo = true
  RETURNING id INTO v_team_eranna;

  INSERT INTO public.teams (name, is_demo)
  VALUES ('Sathish Team (Kolar)', true)
  ON CONFLICT (name) DO UPDATE SET is_demo = true
  RETURNING id INTO v_team_sathish;

  INSERT INTO public.teams (name, is_demo)
  VALUES ('Krishna team', true)
  ON CONFLICT (name) DO UPDATE SET is_demo = true
  RETURNING id INTO v_team_krishna;

  -- ------------------------------------------------------------
  -- 2. Ensure Sites exist with is_demo = true
  -- ------------------------------------------------------------
  INSERT INTO public.sites (name, code, is_demo) VALUES ('Site 637', 'S637', true)
  ON CONFLICT (name) DO UPDATE SET is_demo = true RETURNING id INTO v_site_637;

  INSERT INTO public.sites (name, code, is_demo) VALUES ('Site 3033', 'S3033', true)
  ON CONFLICT (name) DO UPDATE SET is_demo = true RETURNING id INTO v_site_3033;

  INSERT INTO public.sites (name, code, is_demo) VALUES ('Kelamangalam', 'KLM', true)
  ON CONFLICT (name) DO UPDATE SET is_demo = true RETURNING id INTO v_site_klm;

  INSERT INTO public.sites (name, code, is_demo) VALUES ('Kolar', 'KLR', true)
  ON CONFLICT (name) DO UPDATE SET is_demo = true RETURNING id INTO v_site_klr;

  -- ------------------------------------------------------------
  -- 3. Upsert Benchmark Employees
  -- ------------------------------------------------------------
  -- Vinoth (1100/day, Vinoth Team)
  INSERT INTO public.employees (employee_code, full_name, designation, wage_rate, team_id, is_active)
  VALUES ('EMP-VINOTH', 'Vinoth', 'Mason', 1100, v_team_vinoth, true)
  ON CONFLICT (employee_code) DO UPDATE SET wage_rate = 1100, team_id = v_team_vinoth, designation = 'Mason'
  RETURNING id INTO v_emp_vinoth;

  -- Krishna (1100/day, Krishna team)
  INSERT INTO public.employees (employee_code, full_name, designation, wage_rate, team_id, is_active)
  VALUES ('EMP-KRISHNA', 'Krishna', 'Mason', 1100, v_team_krishna, true)
  ON CONFLICT (employee_code) DO UPDATE SET wage_rate = 1100, team_id = v_team_krishna, designation = 'Mason'
  RETURNING id INTO v_emp_krishna;

  -- Eranna (750/day, Eranna Team)
  INSERT INTO public.employees (employee_code, full_name, designation, wage_rate, team_id, is_active)
  VALUES ('EMP-ERANNA', 'Eranna', 'Helper', 750, v_team_eranna, true)
  ON CONFLICT (employee_code) DO UPDATE SET wage_rate = 750, team_id = v_team_eranna, designation = 'Helper'
  RETURNING id INTO v_emp_eranna;

  -- Ragunath (750/day, Krishna team)
  INSERT INTO public.employees (employee_code, full_name, designation, wage_rate, team_id, is_active)
  VALUES ('EMP-RAGUNATH', 'Ragunath', 'Helper', 750, v_team_krishna, true)
  ON CONFLICT (employee_code) DO UPDATE SET wage_rate = 750, team_id = v_team_krishna, designation = 'Helper'
  RETURNING id INTO v_emp_ragunath;

  -- Sanjay (1100/day, Krishna team)
  INSERT INTO public.employees (employee_code, full_name, designation, wage_rate, team_id, is_active)
  VALUES ('EMP-SANJAY', 'Sanjay', 'Mason', 1100, v_team_krishna, true)
  ON CONFLICT (employee_code) DO UPDATE SET wage_rate = 1100, team_id = v_team_krishna, designation = 'Mason'
  RETURNING id INTO v_emp_sanjay;

  -- Gowtham (750/day, Vinoth Team)
  INSERT INTO public.employees (employee_code, full_name, designation, wage_rate, team_id, is_active)
  VALUES ('EMP-GOWTHAM', 'Gowtham', 'Helper', 750, v_team_vinoth, true)
  ON CONFLICT (employee_code) DO UPDATE SET wage_rate = 750, team_id = v_team_vinoth, designation = 'Helper'
  RETURNING id INTO v_emp_gowtham;

  -- Narasamma (500/day, Eranna Team)
  INSERT INTO public.employees (employee_code, full_name, designation, wage_rate, team_id, is_active)
  VALUES ('EMP-NARASAMMA', 'Narasamma', 'Helper', 500, v_team_eranna, true)
  ON CONFLICT (employee_code) DO UPDATE SET wage_rate = 500, team_id = v_team_eranna, designation = 'Helper'
  RETURNING id INTO v_emp_narasamma;

  -- Ravi (1100/day, Vinoth Team)
  INSERT INTO public.employees (employee_code, full_name, designation, wage_rate, team_id, is_active)
  VALUES ('EMP-RAVI', 'Ravi', 'Mason', 1100, v_team_vinoth, true)
  ON CONFLICT (employee_code) DO UPDATE SET wage_rate = 1100, team_id = v_team_vinoth, designation = 'Mason'
  RETURNING id INTO v_emp_ravi;

  -- Madesh (750/day, Vinoth Team)
  INSERT INTO public.employees (employee_code, full_name, designation, wage_rate, team_id, is_active)
  VALUES ('EMP-MADESH', 'Madesh', 'Helper', 750, v_team_vinoth, true)
  ON CONFLICT (employee_code) DO UPDATE SET wage_rate = 750, team_id = v_team_vinoth, designation = 'Helper'
  RETURNING id INTO v_emp_madesh;

  -- Sathish (1100/day, Sathish Team (Kolar))
  INSERT INTO public.employees (employee_code, full_name, designation, wage_rate, team_id, is_active)
  VALUES ('EMP-SATHISH', 'Sathish', 'Mason', 1100, v_team_sathish, true)
  ON CONFLICT (employee_code) DO UPDATE SET wage_rate = 1100, team_id = v_team_sathish, designation = 'Mason'
  RETURNING id INTO v_emp_sathish;

  -- Beema (750/day, Sathish Team (Kolar))
  INSERT INTO public.employees (employee_code, full_name, designation, wage_rate, team_id, is_active)
  VALUES ('EMP-BEEMA', 'Beema', 'Helper', 750, v_team_sathish, true)
  ON CONFLICT (employee_code) DO UPDATE SET wage_rate = 750, team_id = v_team_sathish, designation = 'Helper'
  RETURNING id INTO v_emp_beema;

  -- Rammappa (750/day, Sathish Team (Kolar))
  INSERT INTO public.employees (employee_code, full_name, designation, wage_rate, team_id, is_active)
  VALUES ('EMP-RAMMAPPA', 'Rammappa', 'Helper', 750, v_team_sathish, true)
  ON CONFLICT (employee_code) DO UPDATE SET wage_rate = 750, team_id = v_team_sathish, designation = 'Helper'
  RETURNING id INTO v_emp_rammappa;

  -- Update Team Leaders
  UPDATE public.teams SET leader_employee_id = v_emp_vinoth, leader_name = 'Vinoth' WHERE id = v_team_vinoth;
  UPDATE public.teams SET leader_employee_id = v_emp_eranna, leader_name = 'Eranna' WHERE id = v_team_eranna;
  UPDATE public.teams SET leader_employee_id = v_emp_sathish, leader_name = 'Sathish' WHERE id = v_team_sathish;
  UPDATE public.teams SET leader_employee_id = v_emp_krishna, leader_name = 'Krishna' WHERE id = v_team_krishna;

  -- ------------------------------------------------------------
  -- 4. Seed Attendance Records for Week 13.09.2026 - 19.09.2026
  -- ------------------------------------------------------------
  -- Clean existing attendance for benchmark week to ensure exact state
  DELETE FROM public.attendance WHERE attendance_date >= v_week_start AND attendance_date <= v_day6 AND employee_id IN (
    v_emp_vinoth, v_emp_krishna, v_emp_eranna, v_emp_ragunath, v_emp_sanjay,
    v_emp_gowtham, v_emp_narasamma, v_emp_ravi, v_emp_madesh, v_emp_sathish,
    v_emp_beema, v_emp_rammappa
  );

  -- Helper closure / inserts for attendance
  -- Vinoth (7.5 days total: 5 x 1.5 OT days) -> Wage 8250
  INSERT INTO public.attendance (employee_id, attendance_date, kind, status, in_time, out_time, site_id, site_name, day_value, calculated_wage) VALUES
    (v_emp_vinoth, v_day0, 'present', 'present', '6', '6', v_site_637, 'Site 637', 1.5, 1650),
    (v_emp_vinoth, v_day1, 'present', 'present', '6', '6', v_site_637, 'Site 637', 1.5, 1650),
    (v_emp_vinoth, v_day2, 'present', 'present', '6', '6', v_site_637, 'Site 637', 1.5, 1650),
    (v_emp_vinoth, v_day3, 'present', 'present', '6', '6', v_site_637, 'Site 637', 1.5, 1650),
    (v_emp_vinoth, v_day4, 'present', 'present', '6', '6', v_site_637, 'Site 637', 1.5, 1650);

  -- Krishna (8.0 days total: 4 x 1.5 + 2 x 1.0) -> Wage 8800
  INSERT INTO public.attendance (employee_id, attendance_date, kind, status, in_time, out_time, site_id, site_name, day_value, calculated_wage) VALUES
    (v_emp_krishna, v_day0, 'present', 'present', '6', '6', v_site_3033, 'Site 3033', 1.5, 1650),
    (v_emp_krishna, v_day1, 'present', 'present', '6', '6', v_site_3033, 'Site 3033', 1.5, 1650),
    (v_emp_krishna, v_day2, 'present', 'present', '6', '6', v_site_3033, 'Site 3033', 1.5, 1650),
    (v_emp_krishna, v_day3, 'present', 'present', '6', '6', v_site_3033, 'Site 3033', 1.5, 1650),
    (v_emp_krishna, v_day4, 'present', 'present', '9', '6', v_site_3033, 'Site 3033', 1.0, 1100),
    (v_emp_krishna, v_day5, 'present', 'present', '9', '6', v_site_3033, 'Site 3033', 1.0, 1100);

  -- Eranna (9.5 days total: 5 x 1.5 + 2 x 1.0) -> Wage 7125
  INSERT INTO public.attendance (employee_id, attendance_date, kind, status, in_time, out_time, site_id, site_name, day_value, calculated_wage) VALUES
    (v_emp_eranna, v_day0, 'present', 'present', '6', '6', v_site_637, 'Site 637', 1.5, 1125),
    (v_emp_eranna, v_day1, 'present', 'present', '6', '6', v_site_637, 'Site 637', 1.5, 1125),
    (v_emp_eranna, v_day2, 'present', 'present', '6', '6', v_site_637, 'Site 637', 1.5, 1125),
    (v_emp_eranna, v_day3, 'present', 'present', '6', '6', v_site_637, 'Site 637', 1.5, 1125),
    (v_emp_eranna, v_day4, 'present', 'present', '6', '6', v_site_637, 'Site 637', 1.5, 1125),
    (v_emp_eranna, v_day5, 'present', 'present', '9', '6', v_site_637, 'Site 637', 1.0, 750),
    (v_emp_eranna, v_day6, 'present', 'present', '9', '6', v_site_637, 'Site 637', 1.0, 750);

  -- Ragunath (8.0 days total: 4 x 1.5 + 2 x 1.0) -> Wage 6000
  INSERT INTO public.attendance (employee_id, attendance_date, kind, status, in_time, out_time, site_id, site_name, day_value, calculated_wage) VALUES
    (v_emp_ragunath, v_day0, 'present', 'present', '6', '6', v_site_3033, 'Site 3033', 1.5, 1125),
    (v_emp_ragunath, v_day1, 'present', 'present', '6', '6', v_site_3033, 'Site 3033', 1.5, 1125),
    (v_emp_ragunath, v_day2, 'present', 'present', '6', '6', v_site_3033, 'Site 3033', 1.5, 1125),
    (v_emp_ragunath, v_day3, 'present', 'present', '6', '6', v_site_3033, 'Site 3033', 1.5, 1125),
    (v_emp_ragunath, v_day4, 'present', 'present', '9', '6', v_site_3033, 'Site 3033', 1.0, 750),
    (v_emp_ragunath, v_day5, 'present', 'present', '9', '6', v_site_3033, 'Site 3033', 1.0, 750);

  -- Sanjay (8.0 days total: 4 x 1.5 + 2 x 1.0) -> Wage 8800
  INSERT INTO public.attendance (employee_id, attendance_date, kind, status, in_time, out_time, site_id, site_name, day_value, calculated_wage) VALUES
    (v_emp_sanjay, v_day0, 'present', 'present', '6', '6', v_site_3033, 'Site 3033', 1.5, 1650),
    (v_emp_sanjay, v_day1, 'present', 'present', '6', '6', v_site_3033, 'Site 3033', 1.5, 1650),
    (v_emp_sanjay, v_day2, 'present', 'present', '6', '6', v_site_3033, 'Site 3033', 1.5, 1650),
    (v_emp_sanjay, v_day3, 'present', 'present', '6', '6', v_site_3033, 'Site 3033', 1.5, 1650),
    (v_emp_sanjay, v_day4, 'present', 'present', '9', '6', v_site_3033, 'Site 3033', 1.0, 1100),
    (v_emp_sanjay, v_day5, 'present', 'present', '9', '6', v_site_3033, 'Site 3033', 1.0, 1100);

  -- Gowtham (10.0 days total: 6 x 1.5 + 1 x 1.0) -> Wage 7500
  INSERT INTO public.attendance (employee_id, attendance_date, kind, status, in_time, out_time, site_id, site_name, day_value, calculated_wage) VALUES
    (v_emp_gowtham, v_day0, 'present', 'present', '6', '6', v_site_637, 'Site 637', 1.5, 1125),
    (v_emp_gowtham, v_day1, 'present', 'present', '6', '6', v_site_637, 'Site 637', 1.5, 1125),
    (v_emp_gowtham, v_day2, 'present', 'present', '6', '6', v_site_637, 'Site 637', 1.5, 1125),
    (v_emp_gowtham, v_day3, 'present', 'present', '6', '6', v_site_637, 'Site 637', 1.5, 1125),
    (v_emp_gowtham, v_day4, 'present', 'present', '6', '6', v_site_637, 'Site 637', 1.5, 1125),
    (v_emp_gowtham, v_day5, 'present', 'present', '6', '6', v_site_637, 'Site 637', 1.5, 1125),
    (v_emp_gowtham, v_day6, 'present', 'present', '9', '6', v_site_637, 'Site 637', 1.0, 750);

  -- Narasamma (8.5 days total: 5 x 1.5 + 1 x 1.0) -> Wage 4250
  INSERT INTO public.attendance (employee_id, attendance_date, kind, status, in_time, out_time, site_id, site_name, day_value, calculated_wage) VALUES
    (v_emp_narasamma, v_day0, 'present', 'present', '6', '6', v_site_637, 'Site 637', 1.5, 750),
    (v_emp_narasamma, v_day1, 'present', 'present', '6', '6', v_site_637, 'Site 637', 1.5, 750),
    (v_emp_narasamma, v_day2, 'present', 'present', '6', '6', v_site_637, 'Site 637', 1.5, 750),
    (v_emp_narasamma, v_day3, 'present', 'present', '6', '6', v_site_637, 'Site 637', 1.5, 750),
    (v_emp_narasamma, v_day4, 'present', 'present', '6', '6', v_site_637, 'Site 637', 1.5, 750),
    (v_emp_narasamma, v_day5, 'present', 'present', '9', '6', v_site_637, 'Site 637', 1.0, 500);

  -- Ravi (6.0 days total: 4 x 1.5) -> Wage 6600
  INSERT INTO public.attendance (employee_id, attendance_date, kind, status, in_time, out_time, site_id, site_name, day_value, calculated_wage) VALUES
    (v_emp_ravi, v_day0, 'present', 'present', '6', '6', v_site_klm, 'Kelamangalam', 1.5, 1650),
    (v_emp_ravi, v_day1, 'present', 'present', '6', '6', v_site_klm, 'Kelamangalam', 1.5, 1650),
    (v_emp_ravi, v_day2, 'present', 'present', '6', '6', v_site_klm, 'Kelamangalam', 1.5, 1650),
    (v_emp_ravi, v_day3, 'present', 'present', '6', '6', v_site_klm, 'Kelamangalam', 1.5, 1650);

  -- Madesh (6.0 days total: 4 x 1.5) -> Wage 4500
  INSERT INTO public.attendance (employee_id, attendance_date, kind, status, in_time, out_time, site_id, site_name, day_value, calculated_wage) VALUES
    (v_emp_madesh, v_day0, 'present', 'present', '6', '6', v_site_klm, 'Kelamangalam', 1.5, 1125),
    (v_emp_madesh, v_day1, 'present', 'present', '6', '6', v_site_klm, 'Kelamangalam', 1.5, 1125),
    (v_emp_madesh, v_day2, 'present', 'present', '6', '6', v_site_klm, 'Kelamangalam', 1.5, 1125),
    (v_emp_madesh, v_day3, 'present', 'present', '6', '6', v_site_klm, 'Kelamangalam', 1.5, 1125);

  -- Sathish (1.0 days total: 1 x 1.0) -> Wage 1100
  INSERT INTO public.attendance (employee_id, attendance_date, kind, status, in_time, out_time, site_id, site_name, day_value, calculated_wage) VALUES
    (v_emp_sathish, v_day0, 'present', 'present', '9', '6', v_site_klr, 'Kolar', 1.0, 1100);

  -- Beema (1.0 days total: 1 x 1.0) -> Wage 750
  INSERT INTO public.attendance (employee_id, attendance_date, kind, status, in_time, out_time, site_id, site_name, day_value, calculated_wage) VALUES
    (v_emp_beema, v_day0, 'present', 'present', '9', '6', v_site_klr, 'Kolar', 1.0, 750);

  -- Rammappa (1.0 days total: 1 x 1.0) -> Wage 750
  INSERT INTO public.attendance (employee_id, attendance_date, kind, status, in_time, out_time, site_id, site_name, day_value, calculated_wage) VALUES
    (v_emp_rammappa, v_day0, 'present', 'present', '9', '6', v_site_klr, 'Kolar', 1.0, 750);

  -- ------------------------------------------------------------
  -- 5. Seed Weekly Wage Adjustments (Bus/Petrol 320 for Eranna)
  -- ------------------------------------------------------------
  INSERT INTO public.weekly_wage_adjustments (employee_id, week_start_date, bus_petrol, advance_paid, is_demo)
  VALUES (v_emp_eranna, v_week_start, 320, 0, true)
  ON CONFLICT (employee_id, week_start_date)
  DO UPDATE SET bus_petrol = 320, advance_paid = 0, is_demo = true;

  -- ------------------------------------------------------------
  -- 6. Seed Subcontractor Payments for week 13.09.2026
  -- ------------------------------------------------------------
  SELECT id INTO v_project_id FROM public.projects LIMIT 1;

  INSERT INTO public.subcontractor_payments (name, work_description, amount, payment_date, week_start_date, project_id, status, is_demo)
  VALUES
    ('Painter Sirenjeev + Arun + Paneer', 'Painting Contractor Voucher', 12000, v_week_start, v_week_start, v_project_id, 'job_done', true),
    ('Tamil Electrician', 'Electrical work settlement', 1475, v_week_start, v_week_start, v_project_id, 'job_done', true),
    ('Kelamangalam Site Petty Cash', 'Site operational disbursement', 2200, v_week_start, v_week_start, v_project_id, 'job_done', true)
  ON CONFLICT DO NOTHING;

END $$;
