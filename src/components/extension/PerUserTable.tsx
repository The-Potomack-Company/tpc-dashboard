import { useMemo, useState } from 'react';
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
import { formatCount, formatTimestampShort, EMPTY } from '../../lib/format';
import { usePerUserSummary } from '../../hooks/extension/usePerUserSummary';
import { useAuthStore } from '../../stores/authStore';
import type { PerUserRow } from '../../services/extension/queries';

// Phase 2 / EXT-04 — Sortable per-user wide-pivot table.
//
// Columns: User | catalog_single | catalog_batch | portal_upload |
//          spreadsheet_transform | data_import | Errors | Last seen
//
// Default sort: last_seen_at desc (most-recent user on top).
// D-04: Unknown rows render in italic muted gray on the User cell.
// D-21: per-card loading (TableSkeleton) / empty (EmptyState) / error
//       (ErrorState with the LOCKED Phase 1 contract — heading + body string +
//       onRetry; no children, no sibling Retry button).
//
// The Phase 1 SortIndicator already accepts the v8 sort-state shape
// ('asc' | 'desc' | false) — cast h.column.getIsSorted() to that union.

// Skeleton shimmer-bar widths — dev includes the "Errors" column
// (8 columns total), admin drops it (7 columns). Phase 8: errors is a
// failure-count metric and is dev-only per the user directive "admin
// shouldn't see failures".
//
// These widths are used ONLY by TableSkeleton's inner shimmer bars to
// approximate cell content size during loading. The rendered table itself
// no longer pins column widths — the parent wraps `<table>` in an
// overflow-x-auto container so columns can size naturally and the table
// can scroll horizontally if it overflows the card.
const SKELETON_WIDTHS_DEV   = ['w-48', 'w-12', 'w-12', 'w-12', 'w-12', 'w-12', 'w-12', 'w-20'];
const SKELETON_WIDTHS_ADMIN = ['w-48', 'w-12', 'w-12', 'w-12', 'w-12', 'w-12',        'w-20'];

// Cell renderer for numeric columns. Lifted out so the same renderer is used
// for the 5 event-type columns AND the Errors column.
function NumberCell({ value }: { value: number | null | undefined }) {
  return <span className="tabular-nums">{formatCount(Number(value ?? 0))}</span>;
}

const BASE_COLUMNS: ColumnDef<PerUserRow>[] = [
  {
    accessorKey: 'user_email_label',
    header: 'User',
    cell: (info) => {
      const v = info.getValue<string>();
      return v === 'Unknown' ? (
        <span className="italic text-ink-3">Unknown</span>
      ) : (
        <span className="text-ink-2">{v}</span>
      );
    },
  },
  {
    accessorKey: 'catalog_single',
    header: 'catalog_single',
    cell: (info) => <NumberCell value={info.getValue<number>()} />,
  },
  {
    accessorKey: 'catalog_batch',
    header: 'catalog_batch',
    cell: (info) => <NumberCell value={info.getValue<number>()} />,
  },
  {
    accessorKey: 'portal_upload',
    header: 'portal_upload',
    cell: (info) => <NumberCell value={info.getValue<number>()} />,
  },
  {
    accessorKey: 'spreadsheet_transform',
    header: 'spreadsheet_transform',
    cell: (info) => <NumberCell value={info.getValue<number>()} />,
  },
  {
    accessorKey: 'data_import',
    header: 'data_import',
    cell: (info) => <NumberCell value={info.getValue<number>()} />,
  },
];

const ERRORS_COLUMN: ColumnDef<PerUserRow> = {
  accessorKey: 'total_errors',
  header: 'Errors',
  cell: (info) => <NumberCell value={info.getValue<number>()} />,
};

const LAST_SEEN_COLUMN: ColumnDef<PerUserRow> = {
  accessorKey: 'last_seen_at',
  header: 'Last seen',
  cell: (info) => {
    const v = info.getValue<string | null>();
    return (
      <span className="tabular-nums text-ink-3">
        {v ? formatTimestampShort(v) : EMPTY}
      </span>
    );
  },
};

// Numeric-alignment helper. Index map depends on whether the Errors column
// is present:
//   dev   (8 cols): User | 5 event counts | Errors    | Last seen
//                    0       1..5            6            7
//   admin (7 cols): User | 5 event counts |            | Last seen
//                    0       1..5                          6
// Indices 1..5 (event counts) are always numeric. Index 6 is numeric for
// dev (Errors) and the timestamp column (left-aligned, not text-right) for
// admin — so admin's index 6 is NOT in the numeric set.
function isNumericColumn(idx: number, isDev: boolean): boolean {
  if (isDev) return idx >= 1 && idx <= 6;
  return idx >= 1 && idx <= 5;
}

export function PerUserTable() {
  const query = usePerUserSummary();
  const isDev = useAuthStore((s) => s.isDev);
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'last_seen_at', desc: true },
  ]);

  // Phase 8: Errors is a failure-count metric — dev only. Compose columns
  // per role so admin never sees the count of failures per user (the user
  // directive is "admin shouldn't see failures").
  const columns = useMemo<ColumnDef<PerUserRow>[]>(
    () =>
      isDev
        ? [...BASE_COLUMNS, ERRORS_COLUMN, LAST_SEEN_COLUMN]
        : [...BASE_COLUMNS, LAST_SEEN_COLUMN],
    [isDev],
  );

  const skeletonWidths = isDev ? SKELETON_WIDTHS_DEV : SKELETON_WIDTHS_ADMIN;

  const table = useReactTable({
    data: query.data ?? [],
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (query.isLoading) {
    // TableSkeleton renders <tbody>; wrap in a <table> so it's valid HTML.
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <TableSkeleton rows={5} columnWidths={skeletonWidths} />
        </table>
      </div>
    );
  }

  if (query.error) {
    // LOCKED Phase 1 ErrorState contract: heading + body (string) + onRetry.
    return (
      <ErrorState
        heading="Couldn't load per-user data"
        body="Retry below."
        onRetry={() => void query.refetch()}
      />
    );
  }

  if ((query.data ?? []).length === 0) {
    return (
      <EmptyState heading="No users in this range">
        Try widening the date range or clearing the user filter.
      </EmptyState>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" data-testid="per-user-table">
        <thead className="border-b border-rule bg-bg-2 text-left">
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id} className="h-11">
              {hg.headers.map((h, idx) => {
                const sorted = h.column.getIsSorted() as 'asc' | 'desc' | false;
                return (
                  <th
                    key={h.id}
                    scope="col"
                    className={`px-4 cursor-pointer text-sm font-semibold text-ink-2 select-none ${
                      isNumericColumn(idx, isDev) ? 'text-right' : ''
                    }`}
                    aria-sort={
                      sorted === 'asc'
                        ? 'ascending'
                        : sorted === 'desc'
                          ? 'descending'
                          : 'none'
                    }
                    onClick={h.column.getToggleSortingHandler()}
                  >
                    <span className="inline-flex items-center gap-1">
                      {flexRender(h.column.columnDef.header, h.getContext())}
                      <SortIndicator state={sorted ?? false} />
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
              className="h-11 border-b border-rule hover:bg-bg-2"
            >
              {r.getVisibleCells().map((c, idx) => (
                <td
                  key={c.id}
                  className={`px-4 ${isNumericColumn(idx, isDev) ? 'text-right' : ''}`}
                >
                  {flexRender(c.column.columnDef.cell, c.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
