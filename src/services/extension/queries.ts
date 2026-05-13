//
// Phase 2 / EXT-01..10 — Supabase query/RPC builders for /extension.
//
// IMPORTANT: every aggregation and select against analytics_events MUST scope by
// app_source = 'tpc-extension' (CONTEXT D-01). The 5-event vocabulary excludes
// catalog_item from EXT-01..04 (D-02). The error signal is `error_message IS NOT NULL`
// (D-03). Bucketing is server-side (D-13).
//
// Code-review checklist: every new function in this module MUST .eq('app_source', 'tpc-extension').
// Plan 02-01's static verifier (scripts/verify-extension-app-source-scope.mjs) covers the SQL
// migration; this JSDoc + reviewer convention covers the TypeScript half.

import { supabase } from '../../lib/supabase';
import type { Database } from '../../db/database.types';

// 5-event vocabulary (D-02) — declared once, reused everywhere a select must
// restrict event_type. Use the constant — never hand-type the array elsewhere.
export const EXTENSION_EVENT_TYPES = [
  'catalog_single',
  'catalog_batch',
  'portal_upload',
  'spreadsheet_transform',
  'data_import',
] as const;

export type ExtensionEventType = (typeof EXTENSION_EVENT_TYPES)[number];

// Typed result aliases — pulled from regenerated database.types.ts (Plan 02-01).
export type VolumeRow = Database['public']['Functions']['get_event_volume_daily']['Returns'][number];
export type KpiRow = Database['public']['Functions']['get_kpi_totals']['Returns'][number];
export type ErrorRateRow = Database['public']['Functions']['get_error_rate_by_type']['Returns'][number];
export type PerUserRow = Database['public']['Functions']['get_per_user_summary']['Returns'][number];
export type DomVersionRow = Database['public']['Functions']['get_dominant_version']['Returns'][number];
// CancelRateRow includes previous_rate: number | null at runtime even though
// supabase gen types emits it as `number` (D-05 NULLIF semantics — when prev_total
// = 0 the SQL returns NULL → JS sees null). Plan 02-04 cancellation KPIs must
// null-check explicitly. See 02-01-SUMMARY.md "Decisions Made" for the gen-types
// nullability gap.
export type CancelRateRow = Database['public']['Functions']['get_cancellation_rates']['Returns'][number];
export type EventRow = Database['public']['Tables']['analytics_events']['Row'];

// ---------------------------------------------------------------------------
// RPC builders (4 aggregation RPCs from D-12 + 2 dev-panel RPCs)
// ---------------------------------------------------------------------------

/**
 * EXT-01 — daily/hourly event volume (Pattern 1).
 * D-08: bucket = 'hour' for ?range=today, otherwise 'day'.
 */
export async function fetchEventVolume(args: {
  from: Date;
  to: Date;
  users: string[];
  versions: string[];
  bucket: 'day' | 'hour';
}): Promise<VolumeRow[]> {
  const { data, error } = await supabase.rpc('get_event_volume_daily', {
    p_from: args.from.toISOString(),
    p_to: args.to.toISOString(),
    p_users: args.users, // empty array = "no filter" (Pitfall 2)
    p_versions: args.versions,
    p_bucket: args.bucket,
  });
  if (error) throw error;
  return data ?? [];
}

/**
 * EXT-02 — KPI totals + previous-period counts + sparkline series (Pattern 2).
 * D-05 (previous-period semantics) + D-08 (sparkline bucket resolution).
 */
export async function fetchKpiTotals(args: {
  from: Date;
  to: Date;
  users: string[];
  versions: string[];
  bucket: 'day' | 'hour';
}): Promise<KpiRow[]> {
  const { data, error } = await supabase.rpc('get_kpi_totals', {
    p_from: args.from.toISOString(),
    p_to: args.to.toISOString(),
    p_users: args.users,
    p_versions: args.versions,
    p_bucket: args.bucket,
  });
  if (error) throw error;
  return data ?? [];
}

/**
 * EXT-03 — error rate per event_type (D-03 canonical signal).
 */
export async function fetchErrorRate(args: {
  from: Date;
  to: Date;
  users: string[];
  versions: string[];
}): Promise<ErrorRateRow[]> {
  const { data, error } = await supabase.rpc('get_error_rate_by_type', {
    p_from: args.from.toISOString(),
    p_to: args.to.toISOString(),
    p_users: args.users,
    p_versions: args.versions,
  });
  if (error) throw error;
  return data ?? [];
}

/**
 * EXT-04 — per-user summary (D-04: NULL emails grouped as 'Unknown' inside the RPC).
 */
export async function fetchPerUserSummary(args: {
  from: Date;
  to: Date;
  users: string[];
  versions: string[];
}): Promise<PerUserRow[]> {
  const { data, error } = await supabase.rpc('get_per_user_summary', {
    p_from: args.from.toISOString(),
    p_to: args.to.toISOString(),
    p_users: args.users,
    p_versions: args.versions,
  });
  if (error) throw error;
  return data ?? [];
}

/**
 * EXT-09 — dominant extension_version in active filter selection (D-06).
 * The RPC returns at most 1 row (single-row dominant version with semver tie-break).
 * Returns the single row or null when the result set is empty.
 */
export async function fetchDominantVersion(args: {
  from: Date;
  to: Date;
  users: string[];
  versions: string[];
}): Promise<DomVersionRow | null> {
  const { data, error } = await supabase.rpc('get_dominant_version', {
    p_from: args.from.toISOString(),
    p_to: args.to.toISOString(),
    p_users: args.users,
    p_versions: args.versions,
  });
  if (error) throw error;
  return data?.[0] ?? null;
}

/**
 * EXT-10 — cancellation rate KPIs (D-07).
 * Returns rows for catalog_batch + portal_upload always (2-row VALUES left-join
 * trick in the SQL guarantees stable cardinality even when one period has zero rows).
 * Each row includes `previous_rate: number | null` (NULL when prev denominator = 0).
 */
export async function fetchCancellationRates(args: {
  from: Date;
  to: Date;
  users: string[];
  versions: string[];
}): Promise<CancelRateRow[]> {
  const { data, error } = await supabase.rpc('get_cancellation_rates', {
    p_from: args.from.toISOString(),
    p_to: args.to.toISOString(),
    p_users: args.users,
    p_versions: args.versions,
  });
  if (error) throw error;
  return data ?? [];
}

// ---------------------------------------------------------------------------
// Raw select builders (.from('analytics_events'))
// ---------------------------------------------------------------------------

/**
 * EXT-05 — Recent Errors table.
 * D-01 (app_source) + D-02 (5-event vocab) + D-03 (error_message IS NOT NULL).
 * Default cap 100 per UI-SPEC EXT-05 subheading copy.
 *
 * Empty users[] / versions[] are NO-OPS — we MUST NOT call .in('user_email', [])
 * because Postgres treats an empty IN list as "match nothing" → silent blank chart.
 */
export async function fetchRecentErrors(args: {
  from: Date;
  to: Date;
  users: string[];
  versions: string[];
  limit?: number;
}): Promise<EventRow[]> {
  let q = supabase
    .from('analytics_events')
    .select('id, created_at, user_email, event_type, error_message, extension_version, items_content')
    .eq('app_source', 'tpc-extension') // D-01
    .not('error_message', 'is', null) // D-03
    .in('event_type', EXTENSION_EVENT_TYPES as unknown as string[]) // D-02
    .gte('created_at', args.from.toISOString())
    .lte('created_at', args.to.toISOString())
    .order('created_at', { ascending: false })
    .limit(args.limit ?? 100);
  if (args.users.length) q = q.in('user_email', args.users);
  if (args.versions.length) q = q.in('extension_version', args.versions);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as EventRow[];
}

/**
 * EXT-08 — Live event feed.
 * D-09 / D-10 / D-11 — newest 50 rows, scoped by app_source ONLY (no event_type
 * filter, no error_message filter — feed is unfiltered live activity).
 */
export async function fetchLiveFeed(
  { limit = 50 }: { limit?: number } = {},
): Promise<EventRow[]> {
  const { data, error } = await supabase
    .from('analytics_events')
    .select('id, created_at, user_email, event_type, error_message, extension_version, items_content')
    .eq('app_source', 'tpc-extension') // D-01 still applies
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as EventRow[];
}

/**
 * category-filtered-batch — Skip-reason breakdown for /extension.
 *
 * Selects the 5 new top-level INT columns on `analytics_events` filtered to
 * `event_type = 'catalog_batch'` (skip reasons only exist on batch events) and
 * `app_source = 'tpc-extension'` (D-01). Date range gates via gte/lte on
 * created_at.
 *
 * Filter contract matches the neighboring fetchers (see fetchRecentErrors):
 * empty `users` / `versions` arrays are NO-OPS — .in('user_email', []) /
 * .in('extension_version', []) would degenerate to "match nothing" and silently
 * blank the chart.
 *
 * Historical rows (pre-migration 007) carry NULL for all 5 columns; client-
 * side aggregation in `useSkipReasons` coerces nullish to 0 so the donut shows
 * an empty-state instead of NaN.
 */
export type SkipReasonRow = Pick<
  Database['public']['Tables']['analytics_events']['Row'],
  | 'skipped_no_photos'
  | 'skipped_fields_filled'
  | 'skipped_manually'
  | 'skipped_category_filter'
  | 'skipped_classification_failed'
>;

export async function fetchSkipReasons(args: {
  from: Date;
  to: Date;
  users: string[];
  versions: string[];
}): Promise<SkipReasonRow[]> {
  let q = supabase
    .from('analytics_events')
    .select(
      'skipped_no_photos, skipped_fields_filled, skipped_manually, skipped_category_filter, skipped_classification_failed',
    )
    .eq('app_source', 'tpc-extension') // D-01
    .eq('event_type', 'catalog_batch') // skip reasons live only on batch events
    .gte('created_at', args.from.toISOString())
    .lte('created_at', args.to.toISOString());
  if (args.users.length) q = q.in('user_email', args.users);
  if (args.versions.length) q = q.in('extension_version', args.versions);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as SkipReasonRow[];
}

/**
 * D-19 — Lifetime emptiness probe for /extension.
 * Single SELECT with limit(1); the `useExtensionGate` hook caches the result
 * indefinitely (staleTime: Infinity) — see D-19 trade-off (CONTEXT § Deferred).
 */
export async function fetchExtensionGate(): Promise<{ hasAny: boolean }> {
  const { data, error } = await supabase
    .from('analytics_events')
    .select('id')
    .eq('app_source', 'tpc-extension') // D-01 — legacy NULL-source rows can't false-positive
    .limit(1);
  if (error) throw error;
  return { hasAny: (data?.length ?? 0) > 0 };
}

/**
 * EXT-09 — Distinct extension_version values currently present in analytics_events
 * (scope: app_source = 'tpc-extension', NULLs excluded).
 *
 * Sole source of truth for the EXT-09 ExtensionVersionFilter option list.
 * Cached for ~5 minutes by the consumer hook (useDistinctVersions); versions
 * change rarely. Dedupe is performed JS-side via Set; server returns rows
 * already sorted descending so the resulting array preserves that order.
 */
export async function fetchDistinctVersions(): Promise<string[]> {
  const { data, error } = await supabase
    .from('analytics_events')
    .select('extension_version')
    .eq('app_source', 'tpc-extension') // D-01
    .not('extension_version', 'is', null)
    .order('extension_version', { ascending: false });
  if (error) throw error;
  const set = new Set<string>();
  for (const r of (data ?? []) as Array<{ extension_version: string | null }>) {
    if (r.extension_version) set.add(r.extension_version);
  }
  return [...set];
}
