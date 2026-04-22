// Sortable, read-only breakdown table for /sales/:saleNumber.
//
// Contract: 03-UI-SPEC.md § Layout Specifications (/sales/:saleNumber
// department table — semantic thead/tbody/tfoot, 44px rows, 2px top
// border on tfoot); § Copywriting (exact column headers + "Totals"
// label); § Interaction Contract (rows are NOT clickable — no focus
// ring, no hover cursor); § Color (font-mono code badge, footer
// bg-gray-50).
//
// Key decisions (pinned by the plan):
//   - TanStack Table v8, no virtualization — typical sales have 8-20
//     department rows, far below the virtualization threshold.
//   - Default sort: revenue DESC.
//   - enableMultiSort: false — one column at a time.
//   - Footer totals computed from `departments` (the full input array),
//     NOT `table.getRowModel().rows` — totals remain invariant under
//     user sort changes. Percent and estimate columns intentionally
//     render EMPTY in the footer (they don't sum meaningfully).
//   - sell_through_pct is stored 0-100 in the DB; we divide by 100
//     before passing to formatPercent (which expects a ratio).
//   - Rows have no tab-index, no click handler, no cursor-pointer class —
//     they are read-only display rows by spec.
//
// Threat model: T-03-01 (XSS via department.display_name, department_code)
// is mitigated by React auto-escaping all text nodes; no
// dangerouslySetInnerHTML sinks exist in this file.

import * as React from 'react';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import type { Database } from '../db/database.types';
import {
  formatCurrency,
  formatCount,
  formatPercent,
  formatEstimateRange,
  EMPTY,
} from '../lib/format';
import { SortIndicator } from './SortIndicator';

type SaleDepartment = Database['public']['Tables']['sale_departments']['Row'] & {
  department?: {
    code: string;
    display_name: string | null;
    auto_discovered: boolean;
  } | null;
};

interface DepartmentTableProps {
  departments: SaleDepartment[];
}

function sum(values: Array<number | null | undefined>): number | null {
  const nums = values.filter((v): v is number => typeof v === 'number');
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0);
}

export function DepartmentTable({ departments }: DepartmentTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: 'revenue', desc: true },
  ]);

  const columns = React.useMemo<ColumnDef<SaleDepartment>[]>(
    () => [
      {
        id: 'department',
        header: 'Department',
        accessorFn: (row) =>
          row.department?.display_name ?? row.department_code,
        cell: (info) => {
          const row = info.row.original;
          return (
            <span className="flex items-center gap-2">
              <span className="font-mono text-sm font-semibold">
                {row.department_code}
              </span>
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {row.department?.display_name ?? EMPTY}
              </span>
            </span>
          );
        },
      },
      {
        accessorKey: 'lots_auctioned',
        header: 'Lots',
        cell: (info) => formatCount(info.getValue<number | null>()),
        meta: { numeric: true },
      },
      {
        accessorKey: 'lots_sold',
        header: 'Sold',
        cell: (info) => formatCount(info.getValue<number | null>()),
        meta: { numeric: true },
      },
      {
        id: 'sell_through',
        header: 'Sell-through',
        accessorFn: (row) =>
          row.sell_through_pct == null ? null : row.sell_through_pct / 100,
        cell: (info) => formatPercent(info.getValue<number | null>()),
        meta: { numeric: true },
      },
      {
        accessorKey: 'total_sold_value',
        header: 'Sold value',
        cell: (info) => formatCurrency(info.getValue<number | null>()),
        meta: { numeric: true },
      },
      {
        id: 'estimate',
        header: 'Estimate',
        // Sort by low_estimate (fall back to high) for a consistent numeric key.
        accessorFn: (row) => row.low_estimate ?? row.high_estimate ?? null,
        cell: (info) =>
          formatEstimateRange(
            info.row.original.low_estimate,
            info.row.original.high_estimate,
          ),
        meta: { numeric: true },
      },
      {
        accessorKey: 'reserves',
        header: 'Reserves',
        cell: (info) => formatCurrency(info.getValue<number | null>()),
        meta: { numeric: true },
      },
      {
        accessorKey: 'revenue',
        header: 'Revenue',
        cell: (info) => formatCurrency(info.getValue<number | null>()),
        meta: { numeric: true },
      },
    ],
    [],
  );

  const table = useReactTable({
    data: departments,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableMultiSort: false,
    // Numeric columns default to descending-first in TanStack Table.
    // Override so each click cycles asc → desc → (reset), matching the
    // UI-SPEC § Interaction Contract ("Cycles sort state unsorted → asc
    // → desc → unsorted"). Default sort (revenue DESC) is set explicitly
    // in initial state; user-driven sort changes start ascending.
    sortDescFirst: false,
  });

  // Footer totals: computed from the SOURCE array, not the sorted row model.
  // Totals are data-level invariants — user sort should not change them.
  // Sell-through and Estimate are intentionally NOT summed (percentages don't
  // sum, ranges don't sum meaningfully) — those footer cells render EMPTY.
  const totals = React.useMemo(
    () => ({
      lots_auctioned: sum(departments.map((d) => d.lots_auctioned)),
      lots_sold: sum(departments.map((d) => d.lots_sold)),
      total_sold_value: sum(departments.map((d) => d.total_sold_value)),
      reserves: sum(departments.map((d) => d.reserves)),
      revenue: sum(departments.map((d) => d.revenue)),
    }),
    [departments],
  );

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id} className="h-11">
              {headerGroup.headers.map((header) => {
                const sortDir = header.column.getIsSorted();
                const meta = header.column.columnDef.meta as
                  | { numeric?: boolean }
                  | undefined;
                const isNumeric = meta?.numeric;
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
                    className={`px-4 text-sm font-semibold text-gray-700 dark:text-gray-300 ${
                      isNumeric ? 'text-right' : 'text-left'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={header.column.getToggleSortingHandler()}
                      className={`flex items-center gap-1 cursor-pointer ${
                        isNumeric ? 'justify-end ml-auto' : ''
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
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} className="h-11">
              {row.getVisibleCells().map((cell) => {
                const meta = cell.column.columnDef.meta as
                  | { numeric?: boolean }
                  | undefined;
                const isNumeric = meta?.numeric;
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
          ))}
        </tbody>
        <tfoot className="bg-gray-50 dark:bg-gray-800 font-semibold border-t-2 border-gray-300 dark:border-gray-600">
          <tr className="h-11">
            <td className="px-4 text-sm">Totals</td>
            <td className="px-4 text-sm text-right tabular-nums">
              {formatCount(totals.lots_auctioned)}
            </td>
            <td className="px-4 text-sm text-right tabular-nums">
              {formatCount(totals.lots_sold)}
            </td>
            <td className="px-4 text-sm text-right tabular-nums">{EMPTY}</td>
            <td className="px-4 text-sm text-right tabular-nums">
              {formatCurrency(totals.total_sold_value)}
            </td>
            <td className="px-4 text-sm text-right tabular-nums">{EMPTY}</td>
            <td className="px-4 text-sm text-right tabular-nums">
              {formatCurrency(totals.reserves)}
            </td>
            <td className="px-4 text-sm text-right tabular-nums">
              {formatCurrency(totals.revenue)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
