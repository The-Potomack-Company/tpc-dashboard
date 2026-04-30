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
import { formatCount, formatTimestampShort, EMPTY } from '../../lib/format';
import { usePerUserSummary } from '../../hooks/extension/usePerUserSummary';
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

const COLUMN_WIDTHS = ['w-48', 'w-12', 'w-12', 'w-12', 'w-12', 'w-12', 'w-12', 'w-20'];

// Cell renderer for numeric columns. Lifted out so the same renderer is used
// for the 5 event-type columns AND the Errors column.
function NumberCell({ value }: { value: number | null | undefined }) {
  return <span className="tabular-nums">{formatCount(Number(value ?? 0))}</span>;
}

const columns: ColumnDef<PerUserRow>[] = [
  {
    accessorKey: 'user_email_label',
    header: 'User',
    cell: (info) => {
      const v = info.getValue<string>();
      return v === 'Unknown' ? (
        <span className="italic text-gray-500">Unknown</span>
      ) : (
        <span className="text-gray-700">{v}</span>
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
  {
    accessorKey: 'total_errors',
    header: 'Errors',
    cell: (info) => <NumberCell value={info.getValue<number>()} />,
  },
  {
    accessorKey: 'last_seen_at',
    header: 'Last seen',
    cell: (info) => {
      const v = info.getValue<string | null>();
      return (
        <span className="tabular-nums text-gray-500">
          {v ? formatTimestampShort(v) : EMPTY}
        </span>
      );
    },
  },
];

// Numeric columns get text-right + tabular-nums. The first column (User) is
// left-aligned; the last column (Last seen) is left-aligned numeric (timestamp).
// Indices 1..6 are the 5 event-type counts + Errors.
function isNumericColumn(idx: number): boolean {
  return idx >= 1 && idx <= 6;
}

export function PerUserTable() {
  const query = usePerUserSummary();
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'last_seen_at', desc: true },
  ]);

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
      <table className="w-full text-sm">
        <TableSkeleton rows={5} columnWidths={COLUMN_WIDTHS} />
      </table>
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
    <table className="w-full text-sm" data-testid="per-user-table">
      <thead className="border-b border-gray-200 bg-gray-50 text-left">
        {table.getHeaderGroups().map((hg) => (
          <tr key={hg.id} className="h-11">
            {hg.headers.map((h, idx) => {
              const sorted = h.column.getIsSorted() as 'asc' | 'desc' | false;
              return (
                <th
                  key={h.id}
                  scope="col"
                  className={`px-4 cursor-pointer text-sm font-semibold text-gray-700 select-none ${
                    isNumericColumn(idx) ? 'text-right' : ''
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
            className="h-11 border-b border-gray-100 hover:bg-gray-50"
          >
            {r.getVisibleCells().map((c, idx) => (
              <td
                key={c.id}
                className={`px-4 ${isNumericColumn(idx) ? 'text-right' : ''}`}
              >
                {flexRender(c.column.columnDef.cell, c.getContext())}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
