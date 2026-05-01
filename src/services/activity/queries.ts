//
// Phase 3 / APP-01..12 — Supabase query/RPC builders for /activity.
//
// IMPORTANT INVARIANTS — every new function in this module MUST honor:
//   D-30: per-chart RPCs; non-aggregating queries use raw `.from().select()` with embedded joins
//   D-33: every reference to `ui_interactions` MUST `.eq('app_source', 'tpc-app')` —
//     enforced statically in `scripts/verify-activity-app-source-scope.mjs` for the SQL surface;
//     code review + this header convention covers the TypeScript half.
//   D-20: mode filter targets `sessions.mode` only — never `items.mode`. The RPCs in Plan 03-01
//     enforce this server-side; raw `.from()` builders here MUST do the same.
//   D-19: specialist multi-select sources from `profiles WHERE is_active = true AND role = 'specialist'`.
//
// Code-review checklist: every new function in this module MUST have its name listed below in the
// JSDoc index, and any `ui_interactions` query MUST `.eq('app_source', 'tpc-app')`.
//
// Functions exported (alphabetical):
//   fetchActiveSessions          — RPC get_active_sessions          (D-15 right-now)
//   fetchActiveSpecialists       — raw .from('profiles')            (D-19 dropdown source)
//   fetchAiStatusDistribution    — RPC get_ai_status_distribution   (D-17 range-driven)
//   fetchExportPipeline          — RPC get_export_pipeline          (D-17 range-driven)
//   fetchFailedAiBreakdown       — RPC get_failed_ai_breakdown      (D-29 dev range-driven)
//   fetchHouseSaleSplit          — RPC get_house_sale_split         (D-17 range-driven)
//   fetchItemsPerSpecialist14d   — RPC get_items_per_specialist_14d (D-16 fixed-window)
//   fetchPhotoCoverage           — RPC get_photo_coverage           (APP-10 one-shot)
//   fetchSessionDetail           — RPC get_session_detail           (APP-06 one-shot)
//   fetchSessionItems            — raw .from('items')               (APP-06 one-shot embed)
//   fetchSessionPhotos           — raw .from('photos')              (D-09 lazy thumbnail meta)
//   fetchStuckItems              — RPC get_stuck_items              (APP-11 / D-24 right-now)
//   fetchTodayKpis               — RPC get_today_kpis               (APP-01 right-now)
//   fetchUiRecentEvents          — raw .from('ui_interactions')     (D-32 dev live tail)
//   fetchUiTopElements           — RPC get_ui_top_elements          (D-32 dev range-driven)
//   fetchUiTopPages              — RPC get_ui_top_pages             (D-32 dev range-driven)
//   fetchWalkthroughFunnel       — RPC get_walkthrough_funnel       (D-32 dev right-now)

import { supabase } from '../../lib/supabase';
import type { Database } from '../../db/database.types';

// ---------------------------------------------------------------------------
// Type aliases — pulled from regenerated database.types.ts (Plan 03-01).
// ---------------------------------------------------------------------------

export type TodayKpisRow            = Database['public']['Functions']['get_today_kpis']['Returns'][number];
export type ActiveSessionsRow       = Database['public']['Functions']['get_active_sessions']['Returns'][number];
export type ItemsPerSpecialistRow   = Database['public']['Functions']['get_items_per_specialist_14d']['Returns'][number];
export type AiStatusRow             = Database['public']['Functions']['get_ai_status_distribution']['Returns'][number];
export type ExportPipelineRow       = Database['public']['Functions']['get_export_pipeline']['Returns'][number];
export type HouseSaleSplitRow       = Database['public']['Functions']['get_house_sale_split']['Returns'][number];
export type StuckItemsRow           = Database['public']['Functions']['get_stuck_items']['Returns'][number];
export type FailedAiBreakdownRow    = Database['public']['Functions']['get_failed_ai_breakdown']['Returns'][number];
export type SessionDetailRow        = Database['public']['Functions']['get_session_detail']['Returns'][number];
export type PhotoCoverageRow        = Database['public']['Functions']['get_photo_coverage']['Returns'][number];
export type UiTopPagesRow           = Database['public']['Functions']['get_ui_top_pages']['Returns'][number];
export type UiTopElementsRow        = Database['public']['Functions']['get_ui_top_elements']['Returns'][number];
export type WalkthroughFunnelRow    = Database['public']['Functions']['get_walkthrough_funnel']['Returns'][number];

export type SpecialistOption = Pick<
  Database['public']['Tables']['profiles']['Row'],
  'id' | 'display_name'
> & { email: string };

export type ItemListRow = Pick<
  Database['public']['Tables']['items']['Row'],
  | 'id'
  | 'receipt_number'
  | 'title'
  | 'ai_status'
  | 'description'
  | 'category'
  | 'estimate'
  | 'measurements'
  | 'transcript'
  | 'created_at'
> & { photo_count: number };

export type PhotoMetaRow = Pick<
  Database['public']['Tables']['photos']['Row'],
  'id' | 'item_id' | 'storage_path' | 'thumbnail_path' | 'upload_status' | 'sort_order'
>;

export type UiInteractionFeedRow = Database['public']['Tables']['ui_interactions']['Row'];

// ---------------------------------------------------------------------------
// Defaults helper — fetchTodayKpis returns a single row; tests / empty DB
// states get a zeroed-out row so consuming UI never crashes on undefined.
// ---------------------------------------------------------------------------

function defaultTodayKpisRow(): TodayKpisRow {
  return {
    sessions_today: 0,
    items_today: 0,
    exports_today: 0,
    items_done_today: 0,
    items_total_today: 0,
    sessions_yday: 0,
    items_yday: 0,
    exports_yday: 0,
    items_done_yday: 0,
    items_total_yday: 0,
  };
}

// ---------------------------------------------------------------------------
// RPC wrappers — right-now class
// ---------------------------------------------------------------------------

/**
 * APP-01 / D-14 — today vs yesterday KPI strip.
 * Empty `specialists` array means "no filter" (Pitfall 7); the RPC body uses
 * the cardinality(p_specialists) = 0 short-circuit.
 */
export async function fetchTodayKpis(args: {
  specialists: string[];
  mode: 'house' | 'sale' | 'all';
}): Promise<TodayKpisRow> {
  const { data, error } = await supabase.rpc('get_today_kpis', {
    p_specialists: args.specialists,
    p_mode: args.mode,
  });
  if (error) throw error;
  return data?.[0] ?? defaultTodayKpisRow();
}

/**
 * APP-02 / D-15 — Active sessions list (status = 'active').
 */
export async function fetchActiveSessions(args: {
  specialists: string[];
  mode: 'house' | 'sale' | 'all';
}): Promise<ActiveSessionsRow[]> {
  const { data, error } = await supabase.rpc('get_active_sessions', {
    p_specialists: args.specialists,
    p_mode: args.mode,
  });
  if (error) throw error;
  return data ?? [];
}

/**
 * APP-11 / D-18 / D-24 — Stuck items (2-hour threshold, hard-coded server-side).
 */
export async function fetchStuckItems(args: {
  specialists: string[];
  mode: 'house' | 'sale' | 'all';
}): Promise<StuckItemsRow[]> {
  const { data, error } = await supabase.rpc('get_stuck_items', {
    p_specialists: args.specialists,
    p_mode: args.mode,
  });
  if (error) throw error;
  return data ?? [];
}

/**
 * D-32 (dev) — Walkthrough funnel: distinct users per step. No filter args.
 */
export async function fetchWalkthroughFunnel(): Promise<WalkthroughFunnelRow[]> {
  const { data, error } = await supabase.rpc('get_walkthrough_funnel');
  if (error) throw error;
  return data ?? [];
}

// ---------------------------------------------------------------------------
// RPC wrappers — fixed-window class
// ---------------------------------------------------------------------------

/**
 * APP-03 / D-16 — Items per specialist over a trailing 14-day window.
 * Server computes window bounds; this wrapper does NOT pass `p_from` or `p_to`.
 */
export async function fetchItemsPerSpecialist14d(args: {
  specialists: string[];
  mode: 'house' | 'sale' | 'all';
}): Promise<ItemsPerSpecialistRow[]> {
  const { data, error } = await supabase.rpc('get_items_per_specialist_14d', {
    p_specialists: args.specialists,
    p_mode: args.mode,
  });
  if (error) throw error;
  return data ?? [];
}

// ---------------------------------------------------------------------------
// RPC wrappers — range-driven class (D-17)
// ---------------------------------------------------------------------------

/**
 * APP-04 / D-17 — AI status distribution across `items.created_at` window.
 */
export async function fetchAiStatusDistribution(args: {
  from: Date;
  to: Date;
  specialists: string[];
  mode: 'house' | 'sale' | 'all';
}): Promise<AiStatusRow[]> {
  const { data, error } = await supabase.rpc('get_ai_status_distribution', {
    p_from: args.from.toISOString(),
    p_to: args.to.toISOString(),
    p_specialists: args.specialists,
    p_mode: args.mode,
  });
  if (error) throw error;
  return data ?? [];
}

/**
 * APP-05 / D-17 — Export pipeline distribution by session.status (5 segments).
 * Includes `'completed'` (per Plan 03-01 SUMMARY Open Q1 lock).
 */
export async function fetchExportPipeline(args: {
  from: Date;
  to: Date;
  specialists: string[];
  mode: 'house' | 'sale' | 'all';
}): Promise<ExportPipelineRow[]> {
  const { data, error } = await supabase.rpc('get_export_pipeline', {
    p_from: args.from.toISOString(),
    p_to: args.to.toISOString(),
    p_specialists: args.specialists,
    p_mode: args.mode,
  });
  if (error) throw error;
  return data ?? [];
}

/**
 * APP-12 / D-17 — Always returns 2 rows (house, sale). UI hides the unselected
 * mode tile when `mode !== 'all'`.
 */
export async function fetchHouseSaleSplit(args: {
  from: Date;
  to: Date;
  specialists: string[];
  mode: 'house' | 'sale' | 'all';
}): Promise<HouseSaleSplitRow[]> {
  const { data, error } = await supabase.rpc('get_house_sale_split', {
    p_from: args.from.toISOString(),
    p_to: args.to.toISOString(),
    p_specialists: args.specialists,
    p_mode: args.mode,
  });
  if (error) throw error;
  return data ?? [];
}

/**
 * D-29 (dev) — Failed-AI breakdown by specialist × mode × category.
 * Returns long-form rows (dimension + dim_key + dim_label + item_count).
 */
export async function fetchFailedAiBreakdown(args: {
  from: Date;
  to: Date;
  specialists: string[];
  mode: 'house' | 'sale' | 'all';
}): Promise<FailedAiBreakdownRow[]> {
  const { data, error } = await supabase.rpc('get_failed_ai_breakdown', {
    p_from: args.from.toISOString(),
    p_to: args.to.toISOString(),
    p_specialists: args.specialists,
    p_mode: args.mode,
  });
  if (error) throw error;
  return data ?? [];
}

/**
 * D-32 (dev) / D-34 — Top page paths from ui_interactions over the date range.
 * NO specialist/mode args — UI dev panels do not respect those filters.
 */
export async function fetchUiTopPages(args: {
  from: Date;
  to: Date;
}): Promise<UiTopPagesRow[]> {
  const { data, error } = await supabase.rpc('get_ui_top_pages', {
    p_from: args.from.toISOString(),
    p_to: args.to.toISOString(),
  });
  if (error) throw error;
  return data ?? [];
}

/**
 * D-32 (dev) / D-34 — Top element clicks from ui_interactions over the date range.
 * NO specialist/mode args.
 */
export async function fetchUiTopElements(args: {
  from: Date;
  to: Date;
}): Promise<UiTopElementsRow[]> {
  const { data, error } = await supabase.rpc('get_ui_top_elements', {
    p_from: args.from.toISOString(),
    p_to: args.to.toISOString(),
  });
  if (error) throw error;
  return data ?? [];
}

// ---------------------------------------------------------------------------
// RPC wrappers — one-shot class
// ---------------------------------------------------------------------------

/**
 * APP-06 — Single-session metadata. Returns null when the session is missing
 * or the admin can't see it.
 */
export async function fetchSessionDetail(args: {
  sessionId: string;
}): Promise<SessionDetailRow | null> {
  const { data, error } = await supabase.rpc('get_session_detail', {
    p_session_id: args.sessionId,
  });
  if (error) throw error;
  return data?.[0] ?? null;
}

/**
 * APP-10 — Per-session photo coverage stats. Returns null on empty.
 */
export async function fetchPhotoCoverage(args: {
  sessionId: string;
}): Promise<PhotoCoverageRow | null> {
  const { data, error } = await supabase.rpc('get_photo_coverage', {
    p_session_id: args.sessionId,
  });
  if (error) throw error;
  return data?.[0] ?? null;
}

// ---------------------------------------------------------------------------
// Raw `.from()` builders — non-aggregating reads
// ---------------------------------------------------------------------------

/**
 * APP-08 / D-19 — Active specialist option list (feeds SpecialistMultiSelect).
 * Excludes admins (role = 'admin') and deactivated rows. Ordered by display_name.
 * The .filter() drops the `email IS NULL` rows defensively even though the
 * `.not('email','is',null)` server filter already excludes them — types stay narrow.
 */
export async function fetchActiveSpecialists(): Promise<SpecialistOption[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, display_name')
    .eq('is_active', true)
    .eq('role', 'specialist')
    .not('email', 'is', null)
    .order('display_name', { ascending: true });
  if (error) throw error;
  return (data ?? [])
    .filter((p): p is { id: string; email: string; display_name: string } => p.email !== null);
}

/**
 * APP-06 — Session item list with embedded photo count. NOT an RPC because the
 * shape is a simple inner-join; PostgREST handles it via embedded select. The
 * photos count comes back as `photos: [{ count }]` and gets flattened to
 * `photo_count` in the return shape.
 */
export async function fetchSessionItems(args: {
  sessionId: string;
}): Promise<ItemListRow[]> {
  const { data, error } = await supabase
    .from('items')
    .select(
      'id, receipt_number, title, ai_status, description, category, estimate, measurements, transcript, created_at, photos(count)',
    )
    .eq('session_id', args.sessionId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => {
    const r = row as unknown as Record<string, unknown> & {
      photos?: Array<{ count: number }> | null;
    };
    const photo_count = r.photos?.[0]?.count ?? 0;
    return {
      id: r.id as string,
      receipt_number: (r.receipt_number as string | null) ?? null,
      title: (r.title as string | null) ?? null,
      ai_status: r.ai_status as string,
      description: (r.description as string | null) ?? null,
      category: (r.category as string | null) ?? null,
      estimate: (r.estimate as string | null) ?? null,
      measurements: (r.measurements as string | null) ?? null,
      transcript: (r.transcript as string | null) ?? null,
      created_at: r.created_at as string,
      photo_count,
    } satisfies ItemListRow;
  });
}

/**
 * D-09 — Per-item lazy photo metadata fetch. Returns photo metadata only —
 * signed URLs are computed on demand by useSignedPhotoUrl per photo. Mounts
 * only when an item row is expanded (the consumer hook is `enabled`-gated).
 */
export async function fetchSessionPhotos(args: {
  itemId: string;
}): Promise<PhotoMetaRow[]> {
  const { data, error } = await supabase
    .from('photos')
    .select('id, item_id, storage_path, thumbnail_path, upload_status, sort_order')
    .eq('item_id', args.itemId)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/**
 * D-32 (dev) — Live tail of ui_interactions for the dev panel Recent Events Feed.
 * D-33 INVARIANT: `app_source = 'tpc-app'` MUST be present.
 */
export async function fetchUiRecentEvents(args: {
  limit?: number;
}): Promise<UiInteractionFeedRow[]> {
  const { data, error } = await supabase
    .from('ui_interactions')
    .select(
      'id, app_source, app_version, user_id, user_email, session_id, interaction_type, page_path, element_id, metadata, created_at',
    )
    .eq('app_source', 'tpc-app') // D-33 invariant
    .order('created_at', { ascending: false })
    .limit(args.limit ?? 50);
  if (error) throw error;
  return data ?? [];
}
