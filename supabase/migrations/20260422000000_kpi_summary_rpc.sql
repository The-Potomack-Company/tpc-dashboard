-- KPI landing-page aggregate RPC (Phase 4).
-- Returns both current-window and previous-window aggregates in ONE round-trip
-- as a nested JSONB object: { current: {...}, previous: {...} }.
--
-- Called by the browser from `useKpiSummary` via `supabase.rpc('kpi_summary', ...)`.
-- All four parameters are typed `date` — no string concatenation into the query
-- body, so malformed input raises a cast error before the function runs (T-02).
--
-- Security model:
--   * security definer: runs as function owner. Safe because the function only
--     returns aggregates (no row-level leakage) and explicitly gates on admin
--     role at entry.
--   * set search_path = public, pg_temp: defuses search-path hijack (T-01),
--     mirroring Phase 2 `import_sale_with_departments` hygiene.
--   * private.is_admin() gate raises 'Access denied' for non-admin callers
--     (T-04, defense-in-depth — the sales RLS policy already blocks non-admin
--     SELECTs, so aggregates would return all-zeros anyway; the explicit check
--     surfaces a clear error instead of silently empty data).
--   * Callable by the `authenticated` role; public / anon are revoked.
--
-- Divide-by-zero guard:
--   * `nullif(sum(lots_auctioned), 0)` returns NULL when the denominator is 0,
--     so `x / NULL` → NULL instead of a Postgres error. NULL serializes to
--     JSON null and the client renders an em-dash.
--
-- Contract:
--   revenue / lots_sold / sales_count are ALWAYS numeric (never null) via
--   COALESCE at the jsonb_build_object site; only sell_through may be null.

create or replace function public.kpi_summary(
  period_start  date,
  period_end    date,
  compare_start date,
  compare_end   date
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
begin
  -- Admin-only gate (defense-in-depth; sales RLS is admin-only already).
  if not private.is_admin() then
    raise exception 'Access denied: kpi_summary requires admin role';
  end if;

  with current_window as (
    select
      coalesce(sum(net_revenue), 0)::numeric(14,2)                          as revenue,
      sum(lots_sold)::bigint                                                as lots_sold,
      (sum(lots_sold)::numeric / nullif(sum(lots_auctioned), 0))::numeric   as sell_through,
      count(*)::bigint                                                      as sales_count
    from public.sales
    where sale_date >= period_start
      and sale_date <  period_end
  ),
  previous_window as (
    select
      coalesce(sum(net_revenue), 0)::numeric(14,2)                          as revenue,
      sum(lots_sold)::bigint                                                as lots_sold,
      (sum(lots_sold)::numeric / nullif(sum(lots_auctioned), 0))::numeric   as sell_through,
      count(*)::bigint                                                      as sales_count
    from public.sales
    where sale_date >= compare_start
      and sale_date <  compare_end
  )
  select jsonb_build_object(
    'current', jsonb_build_object(
      'revenue',      c.revenue,
      'sell_through', c.sell_through,
      'lots_sold',    coalesce(c.lots_sold, 0),
      'sales_count',  c.sales_count
    ),
    'previous', jsonb_build_object(
      'revenue',      p.revenue,
      'sell_through', p.sell_through,
      'lots_sold',    coalesce(p.lots_sold, 0),
      'sales_count',  p.sales_count
    )
  )
  into v_result
  from current_window c, previous_window p;

  return v_result;
end;
$$;

revoke all on function public.kpi_summary(date, date, date, date) from public;
grant execute on function public.kpi_summary(date, date, date, date) to authenticated;

comment on function public.kpi_summary(date, date, date, date) is
  'KPI landing-page aggregate. Returns { current, previous } revenue / sell_through / lots_sold / sales_count over a date-bounded window. Admin-only via explicit private.is_admin() gate + grant to authenticated. Mitigates T-01 (search-path) / T-02 (typed date params, no string concat) / T-04 (client RBAC bypass).';
