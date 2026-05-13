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
// Aggregation is client-side because server-side row count is tiny — one row
// per catalog_batch event, even on a busy week measured in hundreds. The 5
// columns are summed across the result set; nullish coercion (`?? 0`) handles
// historical rows that pre-date migration 007 (all 5 columns NULL there).

export interface SkipReasonTotals {
  no_photos: number;
  fields_filled: number;
  manually: number;
  category_filter: number;
  classification_failed: number;
  total: number;
}

function aggregate(rows: SkipReasonRow[]): SkipReasonTotals {
  const totals: SkipReasonTotals = {
    no_photos: 0,
    fields_filled: 0,
    manually: 0,
    category_filter: 0,
    classification_failed: 0,
    total: 0,
  };
  for (const r of rows) {
    totals.no_photos += r.skipped_no_photos ?? 0;
    totals.fields_filled += r.skipped_fields_filled ?? 0;
    totals.manually += r.skipped_manually ?? 0;
    totals.category_filter += r.skipped_category_filter ?? 0;
    totals.classification_failed += r.skipped_classification_failed ?? 0;
  }
  totals.total =
    totals.no_photos +
    totals.fields_filled +
    totals.manually +
    totals.category_filter +
    totals.classification_failed;
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
