-- Atomic per-sale insert for the PDF import pipeline (Phase 2).
-- Writes to public.sales, public.departments (auto-discovers unknown codes),
-- and public.sale_departments in a single transaction. On any failure
-- (cast error, unique-constraint violation, etc.), the entire sale rolls back.
--
-- Security model:
--   * security definer: runs as function owner so the importer can INSERT
--     without needing RLS policies on the target tables.
--   * set search_path = public, pg_temp: defuses search-path hijack
--     (standard Supabase security-definer hygiene).
--   * Callable by service_role ONLY. Public / authenticated / anon are revoked.
--
-- SQL-injection (T-02) mitigation:
--   * Input is jsonb; every field is extracted via ->> and explicitly cast
--     (::numeric / ::int / ::date / ::boolean / ::timestamptz).
--   * No string concatenation on JSON-sourced values.
--   * Cast failures raise and abort the transaction (correct per-sale rollback).

create or replace function public.import_sale_with_departments(
  p_sale jsonb,
  p_departments jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sale_id uuid;
  v_dept jsonb;
  v_dept_id uuid;
begin
  -- Insert sale row. Fails on UNIQUE(sale_number) violation
  -- (duplicates are caught upstream by the importer's idempotency check;
  -- hitting the constraint here means a race or a skipped pre-check).
  insert into public.sales (
    sale_number, title, sale_date,
    lots_auctioned, lots_sold, lots_unsold,
    total_sold_value, total_unsold_value,
    total_low_estimate, total_high_estimate, total_reserves,
    hammer_total, buyer_premium, seller_commission,
    insurance, lot_charges, referral_fees, net_revenue,
    registered_bidders, winning_buyers,
    payment_status, source_pdf_path, imported_at,
    validation_warning
  )
  values (
    p_sale->>'sale_number',
    p_sale->>'title',
    (p_sale->>'sale_date')::date,
    (p_sale->>'lots_auctioned')::int,
    (p_sale->>'lots_sold')::int,
    (p_sale->>'lots_unsold')::int,
    (p_sale->>'total_sold_value')::numeric,
    (p_sale->>'total_unsold_value')::numeric,
    (p_sale->>'total_low_estimate')::numeric,
    (p_sale->>'total_high_estimate')::numeric,
    (p_sale->>'total_reserves')::numeric,
    (p_sale->>'hammer_total')::numeric,
    (p_sale->>'buyer_premium')::numeric,
    (p_sale->>'seller_commission')::numeric,
    (p_sale->>'insurance')::numeric,
    (p_sale->>'lot_charges')::numeric,
    (p_sale->>'referral_fees')::numeric,
    (p_sale->>'net_revenue')::numeric,
    (p_sale->>'registered_bidders')::int,
    (p_sale->>'winning_buyers')::int,
    p_sale->>'payment_status',
    p_sale->>'source_pdf_path',
    coalesce((p_sale->>'imported_at')::timestamptz, now()),
    coalesce((p_sale->>'validation_warning')::boolean, false)
  )
  returning id into v_sale_id;

  -- Insert department rows. Unknown codes are auto-discovered
  -- (new departments row with auto_discovered = true).
  --
  -- WR-06: for KNOWN codes whose stored display_name is still the
  -- placeholder (equal to the code — the seed default in
  -- 20260421000008_seed_departments.sql), refine the name from the
  -- incoming PDF value when it differs. This gives the 22 seeded rows
  -- a chance to acquire their richer PDF-derived name on first import
  -- ("FRN Furniture (General)" etc.) without stomping on any name an
  -- operator has manually curated. Rows where display_name != code
  -- are treated as curated and left alone.
  for v_dept in select * from jsonb_array_elements(p_departments)
  loop
    select id into v_dept_id
    from public.departments
    where code = v_dept->>'code';

    if v_dept_id is null then
      insert into public.departments (code, display_name, auto_discovered)
      values (
        v_dept->>'code',
        v_dept->>'display_name',
        true
      )
      returning id into v_dept_id;
    else
      update public.departments
      set display_name = v_dept->>'display_name'
      where id = v_dept_id
        and display_name = code
        and v_dept->>'display_name' is not null
        and v_dept->>'display_name' <> code;
    end if;

    insert into public.sale_departments (
      sale_id, department_id, department_code,
      lots_auctioned, lots_sold, sell_through_pct,
      total_sold_value, low_estimate, high_estimate,
      reserves, revenue
    )
    values (
      v_sale_id,
      v_dept_id,
      v_dept->>'code',
      (v_dept->>'lots_auctioned')::int,
      (v_dept->>'lots_sold')::int,
      (v_dept->>'sell_through_pct')::numeric(5,2),
      (v_dept->>'total_sold_value')::numeric,
      (v_dept->>'low_estimate')::numeric,
      (v_dept->>'high_estimate')::numeric,
      (v_dept->>'reserves')::numeric,
      (v_dept->>'revenue')::numeric
    );
  end loop;

  return v_sale_id;
end;
$$;

-- Lock down execution to service_role. Do NOT grant to authenticated or anon.
revoke all on function public.import_sale_with_departments(jsonb, jsonb) from public;
grant execute on function public.import_sale_with_departments(jsonb, jsonb) to service_role;

comment on function public.import_sale_with_departments(jsonb, jsonb) is
  'Atomic sale+departments insert for PDF import pipeline. Service-role only. Auto-discovers unknown department codes.';
