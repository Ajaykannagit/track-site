-- Attendance wage rate locking (Bug B) and month-correct monthly pro-rata (Bug C).
--
-- Rules:
--   * INSERT: use the client-supplied rate if > 0, otherwise the employee master
--     rate. Monthly staff are pro-rated by the days in the ATTENDANCE DATE's month.
--   * UPDATE: the stored (historical) wage_rate is kept. A different rate is only
--     accepted from MD / Accounts (explicit "Reprice at current master rate") or a
--     server context (auth.uid() IS NULL). Unpriced legacy rows (rate 0) and
--     employee reassignment fall back to the master rate.
--   * calculated_wage = ROUND(day_value * wage_rate) whenever day value, rate,
--     leave flag or employee changes; otherwise the stored wage is kept.
--   * Leave: wage 0, day value 0, stored rate retained for when leave is undone.

CREATE OR REPLACE FUNCTION public.handle_attendance_wage_calc()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_rate   numeric(12,2);
  v_type   text;
  v_days   int;
  v_master numeric(12,2);
  v_can_reprice boolean;
BEGIN
  -- Master daily rate, pro-rated by the attendance date's own month for monthly staff
  SELECT wage_rate, wage_type INTO v_rate, v_type FROM public.employees WHERE id = NEW.employee_id;
  v_days := EXTRACT(DAY FROM (date_trunc('month', NEW.attendance_date::timestamp) + interval '1 month - 1 day'))::int;
  v_master := CASE
    WHEN v_type = 'monthly' THEN ROUND(COALESCE(v_rate, 0) / NULLIF(v_days, 0))
    ELSE COALESCE(v_rate, 0)
  END;

  IF TG_OP = 'UPDATE' THEN
    v_can_reprice := auth.uid() IS NULL OR public.is_md() OR public.has_role(auth.uid(), 'accounts');

    -- Keep the stored historical rate unless an authorised reprice was requested
    IF NEW.wage_rate IS DISTINCT FROM OLD.wage_rate THEN
      IF COALESCE(NEW.wage_rate, 0) <= 0
         OR (COALESCE(OLD.wage_rate, 0) > 0 AND NOT v_can_reprice) THEN
        NEW.wage_rate := OLD.wage_rate;
      END IF;
    END IF;

    -- Unpriced legacy row, or row moved to another employee → master rate
    IF COALESCE(NEW.wage_rate, 0) <= 0 OR NEW.employee_id IS DISTINCT FROM OLD.employee_id THEN
      NEW.wage_rate := v_master;
    END IF;

    IF NEW.is_leave THEN
      NEW.day_value := 0;
      NEW.calculated_wage := 0;
      RETURN NEW;
    END IF;

    IF NEW.day_value IS DISTINCT FROM OLD.day_value
       OR NEW.wage_rate IS DISTINCT FROM OLD.wage_rate
       OR NEW.is_leave IS DISTINCT FROM OLD.is_leave
       OR NEW.employee_id IS DISTINCT FROM OLD.employee_id THEN
      NEW.calculated_wage := ROUND(COALESCE(NEW.day_value, 1.0) * COALESCE(NEW.wage_rate, 0));
    ELSE
      NEW.calculated_wage := OLD.calculated_wage;
    END IF;

    RETURN NEW;
  END IF;

  -- INSERT
  IF COALESCE(NEW.wage_rate, 0) <= 0 THEN
    NEW.wage_rate := v_master;
  END IF;

  IF NEW.is_leave THEN
    NEW.day_value := 0;
    NEW.calculated_wage := 0;
    RETURN NEW;
  END IF;

  NEW.calculated_wage := ROUND(COALESCE(NEW.day_value, 1.0) * COALESCE(NEW.wage_rate, 0));
  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.handle_attendance_wage_calc() FROM anon, authenticated, public;
