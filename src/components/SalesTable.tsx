// Virtualized sortable + filterable TanStack Table for the /sales list.
//
// Design contract: 03-UI-SPEC.md § Layout Specifications (/sales),
// § Interaction Contract, § Copywriting Contract.
// Reference wiring: 03-RESEARCH.md Pattern 1 (fixed-row-height variant).
//
// Key choices (pinned by the plan):
//   - Row height 44px (h-11) — matches UI-SPEC touch-target minimum.
//   - Default sort: sale_date DESC.
//   - enableMultiSort: false — one column at a time.
//   - globalFilterFn: 'includesString' — case-insensitive built-in; no regex
//     compiled from user input, so no ReDoS surface (threat T-03-05).
//   - Sell-through is a derived column via accessorFn so it sorts numerically
//     (03-RESEARCH.md Pitfall 3).
//   - Sticky thead z-[1] — do NOT raise to z-10 (Pitfall 5: would cover the
//     DashboardLayout header user-menu dropdown).
//   - Cells render via flexRender only — React escapes text by default
//     (threat T-03-01 mitigation; zero raw-HTML injection sinks).

import * as React from 'react';
import { useNavigate } from 'react-router';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  useReactTable,
  type ColumnDef,
  type RowData,
  type SortingState,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { Database } from '../db/database.types';
import {
  formatCurrency,
  formatPercent,
  formatCount,
  formatDate,
} from '../lib/format';
import { SortIndicator } from './SortIndicator';

type Sale = Database['public']['Tables']['sales']['Row'];

interface SalesTableProps {
  sales: Sale[];
  /** Already-debounced filter string from the parent (useDeferredValue). */
  filterText: string;
}

const ROW_HEIGHT = 44; // UI-SPEC h-11

// Augment TanStack's ColumnMeta so `meta: { numeric: true }` is typed.
declare module '@tanstack/react-table' {
  interface ColumnMeta<TData extends RowData, TValue> {
    // The two generics are required by TanStack's declaration shape but
    // neither is used in our lightweight augmentation.
    _phantomData?: TData;
    _phantomValue?: TValue;
    numeric?: boolean;
  }
}

export function SalesTable({ sales, filterText }: SalesTableProps) {
  const navigate = useNavigate();
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: 'sale_date', desc: true },
  ]);

  const columns = React.useMemo<ColumnDef<Sale>[]>(
    () => [
      { accessorKey: 'sale_number', header: 'Sale #', size: 100 },
      { accessorKey: 'title', header: 'Title', size: 280 },
      {
        accessorKey: 'sale_date',
        header: 'Date',
        cell: (info) => formatDate(info.getValue<string | null>()),
        size: 120,
      },
      {
        accessorKey: 'lots_auctioned',
        header: 'Lots',
        cell: (info) => formatCount(info.getValue<number | null>()),
        size: 80,
        meta: { numeric: true },
      },
      {
        accessorKey: 'lots_sold',
        header: 'Sold',
        cell: (info) => formatCount(info.getValue<number | null>()),
        size: 80,
        meta: { numeric: true },
      },
      {
        id: 'sell_through',
        header: 'Sell-through',
        // Guard only `lots_auctioned > 0` so lots_sold === 0 renders a valid
        // 0% sell-through instead of EMPTY. Matches SaleSummaryCard's
        // derivation exactly; divergence was flagged as WR-01.
        accessorFn: (row) =>
          row.lots_sold != null &&
          row.lots_auctioned != null &&
          row.lots_auctioned > 0
            ? row.lots_sold / row.lots_auctioned
            : null,
        cell: (info) => formatPercent(info.getValue<number | null>()),
        size: 120,
        meta: { numeric: true },
      },
      {
        accessorKey: 'total_sold_value',
        header: 'Sold value',
        cell: (info) => formatCurrency(info.getValue<number | null>()),
        size: 140,
        meta: { numeric: true },
      },
      {
        accessorKey: 'net_revenue',
        header: 'Net revenue',
        cell: (info) => formatCurrency(info.getValue<number | null>()),
        size: 140,
        meta: { numeric: true },
      },
    ],
    [],
  );

  const table = useReactTable({
    data: sales,
    columns,
    state: { sorting, globalFilter: filterText },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: 'includesString',
    enableMultiSort: false,
  });

  const { rows } = table.getRowModel();

  const parentRef = React.useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div
      ref={parentRef}
      // WR-05: `flex-1 min-h-0` replaces a fragile `max-h-[calc(100dvh-16rem)]`.
      // The parent page (and DashboardLayout) supply a flex-column context
      // so this container fills exactly the space left after the header,
      // preventing the double-scrollbar UX when the filter row stacks.
      className="flex-1 min-h-0 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700"
    >
      <div style={{ height: `${virtualizer.getTotalSize()}px` }}>
        <table className="w-full">
          <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800 z-[1] border-b border-gray-200 dark:border-gray-700">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="h-11">
                {headerGroup.headers.map((header) => {
                  const sortDir = header.column.getIsSorted();
                  const isNumeric = header.column.columnDef.meta?.numeric;
                  return (
                    <th
                      key={header.id}
                      scope="col"
                      aria-sort={
                        sortDir === 'asc'
                          ? 'ascending'
                          : sortDir === 'desc'
                            ? 'descending'
                            : 'none'
                      }
                      style={{ width: header.getSize() }}
                      className={`text-sm font-semibold text-gray-700 dark:text-gray-300 px-4 ${
                        isNumeric ? 'text-right' : 'text-left'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className={`flex items-center gap-1 cursor-pointer ${
                          isNumeric
                            ? 'justify-end tabular-nums w-full'
                            : ''
                        }`}
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                        <SortIndicator state={sortDir} />
                      </button>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700 [&>tr:nth-child(even)]:bg-gray-50 dark:[&>tr:nth-child(even)]:bg-gray-900/50">
            {virtualItems.map((vRow, index) => {
              const row = rows[vRow.index];
              // WR-04 invariant: `translateY(vRow.start - index * vRow.size)`
              // positions each visible row at its absolute virtual offset
              // (vRow.start) by subtracting the natural flow offset the row
              // would otherwise take (index * vRow.size). This works ONLY
              // because every row is fixed-height at ROW_HEIGHT (vRow.size
              // is identical for every entry in virtualItems). If variable
              // row heights are ever introduced (measureElement/dynamic
              // sizes), replace with absolute positioning or a per-row
              // cumulative-start offset — the subtraction breaks.
              return (
                <tr
                  key={row.id}
                  tabIndex={0}
                  onClick={() =>
                    navigate(`/sales/${row.original.sale_number}`)
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      navigate(`/sales/${row.original.sale_number}`);
                    }
                  }}
                  style={{
                    height: `${vRow.size}px`,
                    transform: `translateY(${
                      vRow.start - index * vRow.size
                    }px)`,
                  }}
                  className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset outline-none"
                >
                  {row.getVisibleCells().map((cell) => {
                    const isNumeric = cell.column.columnDef.meta?.numeric;
                    return (
                      <td
                        key={cell.id}
                        className={`px-4 text-sm ${
                          isNumeric ? 'text-right tabular-nums' : ''
                        }`}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
