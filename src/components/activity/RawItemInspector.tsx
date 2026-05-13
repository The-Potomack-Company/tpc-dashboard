import { useState } from 'react';
import { PayloadViewerModal } from '../kit/PayloadViewerModal';
import type { ItemListRow } from '../../services/activity/queries';

// Phase 3 / D-27 / D-28 — dev-only Raw Item Inspector.
//
// IMPORTANT: NOT internally gated. The caller (SessionItemDisclosure) is
// responsible for wrapping this component in an `isDevAccount(profile?.email)`
// branch. The render-conditional pattern is used (NOT `display: hidden`)
// so the dev-only DOM never reaches the admin's browser at all (T-03-27).
//
// Renders a 5-line preview of common item fields followed by a "View full
// JSON" button that opens a PayloadViewerModal with the full item record.
// Pattern mirrors RecentErrorsTable.tsx (Phase 2 EXT-06) — both consume
// PayloadViewerModal as the dev-payload viewer.

interface Props {
  item: ItemListRow;
}

export function RawItemInspector({ item }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-t border-rule pt-4 mt-4" data-testid="raw-item-inspector">
      <h3 className="text-sm font-semibold text-ink-2">Raw item data</h3>
      <dl className="mt-2 space-y-2 text-sm">
        {item.transcript && (
          <div>
            <dt className="font-semibold text-ink-2">Transcript</dt>
            <dd className="text-ink whitespace-pre-wrap line-clamp-3">{item.transcript}</dd>
          </div>
        )}
        {item.description && (
          <div>
            <dt className="font-semibold text-ink-2">Description</dt>
            <dd className="text-ink line-clamp-2">{item.description}</dd>
          </div>
        )}
        {item.measurements && (
          <div>
            <dt className="font-semibold text-ink-2">Measurements</dt>
            <dd className="text-ink">{item.measurements}</dd>
          </div>
        )}
        {item.estimate && (
          <div>
            <dt className="font-semibold text-ink-2">Estimate</dt>
            <dd className="text-ink">{item.estimate}</dd>
          </div>
        )}
      </dl>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm font-semibold text-accent hover:text-accent-hover focus:ring-2 focus:ring-accent rounded outline-none mt-3"
        aria-haspopup="dialog"
      >
        View full JSON →
      </button>
      <PayloadViewerModal
        open={open}
        onClose={() => setOpen(false)}
        title={`Raw item — ${item.receipt_number ?? item.id}`}
        payload={item}
      />
    </div>
  );
}
