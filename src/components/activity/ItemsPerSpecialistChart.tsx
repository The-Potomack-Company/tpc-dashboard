// Phase 3 / APP-03 / D-16 — fixed-window 14-day items-per-specialist stacked bar.
// Filter scope: ignores ?range= (computed server-side); applies ?specialists= and ?mode=
// via the underlying useItemsPerSpecialist hook. This component MUST NOT import
// useDateRange — the @filterScope verifier on the hook enforces that contract there;
// the absence of the import here keeps the fixed-window invariant visible at the call site.
//
// Recharts pattern is verbatim Phase 2 / EventVolumeChart (long → wide pivot, isAnimationActive=false,
// CartesianGrid stroke='var(--rule)' with vertical={false} — solid horizontal value-axis gridlines
// only; label-axis (X / dates) gridlines are suppressed for a minimalist look). Color allocation
// comes from chartPalette.colorForSpecialist:
// the alphabetically-sorted email list determines the cycle index, so the same specialist gets the
// same color across renders so long as the active set is stable.

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { formatInTimeZone } from 'date-fns-tz';
import { useItemsPerSpecialist } from '../../hooks/activity/useItemsPerSpecialist';
import { colorForSpecialist } from '../../lib/chartPalette';
import { ErrorState } from '../ErrorState';
import { EmptyState } from '../EmptyState';
import type { ItemsPerSpecialistRow } from '../../services/activity/queries';

const ET = 'America/New_York';

interface WideRow {
  bucket: string;
  [specialistEmail: string]: number | string;
}

interface PivotResult {
  wide: WideRow[];
  sortedSpecialists: string[];
  emailToDisplayName: Map<string, string>;
}

// Pivot RPC long-form rows (one row per [bucket, specialist]) to Recharts wide-form
// (one row per bucket with one column per specialist). Specialists are sorted by
// display_name (alphabetical) — that order seeds colorForSpecialist's cycle index.
// Rows missing a specialist column get a `0` so the stacked bar renders contiguous.
function pivotForRecharts(rows: ItemsPerSpecialistRow[]): PivotResult {
  const byBucket = new Map<string, WideRow>();
  const specialists = new Map<string, { email: string; display_name: string }>();

  for (const r of rows) {
    if (!r.specialist_email) continue;
    const wide = byBucket.get(r.bucket_start) ?? { bucket: r.bucket_start };
    (wide as Record<string, unknown>)[r.specialist_email] = Number(r.item_count);
    byBucket.set(r.bucket_start, wide);
    specialists.set(r.specialist_email, {
      email: r.specialist_email,
      display_name: r.specialist_display_name ?? r.specialist_email,
    });
  }

  const sortedSpecialists = [...specialists.values()]
    .sort((a, b) => a.display_name.localeCompare(b.display_name))
    .map((p) => p.email);
  const emailToDisplayName = new Map(
    [...specialists.values()].map((p) => [p.email, p.display_name]),
  );

  const wide = [...byBucket.values()].sort((a, b) =>
    String(a.bucket).localeCompare(String(b.bucket)),
  );

  // Defensive backfill — every wide row gets a numeric 0 for every active specialist.
  for (const row of wide) {
    for (const email of sortedSpecialists) {
      if (typeof row[email] !== 'number') row[email] = 0;
    }
  }

  return { wide, sortedSpecialists, emailToDisplayName };
}

export function ItemsPerSpecialistChart() {
  const query = useItemsPerSpecialist();

  return (
    <section
      className="rounded-lg border border-rule bg-bg p-4 mt-8"
      data-testid="app-03-card"
    >
      <div className="flex items-baseline justify-between mb-2">
        <h2 className="text-sm font-semibold text-ink-2">Items per specialist</h2>
        <span className="text-sm text-ink-3">Last 14 days</span>
      </div>
      <div className="h-72">
        {query.isLoading ? (
          <div
            className="h-full w-full animate-pulse rounded bg-bg-3"
            data-testid="items-per-specialist-skeleton"
            aria-busy="true"
          />
        ) : query.error ? (
          <ErrorState
            heading="Couldn't load items per specialist"
            body="Something went wrong. Retry below."
            onRetry={() => void query.refetch()}
          />
        ) : (
          (() => {
            const { wide, sortedSpecialists, emailToDisplayName } = pivotForRecharts(
              query.data ?? [],
            );
            if (wide.length === 0 || sortedSpecialists.length === 0) {
              return (
                <div
                  className="flex h-full items-center justify-center"
                  data-testid="items-per-specialist-empty"
                >
                  <EmptyState heading="No items in the last 14 days">
                    <p>The TPC team hasn't cataloged anything yet in this window.</p>
                  </EmptyState>
                </div>
              );
            }
            return (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={wide} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                  <CartesianGrid stroke="var(--rule)" vertical={false} />
                  <XAxis
                    dataKey="bucket"
                    tickFormatter={(v: string) => formatInTimeZone(v, ET, 'M/d')}
                  />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend
                    formatter={(value: string) => emailToDisplayName.get(value) ?? value}
                  />
                  {sortedSpecialists.map((email) => (
                    <Bar
                      key={email}
                      dataKey={email}
                      stackId="items"
                      fill={colorForSpecialist(email, sortedSpecialists)}
                      isAnimationActive={false}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            );
          })()
        )}
      </div>
    </section>
  );
}
