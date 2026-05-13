-- Phase 8 (PR #2 follow-up) — exclude TPC internal dev (Josh) from admin analytics.
--
-- WHY: Josh's daily testing/debug catalog activity skews admin metrics —
--   fake sessions, deliberately broken items used to exercise the failure
--   surfaces, etc. Admin views must reflect the real TPC team's work, not
--   the developer's exploratory traffic.
--
-- HOW: every Phase 3 analytics RPC that aggregates over multiple users now
--   accepts a new `p_include_dev boolean default false` parameter. When
--   `false` (the default, and the only value admin views ever send), the
--   RPC adds `AND p.id <> ANY (DEV_USER_PROFILE_IDS)` — see DEV_USER_EXCLUSION
--   comment at each scoped CTE. When `true`, NO filter is applied — the dev's
--   optional override toggle (see src/hooks/useDevDataInclusion.ts) flips it
--   so the dev can verify their own activity surfaces correctly.
--
-- WHO is filtered: profile UUID 'a70ae46e-5d51-47cb-9dff-a6a8a7a08bfd'
--   (josh@potomackco.com). Hard-coded here so the email allowlist in
--   src/lib/devAccess.ts and this filter list stay in lock-step — both must
--   be updated when a future dev account is added.
--
-- INVARIANTS preserved verbatim from 20260430120000_phase_3_activity_rpcs.sql:
--   D-30 (3-arg date_trunc), D-33 (ui_interactions app_source='tpc-app'),
--   D-20 (mode filter on sessions.mode), D-24 (stuck threshold hard-coded
--   '2 hours'), D-19 (specialist filter), Pitfalls 1/2/5, security invoker,
--   `grant execute … to authenticated`.
--
-- Specialist-filter widgets (APP-03 items_per_specialist) are intentionally
-- NOT touched: that view already filters by `role='specialist'` so it cannot
-- contain Josh's data (admin role).
--
-- get_session_detail + get_photo_coverage are intentionally NOT touched —
-- they are one-shot per-session lookups, not multi-user aggregations; if
-- you navigate to one of Josh's sessions you want to see its contents.
--
-- IMPLEMENTATION NOTE: PostgreSQL's `CREATE OR REPLACE FUNCTION` cannot
-- change a function's argument list — it overloads instead. We therefore
-- DROP each affected function (by its old signature) before re-creating it
-- with the new `p_include_dev` argument. `IF EXISTS` keeps the migration
-- idempotent if it ever needs to re-run against a partially-applied state.

drop function if exists public.get_today_kpis(text[], text);
drop function if exists public.get_active_sessions(text[], text);
drop function if exists public.get_ai_status_distribution(timestamptz, timestamptz, text[], text);
drop function if exists public.get_export_pipeline(timestamptz, timestamptz, text[], text);
drop function if exists public.get_house_sale_split(timestamptz, timestamptz, text[], text);
drop function if exists public.get_stuck_items(text[], text);
drop function if exists public.get_failed_ai_breakdown(timestamptz, timestamptz, text[], text);

-- ----------------------------------------------------------------------------
-- get_today_kpis (APP-01) — sessions/items/exports across all users
-- ----------------------------------------------------------------------------
create or replace function public.get_today_kpis(
  p_specialists text[]  default array[]::text[],
  p_mode        text    default 'all',
  p_include_dev boolean default false
) returns table (
  sessions_today    bigint,
  items_today       bigint,
  exports_today     bigint,
  items_done_today  bigint,
  items_total_today bigint,
  sessions_yday     bigint,
  items_yday        bigint,
  exports_yday      bigint,
  items_done_yday   bigint,
  items_total_yday  bigint
)
language sql
stable
security invoker
as $$
  with bounds as (
    select
      date_trunc('day', now(), 'America/New_York')                     as today_from,
      date_trunc('day', now(), 'America/New_York') + interval '1 day'  as today_to,
      date_trunc('day', now(), 'America/New_York') - interval '1 day'  as yday_from,
      date_trunc('day', now(), 'America/New_York')                     as yday_to
  ),
  specialist_ids as (
    select id, email from public.profiles
     where role = 'specialist'
       and is_active = true
       and (cardinality(p_specialists) = 0 or email = any(p_specialists))
  ),
  sessions_scoped as (
    select s.id, s.created_at,
           case when s.created_at >= b.today_from and s.created_at < b.today_to then 'today'
                when s.created_at >= b.yday_from  and s.created_at < b.yday_to  then 'yday'
           end as period
    from public.sessions s
    cross join bounds b
    where s.created_at >= b.yday_from and s.created_at < b.today_to
      and (p_mode = 'all' or s.mode = p_mode)
      and (cardinality(p_specialists) = 0 or s.assigned_to in (select id from specialist_ids))
      -- DEV_USER_EXCLUSION: filters Josh's testing/debug data from admin views; passable via p_include_dev for the dev's optional override toggle.
      and (p_include_dev or s.assigned_to is null or s.assigned_to <> 'a70ae46e-5d51-47cb-9dff-a6a8a7a08bfd'::uuid)
  ),
  items_scoped as (
    select i.id, i.created_at, i.ai_status,
           case when i.created_at >= b.today_from and i.created_at < b.today_to then 'today'
                when i.created_at >= b.yday_from  and i.created_at < b.yday_to  then 'yday'
           end as period
    from public.items i
    join public.sessions s on s.id = i.session_id
    cross join bounds b
    where i.created_at >= b.yday_from and i.created_at < b.today_to
      and (p_mode = 'all' or s.mode = p_mode)
      and (cardinality(p_specialists) = 0 or s.assigned_to in (select id from specialist_ids))
      -- DEV_USER_EXCLUSION: filters Josh's testing/debug data from admin views; passable via p_include_dev for the dev's optional override toggle.
      and (p_include_dev or s.assigned_to is null or s.assigned_to <> 'a70ae46e-5d51-47cb-9dff-a6a8a7a08bfd'::uuid)
  ),
  exports_scoped as (
    select eh.id, eh.exported_at,
           case when eh.exported_at >= b.today_from and eh.exported_at < b.today_to then 'today'
                when eh.exported_at >= b.yday_from  and eh.exported_at < b.yday_to  then 'yday'
           end as period
    from public.export_history eh
    join public.sessions s on s.id = eh.session_id
    cross join bounds b
    where eh.exported_at >= b.yday_from and eh.exported_at < b.today_to
      and (p_mode = 'all' or s.mode = p_mode)
      and (cardinality(p_specialists) = 0 or s.assigned_to in (select id from specialist_ids))
      -- DEV_USER_EXCLUSION: filters Josh's testing/debug data from admin views; passable via p_include_dev for the dev's optional override toggle.
      and (p_include_dev or s.assigned_to is null or s.assigned_to <> 'a70ae46e-5d51-47cb-9dff-a6a8a7a08bfd'::uuid)
  )
  select
    coalesce(count(*) filter (where ss.period = 'today'), 0)::bigint                      as sessions_today,
    coalesce((select count(*) from items_scoped where period = 'today'), 0)::bigint      as items_today,
    coalesce((select count(*) from exports_scoped where period = 'today'), 0)::bigint    as exports_today,
    coalesce((select count(*) from items_scoped where period = 'today' and ai_status = 'done'), 0)::bigint as items_done_today,
    coalesce((select count(*) from items_scoped where period = 'today'), 0)::bigint      as items_total_today,
    coalesce(count(*) filter (where ss.period = 'yday'), 0)::bigint                       as sessions_yday,
    coalesce((select count(*) from items_scoped where period = 'yday'), 0)::bigint       as items_yday,
    coalesce((select count(*) from exports_scoped where period = 'yday'), 0)::bigint     as exports_yday,
    coalesce((select count(*) from items_scoped where period = 'yday' and ai_status = 'done'), 0)::bigint as items_done_yday,
    coalesce((select count(*) from items_scoped where period = 'yday'), 0)::bigint       as items_total_yday
  from sessions_scoped ss;
$$;

grant execute on function public.get_today_kpis(text[], text, boolean) to authenticated;

-- ----------------------------------------------------------------------------
-- get_active_sessions (APP-02)
-- ----------------------------------------------------------------------------
create or replace function public.get_active_sessions(
  p_specialists text[]  default array[]::text[],
  p_mode        text    default 'all',
  p_include_dev boolean default false
) returns table (
  session_id                uuid,
  name                      text,
  mode                      text,
  status                    text,
  assigned_to_id            uuid,
  assigned_to_display_name  text,
  item_count                bigint,
  created_at                timestamptz,
  updated_at                timestamptz
)
language sql
stable
security invoker
as $$
  select
    s.id                            as session_id,
    s.name,
    s.mode,
    s.status,
    p.id                            as assigned_to_id,
    p.display_name                  as assigned_to_display_name,
    coalesce((select count(*) from public.items i where i.session_id = s.id), 0)::bigint as item_count,
    s.created_at,
    s.updated_at
  from public.sessions s
  left join public.profiles p on p.id = s.assigned_to
  where s.status = 'active'
    and (p_mode = 'all' or s.mode = p_mode)
    and (cardinality(p_specialists) = 0 or p.email = any(p_specialists))
    -- DEV_USER_EXCLUSION: filters Josh's testing/debug data from admin views; passable via p_include_dev for the dev's optional override toggle.
    and (p_include_dev or s.assigned_to is null or s.assigned_to <> 'a70ae46e-5d51-47cb-9dff-a6a8a7a08bfd'::uuid)
  order by s.created_at asc;
$$;

grant execute on function public.get_active_sessions(text[], text, boolean) to authenticated;

-- ----------------------------------------------------------------------------
-- get_ai_status_distribution (APP-04)
-- ----------------------------------------------------------------------------
create or replace function public.get_ai_status_distribution(
  p_from        timestamptz,
  p_to          timestamptz,
  p_specialists text[]  default array[]::text[],
  p_mode        text    default 'all',
  p_include_dev boolean default false
) returns table (
  ai_status   text,
  item_count  bigint
)
language sql
stable
security invoker
as $$
  with statuses(ai_status) as (
    values ('pending'), ('processing'), ('queued'), ('done'), ('failed')
  ),
  scoped as (
    select i.ai_status
    from public.items i
    join public.sessions s on s.id = i.session_id
    left join public.profiles p on p.id = s.assigned_to
    where i.created_at >= p_from
      and i.created_at <  p_to
      and (p_mode = 'all' or s.mode = p_mode)
      and (cardinality(p_specialists) = 0 or p.email = any(p_specialists))
      -- DEV_USER_EXCLUSION: filters Josh's testing/debug data from admin views; passable via p_include_dev for the dev's optional override toggle.
      and (p_include_dev or s.assigned_to is null or s.assigned_to <> 'a70ae46e-5d51-47cb-9dff-a6a8a7a08bfd'::uuid)
  )
  select t.ai_status, coalesce(count(sc.*), 0)::bigint as item_count
  from statuses t
  left join scoped sc on sc.ai_status = t.ai_status
  group by t.ai_status
  order by t.ai_status;
$$;

grant execute on function public.get_ai_status_distribution(
  timestamptz, timestamptz, text[], text, boolean
) to authenticated;

-- ----------------------------------------------------------------------------
-- get_export_pipeline (APP-05)
-- ----------------------------------------------------------------------------
create or replace function public.get_export_pipeline(
  p_from        timestamptz,
  p_to          timestamptz,
  p_specialists text[]  default array[]::text[],
  p_mode        text    default 'all',
  p_include_dev boolean default false
) returns table (
  status        text,
  session_count bigint
)
language sql
stable
security invoker
as $$
  with statuses(status) as (
    values ('active'), ('submitted'), ('returned'), ('exported'), ('completed')
  ),
  scoped as (
    select s.status
    from public.sessions s
    left join public.profiles p on p.id = s.assigned_to
    where s.created_at >= p_from
      and s.created_at <  p_to
      and (p_mode = 'all' or s.mode = p_mode)
      and (cardinality(p_specialists) = 0 or p.email = any(p_specialists))
      -- DEV_USER_EXCLUSION: filters Josh's testing/debug data from admin views; passable via p_include_dev for the dev's optional override toggle.
      and (p_include_dev or s.assigned_to is null or s.assigned_to <> 'a70ae46e-5d51-47cb-9dff-a6a8a7a08bfd'::uuid)
  )
  select t.status, coalesce(count(sc.*), 0)::bigint as session_count
  from statuses t
  left join scoped sc on sc.status = t.status
  group by t.status
  order by t.status;
$$;

grant execute on function public.get_export_pipeline(
  timestamptz, timestamptz, text[], text, boolean
) to authenticated;

-- ----------------------------------------------------------------------------
-- get_house_sale_split (APP-12)
-- ----------------------------------------------------------------------------
create or replace function public.get_house_sale_split(
  p_from        timestamptz,
  p_to          timestamptz,
  p_specialists text[]  default array[]::text[],
  p_mode        text    default 'all',
  p_include_dev boolean default false
) returns table (
  mode        text,
  n_sessions  bigint,
  n_items     bigint
)
language sql
stable
security invoker
as $$
  with modes(mode) as (
    values ('house'), ('sale')
  ),
  scoped_sessions as (
    select s.mode, s.id
    from public.sessions s
    left join public.profiles p on p.id = s.assigned_to
    where s.created_at >= p_from
      and s.created_at <  p_to
      and (p_mode = 'all' or s.mode = p_mode)
      and (cardinality(p_specialists) = 0 or p.email = any(p_specialists))
      -- DEV_USER_EXCLUSION: filters Josh's testing/debug data from admin views; passable via p_include_dev for the dev's optional override toggle.
      and (p_include_dev or s.assigned_to is null or s.assigned_to <> 'a70ae46e-5d51-47cb-9dff-a6a8a7a08bfd'::uuid)
  ),
  scoped_items as (
    select s.mode, i.id
    from public.items i
    join public.sessions s on s.id = i.session_id
    left join public.profiles p on p.id = s.assigned_to
    where i.created_at >= p_from
      and i.created_at <  p_to
      and (p_mode = 'all' or s.mode = p_mode)
      and (cardinality(p_specialists) = 0 or p.email = any(p_specialists))
      -- DEV_USER_EXCLUSION: filters Josh's testing/debug data from admin views; passable via p_include_dev for the dev's optional override toggle.
      and (p_include_dev or s.assigned_to is null or s.assigned_to <> 'a70ae46e-5d51-47cb-9dff-a6a8a7a08bfd'::uuid)
  )
  select
    m.mode,
    coalesce(count(distinct ss.id), 0)::bigint as n_sessions,
    coalesce(count(si.id),          0)::bigint as n_items
  from modes m
  left join scoped_sessions ss on ss.mode = m.mode
  left join scoped_items    si on si.mode = m.mode
  group by m.mode
  order by m.mode;
$$;

grant execute on function public.get_house_sale_split(
  timestamptz, timestamptz, text[], text, boolean
) to authenticated;

-- ----------------------------------------------------------------------------
-- get_stuck_items (APP-11, D-24 — '2 hours' threshold STILL hard-coded)
-- ----------------------------------------------------------------------------
create or replace function public.get_stuck_items(
  p_specialists text[]  default array[]::text[],
  p_mode        text    default 'all',
  p_include_dev boolean default false
) returns table (
  item_id                  uuid,
  receipt_number           text,
  title                    text,
  ai_status                text,
  created_at               timestamptz,
  age_seconds              bigint,
  session_id               uuid,
  session_name             text,
  specialist_id            uuid,
  specialist_display_name  text,
  category                 text,
  estimate                 text,
  photo_paths              text[]
)
language sql
stable
security invoker
as $$
  select
    i.id              as item_id,
    i.receipt_number,
    i.title,
    i.ai_status,
    i.created_at,
    extract(epoch from (now() - i.created_at))::bigint as age_seconds,
    s.id              as session_id,
    s.name            as session_name,
    p.id              as specialist_id,
    p.display_name    as specialist_display_name,
    i.category,
    i.estimate,
    array(
      select ph.storage_path
      from public.photos ph
      where ph.item_id = i.id
        and ph.upload_status = 'failed'
    )                 as photo_paths
  from public.items i
  join public.sessions s on s.id = i.session_id
  left join public.profiles p on p.id = s.assigned_to
  where i.ai_status in ('processing', 'queued')
    and i.created_at < now() - interval '2 hours'
    and (p_mode = 'all' or s.mode = p_mode)
    and (cardinality(p_specialists) = 0 or p.email = any(p_specialists))
    -- DEV_USER_EXCLUSION: filters Josh's testing/debug data from admin views; passable via p_include_dev for the dev's optional override toggle.
    and (p_include_dev or s.assigned_to is null or s.assigned_to <> 'a70ae46e-5d51-47cb-9dff-a6a8a7a08bfd'::uuid)
  order by i.created_at asc;
$$;

grant execute on function public.get_stuck_items(text[], text, boolean) to authenticated;

-- ----------------------------------------------------------------------------
-- get_failed_ai_breakdown (D-29, dev-only widget but consistent surface)
--   Even though this is rendered inside the DeveloperPanel today, the RPC
--   accepts p_include_dev for consistency — dev callers always pass `true`
--   here so the dev sees their own failure traffic in their dev panel.
-- ----------------------------------------------------------------------------
create or replace function public.get_failed_ai_breakdown(
  p_from        timestamptz,
  p_to          timestamptz,
  p_specialists text[]  default array[]::text[],
  p_mode        text    default 'all',
  p_include_dev boolean default false
) returns table (
  dimension   text,
  dim_key     text,
  dim_label   text,
  item_count  bigint
)
language sql
stable
security invoker
as $$
  with scoped as (
    select
      i.id,
      i.category,
      s.mode,
      p.id           as specialist_id,
      p.display_name as specialist_display_name
    from public.items i
    join public.sessions s on s.id = i.session_id
    left join public.profiles p on p.id = s.assigned_to
    where i.created_at >= p_from
      and i.created_at <  p_to
      and i.ai_status = 'failed'
      and (p_mode = 'all' or s.mode = p_mode)
      and (cardinality(p_specialists) = 0 or p.email = any(p_specialists))
      -- DEV_USER_EXCLUSION: filters Josh's testing/debug data from admin views; passable via p_include_dev for the dev's optional override toggle.
      and (p_include_dev or s.assigned_to is null or s.assigned_to <> 'a70ae46e-5d51-47cb-9dff-a6a8a7a08bfd'::uuid)
  )
  select 'specialist' as dimension,
         coalesce(specialist_id::text, 'unassigned')   as dim_key,
         coalesce(specialist_display_name, 'Unassigned') as dim_label,
         count(*)::bigint as item_count
  from scoped
  group by specialist_id, specialist_display_name
  union all
  select 'mode' as dimension,
         mode as dim_key,
         mode as dim_label,
         count(*)::bigint
  from scoped
  group by mode
  union all
  select 'category' as dimension,
         coalesce(category, 'uncategorized') as dim_key,
         coalesce(category, 'uncategorized') as dim_label,
         count(*)::bigint
  from scoped
  group by category
  order by dimension, item_count desc;
$$;

grant execute on function public.get_failed_ai_breakdown(
  timestamptz, timestamptz, text[], text, boolean
) to authenticated;
