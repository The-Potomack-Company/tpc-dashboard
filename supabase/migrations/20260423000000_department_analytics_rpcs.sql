-- Phase 6 Plan 06-01 — Department analytics read-aggregate RPCs.
--
-- Source templates:
--   * supabase/migrations/20260422000000_kpi_summary_rpc.sql (security posture,
--     admin gate, revoke/grant pattern).
--   * supabase/migrations/20260421000006_rls_helper_functions.sql (private.is_admin
--     is a ZERO-ARG function — DO NOT call private.is_admin(auth.uid())).
--
-- All three RPCs satisfy INFR-04 (server-side aggregation of financial values).
-- All three RPCs gate on private.is_admin() as defense-in-depth on top of the
-- admin-only RLS policies on public.sales and public.sale_departments.
--
-- Threat mitigations (identical posture across all 3 functions):
--   T-06-01-01 (search_path hijack)      — search_path pinned to (public, pg_temp) on every fn
--   T-06-01-02 (SQL injection via params) — every param typed (date / text[] / int) so
--                                           Postgres casts malformed input at boundary
--   T-06-01-03 (non-admin bypass)         — explicit `if not private.is_admin() then raise`
--   T-06-01-04 (PUBLIC grant leak)        — revoke from public, grant only to authenticated
--
-- Date interval convention: half-open [range_start, range_end). When either
-- bound is NULL the predicate is treated as "unbounded on that side" so the
-- Trends 'all' preset works without sentinel dates. Matches kpi_summary semantics
-- except kpi_summary requires non-null bounds — these RPCs accept NULL so the
-- `all` preset ships without a client-side sentinel translation.

-- ---------------------------------------------------------------------------
-- RPC 1: public.department_rankings(range_start date, range_end date)
-- Returns jsonb array sorted DESC by total_revenue.
-- REQ-ID: DEPT-01.
-- ---------------------------------------------------------------------------
create or replace function public.department_rankings(
  range_start date,
  range_end   date
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
begin
  -- T-06-01-03 defense-in-depth: admin-only gate. sales/sale_departments RLS
  -- already admin-only (empty result for non-admin), but this yields a clear
  -- 403-equivalent error instead of silently empty aggregates.
  if not private.is_admin() then
    raise exception 'Access denied: department_rankings requires admin role';
  end if;

  with scoped_sales as (
    select s.id, s.sale_number, s.sale_date
    from public.sales s
    where (range_start is null or s.sale_date >= range_start)
      and (range_end   is null or s.sale_date <  range_end)
  ),
  dept_agg as (
    select
      sd.department_code,
      count(distinct sd.sale_id)::bigint                                               as sales_count,
      coalesce(sum(sd.revenue), 0)::numeric(14,2)                                      as total_revenue,
      avg(sd.sell_through_pct) filter (where sd.sell_through_pct is not null)::numeric as avg_sell_through,
      -- "Lots above estimate" (CONTEXT.md ambiguity, see 06-RESEARCH.md
      -- Assumptions Log A1). Provisional definition: sum of `lots_sold` on
      -- dept-rows where `total_sold_value > high_estimate`. Flag for review
      -- if the TPC team interprets the metric differently.
      coalesce(sum(case
        when sd.total_sold_value > sd.high_estimate then sd.lots_sold else 0
      end), 0)::bigint                                                                 as lots_above_estimate
    from public.sale_departments sd
    where sd.sale_id in (select id from scoped_sales)
    group by sd.department_code
  )
  -- Open Question #2 (06-RESEARCH.md): filter OUT departments with zero rows
  -- in the range. Departments absent from sale_departments for the scoped
  -- sales are already excluded by the inner aggregate (they never appear in
  -- dept_agg). LEFT JOIN to departments so auto_discovered codes surface even
  -- when display_name is null (Pitfall 7).
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'department_code',     d.department_code,
      'display_name',        dep.display_name,
      'sales_count',         d.sales_count,
      'total_revenue',       d.total_revenue,
      'avg_sell_through',    d.avg_sell_through,
      'lots_above_estimate', d.lots_above_estimate
    ) order by d.total_revenue desc
  ), '[]'::jsonb)
  into v_result
  from dept_agg d
  left join public.departments dep on dep.code = d.department_code;

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC 2: public.department_revenue_series(range_start date, range_end date, dept_codes text[])
-- Returns jsonb array of wide rows — one row per sale, keys = sale_date,
-- sale_number, plus one key per dept_code with revenue value. Consumed by
-- Recharts <Line dataKey={code}> directly (Assumption A7).
-- Empty/null dept_codes treated as "all depts".
-- REQ-ID: DEPT-02.
-- ---------------------------------------------------------------------------
create or replace function public.department_revenue_series(
  range_start date,
  range_end   date,
  dept_codes  text[]
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
begin
  if not private.is_admin() then
    raise exception 'Access denied: department_revenue_series requires admin role';
  end if;

  with scoped_sales as (
    select s.id, s.sale_number, s.sale_date
    from public.sales s
    where (range_start is null or s.sale_date >= range_start)
      and (range_end   is null or s.sale_date <  range_end)
      and s.sale_date is not null
  ),
  scoped_dept_rows as (
    select sd.sale_id, sd.department_code, sd.revenue
    from public.sale_departments sd
    where sd.sale_id in (select id from scoped_sales)
      and (
        dept_codes is null
        or cardinality(dept_codes) = 0
        or sd.department_code = any(dept_codes)
      )
  ),
  per_sale as (
    -- INNER JOIN: omit sales that have no matching dept rows in the filter
    -- (otherwise the series emits empty points that Recharts renders as gaps).
    select
      s.sale_date,
      s.sale_number,
      jsonb_object_agg(sdr.department_code, sdr.revenue) as dept_revenue
    from scoped_sales s
    join scoped_dept_rows sdr on sdr.sale_id = s.id
    group by s.sale_date, s.sale_number
  )
  select coalesce(jsonb_agg(
    (jsonb_build_object(
       'sale_date',   per_sale.sale_date,
       'sale_number', per_sale.sale_number
     ) || per_sale.dept_revenue)
     order by per_sale.sale_date asc
  ), '[]'::jsonb)
  into v_result
  from per_sale;

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC 3: public.department_share_series(range_start date, range_end date, top_n int)
-- Returns jsonb object: { rows: [...], top_codes: [...] }. Rows are wide —
-- one row per sale with sale_date, sale_number, one key per top-N dept_code
-- with share_pct, plus 'other' = sum of non-top-N dept shares. top_codes is
-- the global-top-N list by revenue over the scoped range (single ranked list
-- for consistent legend ordering per CONTEXT.md).
-- REQ-ID: DEPT-03.
-- ---------------------------------------------------------------------------
create or replace function public.department_share_series(
  range_start date,
  range_end   date,
  top_n       int
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
begin
  if not private.is_admin() then
    raise exception 'Access denied: department_share_series requires admin role';
  end if;

  with scoped_sales as (
    select s.id, s.sale_number, s.sale_date
    from public.sales s
    where (range_start is null or s.sale_date >= range_start)
      and (range_end   is null or s.sale_date <  range_end)
      and s.sale_date is not null
  ),
  scoped_dept_rows as (
    select sd.sale_id, sd.department_code, sd.revenue
    from public.sale_departments sd
    where sd.sale_id in (select id from scoped_sales)
  ),
  top_depts as (
    select department_code
    from scoped_dept_rows
    group by department_code
    order by coalesce(sum(revenue), 0) desc
    limit greatest(coalesce(top_n, 8), 0)
  ),
  per_sale_totals as (
    select sdr.sale_id, sum(sdr.revenue) as total
    from scoped_dept_rows sdr
    group by sdr.sale_id
  ),
  -- Bucket each dept row as either its code (if in top_depts) or 'other'.
  -- nullif(total, 0) guards divide-by-zero — null share becomes 0 in output.
  bucketed as (
    select
      s.id as sale_id,
      s.sale_date,
      s.sale_number,
      case when td.department_code is not null
           then sdr.department_code
           else 'other'
      end as bucket_key,
      sum(coalesce(sdr.revenue, 0) / nullif(pst.total, 0)) as share_pct
    from scoped_sales s
    join scoped_dept_rows sdr on sdr.sale_id = s.id
    left join top_depts td on td.department_code = sdr.department_code
    left join per_sale_totals pst on pst.sale_id = s.id
    group by s.id, s.sale_date, s.sale_number,
             case when td.department_code is not null
                  then sdr.department_code
                  else 'other'
             end
  ),
  per_sale_share as (
    select
      sale_date,
      sale_number,
      jsonb_object_agg(bucket_key, coalesce(share_pct, 0)) as shares
    from bucketed
    group by sale_id, sale_date, sale_number
  ),
  rows_array as (
    select coalesce(jsonb_agg(
      (jsonb_build_object(
         'sale_date',   sale_date,
         'sale_number', sale_number
       ) || shares)
       order by sale_date asc
    ), '[]'::jsonb) as rows
    from per_sale_share
  ),
  top_codes_array as (
    select coalesce(jsonb_agg(to_jsonb(department_code)), '[]'::jsonb) as top_codes
    from top_depts
  )
  select jsonb_build_object(
    'rows',      rows_array.rows,
    'top_codes', top_codes_array.top_codes
  )
  into v_result
  from rows_array, top_codes_array;

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants + revokes + comments (signature-aware).
-- ---------------------------------------------------------------------------

revoke all on function public.department_rankings(date, date) from public;
grant execute on function public.department_rankings(date, date) to authenticated;
comment on function public.department_rankings(date, date) is
  'DEPT-01 rankings aggregate. Returns jsonb array of { department_code, display_name, sales_count, total_revenue, avg_sell_through, lots_above_estimate } for sales in [range_start, range_end). NULL bounds = unbounded. Admin-only via explicit private.is_admin() gate + grant to authenticated. Mitigates T-06-01-01 (search_path) / T-06-01-02 (typed date params, no string concat) / T-06-01-03 (client RBAC bypass) / T-06-01-04 (PUBLIC grant leak).';

revoke all on function public.department_revenue_series(date, date, text[]) from public;
grant execute on function public.department_revenue_series(date, date, text[]) to authenticated;
comment on function public.department_revenue_series(date, date, text[]) is
  'DEPT-02 multi-line revenue series. Returns jsonb array of wide rows { sale_date, sale_number, <dept_code>: revenue, ... } ordered by sale_date ASC. Empty/null dept_codes => all departments. Admin-only via private.is_admin(). Mitigates T-06-01-01..04.';

revoke all on function public.department_share_series(date, date, int) from public;
grant execute on function public.department_share_series(date, date, int) to authenticated;
comment on function public.department_share_series(date, date, int) is
  'DEPT-03 stacked-share series. Returns jsonb object { rows: [{ sale_date, sale_number, <top_dept_code>: share, ..., other: share }, ...], top_codes: [text, ...] }. top_codes is the global-top-N department list by revenue over the scoped range (consistent legend ordering). Admin-only via private.is_admin(). Mitigates T-06-01-01..04.';
