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
  type OnChangeFn,
  type RowSelectionState,
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
  // Phase 6 Plan 06-04 — optional selection column. When onRowSelectionChange
  // is undefined the rendering is byte-identical to pre-06-04. When defined,
  // a leading w-12 checkbox column is prepended and getRowId is keyed to
  // sale_number so selection survives sort/filter re-renders.
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: OnChangeFn<RowSelectionState>;
  /** Max-N cap; default 4. Attempts to check the (N+1)th row fire onMaxExceeded and are blocked. */
  maxSelection?: number;
  onMaxExceeded?: () => void;
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

export function SalesTable({
  sales,
  filterText,
  rowSelection,
  onRowSelectionChange,
  maxSelection = 4,
  onMaxExceeded,
}: SalesTableProps) {
  const navigate = useNavigate();
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: 'sale_date', desc: true },
  ]);

  const selectionEnabled = onRowSelectionChange != null;

  const columns = React.useMemo<ColumnDef<Sale>[]>(
    () => {
      // Build the column set. When selection is enabled, prepend a w-12
      // checkbox column whose header is visually blank (sr-only label) and
      // whose cell renders a native input[type=checkbox] with
      // stopPropagation on both onClick and onChange (Pitfall 2: row onClick
      // navigates; unless we stop propagation, clicking the checkbox
      // navigates away and wipes the selection).
      const base: ColumnDef<Sale>[] = [
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
      ];

      if (!selectionEnabled) return base;

      // Selection column. w-12 (48px) container; centers a native 20x20 checkbox.
      // Row height stays h-11 (44px) — DO NOT raise estimateSize.
      const selectionColumn: ColumnDef<Sale> = {
        id: '_select',
        size: 48,
        enableSorting: false,
        header: () => <span className="sr-only">Select sale</span>,
        cell: ({ row }) => {
          return (
            <div className="w-12 flex items-center justify-center">
              <input
                type="checkbox"
                aria-label={'Select sale ' + row.original.sale_number}
                checked={row.getIsSelected()}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => {
                  e.stopPropagation();
                  const next = e.target.checked;
                  if (next) {
                    // Count current selections from the outer rowSelection
                    // prop (not from table state) so we respect the
                    // parent-owned truth even across re-renders.
                    const currentCount = Object.values(
                      rowSelection ?? {},
                    ).filter(Boolean).length;
                    if (currentCount >= maxSelection) {
                      onMaxExceeded?.();
                      return;
                    }
                  }
                  row.toggleSelected(next);
                }}
                className="w-5 h-5 cursor-pointer focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset"
              />
            </div>
          );
        },
      };

      return [selectionColumn, ...base];
    },
    // The selection column reads rowSelection + maxSelection + onMaxExceeded
    // from closure. Memoize against those + the selectionEnabled flag so the
    // cell renderer sees fresh values when the parent re-renders with a new
    // rowSelection snapshot.
    [selectionEnabled, rowSelection, maxSelection, onMaxExceeded],
  );

  const table = useReactTable({
    data: sales,
    columns,
    state: {
      sorting,
      globalFilter: filterText,
      // Only include rowSelection state when selection mode is active, so
      // existing tests/usage (which never pass rowSelection) see the
      // pre-06-04 state shape exactly.
      ...(selectionEnabled ? { rowSelection: rowSelection ?? {} } : {}),
    },
    onSortingChange: setSorting,
    // getRowId is only overridden when selection is enabled. Keying rows by
    // sale_number (not array index) means selection survives sort + filter
    // re-renders. Existing callers that do not use selection keep TanStack
    // default numeric-index row IDs.
    ...(selectionEnabled
      ? {
          getRowId: (row: Sale) => row.sale_number,
          onRowSelectionChange,
          enableRowSelection: true,
        }
      : {}),
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
                      {header.column.id === '_select' ? (
                        // Selection column: render the header content (the
                        // sr-only "Select sale" span) directly without a sort
                        // button. Not sortable; no SortIndicator; no
                        // toggleSorting handler.
                        flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )
                      ) : (
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
                      )}
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
