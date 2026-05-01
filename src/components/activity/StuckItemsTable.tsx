import { useState } from 'react';
import { useNavigate } from 'react-router';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { useAuthStore } from '../../stores/authStore';
import { isDevAccount } from '../../lib/devAccess';
import { useStuckItems } from '../../hooks/activity/useStuckItems';
import { PayloadViewerModal } from '../kit/PayloadViewerModal';
import { ErrorState } from '../ErrorState';
import { EmptyState } from '../EmptyState';
import { TableSkeleton } from '../TableSkeleton';
import { SortIndicator } from '../SortIndicator';
import { formatAge, EMPTY } from '../../lib/format';
import type { StuckItemsRow } from '../../services/activity/queries';

// Phase 3 / APP-11 / D-23 / D-28 — Stuck items page table.
//
// D-23: filters from /activity NOT inherited — page is its own context (the
// /activity/stuck route owner does not pass `?specialists=` or `?mode=`).
// This component just consumes `useStuckItems()` which DOES read the URL
// state — Plan 03-08's StuckItems page will simply mount the component
// without the filter row.
//
// Default sort: age desc (oldest first) using created_at as the comparator.
// Rows are clickable AND keyboard-focusable; Enter/Space triggers navigation
// to /activity/sessions/<row.session_id>.
//
// Column shape:
//   admin: Receipt # | Title | AI status | Age | Session | Specialist
//   dev:   admin + Category | Estimate | Raw
// Dev "Raw" cell renders a button that opens PayloadViewerModal with the
// row's full payload (mirrors the EXT-06 RecentErrorsTable pattern).

const ADMIN_WIDTHS = ['w-24', 'w-full', 'w-24', 'w-16', 'w-32', 'w-32'];
const DEV_WIDTHS = ['w-24', 'w-full', 'w-24', 'w-16', 'w-32', 'w-32', 'w-24', 'w-16', 'w-12'];

const AI_STATUS_TONE: Record<string, string> = {
  pending:    'bg-gray-100 text-gray-700',
  processing: 'bg-sky-100 text-sky-700',
  queued:     'bg-amber-100 text-amber-800',
  done:       'bg-green-100 text-green-700',
  failed:     'bg-red-100 text-red-700',
};

interface ModalState {
  open: boolean;
  row: StuckItemsRow | null;
}

export function StuckItemsTable() {
  const email = useAuthStore(
    (s: unknown) => (s as { profile: { email?: string | null } | null }).profile?.email,
  );
  const isDev = isDevAccount(email ?? null);
  const navigate = useNavigate();
  const query = useStuckItems();
  const [sorting, setSorting] = useState<SortingState>([{ id: 'age', desc: true }]);
  const [modal, setModal] = useState<ModalState>({ open: false, row: null });

  const baseColumns: ColumnDef<StuckItemsRow>[] = [
    {
      id: 'receipt_number',
      accessorKey: 'receipt_number',
      header: 'Receipt #',
      cell: (info) => (info.getValue() as string | null) ?? EMPTY,
    },
    {
      id: 'title',
      accessorKey: 'title',
      header: 'Title',
      cell: (info) => (info.getValue() as string | null) ?? EMPTY,
    },
    {
      id: 'ai_status',
      accessorKey: 'ai_status',
      header: 'AI status',
      cell: (info) => {
        const status = info.getValue() as string;
        const tone = AI_STATUS_TONE[status] ?? 'bg-gray-100 text-gray-700';
        return (
          <span
            className={`px-2 py-0.5 rounded text-xs font-semibold ${tone}`}
          >
            {status}
          </span>
        );
      },
    },
    {
      id: 'age',
      accessorKey: 'created_at',
      header: 'Age',
      cell: (info) => formatAge(info.getValue() as string),
      // Sort comparator on AGE (not raw timestamp): older = bigger age,
      // so "age desc" sort surfaces the oldest items first. We compute
      // (b.created_at - a.created_at) so a smaller created_at (older)
      // returns a positive number, ranking it later when ascending —
      // and earlier when descending. This matches the locked default
      // sorting state below: { id: 'age', desc: true } → oldest first.
      sortingFn: (a, b) =>
        new Date(b.original.created_at).getTime() -
        new Date(a.original.created_at).getTime(),
    },
    {
      id: 'session',
      accessorKey: 'session_name',
      header: 'Session',
      cell: (info) => (info.getValue() as string | null) ?? EMPTY,
    },
    {
      id: 'specialist',
      accessorKey: 'specialist_display_name',
      header: 'Specialist',
      cell: (info) => (info.getValue() as string | null) ?? EMPTY,
    },
  ];

  const devColumns: ColumnDef<StuckItemsRow>[] = isDev
    ? [
        {
          id: 'category',
          accessorKey: 'category',
          header: 'Category',
          cell: (info) => (info.getValue() as string | null) ?? EMPTY,
        },
        {
          id: 'estimate',
          accessorKey: 'estimate',
          header: 'Estimate',
          cell: (info) => (info.getValue() as string | null) ?? EMPTY,
        },
        {
          id: 'raw',
          header: 'Raw',
          enableSorting: false,
          cell: ({ row }) => (
            <button
              type="button"
              onClick={(e) => {
                // Don't bubble — row click would otherwise navigate.
                e.stopPropagation();
                setModal({ open: true, row: row.original });
              }}
              aria-haspopup="dialog"
              className="text-sm text-gray-700 hover:text-accent focus:ring-2 focus:ring-accent rounded outline-none"
            >
              View →
            </button>
          ),
        },
      ]
    : [];

  const columns = [...baseColumns, ...devColumns];

  const table = useReactTable({
    data: query.data ?? [],
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const rowCount = query.data?.length ?? 0;

  function navigateToSession(sessionId: string) {
    navigate(`/activity/sessions/${sessionId}`);
  }

  return (
    <section
      className="rounded-lg border border-gray-200 bg-white p-4 mt-8"
      data-testid="stuck-items-table"
    >
      {rowCount > 0 && (
        <header className="mb-2">
          <span className="text-xs text-gray-500">
            {rowCount} {rowCount === 1 ? 'stuck item' : 'stuck items'}
          </span>
        </header>
      )}

      {query.isLoading ? (
        <table className="w-full text-sm">
          <TableSkeleton
            rows={10}
            columnWidths={isDev ? DEV_WIDTHS : ADMIN_WIDTHS}
          />
        </table>
      ) : query.error ? (
        <ErrorState
          heading="Couldn't load stuck items"
          body="Retry below."
          onRetry={() => void query.refetch()}
        />
      ) : rowCount === 0 ? (
        <EmptyState heading="No stuck items">
          <p>Everything is moving through the AI pipeline.</p>
        </EmptyState>
      ) : (
        <>
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-left">
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id} className="h-11">
                  {hg.headers.map((h) => {
                    const sortable = h.column.getCanSort();
                    const sorted = h.column.getIsSorted() as 'asc' | 'desc' | false;
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
                        className={`px-4 text-sm font-semibold text-gray-700 select-none ${
                          sortable ? 'cursor-pointer' : ''
                        }`}
                        aria-sort={ariaSort}
                        onClick={
                          sortable ? h.column.getToggleSortingHandler() : undefined
                        }
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
              {table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="h-11 border-b border-gray-100 hover:bg-gray-50 cursor-pointer focus:ring-2 focus:ring-accent outline-none"
                  tabIndex={0}
                  onClick={() => navigateToSession(row.original.session_id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      navigateToSession(row.original.session_id);
                    }
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <PayloadViewerModal
            open={modal.open}
            onClose={() => setModal({ open: false, row: null })}
            title={`Raw stuck item — ${modal.row?.receipt_number ?? modal.row?.item_id ?? ''}`}
            payload={modal.row}
          />
        </>
      )}
    </section>
  );
}
