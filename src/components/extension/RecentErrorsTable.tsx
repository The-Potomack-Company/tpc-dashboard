import { useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { SortIndicator } from '../SortIndicator';
import { TableSkeleton } from '../TableSkeleton';
import { EmptyState } from '../EmptyState';
import { ErrorState } from '../ErrorState';
import { PayloadViewerModal } from '../kit/PayloadViewerModal';
import { useRecentErrors } from '../../hooks/extension/useRecentErrors';
import { useAuthStore } from '../../stores/authStore';
import { isDevAccount } from '../../lib/devAccess';
import { formatTimestampShort, EMPTY } from '../../lib/format';
import type { EventRow } from '../../services/extension/queries';

// Phase 2 / EXT-05 + EXT-06 — Recent Errors table with dev-gated payload viewer.
//
// D-18 INVARIANT (the load-bearing UX boundary for the dev panel concept):
//   - Admin sees the row + the Payload column header but the cells are blank.
//     The row click is a no-op (no cursor-pointer, no modal open).
//   - Dev sees a `View →` button per row that opens PayloadViewerModal with
//     the row's items_content payload.
//
// One TanStack Table instance regardless of dev/admin (Open Question 2 / Q9):
// the dev gate is per-cell, not at the table boundary. The PayloadViewerModal
// is lifted into THIS component (single instance, opened by per-row View
// buttons) — Plan 02-08's page never owns the modal.
//
// Default sort: created_at desc (newest error on top). The Payload column is
// not sortable.

const COLUMN_WIDTHS = ['w-24', 'w-48', 'w-32', 'w-full', 'w-16', 'w-12'];

interface ModalState {
  open: boolean;
  title: string;
  payload: unknown;
}

export function RecentErrorsTable() {
  const query = useRecentErrors();
  const email = useAuthStore((s) => s.profile?.email);
  const isDev = isDevAccount(email);

  const [modal, setModal] = useState<ModalState>({
    open: false,
    title: 'Payload',
    payload: null,
  });
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'created_at', desc: true },
  ]);

  // Columns are declared inside the component because the Payload cell
  // closes over `isDev` + setModal. The cost is recomputing the array per
  // render — negligible for a 6-column table.
  const columns: ColumnDef<EventRow>[] = [
    {
      accessorKey: 'created_at',
      header: 'Time',
      cell: (info) => (
        <span className="tabular-nums text-err">
          {formatTimestampShort(info.getValue<string>())}
        </span>
      ),
    },
    {
      accessorKey: 'user_email',
      header: 'User',
      cell: (info) => (
        <span className="text-ink-2">
          {info.getValue<string | null>() ?? EMPTY}
        </span>
      ),
    },
    {
      accessorKey: 'event_type',
      header: 'Event',
      cell: (info) => <span className="text-ink-2">{info.getValue<string>()}</span>,
    },
    {
      accessorKey: 'error_message',
      header: 'Error',
      cell: (info) => (
        <span className="text-err truncate" title={info.getValue<string | null>() ?? undefined}>
          {info.getValue<string | null>() ?? EMPTY}
        </span>
      ),
    },
    {
      accessorKey: 'extension_version',
      header: 'Version',
      cell: (info) => (
        <span className="tabular-nums text-ink-3">
          {info.getValue<string | null>() ?? EMPTY}
        </span>
      ),
    },
    {
      id: 'payload',
      header: 'Payload',
      enableSorting: false,
      cell: (info) => {
        if (!isDev) return null;
        const row = info.row.original;
        return (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setModal({
                open: true,
                title: `${row.event_type} payload — ${row.user_email ?? 'unknown'}`,
                payload: row.items_content,
              });
            }}
            aria-haspopup="dialog"
            className="text-sm text-ink-2 hover:text-accent focus:ring-2 focus:ring-accent rounded outline-none"
          >
            View →
          </button>
        );
      },
    },
  ];

  const table = useReactTable({
    data: query.data ?? [],
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (query.isLoading) {
    // TableSkeleton renders <tbody>; wrap in <table> so it's valid HTML.
    return (
      <table className="w-full text-sm">
        <TableSkeleton rows={5} columnWidths={COLUMN_WIDTHS} />
      </table>
    );
  }

  if (query.error) {
    // LOCKED Phase 1 ErrorState contract: heading + body (string) + onRetry.
    return (
      <ErrorState
        heading="Couldn't load recent errors"
        body="Retry below."
        onRetry={() => void query.refetch()}
      />
    );
  }

  if ((query.data ?? []).length === 0) {
    return (
      <EmptyState heading="No errors in this range">
        Nothing in the selected window. The extension is having a quiet stretch.
      </EmptyState>
    );
  }

  return (
    <>
      <div className="max-h-[28rem] overflow-y-auto">
        <table className="w-full text-sm" data-testid="recent-errors-table">
          <thead className="border-b border-rule bg-bg-2 text-left sticky top-0">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="h-11">
                {hg.headers.map((h) => {
                  const sortable = h.column.getCanSort();
                  const sorted = h.column.getIsSorted() as 'asc' | 'desc' | false;
                  // Non-sortable columns omit aria-sort entirely.
                  const ariaSort: 'ascending' | 'descending' | 'none' | undefined =
                    !sortable
                      ? undefined
                      : sorted === 'asc'
                        ? 'ascending'
                        : sorted === 'desc'
                          ? 'descending'
                          : 'none';
                  return (
                    <th
                      key={h.id}
                      scope="col"
                      className={`px-4 text-sm font-semibold text-ink-2 select-none ${
                        sortable ? 'cursor-pointer' : ''
                      }`}
                      onClick={sortable ? h.column.getToggleSortingHandler() : undefined}
                      aria-sort={ariaSort}
                    >
                      <span className="inline-flex items-center gap-1">
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        {sortable && <SortIndicator state={sorted ?? false} />}
                      </span>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((r) => (
              <tr
                key={r.id}
                // Every row in this table represents an error by definition
                // (D-03: error_message IS NOT NULL filter is on the query).
                // UI-SPEC § Color "Error indicator on live-feed rows" — left-
                // border-red treatment makes the error nature scannable.
                className="h-11 border-b border-rule border-l-2 border-l-red-500 hover:bg-bg-2"
              >
                {r.getVisibleCells().map((c) => (
                  <td key={c.id} className="px-4">
                    {flexRender(c.column.columnDef.cell, c.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <PayloadViewerModal
        open={modal.open}
        onClose={() => setModal((m) => ({ ...m, open: false }))}
        title={modal.title}
        payload={modal.payload}
      />
    </>
  );
}
