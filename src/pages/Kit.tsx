import { useState } from 'react';
import { Sparkline } from '../components/kit/Sparkline';
import { KpiCard } from '../components/kit/KpiCard';
import { PayloadViewerModal } from '../components/kit/PayloadViewerModal';
import { DateRangeFilter } from '../components/kit/DateRangeFilter';
import { useDateRange } from '../hooks/useDateRange';
import { useTimezone } from '../hooks/useTimezone';

// Phase 1 / INFR-03 — dev-only /kit demo page (D-11).
// Gated by import.meta.env.DEV in src/App.tsx so Vite tree-shakes this file
// (and everything it imports uniquely) out of production bundles. Verified
// by scripts/verify-no-kit-in-dist.mjs after `npm run build`.

// Sample data for primitives.
const SPARKLINE_UP = Array.from({ length: 14 }, (_, i) => ({
  x: i,
  y: 10 + i * 2 + Math.sin(i) * 3,
}));
const SPARKLINE_DOWN = Array.from({ length: 14 }, (_, i) => ({
  x: i,
  y: 40 - i * 2 + Math.cos(i) * 4,
}));
const SPARKLINE_FLAT = Array.from({ length: 14 }, (_, i) => ({
  x: i,
  y: 20 + Math.sin(i) * 1.5,
}));

// Extension-shaped payload (matches analytics_events migration 001 catalog_batch row — RESEARCH § Open Question 5).
const SAMPLE_PAYLOAD = {
  id: '8f7c9a12-3b4d-5e6f-7890-123456789abc',
  event_type: 'catalog_batch',
  user_email: 'specialist@tpc.example',
  extension_version: '2.0.1',
  created_at: '2026-04-24T17:32:11Z',
  session_id: 'a1b2c3d4-5678-9012-abcd-ef1234567890',
  total_items: 8,
  success_count: 7,
  skipped_count: 0,
  error_count: 1,
  execution_time_ms: 42137,
  cancelled: false,
  error_message: 'Lot 42: title field failed validation (too long)',
  items_content: [
    { receipt_number: 'R100', category_id: 'ceramics', photo_count: 3 },
    { receipt_number: 'R101', category_id: 'glass', photo_count: 2 },
  ],
};

export function KitPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const { range, from, to } = useDateRange();
  const { formatRange, formatDateTime } = useTimezone();

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-8">
      <header>
        <h1 className="text-2xl font-bold text-ink">UI Kit — Dev Demo</h1>
        <p className="mt-1 text-sm text-ink-2">
          Renders every shared v2.0 primitive in multiple states. Dev-only: tree-shaken from production via{' '}
          <code className="rounded bg-bg-3 px-1 py-0.5 text-xs">import.meta.env.DEV</code>.
        </p>
      </header>

      {/* --- DateRangeFilter --- */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-ink">&lt;DateRangeFilter&gt;</h2>
        <p className="text-sm text-ink-2">
          URL-bound. Range: <code>{range}</code>. Window: {formatRange(from, to)}.
        </p>
        <DateRangeFilter />
      </section>

      {/* --- Sparkline: 3 shapes --- */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-ink">&lt;Sparkline&gt;</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded border border-rule bg-bg p-4">
            <div className="mb-1 text-xs uppercase text-ink-3">Up</div>
            <div className="text-emerald-600">
              <Sparkline data={SPARKLINE_UP} />
            </div>
          </div>
          <div className="rounded border border-rule bg-bg p-4">
            <div className="mb-1 text-xs uppercase text-ink-3">Down</div>
            <div className="text-err">
              <Sparkline data={SPARKLINE_DOWN} />
            </div>
          </div>
          <div className="rounded border border-rule bg-bg p-4">
            <div className="mb-1 text-xs uppercase text-ink-3">Flat</div>
            <div className="text-ink-3">
              <Sparkline data={SPARKLINE_FLAT} />
            </div>
          </div>
        </div>
      </section>

      {/* --- KpiCard: loading, plain, with delta up/down/flat, with sparkline --- */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-ink">&lt;KpiCard&gt;</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <KpiCard label="Loading" value="" loading />
          <KpiCard label="Sessions today" value={42} />
          <KpiCard
            label="Items cataloged"
            value={1234}
            delta={{ value: '+12%', direction: 'up', label: 'vs last week' }}
          />
          <KpiCard
            label="Errors"
            value={5}
            delta={{ value: '-50%', direction: 'down', label: 'vs last week' }}
          />
          <KpiCard
            label="Active sessions"
            value={3}
            delta={{ value: '0', direction: 'flat', label: 'vs last week' }}
          />
          <KpiCard
            label="Catalog batch"
            value={87}
            delta={{ value: '+8%', direction: 'up', label: 'vs 7d ago' }}
            sparkline={<Sparkline data={SPARKLINE_UP} stroke="currentColor" />}
          />
        </div>
      </section>

      {/* --- PayloadViewerModal --- */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-ink">&lt;PayloadViewerModal&gt;</h2>
        <p className="text-sm text-ink-2">
          Click below to open with a sample catalog_batch event payload.
        </p>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="rounded-md bg-bg px-3 py-1.5 text-sm font-medium text-accent-ink hover:bg-bg-2"
        >
          Open payload viewer
        </button>
        <PayloadViewerModal
          payload={SAMPLE_PAYLOAD}
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title="catalog_batch event payload"
        />
      </section>

      {/* --- useTimezone spot-check --- */}
      <section className="space-y-2 border-t border-rule pt-6">
        <h2 className="text-lg font-semibold text-ink">useTimezone spot-check</h2>
        <ul className="space-y-1 text-sm text-ink-2">
          <li>Now (ET): <code>{formatDateTime(new Date())}</code></li>
          <li>
            Jan 15, 2026 17:00 UTC → <code>{formatDateTime(new Date('2026-01-15T17:00:00Z'))}</code> (should read "12:00 PM ET" — winter/EST)
          </li>
          <li>
            Jul 15, 2026 16:00 UTC → <code>{formatDateTime(new Date('2026-07-15T16:00:00Z'))}</code> (should read "12:00 PM ET" — summer/EDT)
          </li>
        </ul>
      </section>
    </div>
  );
}
