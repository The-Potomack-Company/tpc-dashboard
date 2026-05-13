import { Fragment, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getExpandedRowModel,
  flexRender,
  type ColumnDef,
  type ExpandedState,
  type SortingState,
} from '@tanstack/react-table';
import { useAuthStore } from '../../stores/authStore';
import { isDevAccount } from '../../lib/devAccess';
import { useSessionItems } from '../../hooks/activity/useSessionDetail';
import { SessionItemDisclosure } from './SessionItemDisclosure';
import { ErrorState } from '../ErrorState';
import { EmptyState } from '../EmptyState';
import { TableSkeleton } from '../TableSkeleton';
import { SortIndicator } from '../SortIndicator';
import { EMPTY } from '../../lib/format';
import type { ItemListRow } from '../../services/activity/queries';

// Phase 3 / APP-06 / D-05 / D-06 — Session Detail item list with per-row expansion.
//
// TanStack Table v8 with `getExpandedRowModel()`. Columns:
//   admin: [chevron] Receipt # | Title | AI status | Photos | Raw
//   dev: same shape with the Raw cell rendering "expand row →" hint
//
// The Raw column header is ALWAYS present (column shape stable across
// admin/dev — D-23). Cell content is gated by `isDev` at the cell level,
// not by adding/removing the column. This avoids layout shift on a
// dev login vs admin login.
//
// Per-row expansion (Pitfall 9): the expanded body is `<tr><td colSpan={N}>
// <SessionItemDisclosure /></td></tr>` placed as a Fragment sibling of the
// data row. Wrapping data + expansion rows in a Fragment with a single key
// keeps React's reconciliation stable.

const COLUMN_WIDTHS = ['w-4', 'w-24', 'w-full', 'w-24', 'w-12', 'w-12'];

const AI_STATUS_TONE: Record<string, string> = {
  pending:    'bg-bg-3 text-ink-2',
  processing: 'bg-sky-100 text-sky-700',
  queued:     'bg-amber-100 text-amber-800',
  done:       'bg-ok-wash text-ok',
  failed:     'bg-err-wash text-err',
};

function ChevronCell({ row }: { row: { getIsExpanded: () => boolean } }) {
  return (
    <span
      className={`inline-block transition-transform ${
        row.getIsExpanded() ? 'rotate-90 text-accent' : 'text-ink-4'
      }`}
      aria-hidden="true"
    >
      ▶
    </span>
  );
}

interface Props {
  sessionId: string;
}

export function SessionItemList({ sessionId }: Props) {
  const email = useAuthStore(
    (s: unknown) => (s as { profile: { email?: string | null } | null }).profile?.email,
  );
  const isDev = isDevAccount(email ?? null);
  const query = useSessionItems(sessionId);

  const [expanded, setExpanded] = useState<ExpandedState>({});
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns: ColumnDef<ItemListRow>[] = [
    {
      id: 'expand',
      header: '',
      enableSorting: false,
      cell: ({ row }) => <ChevronCell row={row} />,
    },
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
        const tone = AI_STATUS_TONE[status] ?? 'bg-bg-3 text-ink-2';
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
      id: 'photo_count',
      accessorKey: 'photo_count',
      header: 'Photos',
      cell: (info) => {
        const n = Number(info.getValue() ?? 0);
        return n === 0 ? EMPTY : <span className="tabular-nums">{n}</span>;
      },
    },
    {
      id: 'raw',
      header: 'Raw',
      enableSorting: false,
      cell: () =>
        isDev ? <span className="text-sm text-ink-3">expand row →</span> : null,
    },
  ];

  const table = useReactTable({
    data: query.data ?? [],
    columns,
    state: { expanded, sorting },
    onExpandedChange: setExpanded,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getRowCanExpand: () => true,
  });

  const rowCount = query.data?.length ?? 0;

  return (
    <section
      className="rounded-lg border border-rule bg-bg p-4 mt-8"
      data-testid="session-item-list"
    >
      <header className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-ink-2">Items</h2>
        {rowCount > 0 && (
          <span className="text-xs text-ink-3">
            {rowCount} {rowCount === 1 ? 'item' : 'items'}
          </span>
        )}
      </header>

      {query.isLoading ? (
        <table className="w-full text-sm">
          <TableSkeleton rows={8} columnWidths={COLUMN_WIDTHS} />
        </table>
      ) : query.error ? (
        <ErrorState
          heading="Couldn't load items"
          body="Retry below."
          onRetry={() => void query.refetch()}
        />
      ) : rowCount === 0 ? (
        <EmptyState heading="No items in this session">
          <p>Items appear here as the specialist catalogs them.</p>
        </EmptyState>
      ) : (
        <table className="w-full text-sm">
          <thead className="border-b border-rule bg-bg-2 text-left">
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
                      className={`px-4 text-sm font-semibold text-ink-2 select-none ${
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
              <Fragment key={row.id}>
                <tr
                  className="h-11 border-b border-rule hover:bg-bg-2 cursor-pointer"
                  onClick={row.getToggleExpandedHandler()}
                  aria-expanded={row.getIsExpanded()}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
                {row.getIsExpanded() && (
                  <tr>
                    <td
                      colSpan={row.getVisibleCells().length}
                      className="p-0"
                    >
                      <SessionItemDisclosure item={row.original} isDev={isDev} />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
