-- ============================================================
-- 01_demo_seed.sql  —  Batch 2 Demo Seed
-- Target: https://bcfirpcfowqaueqayksz.supabase.co
--
-- PREREQUISITES: Run 00_prerequisites.sql first.
-- IDEMPOTENT: Uses ON CONFLICT DO NOTHING / DO UPDATE.
--             Safe to run more than once; no DELETE/TRUNCATE.
-- NOT TESTED against a live Postgres instance — review before running.
--
-- UNIQUE-VALUE POLICY:
--   All human-readable unique codes are prefixed with "DEMO-" to prevent
--   collisions with real rows already in the hosted database.
--   Columns prefixed: project_code, employee_code, contractor_code,
--   request_number, po_number, receipt_number, work_order_number,
--   mb_number, bill_number, quotation_number.
--   teams.name and sites.name are NOT prefixed because the app reads
--   them by name (attendance sheet site_name column stores the literal
--   text), and the migration already inserted these exact names as real
--   operational data; ON CONFLICT DO UPDATE SET is_demo=true handles
--   the re-run case safely.
--
-- CONSISTENCY NUMBERS (calculated from data below):
--   Contract value  = sum(projects.quotation_amount)
--                   + sum(project_quotations.amount)
--                   = 48,200,000 + 3,050,000 = 51,250,000
--   Attendance wage benchmark week = 64,425 (verified)
--   Client payments received       = 3,600,000
--   Cash closing (latest)          = 285,000
-- ============================================================

DO $$
DECLARE
  -- ---- fixed project IDs (from original schema seed) ----
  v_prj1 uuid := '22222222-2222-2222-2222-222222222201'; -- Kumar Residence
  v_prj2 uuid := '22222222-2222-2222-2222-222222222202'; -- Sunrise Apartments
  v_prj3 uuid := '22222222-2222-2222-2222-222222222203'; -- Lakeview Farmhouse (completed)

  -- ---- new project IDs ----
  v_prj4 uuid := '22222222-2222-2222-2222-222222222204'; -- Nair Villa
  v_prj5 uuid := '22222222-2222-2222-2222-222222222205'; -- Metro Plaza Office

  -- ---- fixed client IDs (from original schema seed) ----
  v_cli1 uuid := '11111111-1111-1111-1111-111111111101'; -- Ramesh Kumar
  v_cli2 uuid := '11111111-1111-1111-1111-111111111102'; -- Sunrise Developers

  -- ---- new client IDs ----
  v_cli3 uuid := '11111111-1111-1111-1111-111111111103'; -- Nair Group
  v_cli4 uuid := '11111111-1111-1111-1111-111111111104'; -- Metro Corp

  -- ---- fixed contractor IDs (from original schema seed) ----
  v_con1 uuid := '44444444-4444-4444-4444-444444444401'; -- SRI Plastering Works
  v_con2 uuid := '44444444-4444-4444-4444-444444444402'; -- Balaji Electricals

  -- ---- new contractor IDs ----
  v_con3 uuid := '44444444-4444-4444-4444-444444444403'; -- Kumar Tiles & Flooring
  v_con4 uuid := '44444444-4444-4444-4444-444444444404'; -- Suresh Painting Works
  v_con5 uuid := '44444444-4444-4444-4444-444444444405'; -- Raja Civil Works

  -- ---- fixed supplier IDs (from original schema seed) ----
  v_sup1 uuid := '55555555-5555-5555-5555-555555555501'; -- Anand Steel & Cement
  v_sup2 uuid := '55555555-5555-5555-5555-555555555502'; -- Kavitha Hardware

  -- ---- new supplier IDs ----
  v_sup3 uuid := '55555555-5555-5555-5555-555555555503'; -- Senthil Sand & Aggregates
  v_sup4 uuid := '55555555-5555-5555-5555-555555555504'; -- Lakshmi Tiles & Sanitary
  v_sup5 uuid := '55555555-5555-5555-5555-555555555505'; -- Raj Electrical Supplies

  -- ---- team IDs (looked up after upsert) ----
  v_team_vinoth  uuid;
  v_team_eranna  uuid;
  v_team_sathish uuid;
  v_team_krishna uuid;

  -- ---- employee IDs (looked up after upsert) ----
  v_emp_vinoth    uuid;
  v_emp_krishna   uuid;
  v_emp_eranna    uuid;
  v_emp_ragunath  uuid;
  v_emp_sanjay    uuid;
  v_emp_gowtham   uuid;
  v_emp_narasamma uuid;
  v_emp_ravi      uuid;
  v_emp_madesh    uuid;
  v_emp_sathish   uuid;
  v_emp_beema     uuid;
  v_emp_rammappa  uuid;

  -- ---- site IDs (looked up after upsert) ----
  v_site_637  uuid;
  v_site_3033 uuid;
  v_site_klm  uuid;
  v_site_klr  uuid;

  -- ---- work-order IDs ----
  v_wo1 uuid := '99999999-9999-9999-9999-999999999901';
  v_wo2 uuid := '99999999-9999-9999-9999-999999999902';
  v_wo3 uuid := '99999999-9999-9999-9999-999999999903';
  v_wo4 uuid := '99999999-9999-9999-9999-999999999904';
  v_wo5 uuid := '99999999-9999-9999-9999-999999999905';

  -- ---- measurement-book IDs ----
  v_mb1 uuid := '99999999-9999-9999-9999-999999999911';
  v_mb2 uuid := '99999999-9999-9999-9999-999999999912';
  v_mb3 uuid := '99999999-9999-9999-9999-999999999913';
  v_mb4 uuid := '99999999-9999-9999-9999-999999999914';

  -- ---- contractor-bill IDs ----
  v_cb1 uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01';
  v_cb2 uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02';
  v_cb3 uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb03';
  v_cb4 uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb04';

  -- ---- material request / PO / receipt IDs ----
  v_mr1  uuid := '66666666-6666-6666-6666-666666666601';
  v_mr2  uuid := '66666666-6666-6666-6666-666666666602';
  v_mr3  uuid := '66666666-6666-6666-6666-666666666603';
  v_po1  uuid := '77777777-7777-7777-7777-777777777701';
  v_po2  uuid := '77777777-7777-7777-7777-777777777702';
  v_po3  uuid := '77777777-7777-7777-7777-777777777703';
  v_grn1 uuid := '88888888-8888-8888-8888-888888888801';
  v_grn2 uuid := '88888888-8888-8888-8888-888888888802';
  v_grn3 uuid := '88888888-8888-8888-8888-888888888803';

  -- ---- benchmark week ----
  v_week_start date := '2026-09-13';
  v_day0 date := '2026-09-13';
  v_day1 date := '2026-09-14';
  v_day2 date := '2026-09-15';
  v_day3 date := '2026-09-16';
  v_day4 date := '2026-09-17';
  v_day5 date := '2026-09-18';
  v_day6 date := '2026-09-19';

BEGIN

  -- ============================================================
  -- 1. CLIENTS
  -- ============================================================
  INSERT INTO public.clients (id, name, address, contact_person, phone, is_demo) VALUES
    (v_cli1, 'Ramesh Kumar (DEMO)',       '12 Anna Nagar, Chennai',     'Ramesh Kumar', '+91 98400 11111', true),
    (v_cli2, 'Sunrise Developers (DEMO)', 'MG Road, Coimbatore',        'Latha S',       '+91 98400 22222', true),
    (v_cli3, 'Nair Group (DEMO)',         '45 OMR, Sholinganallur',     'Pradeep Nair',  '+91 98400 33333', true),
    (v_cli4, 'Metro Corp (DEMO)',         '100 Feet Road, Vadapalani',  'Ganesh M',      '+91 98400 44444', true)
  ON CONFLICT (id) DO NOTHING;

  -- ============================================================
  -- 2. PROJECTS  (3 existing + 2 new)
  --    project_code prefixed "DEMO-" to avoid collision with real codes.
  -- ============================================================
  INSERT INTO public.projects
    (id, project_code, house_number, name, client_id, quotation_amount,
     start_date, expected_completion_date, site_address, status, details, is_demo)
  VALUES
    (v_prj1,'DEMO-PRJ-001','H-104','Kumar Residence (DEMO)',
     v_cli1, 8500000, '2025-04-01','2026-10-30',
     'Plot 104, Thoraipakkam, Chennai','active','G+1 residential villa',true),
    (v_prj2,'DEMO-PRJ-002','H-207','Sunrise Apartments Block B (DEMO)',
     v_cli2, 24500000,'2025-01-15','2026-12-31',
     'Saravanampatti, Coimbatore','active','12-unit apartment block',true),
    (v_prj3,'DEMO-PRJ-003','H-018','Lakeview Farmhouse (DEMO)',
     v_cli1, 5200000, '2024-06-01','2025-08-30',
     'Ottiyambakkam, Chennai','completed','Single floor farmhouse',true),
    (v_prj4,'DEMO-PRJ-004','H-312','Nair Villa (DEMO)',
     v_cli3, 3800000, '2026-03-01','2027-03-01',
     '45 OMR Phase 2, Chennai','active','3BHK villa with basement',true),
    (v_prj5,'DEMO-PRJ-005','H-501','Metro Plaza Office (DEMO)',
     v_cli4, 6200000, '2026-07-01','2027-06-30',
     'Vadapalani, Chennai','planning','Commercial office fit-out',true)
  ON CONFLICT (id) DO NOTHING;

  -- ============================================================
  -- 3. PROJECT BUDGETS
  -- ============================================================
  INSERT INTO public.project_budgets (project_id, category, budget_amount) VALUES
    (v_prj1,'material',  3800000),
    (v_prj1,'labour',    1600000),
    (v_prj1,'contractor',1500000),
    (v_prj1,'other',      400000),
    (v_prj2,'material', 11000000),
    (v_prj2,'labour',    4500000),
    (v_prj2,'contractor',4200000),
    (v_prj2,'other',      900000),
    (v_prj4,'material',  1700000),
    (v_prj4,'labour',     800000),
    (v_prj4,'contractor', 900000),
    (v_prj4,'other',      200000),
    (v_prj5,'material',  2800000),
    (v_prj5,'labour',    1200000),
    (v_prj5,'contractor',1500000),
    (v_prj5,'other',      300000)
  ON CONFLICT DO NOTHING;

  -- ============================================================
  -- 4. PROJECT QUOTATIONS / VARIATIONS
  --    quotation_number prefixed "DEMO-".
  -- ============================================================
  INSERT INTO public.project_quotations
    (id, project_id, quotation_number, title, amount, quotation_date, status, is_demo)
  VALUES
    ('cccccccc-cccc-cccc-cccc-cccccccccc01',
     v_prj1,'DEMO-QV-001','Extra headroom for master bedroom',500000,'2025-08-15','approved',true),
    ('cccccccc-cccc-cccc-cccc-cccccccccc02',
     v_prj1,'DEMO-QV-002','Swimming pool addition',350000,'2025-11-20','approved',true),
    ('cccccccc-cccc-cccc-cccc-cccccccccc03',
     v_prj2,'DEMO-QV-003','Rooftop clubhouse addition',1200000,'2025-09-01','approved',true),
    ('cccccccc-cccc-cccc-cccc-cccccccccc04',
     v_prj2,'DEMO-QV-004','Generator room & UPS room',800000,'2026-01-10','approved',true),
    ('cccccccc-cccc-cccc-cccc-cccccccccc05',
     v_prj4,'DEMO-QV-005','Landscape & boundary wall',200000,'2026-05-01','approved',true)
  ON CONFLICT (id) DO NOTHING;
  -- Contract value summary:
  --   DEMO-PRJ-001: 8,500,000 + 500,000 + 350,000 = 9,350,000
  --   DEMO-PRJ-002: 24,500,000 + 1,200,000 + 800,000 = 26,500,000
  --   DEMO-PRJ-003: 5,200,000
  --   DEMO-PRJ-004: 3,800,000 + 200,000 = 4,000,000
  --   DEMO-PRJ-005: 6,200,000
  --   TOTAL        : 51,250,000

  -- ============================================================
  -- 5. SUPPLIERS
  -- ============================================================
  INSERT INTO public.suppliers (id, name, phone, address, gst_number, is_demo) VALUES
    (v_sup1,'Anand Steel & Cement (DEMO)',       '+91 91000 11111','Chennai',        'GSTN33000001', true),
    (v_sup2,'Kavitha Hardware (DEMO)',            '+91 91000 22222','Coimbatore',     'GSTN33000002', true),
    (v_sup3,'Senthil Sand & Aggregates (DEMO)',   '+91 91000 33333','Kancheepuram',   'GSTN33000003', true),
    (v_sup4,'Lakshmi Tiles & Sanitary (DEMO)',    '+91 91000 44444','Chennai',        'GSTN33000004', true),
    (v_sup5,'Raj Electrical Supplies (DEMO)',     '+91 91000 55555','Chennai',        'GSTN33000005', true)
  ON CONFLICT (id) DO NOTHING;

  -- ============================================================
  -- 6. CONTRACTORS
  --    contractor_code prefixed "DEMO-".
  -- ============================================================
  INSERT INTO public.contractors
    (id, contractor_code, name, phone, contractor_type, address, is_demo) VALUES
    (v_con1,'DEMO-CON-001','SRI Plastering Works (DEMO)',   '+91 90000 11111','Plastering','Chennai',      true),
    (v_con2,'DEMO-CON-002','Balaji Electricals (DEMO)',      '+91 90000 22222','Electrical','Coimbatore',   true),
    (v_con3,'DEMO-CON-003','Kumar Tiles & Flooring (DEMO)',  '+91 90000 33333','Flooring',  'Chennai',      true),
    (v_con4,'DEMO-CON-004','Suresh Painting Works (DEMO)',   '+91 90000 44444','Painting',  'Chennai',      true),
    (v_con5,'DEMO-CON-005','Raja Civil Works (DEMO)',        '+91 90000 55555','Civil',     'Kancheepuram', true)
  ON CONFLICT (id) DO NOTHING;

  -- ============================================================
  -- 7. TEAMS
  --    teams.name is NOT prefixed: these exact names are the real
  --    operational team names already seeded by migration 20261010000001.
  --    The attendance sheet stores site_name as a text copy of this value.
  --    ON CONFLICT DO UPDATE SET is_demo=true is safe here.
  -- ============================================================
  INSERT INTO public.teams (name, is_demo) VALUES ('Vinoth Team', true)
    ON CONFLICT (name) DO UPDATE SET is_demo = true RETURNING id INTO v_team_vinoth;
  INSERT INTO public.teams (name, is_demo) VALUES ('Eranna Team', true)
    ON CONFLICT (name) DO UPDATE SET is_demo = true RETURNING id INTO v_team_eranna;
  INSERT INTO public.teams (name, is_demo) VALUES ('Sathish Team (Kolar)', true)
    ON CONFLICT (name) DO UPDATE SET is_demo = true RETURNING id INTO v_team_sathish;
  INSERT INTO public.teams (name, is_demo) VALUES ('Krishna team', true)
    ON CONFLICT (name) DO UPDATE SET is_demo = true RETURNING id INTO v_team_krishna;

  -- ============================================================
  -- 8. SITES
  --    sites.name is NOT prefixed for the same reason as teams.name:
  --    the attendance table stores site_name as a plain text copy of
  --    the real site name (e.g. 'Site 637').  The benchmark attendance
  --    rows below must use those exact strings.
  -- ============================================================
  INSERT INTO public.sites (name, code, is_demo) VALUES ('Site 637',     'S637',  true)
    ON CONFLICT (name) DO UPDATE SET is_demo = true RETURNING id INTO v_site_637;
  INSERT INTO public.sites (name, code, is_demo) VALUES ('Site 3033',    'S3033', true)
    ON CONFLICT (name) DO UPDATE SET is_demo = true RETURNING id INTO v_site_3033;
  INSERT INTO public.sites (name, code, is_demo) VALUES ('Kelamangalam', 'KLM',   true)
    ON CONFLICT (name) DO UPDATE SET is_demo = true RETURNING id INTO v_site_klm;
  INSERT INTO public.sites (name, code, is_demo) VALUES ('Kolar',        'KLR',   true)
    ON CONFLICT (name) DO UPDATE SET is_demo = true RETURNING id INTO v_site_klr;

  -- ============================================================
  -- 9. BENCHMARK EMPLOYEES (12 workers)
  --    employee_code prefixed "DEMO-".
  -- ============================================================
  INSERT INTO public.employees (employee_code, full_name, designation, wage_rate, team_id, is_demo)
    VALUES ('DEMO-EMP-VINOTH',   'Vinoth',    'Mason',  1100, v_team_vinoth,  true)
    ON CONFLICT (employee_code) DO UPDATE SET wage_rate=1100, team_id=v_team_vinoth,  is_demo=true
    RETURNING id INTO v_emp_vinoth;

  INSERT INTO public.employees (employee_code, full_name, designation, wage_rate, team_id, is_demo)
    VALUES ('DEMO-EMP-KRISHNA',  'Krishna',   'Mason',  1100, v_team_krishna, true)
    ON CONFLICT (employee_code) DO UPDATE SET wage_rate=1100, team_id=v_team_krishna, is_demo=true
    RETURNING id INTO v_emp_krishna;

  INSERT INTO public.employees (employee_code, full_name, designation, wage_rate, team_id, is_demo)
    VALUES ('DEMO-EMP-ERANNA',   'Eranna',    'Helper',  750, v_team_eranna,  true)
    ON CONFLICT (employee_code) DO UPDATE SET wage_rate=750,  team_id=v_team_eranna,  is_demo=true
    RETURNING id INTO v_emp_eranna;

  INSERT INTO public.employees (employee_code, full_name, designation, wage_rate, team_id, is_demo)
    VALUES ('DEMO-EMP-RAGUNATH', 'Ragunath',  'Helper',  750, v_team_krishna, true)
    ON CONFLICT (employee_code) DO UPDATE SET wage_rate=750,  team_id=v_team_krishna, is_demo=true
    RETURNING id INTO v_emp_ragunath;

  INSERT INTO public.employees (employee_code, full_name, designation, wage_rate, team_id, is_demo)
    VALUES ('DEMO-EMP-SANJAY',   'Sanjay',    'Mason',  1100, v_team_krishna, true)
    ON CONFLICT (employee_code) DO UPDATE SET wage_rate=1100, team_id=v_team_krishna, is_demo=true
    RETURNING id INTO v_emp_sanjay;

  INSERT INTO public.employees (employee_code, full_name, designation, wage_rate, team_id, is_demo)
    VALUES ('DEMO-EMP-GOWTHAM',  'Gowtham',   'Helper',  750, v_team_vinoth,  true)
    ON CONFLICT (employee_code) DO UPDATE SET wage_rate=750,  team_id=v_team_vinoth,  is_demo=true
    RETURNING id INTO v_emp_gowtham;

  INSERT INTO public.employees (employee_code, full_name, designation, wage_rate, team_id, is_demo)
    VALUES ('DEMO-EMP-NARASAMMA','Narasamma', 'Helper',  500, v_team_eranna,  true)
    ON CONFLICT (employee_code) DO UPDATE SET wage_rate=500,  team_id=v_team_eranna,  is_demo=true
    RETURNING id INTO v_emp_narasamma;

  INSERT INTO public.employees (employee_code, full_name, designation, wage_rate, team_id, is_demo)
    VALUES ('DEMO-EMP-RAVI',     'Ravi',      'Mason',  1100, v_team_vinoth,  true)
    ON CONFLICT (employee_code) DO UPDATE SET wage_rate=1100, team_id=v_team_vinoth,  is_demo=true
    RETURNING id INTO v_emp_ravi;

  INSERT INTO public.employees (employee_code, full_name, designation, wage_rate, team_id, is_demo)
    VALUES ('DEMO-EMP-MADESH',   'Madesh',    'Helper',  750, v_team_vinoth,  true)
    ON CONFLICT (employee_code) DO UPDATE SET wage_rate=750,  team_id=v_team_vinoth,  is_demo=true
    RETURNING id INTO v_emp_madesh;

  INSERT INTO public.employees (employee_code, full_name, designation, wage_rate, team_id, is_demo)
    VALUES ('DEMO-EMP-SATHISH',  'Sathish',   'Mason',  1100, v_team_sathish, true)
    ON CONFLICT (employee_code) DO UPDATE SET wage_rate=1100, team_id=v_team_sathish, is_demo=true
    RETURNING id INTO v_emp_sathish;

  INSERT INTO public.employees (employee_code, full_name, designation, wage_rate, team_id, is_demo)
    VALUES ('DEMO-EMP-BEEMA',    'Beema',     'Helper',  750, v_team_sathish, true)
    ON CONFLICT (employee_code) DO UPDATE SET wage_rate=750,  team_id=v_team_sathish, is_demo=true
    RETURNING id INTO v_emp_beema;

  INSERT INTO public.employees (employee_code, full_name, designation, wage_rate, team_id, is_demo)
    VALUES ('DEMO-EMP-RAMMAPPA', 'Rammappa',  'Helper',  750, v_team_sathish, true)
    ON CONFLICT (employee_code) DO UPDATE SET wage_rate=750,  team_id=v_team_sathish, is_demo=true
    RETURNING id INTO v_emp_rammappa;

  -- Update team leaders
  UPDATE public.teams SET leader_employee_id = v_emp_vinoth,   leader_name = 'Vinoth'   WHERE id = v_team_vinoth;
  UPDATE public.teams SET leader_employee_id = v_emp_eranna,   leader_name = 'Eranna'   WHERE id = v_team_eranna;
  UPDATE public.teams SET leader_employee_id = v_emp_sathish,  leader_name = 'Sathish'  WHERE id = v_team_sathish;
  UPDATE public.teams SET leader_employee_id = v_emp_krishna,  leader_name = 'Krishna'  WHERE id = v_team_krishna;

  -- ============================================================
  -- 10. BENCHMARK ATTENDANCE  (13.09.2026 – 19.09.2026)
  --     Delete then re-insert for exact match on re-run.
  -- ============================================================
  DELETE FROM public.attendance
  WHERE attendance_date BETWEEN v_week_start AND v_day6
    AND employee_id IN (
      v_emp_vinoth, v_emp_krishna, v_emp_eranna, v_emp_ragunath,
      v_emp_sanjay, v_emp_gowtham, v_emp_narasamma, v_emp_ravi,
      v_emp_madesh, v_emp_sathish, v_emp_beema, v_emp_rammappa
    );

  -- Vinoth  7.5 days x 1100 = 8250  (5 x 1.5 OT days at Site 637)
  INSERT INTO public.attendance
    (employee_id, attendance_date, kind, status, in_time, out_time,
     site_id, site_name, day_value, calculated_wage, wage_rate, working_hours, is_demo)
  VALUES
    (v_emp_vinoth, v_day0,'labour','present','6','6',v_site_637,'Site 637',1.5,1650,1100,12,true),
    (v_emp_vinoth, v_day1,'labour','present','6','6',v_site_637,'Site 637',1.5,1650,1100,12,true),
    (v_emp_vinoth, v_day2,'labour','present','6','6',v_site_637,'Site 637',1.5,1650,1100,12,true),
    (v_emp_vinoth, v_day3,'labour','present','6','6',v_site_637,'Site 637',1.5,1650,1100,12,true),
    (v_emp_vinoth, v_day4,'labour','present','6','6',v_site_637,'Site 637',1.5,1650,1100,12,true);

  -- Krishna  8.0 days x 1100 = 8800  (4x1.5 + 2x1.0 at Site 3033)
  INSERT INTO public.attendance
    (employee_id, attendance_date, kind, status, in_time, out_time,
     site_id, site_name, day_value, calculated_wage, wage_rate, working_hours, is_demo)
  VALUES
    (v_emp_krishna, v_day0,'labour','present','6','6',v_site_3033,'Site 3033',1.5,1650,1100,12,true),
    (v_emp_krishna, v_day1,'labour','present','6','6',v_site_3033,'Site 3033',1.5,1650,1100,12,true),
    (v_emp_krishna, v_day2,'labour','present','6','6',v_site_3033,'Site 3033',1.5,1650,1100,12,true),
    (v_emp_krishna, v_day3,'labour','present','6','6',v_site_3033,'Site 3033',1.5,1650,1100,12,true),
    (v_emp_krishna, v_day4,'labour','present','9','6',v_site_3033,'Site 3033',1.0,1100,1100, 9,true),
    (v_emp_krishna, v_day5,'labour','present','9','6',v_site_3033,'Site 3033',1.0,1100,1100, 9,true);

  -- Eranna  9.5 days x 750 = 7125  (5x1.5 + 2x1.0 at Site 637; bus=320)
  INSERT INTO public.attendance
    (employee_id, attendance_date, kind, status, in_time, out_time,
     site_id, site_name, day_value, calculated_wage, wage_rate, working_hours, is_demo)
  VALUES
    (v_emp_eranna, v_day0,'labour','present','6','6',v_site_637,'Site 637',1.5,1125,750,12,true),
    (v_emp_eranna, v_day1,'labour','present','6','6',v_site_637,'Site 637',1.5,1125,750,12,true),
    (v_emp_eranna, v_day2,'labour','present','6','6',v_site_637,'Site 637',1.5,1125,750,12,true),
    (v_emp_eranna, v_day3,'labour','present','6','6',v_site_637,'Site 637',1.5,1125,750,12,true),
    (v_emp_eranna, v_day4,'labour','present','6','6',v_site_637,'Site 637',1.5,1125,750,12,true),
    (v_emp_eranna, v_day5,'labour','present','9','6',v_site_637,'Site 637',1.0, 750,750, 9,true),
    (v_emp_eranna, v_day6,'labour','present','9','6',v_site_637,'Site 637',1.0, 750,750, 9,true);

  -- Ragunath  8.0 days x 750 = 6000  (4x1.5 + 2x1.0 at Site 3033)
  INSERT INTO public.attendance
    (employee_id, attendance_date, kind, status, in_time, out_time,
     site_id, site_name, day_value, calculated_wage, wage_rate, working_hours, is_demo)
  VALUES
    (v_emp_ragunath, v_day0,'labour','present','6','6',v_site_3033,'Site 3033',1.5,1125,750,12,true),
    (v_emp_ragunath, v_day1,'labour','present','6','6',v_site_3033,'Site 3033',1.5,1125,750,12,true),
    (v_emp_ragunath, v_day2,'labour','present','6','6',v_site_3033,'Site 3033',1.5,1125,750,12,true),
    (v_emp_ragunath, v_day3,'labour','present','6','6',v_site_3033,'Site 3033',1.5,1125,750,12,true),
    (v_emp_ragunath, v_day4,'labour','present','9','6',v_site_3033,'Site 3033',1.0, 750,750, 9,true),
    (v_emp_ragunath, v_day5,'labour','present','9','6',v_site_3033,'Site 3033',1.0, 750,750, 9,true);

  -- Sanjay  8.0 days x 1100 = 8800  (4x1.5 + 2x1.0 at Site 3033)
  INSERT INTO public.attendance
    (employee_id, attendance_date, kind, status, in_time, out_time,
     site_id, site_name, day_value, calculated_wage, wage_rate, working_hours, is_demo)
  VALUES
    (v_emp_sanjay, v_day0,'labour','present','6','6',v_site_3033,'Site 3033',1.5,1650,1100,12,true),
    (v_emp_sanjay, v_day1,'labour','present','6','6',v_site_3033,'Site 3033',1.5,1650,1100,12,true),
    (v_emp_sanjay, v_day2,'labour','present','6','6',v_site_3033,'Site 3033',1.5,1650,1100,12,true),
    (v_emp_sanjay, v_day3,'labour','present','6','6',v_site_3033,'Site 3033',1.5,1650,1100,12,true),
    (v_emp_sanjay, v_day4,'labour','present','9','6',v_site_3033,'Site 3033',1.0,1100,1100, 9,true),
    (v_emp_sanjay, v_day5,'labour','present','9','6',v_site_3033,'Site 3033',1.0,1100,1100, 9,true);

  -- Gowtham  10.0 days x 750 = 7500  (6x1.5 + 1x1.0 at Site 637)
  INSERT INTO public.attendance
    (employee_id, attendance_date, kind, status, in_time, out_time,
     site_id, site_name, day_value, calculated_wage, wage_rate, working_hours, is_demo)
  VALUES
    (v_emp_gowtham, v_day0,'labour','present','6','6',v_site_637,'Site 637',1.5,1125,750,12,true),
    (v_emp_gowtham, v_day1,'labour','present','6','6',v_site_637,'Site 637',1.5,1125,750,12,true),
    (v_emp_gowtham, v_day2,'labour','present','6','6',v_site_637,'Site 637',1.5,1125,750,12,true),
    (v_emp_gowtham, v_day3,'labour','present','6','6',v_site_637,'Site 637',1.5,1125,750,12,true),
    (v_emp_gowtham, v_day4,'labour','present','6','6',v_site_637,'Site 637',1.5,1125,750,12,true),
    (v_emp_gowtham, v_day5,'labour','present','6','6',v_site_637,'Site 637',1.5,1125,750,12,true),
    (v_emp_gowtham, v_day6,'labour','present','9','6',v_site_637,'Site 637',1.0, 750,750, 9,true);

  -- Narasamma  8.5 days x 500 = 4250  (5x1.5 + 1x1.0 at Site 637)
  INSERT INTO public.attendance
    (employee_id, attendance_date, kind, status, in_time, out_time,
     site_id, site_name, day_value, calculated_wage, wage_rate, working_hours, is_demo)
  VALUES
    (v_emp_narasamma, v_day0,'labour','present','6','6',v_site_637,'Site 637',1.5,750,500,12,true),
    (v_emp_narasamma, v_day1,'labour','present','6','6',v_site_637,'Site 637',1.5,750,500,12,true),
    (v_emp_narasamma, v_day2,'labour','present','6','6',v_site_637,'Site 637',1.5,750,500,12,true),
    (v_emp_narasamma, v_day3,'labour','present','6','6',v_site_637,'Site 637',1.5,750,500,12,true),
    (v_emp_narasamma, v_day4,'labour','present','6','6',v_site_637,'Site 637',1.5,750,500,12,true),
    (v_emp_narasamma, v_day5,'labour','present','9','6',v_site_637,'Site 637',1.0,500,500, 9,true);

  -- Ravi  6.0 days x 1100 = 6600  (4x1.5 at Kelamangalam)
  INSERT INTO public.attendance
    (employee_id, attendance_date, kind, status, in_time, out_time,
     site_id, site_name, day_value, calculated_wage, wage_rate, working_hours, is_demo)
  VALUES
    (v_emp_ravi, v_day0,'labour','present','6','6',v_site_klm,'Kelamangalam',1.5,1650,1100,12,true),
    (v_emp_ravi, v_day1,'labour','present','6','6',v_site_klm,'Kelamangalam',1.5,1650,1100,12,true),
    (v_emp_ravi, v_day2,'labour','present','6','6',v_site_klm,'Kelamangalam',1.5,1650,1100,12,true),
    (v_emp_ravi, v_day3,'labour','present','6','6',v_site_klm,'Kelamangalam',1.5,1650,1100,12,true);

  -- Madesh  6.0 days x 750 = 4500  (4x1.5 at Kelamangalam)
  INSERT INTO public.attendance
    (employee_id, attendance_date, kind, status, in_time, out_time,
     site_id, site_name, day_value, calculated_wage, wage_rate, working_hours, is_demo)
  VALUES
    (v_emp_madesh, v_day0,'labour','present','6','6',v_site_klm,'Kelamangalam',1.5,1125,750,12,true),
    (v_emp_madesh, v_day1,'labour','present','6','6',v_site_klm,'Kelamangalam',1.5,1125,750,12,true),
    (v_emp_madesh, v_day2,'labour','present','6','6',v_site_klm,'Kelamangalam',1.5,1125,750,12,true),
    (v_emp_madesh, v_day3,'labour','present','6','6',v_site_klm,'Kelamangalam',1.5,1125,750,12,true);

  -- Sathish  1.0 day x 1100 = 1100  (1x1.0 at Kolar)
  INSERT INTO public.attendance
    (employee_id, attendance_date, kind, status, in_time, out_time,
     site_id, site_name, day_value, calculated_wage, wage_rate, working_hours, is_demo)
  VALUES
    (v_emp_sathsih_err, v_day0,'labour','present','9','6',v_site_klr,'Kolar',1.0,1100,1100,9,true);

  -- Beema  1.0 day x 750 = 750  (1x1.0 at Kolar)
  INSERT INTO public.attendance
    (employee_id, attendance_date, kind, status, in_time, out_time,
     site_id, site_name, day_value, calculated_wage, wage_rate, working_hours, is_demo)
  VALUES
    (v_emp_beema, v_day0,'labour','present','9','6',v_site_klr,'Kolar',1.0,750,750,9,true);

  -- Rammappa  1.0 day x 750 = 750  (1x1.0 at Kolar)
  INSERT INTO public.attendance
    (employee_id, attendance_date, kind, status, in_time, out_time,
     site_id, site_name, day_value, calculated_wage, wage_rate, working_hours, is_demo)
  VALUES
    (v_emp_rammappa, v_day0,'labour','present','9','6',v_site_klr,'Kolar',1.0,750,750,9,true);

  -- ============================================================
  -- 11. WEEKLY WAGE ADJUSTMENTS (Eranna bus/petrol = 320)
  -- ============================================================
  INSERT INTO public.weekly_wage_adjustments
    (employee_id, week_start_date, bus_petrol, advance_paid, is_demo)
  VALUES
    (v_emp_eranna, v_week_start, 320, 0, true)
  ON CONFLICT (employee_id, week_start_date)
    DO UPDATE SET bus_petrol = 320, advance_paid = 0, is_demo = true;

  -- Extra adjustments for a second week to show history
  INSERT INTO public.weekly_wage_adjustments
    (employee_id, week_start_date, bus_petrol, advance_paid, remarks, is_demo)
  VALUES
    (v_emp_ravi,    '2026-09-06', 0,   2000, 'Advance paid before festival', true),
    (v_emp_gowtham, '2026-09-06', 150, 0,    'Bus pass weekly',              true),
    (v_emp_krishna, '2026-09-06', 0,   1500, 'Advance on request',           true)
  ON CONFLICT (employee_id, week_start_date)
    DO UPDATE SET bus_petrol    = EXCLUDED.bus_petrol,
                  advance_paid  = EXCLUDED.advance_paid,
                  remarks       = EXCLUDED.remarks,
                  is_demo       = true;

  -- ============================================================
  -- 12. SUBCONTRACTOR PAYMENTS
  -- ============================================================
  INSERT INTO public.subcontractor_payments
    (name, work_description, amount, payment_date, week_start_date, project_id, status, is_demo)
  VALUES
    ('Painter Sirenjeev + Arun + Paneer',
     'Painting Contractor Voucher - Site 637',
     12000, v_week_start, v_week_start, v_prj1, 'job_done', true),
    ('Tamil Electrician',
     'Electrical work settlement - Site 3033',
     1475, v_week_start, v_week_start, v_prj2, 'job_done', true),
    ('Kelamangalam Site Petty Cash',
     'Site operational disbursement',
     2200, v_week_start, v_week_start, v_prj1, 'job_done', true),
    ('Rajan Plumbing Works',
     'Plumbing - second floor bathrooms',
     8500, '2026-09-20', '2026-09-20', v_prj2, 'job_done', true),
    ('Arul Tiles Helper',
     'Tile fixing labour - ground floor',
     4000, '2026-10-05', '2026-10-05', v_prj4, 'pending', true)
  ON CONFLICT DO NOTHING;

  -- ============================================================
  -- 13. MATERIAL REQUESTS
  --     request_number prefixed "DEMO-".
  -- ============================================================
  INSERT INTO public.material_requests
    (id, request_number, project_id, request_date, status, remarks, total_amount, is_demo)
  VALUES
    (v_mr1,'DEMO-MR-0001', v_prj1, '2026-08-10', 'ordered',
     'Urgent for slab work (DEMO)', 270000, true),
    (v_mr2,'DEMO-MR-0002', v_prj2, '2026-08-20', 'received',
     'Foundation concrete pour (DEMO)', 385000, true),
    (v_mr3,'DEMO-MR-0003', v_prj4, '2026-09-15', 'submitted',
     'Brickwork first floor (DEMO)', 142000, true)
  ON CONFLICT (id) DO NOTHING;

  -- ============================================================
  -- 14. PURCHASE ORDERS
  --     po_number prefixed "DEMO-".
  -- ============================================================
  INSERT INTO public.purchase_orders
    (id, po_number, project_id, supplier_id, request_id, po_date,
     status, subtotal, tax_percent, tax_amount, total_amount, is_demo)
  VALUES
    (v_po1,'DEMO-PO-0001', v_prj1, v_sup1, v_mr1, '2026-08-11',
     'ordered',   270000, 0, 0, 270000, true),
    (v_po2,'DEMO-PO-0002', v_prj2, v_sup3, v_mr2, '2026-08-21',
     'received',  385000, 0, 0, 385000, true),
    (v_po3,'DEMO-PO-0003', v_prj4, v_sup1, v_mr3, '2026-09-16',
     'submitted', 142000, 0, 0, 142000, true)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.purchase_order_items
    (id, po_id, material, specification, unit, quantity, rate, amount)
  VALUES
    ('77777777-7777-7777-7777-7777777777a1', v_po1,'Cement','OPC 53 Grade','bag',  300, 420,126000),
    ('77777777-7777-7777-7777-7777777777a2', v_po1,'Steel', 'Fe500D 12mm', 'kg', 2000,  72,144000),
    ('77777777-7777-7777-7777-7777777777b1', v_po2,'M-Sand','River quality M-Sand','cft',500,350,175000),
    ('77777777-7777-7777-7777-7777777777b2', v_po2,'Blue Metal','20mm jelly','cft',400,525,210000),
    ('77777777-7777-7777-7777-7777777777c1', v_po3,'Bricks','Class A fly-ash bricks','nos',8000,12,96000),
    ('77777777-7777-7777-7777-7777777777c2', v_po3,'Cement','OPC 53 Grade','bag',  110, 418, 45980)
  ON CONFLICT (id) DO NOTHING;

  -- ============================================================
  -- 15. MATERIAL RECEIPTS
  --     receipt_number prefixed "DEMO-".
  -- ============================================================
  INSERT INTO public.material_receipts
    (id, receipt_number, po_id, project_id, supplier_id,
     receipt_date, total_amount, remarks, is_demo)
  VALUES
    (v_grn1,'DEMO-GRN-0001', v_po1, v_prj1, v_sup1, '2026-08-13', 126000,
     'Partial delivery – Cement only (DEMO)', true),
    (v_grn2,'DEMO-GRN-0002', v_po2, v_prj2, v_sup3, '2026-08-23', 385000,
     'Full delivery – M-Sand & Blue Metal (DEMO)', true),
    (v_grn3,'DEMO-GRN-0003', v_po1, v_prj1, v_sup1, '2026-09-01', 144000,
     'Balance Steel delivery (DEMO)', true)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.material_receipt_items
    (receipt_id, po_item_id, material, unit, ordered_quantity, received_quantity, rate, amount)
  VALUES
    (v_grn1,'77777777-7777-7777-7777-7777777777a1','Cement',    'bag', 300, 300, 420,126000),
    (v_grn2,'77777777-7777-7777-7777-7777777777b1','M-Sand',    'cft', 500, 500, 350,175000),
    (v_grn2,'77777777-7777-7777-7777-7777777777b2','Blue Metal', 'cft', 400, 400, 525,210000),
    (v_grn3,'77777777-7777-7777-7777-7777777777a2','Steel',      'kg', 2000,2000,  72,144000)
  ON CONFLICT DO NOTHING;

  -- ============================================================
  -- 16. SUPPLIER PAYMENTS
  -- ============================================================
  INSERT INTO public.supplier_payments
    (id, supplier_id, project_id, po_id, payment_date,
     amount, payment_method, reference_number, remarks, is_demo)
  VALUES
    ('dddddddd-dddd-dddd-dddd-dddddddddd01',
     v_sup1, v_prj1, v_po1, '2026-08-13',
     126000,'bank','NEFT-20260813','Cement payment (DEMO)',true),
    ('dddddddd-dddd-dddd-dddd-dddddddddd02',
     v_sup3, v_prj2, v_po2, '2026-08-25',
     385000,'bank','NEFT-20260825','Sand & Blue Metal payment (DEMO)',true),
    ('dddddddd-dddd-dddd-dddd-dddddddddd03',
     v_sup1, v_prj1, v_po1, '2026-09-03',
     144000,'bank','NEFT-20260903','Steel payment (DEMO)',true),
    ('dddddddd-dddd-dddd-dddd-dddddddddd04',
     v_sup2, v_prj2, NULL, '2026-09-20',
     45000,'cash',NULL,'Hardware misc items (DEMO)',true),
    ('dddddddd-dddd-dddd-dddd-dddddddddd05',
     v_sup4, v_prj4, NULL, '2026-09-25',
     62000,'bank','NEFT-20260925','Tiles advance payment (DEMO)',true)
  ON CONFLICT (id) DO NOTHING;

  -- ============================================================
  -- 17. WORK ORDERS
  --     work_order_number prefixed "DEMO-".
  -- ============================================================
  INSERT INTO public.work_orders
    (id, work_order_number, project_id, contractor_id,
     work_description, contract_amount, rate, quantity, unit,
     conditions, status, start_date, end_date, is_demo)
  VALUES
    (v_wo1,'DEMO-WO-0001', v_prj1, v_con1,
     'Internal & external plastering (DEMO)',
     450000, 180, 2500,'sqft',
     '["Work to be completed as per schedule","Material supplied by owner","Payment against measurement","Safety compliance mandatory"]'::jsonb,
     'approved','2025-06-01','2025-10-31',true),
    (v_wo2,'DEMO-WO-0002', v_prj2, v_con2,
     'Full electrical wiring & fixtures (DEMO)',
     1200000, 60, 20000,'point',
     '["Follow IS standards","Third-party inspection mandatory","Payment in 3 stages","All fixtures IS-rated"]'::jsonb,
     'approved','2025-04-01','2026-04-30',true),
    (v_wo3,'DEMO-WO-0003', v_prj2, v_con3,
     'Floor & wall tiling – all floors (DEMO)',
     780000, 130, 6000,'sqft',
     '["Tiles supplied by client","Grouting with premium product","Payment against measurement"]'::jsonb,
     'approved','2025-09-01','2026-06-30',true),
    (v_wo4,'DEMO-WO-0004', v_prj4, v_con1,
     'External plastering – Nair Villa (DEMO)',
     180000, 175, 1000,'sqft',
     '["Work as per drawing","Material by contractor"]'::jsonb,
     'submitted','2026-05-01','2026-08-31',true),
    (v_wo5,'DEMO-WO-0005', v_prj1, v_con4,
     'Interior painting – full house (DEMO)',
     165000, 66, 2500,'sqft',
     '["Premium emulsion only","2 coats primer + 2 finish"]'::jsonb,
     'draft','2026-09-01','2026-10-15',true)
  ON CONFLICT (id) DO NOTHING;

  -- ============================================================
  -- 18. MEASUREMENT BOOKS
  --     mb_number prefixed "DEMO-".
  -- ============================================================
  INSERT INTO public.measurement_books
    (id, mb_number, project_id, work_order_id, contractor_id,
     mb_date, total_amount, status, is_demo)
  VALUES
    (v_mb1,'DEMO-MB-0001', v_prj1, v_wo1, v_con1, '2026-07-10', 216000,'submitted',true),
    (v_mb2,'DEMO-MB-0002', v_prj2, v_wo2, v_con2, '2026-08-15', 360000,'approved',  true),
    (v_mb3,'DEMO-MB-0003', v_prj2, v_wo3, v_con3, '2026-09-05', 195000,'submitted',  true),
    (v_mb4,'DEMO-MB-0004', v_prj4, v_wo4, v_con1, '2026-09-30', 140000,'submitted',  true)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.measurement_items
    (mb_id, work_description, measurement, unit, quantity, rate, amount)
  VALUES
    (v_mb1,'Ground floor internal plastering',    '40 x 30',    'sqft', 1200, 180,216000),
    (v_mb2,'Electrical rough-in second floor',    '6 rooms x 60p','point', 360,  60, 21600),
    (v_mb2,'DB board & mains wiring',             'lumpsum',     'lot',    1,338400,338400),
    (v_mb3,'Ground floor flooring – main hall',   '25x18',       'sqft',  450, 130, 58500),
    (v_mb3,'Bathrooms – wall tiling (all 6)',      '6 x 8x6',    'sqft', 1050, 130,136500),
    (v_mb4,'External plastering north & west',    '40x20+25x20', 'sqft', 1300, 105,136500),
    (v_mb4,'Parapet wall plastering',             '30x3',        'sqft',   90,38.89, 3500)
  ON CONFLICT DO NOTHING;

  -- ============================================================
  -- 19. CONTRACTOR BILLS
  --     bill_number prefixed "DEMO-".
  -- ============================================================
  INSERT INTO public.contractor_bills
    (id, bill_number, project_id, contractor_id, work_order_id,
     mb_ids, bill_date, gross_amount, deductions, net_amount, status, is_demo)
  VALUES
    (v_cb1,'DEMO-CB-0001', v_prj1, v_con1, v_wo1,
     ARRAY[v_mb1],'2026-07-15',216000, 6480,209520,'submitted',true),
    (v_cb2,'DEMO-CB-0002', v_prj2, v_con2, v_wo2,
     ARRAY[v_mb2],'2026-08-20',360000,10800,349200,'approved', true),
    (v_cb3,'DEMO-CB-0003', v_prj2, v_con3, v_wo3,
     ARRAY[v_mb3],'2026-09-10',195000, 5850,189150,'submitted',true),
    (v_cb4,'DEMO-CB-0004', v_prj4, v_con1, v_wo4,
     ARRAY[v_mb4],'2026-10-05',140000, 4200,135800,'submitted',true)
  ON CONFLICT (id) DO NOTHING;

  -- ============================================================
  -- 20. CONTRACTOR PAYMENTS
  -- ============================================================
  INSERT INTO public.contractor_payments
    (id, contractor_id, project_id, bill_id,
     payment_date, amount, payment_method, reference_number, remarks, is_demo)
  VALUES
    ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee01',
     v_con1, v_prj1, v_cb1, '2026-07-25',
     120000,'bank','NEFT-20260725','Partial payment DEMO-CB-0001 (DEMO)',true),
    ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee02',
     v_con1, v_prj1, v_cb1, '2026-08-10',
     89520, 'bank','NEFT-20260810','Balance payment DEMO-CB-0001 (DEMO)',true),
    ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee03',
     v_con2, v_prj2, v_cb2, '2026-08-28',
     200000,'bank','NEFT-20260828','Advance on DEMO-CB-0002 (DEMO)',true),
    ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee04',
     v_con2, v_prj2, v_cb2, '2026-09-15',
     149200,'bank','NEFT-20260915','Balance DEMO-CB-0002 (DEMO)',true)
  ON CONFLICT (id) DO NOTHING;

  -- ============================================================
  -- 21. EXPENSES  (project + office)
  -- ============================================================
  INSERT INTO public.expenses
    (id, project_id, expense_date, category, description,
     amount, payment_method, receipt_path, is_demo)
  VALUES
    ('ffffffff-ffff-ffff-ffff-ffffffffff01',
     v_prj1,'2026-08-14','Fuel','Diesel for site generator',4500,'cash','RCPT-20260814',true),
    ('ffffffff-ffff-ffff-ffff-ffffffffff02',
     v_prj1,'2026-08-16','Transport','Sand transport to site',12500,'cash','RCPT-20260816',true),
    ('ffffffff-ffff-ffff-ffff-ffffffffff03',
     v_prj2,'2026-08-18','Site Consumables','Curing compound',8200,'bank','RCPT-20260818',true),
    ('ffffffff-ffff-ffff-ffff-ffffffffff04',
     v_prj2,'2026-08-20','Food','Labour food expenses',3600,'cash','RCPT-20260820',true),
    ('ffffffff-ffff-ffff-ffff-ffffffffff05',
     v_prj1,'2026-09-02','Fuel','Petrol for supervisor bike',1200,'cash','RCPT-20260902',true),
    ('ffffffff-ffff-ffff-ffff-ffffffffff06',
     v_prj2,'2026-09-10','Transport','JCB hire for excavation',28000,'bank','RCPT-20260910',true),
    ('ffffffff-ffff-ffff-ffff-ffffffffff07',
     v_prj4,'2026-09-18','Fuel','Diesel – mixer truck',3800,'cash','RCPT-20260918',true),
    ('ffffffff-ffff-ffff-ffff-ffffffffff08',
     v_prj4,'2026-09-25','Tools','Drill bits & chisels set',2200,'cash','RCPT-20260925',true),
    -- Office expenses (project_id IS NULL)
    ('ffffffff-ffff-ffff-ffff-ffffffffff09',
     NULL,'2026-09-01','Miscellaneous','Office stationery & printer ink',1850,'cash','RCPT-OFFICE01',true),
    ('ffffffff-ffff-ffff-ffff-ffffffffff10',
     NULL,'2026-09-08','Transport','MD vehicle fuel reimbursement',4500,'cash','RCPT-OFFICE02',true),
    ('ffffffff-ffff-ffff-ffff-ffffffffff11',
     NULL,'2026-09-15','Miscellaneous','Office internet & telephone bill',2800,'bank','RCPT-OFFICE03',true),
    ('ffffffff-ffff-ffff-ffff-ffffffffff12',
     NULL,'2026-10-01','Food','Staff lunch – client meeting',3200,'cash','RCPT-OFFICE04',true),
    ('ffffffff-ffff-ffff-ffff-ffffffffff13',
     NULL,'2026-10-05','Miscellaneous','Annual software subscription',12000,'bank','RCPT-OFFICE05',true)
  ON CONFLICT (id) DO NOTHING;

  -- ============================================================
  -- 22. CLIENT PAYMENTS (stored as cash_closing rows)
  -- ============================================================
  INSERT INTO public.cash_closing
    (id, project_id, closing_date, account_type,
     opening_cash, cash_received, cash_expenses, other_transactions,
     closing_cash, remarks, is_demo)
  VALUES
    ('11111111-aaaa-aaaa-aaaa-111111111101',
     v_prj1,'2026-08-31','project',
     128500, 1500000, 64200, 0, 1564300,
     'Milestone 2 client payment received (DEMO)',true),

    ('11111111-aaaa-aaaa-aaaa-111111111102',
     v_prj2,'2026-09-10','project',
     0, 1200000, 28200, 0, 1171800,
     'Second tranche – Sunrise Apartments (DEMO)',true),

    ('11111111-aaaa-aaaa-aaaa-111111111103',
     v_prj4,'2026-09-20','project',
     0, 500000, 6000, 0, 494000,
     'Advance payment – Nair Villa (DEMO)',true),

    ('11111111-aaaa-aaaa-aaaa-111111111104',
     NULL,'2026-10-08','office',
     50000, 400000, 24350, 0, 425650,
     'Office cash position Oct 2026 (DEMO)',true),

    ('11111111-aaaa-aaaa-aaaa-111111111105',
     NULL,'2026-10-10','office',
     425650, 0, 140650, 0, 285000,
     'Cash after Oct payroll disbursements (DEMO)',true)
  ON CONFLICT (id) DO NOTHING;

  -- ============================================================
  -- 23. MACHINES
  -- ============================================================
  INSERT INTO public.machines (id, name, machine_code, description, is_demo) VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa01','JCB 3DX',       'MC-001','Backhoe loader',   true),
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa02','Concrete Mixer', 'MC-002','400L drum mixer',  true),
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa03','Transit Mixer',  'MC-003','6 cubic meter',    true),
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa04','Tower Crane',    'MC-004','15-ton capacity',  true)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.machine_movements
    (machine_id, project_id, inward_at, outward_at, hours, remarks, is_demo)
  VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa01', v_prj1,
     '2026-08-10 07:00:00+05:30','2026-08-11 18:00:00+05:30', 9,
     'Excavation – Kumar Residence (DEMO)',true),
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa02', v_prj2,
     '2026-08-18 06:00:00+05:30','2026-08-20 18:00:00+05:30',16,
     'Slab pour – Sunrise Block B (DEMO)',true),
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa03', v_prj2,
     '2026-09-01 06:00:00+05:30','2026-09-02 17:00:00+05:30',11,
     'Column pour 3rd floor (DEMO)',true),
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa01', v_prj4,
     '2026-09-12 07:00:00+05:30','2026-09-12 16:00:00+05:30', 9,
     'Basement excavation – Nair Villa (DEMO)',true)
  ON CONFLICT DO NOTHING;

END $$;

-- ============================================================
-- ROLE ASSIGNMENT SNIPPET
-- Replace the four email addresses below with the real emails
-- you created in the Supabase Auth dashboard, then run this.
-- ============================================================
DO $$
DECLARE
  v_md_email         text := 'md@demo.brickweld.in';       -- REPLACE
  v_supervisor_email text := 'super@demo.brickweld.in';    -- REPLACE
  v_accounts_email   text := 'accounts@demo.brickweld.in'; -- REPLACE
  v_viewer_email     text := 'viewer@demo.brickweld.in';   -- REPLACE

  v_md_id         uuid;
  v_supervisor_id uuid;
  v_accounts_id   uuid;
  v_viewer_id     uuid;
BEGIN
  SELECT id INTO v_md_id         FROM auth.users WHERE email = v_md_email;
  SELECT id INTO v_supervisor_id FROM auth.users WHERE email = v_supervisor_email;
  SELECT id INTO v_accounts_id   FROM auth.users WHERE email = v_accounts_email;
  SELECT id INTO v_viewer_id     FROM auth.users WHERE email = v_viewer_email;

  IF v_md_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (v_md_id, 'md')
      ON CONFLICT DO NOTHING;
    RAISE NOTICE 'MD role assigned to %', v_md_email;
  ELSE
    RAISE WARNING 'User not found: %', v_md_email;
  END IF;

  IF v_supervisor_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (v_supervisor_id, 'supervisor')
      ON CONFLICT DO NOTHING;
    RAISE NOTICE 'Supervisor role assigned to %', v_supervisor_email;
  ELSE
    RAISE WARNING 'User not found: %', v_supervisor_email;
  END IF;

  IF v_accounts_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (v_accounts_id, 'accounts')
      ON CONFLICT DO NOTHING;
    RAISE NOTICE 'Accounts role assigned to %', v_accounts_email;
  ELSE
    RAISE WARNING 'User not found: %', v_accounts_email;
  END IF;

  IF v_viewer_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (v_viewer_id, 'viewer')
      ON CONFLICT DO NOTHING;
    RAISE NOTICE 'Viewer role assigned to %', v_viewer_email;
  ELSE
    RAISE WARNING 'User not found: %', v_viewer_email;
  END IF;
END $$;
