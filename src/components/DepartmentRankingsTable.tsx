// Phase 6 Plan 06-02 — DEPT-01 rankings table with INTR-01 cross-filter support.
// Contract: .planning/phases/06-department-analysis-sale-comparison/06-UI-SPEC.md
//   § DepartmentRankingsTable (column headers + row heights + highlight style),
//   § Copywriting → /departments page (exact labels + empty/error copy),
//   § Interaction Contract → click rankings-table row (toggle behavior),
//   06-RESEARCH.md Pitfall 7 (null display_name fallback).
// REQ-ID: DEPT-01, INTR-01 (partial — row highlight; chart dimming in 06-03).
//
// Styling mirrors Phase 3 SalesTable / DepartmentTable (h-11 rows, gray-50
// header row, divide-y, px-4 padding). Sort via getSortedRowModel; filter via
// a custom globalFilterFn that matches both code AND display_name
// case-insensitive (includesString on a single accessor would miss one of
// them). Row click toggles the page-level `selectedDept` state; when the row
// matches, the highlight overlay is `bg-accent/5` + `border-l-2 border-accent`
// (UI-SPEC accent reservation #7 extension — selection indicator, not CTA).
//
// Threat model: T-06-02-01 XSS (department text fields as JSX children —
// React auto-escapes). T-06-02-02 ReDoS on filter — custom fn uses
// String.prototype.includes, no regex compilation from user input.

import * as React from 'react';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type Row,
} from '@tanstack/react-table';
import {
  formatCurrency,
  formatPercent,
  formatCount,
} from '../lib/format';
import { SortIndicator } from './SortIndicator';
import { FilterInput } from './FilterInput';
import { TableSkeleton } from './TableSkeleton';
import { EmptyState } from './EmptyState';
import { ErrorState } from './ErrorState';
import type { DepartmentRanking } from '../hooks/useDepartmentRankings';
import type { RankingMetric } from './DeptRankingMetricToggle';

export interface DepartmentRankingsTableProps {
  rows: readonly DepartmentRanking[];
  metric: RankingMetric;
  selectedDept: string | null;
  onToggleSelection: (deptCode: string) => void;
  isPending: boolean;
  isError: boolean;
  onRetry?: () => void;
}

// Map a RankingMetric to its default-sort column id. Single source of truth
// used by (a) the initial `sorting` state and (b) the metric-change reset
// effect below.
const METRIC_TO_COLUMN: Record<RankingMetric, string> = {
  revenue: 'total_revenue',
  sell_through: 'avg_sell_through',
  lots_above_estimate: 'lots_above_estimate',
};

// Nulls-last sorting: handled on the Avg sell-through column via an accessor
// that maps null → undefined + `sortUndefined: 'last'`. A custom sortingFn
// alone won't work here: TanStack Table v8 inverts the fn's return sign on
// DESC, which would flip nulls to the top. See column definition below.
//
// Custom global filter — applied across department_code OR display_name
// (case-insensitive includesString). The default 'includesString' filters
// against a single column accessor, which would miss whichever of the two
// fields wasn't chosen as the accessor. Plain String.includes — no regex,
// no ReDoS surface (T-06-02-02).
function departmentGlobalFilter<T extends DepartmentRanking>(
  row: Row<T>,
  _columnId: string,
  filterValue: string,
): boolean {
  if (!filterValue) return true;
  const haystack = `${row.original.department_code} ${
    row.original.display_name ?? ''
  }`.toLowerCase();
  return haystack.includes(filterValue.toLowerCase());
}

export function DepartmentRankingsTable({
  rows,
  metric,
  selectedDept,
  onToggleSelection,
  isPending,
  isError,
  onRetry,
}: DepartmentRankingsTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: METRIC_TO_COLUMN[metric], desc: true },
  ]);
  const [filterText, setFilterText] = React.useState('');

  // Reset default sort whenever the metric prop flips (so /departments'
  // "Revenue / Sell-through / Lots above estimate" toggle always rehomes
  // the table to the correct DESC column). User-driven sort on any column
  // is preserved within a single metric — only a metric change clobbers it.
  React.useEffect(() => {
    setSorting([{ id: METRIC_TO_COLUMN[metric], desc: true }]);
  }, [metric]);

  const columns = React.useMemo<ColumnDef<DepartmentRanking>[]>(
    () => [
      {
        id: 'department',
        header: 'Department',
        // Accessor is used by the custom global filter's row.getValue path
        // only when we ever switch back to the built-in includesString. For
        // our custom filter fn we read row.original directly. Keep a stable
        // accessor anyway so the column sorts deterministically if toggled.
        accessorFn: (r) => r.department_code,
        cell: (info) => {
          const r = info.row.original;
          return (
            <span className="flex flex-col">
              <span className="font-mono font-semibold text-sm">
                {r.department_code}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {r.display_name ?? r.department_code}
              </span>
            </span>
          );
        },
        enableSorting: false,
      },
      {
        accessorKey: 'sales_count',
        id: 'sales_count',
        header: 'Sales',
        cell: (info) => formatCount(info.getValue<number | null>()),
        meta: { numeric: true },
      },
      {
        accessorKey: 'total_revenue',
        id: 'total_revenue',
        header: 'Total revenue',
        cell: (info) => formatCurrency(info.getValue<number | null>()),
        meta: { numeric: true },
      },
      {
        id: 'avg_sell_through',
        header: 'Avg sell-through',
        // Map null → undefined so TanStack Table's `sortUndefined: 'last'`
        // parks nullable values at the bottom regardless of asc/desc. A
        // custom sortingFn alone won't work: TanStack inverts the fn's
        // return sign on DESC, which would flip nulls to the top.
        accessorFn: (r) =>
          r.avg_sell_through == null ? undefined : r.avg_sell_through,
        cell: (info) => {
          const v = info.getValue<number | undefined>();
          return v == null ? '—' : formatPercent(v);
        },
        sortingFn: 'basic',
        sortUndefined: 'last',
        meta: { numeric: true },
      },
      {
        accessorKey: 'lots_above_estimate',
        id: 'lots_above_estimate',
        header: 'Above estimate',
        cell: (info) => formatCount(info.getValue<number | null>()),
        meta: { numeric: true },
      },
    ],
    [],
  );

  const table = useReactTable({
    data: rows as DepartmentRanking[],
    columns,
    state: { sorting, globalFilter: filterText },
    onSortingChange: setSorting,
    onGlobalFilterChange: setFilterText,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: departmentGlobalFilter,
    enableMultiSort: false,
    // Numeric columns default to descending-first in TanStack Table — keep
    // that behavior so the first click on a numeric header (after a metric
    // change put it in DESC state) flips to ASC, not the other way.
    sortDescFirst: true,
  });

  // Branches: isPending+empty → skeleton, isError → ErrorState, empty (no
  // rows + settled) → EmptyState. Filter-returns-0 branch is handled INSIDE
  // the rendered table (below thead) so the filter input remains visible
  // and the user can clear the filter to recover.
  if (isPending && rows.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="w-full">
          <TableSkeleton
            rows={10}
            columnWidths={['w-20', 'w-12', 'w-24', 'w-20', 'w-16']}
          />
        </table>
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState
        heading="Couldn't load departments"
        body="Something went wrong fetching department data for the selected range. Retry below, or try a different range."
        onRetry={onRetry ?? (() => {})}
      />
    );
  }

  if (rows.length === 0) {
    return (
      <EmptyState heading="No department data in this range">
        <p>Try expanding the date filter to see more data.</p>
      </EmptyState>
    );
  }

  const filteredRows = table.getRowModel().rows;
  const filterActive = filterText.trim().length > 0;

  return (
    <div className="flex flex-col gap-3">
      {/* Filter row — right-aligned above the table. matchCount text renders
          only when the filter is active (mirrors SalesPage pattern). */}
      <div className="flex items-center justify-end gap-3">
        {filterActive && (
          <span
            aria-live="polite"
            aria-atomic="true"
            className="text-sm text-gray-500 dark:text-gray-400"
          >
            {filteredRows.length} of {rows.length} departments
          </span>
        )}
        <FilterInput
          value={filterText}
          onChange={setFilterText}
          placeholder="Search departments…"
          ariaLabel="Filter departments by code or name"
        />
      </div>

      <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="h-11">
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort();
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
                      {canSort ? (
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
                      ) : (
                        <span className="flex items-center gap-1">
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                        </span>
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>

          {filteredRows.length > 0 ? (
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredRows.map((row) => {
                const code = row.original.department_code;
                const isSelected = selectedDept === code;
                const rowClass = [
                  'h-11 cursor-pointer transition-colors duration-200',
                  'hover:bg-gray-50 dark:hover:bg-gray-800',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset',
                  isSelected ? 'bg-accent/5 border-l-2 border-accent' : '',
                ]
                  .filter(Boolean)
                  .join(' ');

                return (
                  // WR-01: Preserve native <tr> row semantics. Using
                  // role="button" strips the implicit row role, breaking
                  // row/column association for screen reader table
                  // navigation. aria-selected + tabIndex + onClick/onKeyDown
                  // keeps the interaction without overriding the role — AT
                  // still announces "row N of M" with column headers.
                  <tr
                    key={row.id}
                    tabIndex={0}
                    aria-selected={isSelected}
                    onClick={() => onToggleSelection(code)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onToggleSelection(code);
                      }
                    }}
                    className={rowClass}
                  >
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
                );
              })}
            </tbody>
          ) : (
            // Filter returned 0 rows but the table has data — show the
            // No-matches hint INSIDE the table container so the filter row
            // above stays mounted. Rendering <EmptyState> inside a <tbody>
            // would break table semantics, so we break out via a single
            // full-width cell.
            <tbody>
              <tr>
                <td colSpan={columns.length} className="p-0">
                  <EmptyState heading="No matches">
                    <p>
                      Try a different search term or clear the filter to
                      see all departments.
                    </p>
                  </EmptyState>
                </td>
              </tr>
            </tbody>
          )}
        </table>
      </div>
    </div>
  );
}
