import { useQuery } from '@tanstack/react-query';
import { useDateRange } from '../useDateRange';
import { useUserFilter } from './useUserFilter';
import { useVersionFilter } from './useVersionFilter';
import { fetchSkipReasons } from '../../services/extension/queries';
import type { SkipReasonRow } from '../../services/extension/queries';

// category-filtered-batch — Skip Reasons donut hook.
//
// Mirrors useEventVolume / useErrorRate / etc.: sorted user + version arrays
// in the queryKey for cache stability (Pitfall 3); URL-order arrays at the
// fetch boundary (proven by all-hooks-smoke.test.tsx).
//
// Aggregation moved server-side in migration 20260514100000 — the RPC returns
// exactly 5 rows (one per bucket, zero-padded). This shape avoids the
// PostgREST 1000-row truncation that the prior raw-select fetcher would hit
// once a date range matched enough catalog_batch rows.

export interface SkipReasonTotals {
  no_photos: number;
  fields_filled: number;
  manually: number;
  category_filter: number;
  classification_failed: number;
  total: number;
}

const REASON_KEYS = [
  'no_photos',
  'fields_filled',
  'manually',
  'category_filter',
  'classification_failed',
] as const satisfies readonly (keyof Omit<SkipReasonTotals, 'total'>)[];

function aggregate(rows: SkipReasonRow[]): SkipReasonTotals {
  const totals: SkipReasonTotals = {
    no_photos: 0,
    fields_filled: 0,
    manually: 0,
    category_filter: 0,
    classification_failed: 0,
    total: 0,
  };
  // Reason taxonomy mismatch detector: if the RPC ever adds or renames a
  // bucket without the dashboard catching up, the donut would silently drop
  // the new bucket from `total`. Log + skip rather than throw — the chart is
  // analytics, not load-bearing on user flow.
  for (const r of rows) {
    if (!(REASON_KEYS as readonly string[]).includes(r.reason)) {
      // eslint-disable-next-line no-console
      console.warn('useSkipReasons: unknown reason from RPC', r.reason);
      continue;
    }
    const key = r.reason as keyof Omit<SkipReasonTotals, 'total'>;
    totals[key] = Number(r.count);
    totals.total += Number(r.count);
  }
  return totals;
}

export function useSkipReasons() {
  const { from, to } = useDateRange();
  const { users } = useUserFilter();
  const { versions } = useVersionFilter();

  const usersKey = [...users].sort();
  const versionsKey = [...versions].sort();

  return useQuery({
    queryKey: [
      'extension',
      'skip-reasons',
      {
        from: from.toISOString(),
        to: to.toISOString(),
        users: usersKey,
        versions: versionsKey,
      },
    ],
    queryFn: async () => {
      const rows = await fetchSkipReasons({ from, to, users, versions });
      return aggregate(rows);
    },
  });
}
