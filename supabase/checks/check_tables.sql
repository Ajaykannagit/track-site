-- =========================================================================
-- Read-only Migration & Schema Verification Script
-- Safe to run in Supabase SQL Editor. Does NOT change any data.
-- =========================================================================

-- 1. Check whether required tables exist
SELECT
  expected_table,
  CASE
    WHEN t.table_name IS NOT NULL THEN 'EXISTS'
    ELSE 'MISSING'
  END AS table_status
FROM (
  VALUES
    ('subcontractor_payments'),
    ('teams'),
    ('sites'),
    ('weekly_wage_adjustments'),
    ('project_quotations'),
    ('projects'),
    ('clients'),
    ('employees'),
    ('contractors'),
    ('suppliers'),
    ('work_orders'),
    ('measurement_books'),
    ('contractor_bills'),
    ('contractor_payments'),
    ('material_requests'),
    ('purchase_orders'),
    ('material_receipts'),
    ('supplier_payments'),
    ('expenses'),
    ('cash_closing'),
    ('attendance')
) AS exp(expected_table)
LEFT JOIN information_schema.tables t
  ON t.table_schema = 'public'
 AND t.table_name = exp.expected_table
ORDER BY expected_table;

-- 2. Check which seed target tables have the `is_demo` column
SELECT
  t.table_name,
  CASE
    WHEN c.column_name IS NOT NULL THEN 'HAS_IS_DEMO'
    ELSE 'NO_IS_DEMO'
  END AS is_demo_status
FROM (
  VALUES
    ('projects'),
    ('clients'),
    ('project_quotations'),
    ('teams'),
    ('sites'),
    ('employees'),
    ('contractors'),
    ('suppliers'),
    ('work_orders'),
    ('measurement_books'),
    ('contractor_bills'),
    ('contractor_payments'),
    ('material_requests'),
    ('purchase_orders'),
    ('material_receipts'),
    ('supplier_payments'),
    ('subcontractor_payments'),
    ('attendance'),
    ('weekly_wage_adjustments'),
    ('expenses'),
    ('cash_closing')
) AS t(table_name)
LEFT JOIN information_schema.columns c
  ON c.table_schema = 'public'
 AND c.table_name = t.table_name
 AND c.column_name = 'is_demo'
ORDER BY t.table_name;
