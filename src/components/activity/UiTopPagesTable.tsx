// src/components/activity/UiTopPagesTable.tsx
// Phase 3 / D-32 / D-34 — Top page paths table.
//
// Range-driven via useUiTopPages (which reads useDateRange only — D-34 spec:
// specialist + mode do NOT apply to the dev panel). Underlying RPC
// (get_ui_top_pages) and service layer enforce `app_source = 'tpc-app'` per
// D-33; this component is unaware of that invariant.
//
// Sortable TanStack v8 table:
//   - Columns: Path (left), Views (right, numeric, tabular-nums)
//   - Default sort: views desc
//
// Per-card states (D-35): TableSkeleton (6 rows × 2 cols) / EmptyState /
// locked ErrorState contract.

import { useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { useUiTopPages } from '../../hooks/activity/useUiTopPages';
import { ErrorState } from '../ErrorState';
import { EmptyState } from '../EmptyState';
import { TableSkeleton } from '../TableSkeleton';
import { SortIndicator } from '../SortIndicator';
import { formatCount } from '../../lib/format';
import type { UiTopPagesRow } from '../../services/activity/queries';

const COLUMN_WIDTHS = ['w-full', 'w-16'];

const columns: ColumnDef<UiTopPagesRow>[] = [
  {
    id: 'page_path',
    accessorKey: 'page_path',
    header: 'Path',
    cell: (info) => (
      <span className="font-mono text-sm break-all text-ink-2">
        {info.getValue<string>()}
      </span>
    ),
  },
  {
    id: 'view_count',
    accessorKey: 'view_count',
    header: 'Views',
    cell: (info) => (
      <span className="tabular-nums">
        {formatCount(Number(info.getValue<number>() ?? 0))}
      </span>
    ),
    sortingFn: (a, b) =>
      Number(a.original.view_count) - Number(b.original.view_count),
  },
];

export function UiTopPagesTable() {
  const query = useUiTopPages();
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'view_count', desc: true },
  ]);

  const table = useReactTable({
    data: query.data ?? [],
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <section
      className="rounded border border-rule bg-bg p-4"
      data-testid="ui-top-pages-table"
    >
      <header className="flex items-baseline justify-between mb-2">
        <h4 className="text-sm font-semibold text-ink-2">Top page paths</h4>
        <span className="text-xs text-ink-3">
          Top 10 by view count · selected range
        </span>
      </header>
      {query.isLoading ? (
        // TableSkeleton renders <tbody>; wrap in a <table> so it's valid HTML.
        <table className="w-full text-sm">
          <TableSkeleton rows={6} columnWidths={COLUMN_WIDTHS} />
        </table>
      ) : query.error ? (
        // LOCKED Phase 1 ErrorState contract — heading + body + onRetry; no
        // children, no sibling Retry button (D-35).
        <ErrorState
          heading="Couldn't load top pages"
          body="Retry below."
          onRetry={() => void query.refetch()}
        />
      ) : (query.data ?? []).length === 0 ? (
        <EmptyState heading="No views in this range">
          <p>Try widening the date range.</p>
        </EmptyState>
      ) : (
        <table className="w-full text-sm">
          <thead className="border-b border-rule bg-bg-2 text-left">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="h-10">
                {hg.headers.map((h, idx) => {
                  const sorted = h.column.getIsSorted() as
                    | 'asc'
                    | 'desc'
                    | false;
                  const isNumeric = idx === 1;
                  return (
                    <th
                      key={h.id}
                      scope="col"
                      className={`px-3 cursor-pointer text-sm font-semibold text-ink-2 select-none ${
                        isNumeric ? 'text-right' : ''
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
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className="h-10 border-b border-rule hover:bg-bg-2"
              >
                {row.getVisibleCells().map((cell, idx) => (
                  <td
                    key={cell.id}
                    className={`px-3 ${
                      idx === 1 ? 'text-right tabular-nums' : ''
                    }`}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
