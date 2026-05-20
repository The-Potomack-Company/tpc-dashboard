import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Database } from '../db/database.types';
import type { Department, Priority, TriageRow } from '../services/crm/types';

type CrmTriageQueueRow = Database['public']['Views']['crm_triage_queue']['Row'];

const PRIORITY_ORDER: Record<Priority, number> = {
  high: 0,
  standard: 1,
  low: 2,
};

const DEPARTMENTS: ReadonlySet<string> = new Set([
  'furniture',
  'decarts',
  'books',
  'fashion',
  'art_sculpture',
]);

// 2x age-bump ladder (locked 2026-05-20). needsReview rows don't age-bump —
// unreadable inputs shouldn't be promoted just because they've been sitting.
export function getEffectivePriority(
  priority: Priority,
  ageDays: number,
  needsReview: boolean = false,
): Priority {
  if (priority === 'high') return 'high';
  if (needsReview) return priority;
  if (priority === 'standard' && ageDays >= 10) return 'high';
  if (priority === 'low' && ageDays >= 30) return 'high';
  if (priority === 'low' && ageDays >= 14) return 'standard';
  return priority;
}

export function sortTriageRows(rows: TriageRow[]): TriageRow[] {
  return [...rows].sort((a, b) => {
    const bucketDelta = PRIORITY_ORDER[a.effective_priority] - PRIORITY_ORDER[b.effective_priority];
    if (bucketDelta !== 0) return bucketDelta;
    return new Date(a.received_at).getTime() - new Date(b.received_at).getTime();
  });
}

function isPriority(value: string | null): value is Priority {
  return value === 'high' || value === 'standard' || value === 'low';
}

function normalizeDepartments(value: string[] | null): Department[] {
  return (value ?? []).filter((dept): dept is Department => DEPARTMENTS.has(dept));
}

function normalizeRow(row: CrmTriageQueueRow, nowMs: number): TriageRow | null {
  if (!row.thread_id || !row.streak_box_key || !row.received_at || !isPriority(row.priority)) {
    return null;
  }

  const ageDays = (nowMs - new Date(row.received_at).getTime()) / 86_400_000;
  const needsReview = row.needs_review === true;
  const effectivePriority = getEffectivePriority(row.priority, ageDays, needsReview);

  return {
    thread_id: row.thread_id,
    streak_box_key: row.streak_box_key,
    streak_pipeline_key: row.streak_pipeline_key,
    streak_stage_key: row.streak_stage_key,
    streak_stage_name: row.streak_stage_name,
    subject: row.subject ?? '(No subject)',
    from_email: row.from_email,
    from_name: row.from_name,
    received_at: row.received_at,
    snippet: row.snippet,
    body_text: row.body_text,
    body_source: row.body_source,
    classification_id: row.classification_id,
    classified_at: row.classified_at,
    department: normalizeDepartments(row.department),
    priority: row.priority,
    effective_priority: effectivePriority,
    rationale: row.rationale,
    model: row.model,
    last_polled_at: row.last_polled_at,
    age_days: ageDays,
    needs_review: needsReview,
  };
}

async function fetchTriageRows(): Promise<TriageRow[]> {
  const { data, error } = await supabase
    .from('crm_triage_queue')
    .select('*');

  if (error) {
    throw new Error(error.message);
  }

  const nowMs = Date.now();
  const rows = (data ?? [])
    .map((row) => normalizeRow(row, nowMs))
    .filter((row): row is TriageRow => row !== null);

  return sortTriageRows(rows);
}

export function useCrmTriage() {
  const query = useQuery({
    queryKey: ['crm', 'triage'] as const,
    queryFn: fetchTriageRows,
  });

  return {
    threads: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
