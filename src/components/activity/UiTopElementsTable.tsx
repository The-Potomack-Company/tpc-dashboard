// src/components/activity/UiTopElementsTable.tsx
// Phase 3 / D-32 / D-34 — Top element clicks table.
//
// Range-driven via useUiTopElements (which reads useDateRange only — D-34
// spec: specialist + mode do NOT apply to the dev panel). Underlying RPC
// (get_ui_top_elements) and service layer enforce `app_source = 'tpc-app'`
// per D-33.
//
// Sortable TanStack v8 table:
//   - Columns: Element ID (left), Clicks (right, numeric, tabular-nums)
//   - Default sort: clicks desc
//
// Per-card states (D-35): TableSkeleton (8 rows × 2 cols) / EmptyState /
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
import { useUiTopElements } from '../../hooks/activity/useUiTopElements';
import { ErrorState } from '../ErrorState';
import { EmptyState } from '../EmptyState';
import { TableSkeleton } from '../TableSkeleton';
import { SortIndicator } from '../SortIndicator';
import { formatCount } from '../../lib/format';
import type { UiTopElementsRow } from '../../services/activity/queries';

const COLUMN_WIDTHS = ['w-full', 'w-16'];

const columns: ColumnDef<UiTopElementsRow>[] = [
  {
    id: 'element_id',
    accessorKey: 'element_id',
    header: 'Element ID',
    cell: (info) => (
      <span className="font-mono text-sm break-all text-ink-2">
        {info.getValue<string>()}
      </span>
    ),
  },
  {
    id: 'click_count',
    accessorKey: 'click_count',
    header: 'Clicks',
    cell: (info) => (
      <span className="tabular-nums">
        {formatCount(Number(info.getValue<number>() ?? 0))}
      </span>
    ),
    sortingFn: (a, b) =>
      Number(a.original.click_count) - Number(b.original.click_count),
  },
];

export function UiTopElementsTable() {
  const query = useUiTopElements();
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'click_count', desc: true },
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
      data-testid="ui-top-elements-table"
    >
      <header className="flex items-baseline justify-between mb-2">
        <h4 className="text-sm font-semibold text-ink-2">Top element clicks</h4>
        <span className="text-xs text-ink-3">
          Top 20 by click count · selected range
        </span>
      </header>
      {query.isLoading ? (
        <table className="w-full text-sm">
          <TableSkeleton rows={8} columnWidths={COLUMN_WIDTHS} />
        </table>
      ) : query.error ? (
        <ErrorState
          heading="Couldn't load top elements"
          body="Retry below."
          onRetry={() => void query.refetch()}
        />
      ) : (query.data ?? []).length === 0 ? (
        <EmptyState heading="No clicks in this range">
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
