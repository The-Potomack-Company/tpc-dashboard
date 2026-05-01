// Phase 3 / APP-02 / D-15 — right-now active sessions table.
// Filter scope: ignores ?range=; applies ?specialists= and ?mode= via the hook.
// Always WHERE status = 'active' (server-side via the get_active_sessions RPC).
//
// Mirrors src/components/extension/PerUserTable.tsx structure verbatim:
//   - TanStack Table v8 with controlled SortingState
//   - Phase 1 SortIndicator + TableSkeleton + EmptyState + ErrorState
//   - Locked ErrorState contract (D-35): heading + body + onRetry; no children;
//     no sibling Retry buttons.
//
// Phase 3 swap from PerUserTable:
//   - Default sort = age desc (oldest first per UI-SPEC § APP-02)
//   - 7 columns: Session, Mode, Specialist, Items, Created, Updated, Age
//   - Section header "Active sessions" + green pulsing right-now pip
//   - Plural-correct subheading ("{n} active session" / "{n} active sessions")
//   - Row click navigates to /activity/sessions/<session_id>; full row is the
//     click target with hover bg-gray-50 + Enter/Space keyboard activation.

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
import { useActiveSessions } from '../../hooks/activity/useActiveSessions';
import { ErrorState } from '../ErrorState';
import { EmptyState } from '../EmptyState';
import { TableSkeleton } from '../TableSkeleton';
import { SortIndicator } from '../SortIndicator';
import { formatAge, formatTimestampShort, EMPTY } from '../../lib/format';
import type { ActiveSessionsRow } from '../../services/activity/queries';

const COLUMN_WIDTHS = ['w-48', 'w-12', 'w-32', 'w-12', 'w-24', 'w-24', 'w-12'];

// Items column is index 3 — render right-aligned with tabular-nums.
function isNumericColumn(idx: number): boolean {
  return idx === 3;
}

const columns: ColumnDef<ActiveSessionsRow>[] = [
  {
    id: 'name',
    accessorKey: 'name',
    header: 'Session',
    cell: (info) => {
      const v = info.getValue<string | null>();
      return v ?? EMPTY;
    },
  },
  {
    id: 'mode',
    accessorKey: 'mode',
    header: 'Mode',
    cell: (info) => {
      const v = info.getValue<string | null>();
      return v ?? EMPTY;
    },
  },
  {
    id: 'specialist',
    accessorKey: 'assigned_to_display_name',
    header: 'Specialist',
    cell: (info) => {
      const v = info.getValue<string | null>();
      return v ?? EMPTY;
    },
  },
  {
    id: 'item_count',
    accessorKey: 'item_count',
    header: 'Items',
    cell: (info) => Number(info.getValue<number | null>() ?? 0),
  },
  {
    id: 'created_at',
    accessorKey: 'created_at',
    header: 'Created',
    cell: (info) => formatTimestampShort(info.getValue<string>()),
  },
  {
    id: 'updated_at',
    accessorKey: 'updated_at',
    header: 'Updated',
    cell: (info) => formatTimestampShort(info.getValue<string>()),
  },
  {
    id: 'age',
    // Same source column as Created; the comparator below sorts on creation
    // timestamp so "age desc" === "created_at asc" === oldest first.
    accessorKey: 'created_at',
    header: 'Age',
    cell: (info) => formatAge(info.getValue<string>()),
    sortingFn: (a, b) => {
      // We want default sort `{ id: 'age', desc: true }` → oldest first.
      // TanStack v8 inverts the comparator under desc=true. So define an asc
      // comparator that puts NEWEST first; desc=true then reverses to oldest-first.
      // Newest-first asc means: smaller `-created_at` first → return
      //   b.created_at - a.created_at
      return (
        new Date(b.original.created_at).getTime() -
        new Date(a.original.created_at).getTime()
      );
    },
  },
];

export function ActiveSessionsTable() {
  const navigate = useNavigate();
  const query = useActiveSessions();
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'age', desc: true },
  ]);

  const table = useReactTable({
    data: query.data ?? [],
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const rowCount = query.data?.length ?? 0;

  return (
    <section
      className="rounded-lg border border-gray-200 bg-white p-4 mt-8"
      data-testid="app-02-card"
    >
      <header className="flex items-center gap-2 mb-2">
        <span
          aria-hidden="true"
          className="h-2 w-2 rounded-full bg-green-500 motion-safe:animate-pulse"
        />
        <span className="sr-only">Live</span>
        <h2 className="text-sm font-semibold text-gray-700">Active sessions</h2>
        {rowCount > 0 && (
          <span className="text-xs text-gray-500 ml-2">
            {rowCount} {rowCount === 1 ? 'active session' : 'active sessions'}
          </span>
        )}
      </header>

      {query.isLoading ? (
        // TableSkeleton renders <tbody>; wrap in a <table> so it's valid HTML.
        <table className="w-full text-sm">
          <TableSkeleton rows={5} columnWidths={COLUMN_WIDTHS} />
        </table>
      ) : query.error ? (
        // LOCKED ErrorState contract: heading + body + onRetry; no sibling Retry.
        <ErrorState
          heading="Couldn't load active sessions"
          body="Retry below."
          onRetry={() => void query.refetch()}
        />
      ) : rowCount === 0 ? (
        <EmptyState heading="No active sessions">
          <p>The TPC team isn't cataloging right now.</p>
        </EmptyState>
      ) : (
        <table
          className="w-full text-sm"
          data-testid="active-sessions-table"
        >
          <thead className="border-b border-gray-200 bg-gray-50 text-left">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="h-11">
                {hg.headers.map((h, idx) => {
                  const sorted = h.column.getIsSorted() as
                    | 'asc'
                    | 'desc'
                    | false;
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
                        {flexRender(
                          h.column.columnDef.header,
                          h.getContext(),
                        )}
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
                className="h-11 border-b border-gray-100 hover:bg-gray-50 cursor-pointer focus:ring-2 focus:ring-accent outline-none"
                tabIndex={0}
                onClick={() =>
                  navigate(`/activity/sessions/${row.original.session_id}`)
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    navigate(`/activity/sessions/${row.original.session_id}`);
                  }
                }}
              >
                {row.getVisibleCells().map((cell, idx) => (
                  <td
                    key={cell.id}
                    className={`px-4 ${isNumericColumn(idx) ? 'text-right tabular-nums' : ''}`}
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
