import { useCallback, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AccessDenied } from '../AccessDenied';
import { EmptyState } from '../EmptyState';
import { useAuthStore } from '../../stores/authStore';
import { getMessageCount, hasAnyAttachment, useCrmTriage } from '../../hooks/useCrmTriage';
import type { Department, Priority, TriageRow } from '../../services/crm/types';
import { DeptTags } from './DeptTags';
import { EMPTY_FILTERS, FilterBar, type FilterState } from './FilterBar';
import { ExpandedRow } from './ExpandedRow';
import { PrioritySection } from './PrioritySection';
import { StageBanner } from './StageBanner';

type PollResponse = {
  classified?: number;
  skipped_unchanged?: number;
  deferred?: string[];
  error?: string;
};

type ToastState = {
  tone: 'ok' | 'err';
  message: string;
};

const PRIORITY_BUCKETS: { key: Priority; label: 'HIGH' | 'STANDARD' | 'LOW' }[] = [
  { key: 'high', label: 'HIGH' },
  { key: 'standard', label: 'STANDARD' },
  { key: 'low', label: 'LOW' },
];

const DATE_FORMAT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

function createEmptyFilters(): FilterState {
  return {
    departments: new Set(EMPTY_FILTERS.departments),
    stages: new Set(EMPTY_FILTERS.stages),
    minAgeDays: EMPTY_FILTERS.minAgeDays,
    maxAgeDays: EMPTY_FILTERS.maxAgeDays,
    search: EMPTY_FILTERS.search,
  };
}

function formatReceived(value: string): string {
  return DATE_FORMAT.format(new Date(value));
}

function formatAge(ageDays: number): string {
  if (ageDays < 1 / 24) return 'just now';
  if (ageDays < 1) {
    const hours = Math.round(ageDays * 24);
    return `${hours}h ago`;
  }
  if (ageDays < 14) {
    const days = Math.round(ageDays);
    return `${days}d ago`;
  }
  if (ageDays < 60) {
    const weeks = Math.round(ageDays / 7);
    return `${weeks}w ago`;
  }
  const months = Math.round(ageDays / 30);
  return `${months}mo ago`;
}

function sender(row: TriageRow): string {
  if (row.from_name && row.from_email) return `${row.from_name} <${row.from_email}>`;
  return row.from_name ?? row.from_email ?? 'Unknown sender';
}

function truncateRationale(value: string | null, max = 200): string {
  if (!value) return '—';
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

function getPollMessage(response: PollResponse): string {
  const classified = response.classified ?? 0;
  const unchanged = response.skipped_unchanged ?? 0;
  const deferred = response.deferred?.length ?? 0;
  return `Classified ${classified} (${unchanged} unchanged, ${deferred} deferred)`;
}

function matchesDepartment(rowDepartments: Department[], selected: Set<Department>): boolean {
  return selected.size === 0 || rowDepartments.some((department) => selected.has(department));
}

function matchesFilters(row: TriageRow, filters: FilterState): boolean {
  if (!matchesDepartment(row.department, filters.departments)) return false;
  if (filters.stages.size > 0 && !filters.stages.has((row.streak_stage_name ?? '').trim())) return false;
  if (filters.minAgeDays !== null && row.age_days < filters.minAgeDays) return false;
  if (filters.maxAgeDays !== null && row.age_days > filters.maxAgeDays) return false;

  const search = filters.search.trim().toLowerCase();
  if (!search) return true;

  const searchable = [
    row.subject,
    row.from_name,
    row.from_email,
    row.body_text,
  ]
    .filter((value): value is string => typeof value === 'string')
    .join(' ')
    .toLowerCase();

  return searchable.includes(search);
}

function groupByPriority(rows: TriageRow[]): Record<Priority, TriageRow[]> {
  return rows.reduce<Record<Priority, TriageRow[]>>(
    (groups, row) => {
      groups[row.effective_priority].push(row);
      return groups;
    },
    { high: [], standard: [], low: [] },
  );
}

function EmptyInbox({
  onRefresh,
  isRefreshing,
  buttonLabel,
}: {
  onRefresh: () => void;
  isRefreshing: boolean;
  buttonLabel: string;
}) {
  return (
    <div className="flex items-center justify-center py-20" data-testid="crm-inbox-empty">
      <EmptyState heading="Inbox zero — no open consignments to triage">
        <div className="mb-5 flex justify-center" aria-hidden="true">
          <svg className="h-16 w-16 text-ink-3" viewBox="0 0 64 64" fill="none">
            <path
              d="M12 20h40l-5 28H17L12 20Z"
              className="stroke-current"
              strokeWidth="3"
              strokeLinejoin="round"
            />
            <path
              d="M20 20c2-8 6-12 12-12s10 4 12 12"
              className="stroke-current"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <path
              d="M23 35h18"
              className="stroke-current"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="tpc-btn tpc-btn-primary mt-1"
        >
          {buttonLabel}
        </button>
      </EmptyState>
    </div>
  );
}

export function CRMInbox() {
  const queryClient = useQueryClient();
  const isAdmin = useAuthStore((s) => s.profile?.role === 'admin' && s.profile.is_active === true);
  const accessToken = useAuthStore((s) => s.session?.access_token);
  const [expandedThreadId, setExpandedThreadId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [liveCount, setLiveCount] = useState(0);
  const [filters, setFilters] = useState<FilterState>(() => createEmptyFilters());

  // Each crm_classifications INSERT bumps the live counter so the Refresh
  // button shows live progress instead of an opaque spinner. The hook also
  // invalidates the table query on each event so rows appear as the poller
  // writes them.
  const onClassificationInsert = useCallback(() => {
    setLiveCount((prev) => prev + 1);
  }, []);

  const { threads, isLoading, error } = useCrmTriage({ onClassificationInsert });

  const availableStages = useMemo(
    () =>
      Array.from(
        new Set(
          threads
            .map((thread) => thread.streak_stage_name?.trim())
            .filter((stage): stage is string => typeof stage === 'string' && stage.length > 0),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [threads],
  );

  const filteredThreads = useMemo(
    () => threads.filter((thread) => matchesFilters(thread, filters)),
    [threads, filters],
  );

  const groupedThreads = useMemo(() => groupByPriority(filteredThreads), [filteredThreads]);

  const refreshMutation = useMutation<PollResponse, Error>({
    mutationFn: async () => {
      if (!accessToken) {
        throw new Error('Missing admin session. Sign in again and retry.');
      }
      const response = await fetch('/api/crm-poll', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const payload = (await response.json().catch(() => ({}))) as PollResponse;
      if (!response.ok) {
        if (response.status === 503 || /streak/i.test(payload.error ?? '')) {
          throw new Error('Streak unavailable, try again');
        }
        throw new Error(payload.error ?? `Refresh failed with HTTP ${response.status}`);
      }
      return payload;
    },
    onMutate: () => {
      setToast(null);
      setLiveCount(0);
    },
    onSuccess: (payload) => {
      setToast({ tone: 'ok', message: getPollMessage(payload) });
      void queryClient.invalidateQueries({ queryKey: ['crm', 'triage'] });
    },
    onError: (err) => {
      setToast({
        tone: 'err',
        message: err instanceof Error ? err.message : 'Refresh failed',
      });
    },
  });

  if (!isAdmin) {
    return <AccessDenied />;
  }

  const isRefreshing = refreshMutation.isPending;
  const buttonLabel = isRefreshing
    ? liveCount > 0
      ? `Polling… ${liveCount}`
      : 'Polling…'
    : 'Refresh';

  function handleRefresh() {
    refreshMutation.mutate();
  }

  function clearFilters() {
    setFilters(createEmptyFilters());
  }

  return (
    <main>
      <header className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-ink">CRM Inbox</h1>
          <p className="mt-1 text-sm text-ink-3">
            Open consignments sorted by effective priority
          </p>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="tpc-btn tpc-btn-primary"
          aria-busy={isRefreshing}
        >
          {buttonLabel}
        </button>
      </header>

      <FilterBar stages={availableStages} filters={filters} onChange={setFilters} />

      {toast && (
        <div
          role={toast.tone === 'err' ? 'alert' : 'status'}
          className={`mb-4 rounded-md px-4 py-3 text-sm ${
            toast.tone === 'err' ? 'bg-err-wash text-err' : 'bg-ok-wash text-ok'
          }`}
        >
          {toast.message}
        </div>
      )}

      {error && (
        <div role="alert" className="mb-4 rounded-md bg-err-wash px-4 py-3 text-sm text-err">
          {error instanceof Error ? error.message : 'Could not load CRM inbox'}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-24" aria-busy="true">
          <span className="sr-only">Loading CRM inbox</span>
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-accent" />
        </div>
      ) : threads.length === 0 ? (
        <EmptyInbox
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
          buttonLabel={buttonLabel}
        />
      ) : filteredThreads.length === 0 ? (
        <div className="flex items-center justify-center py-16">
          <EmptyState heading="No threads match the current filters">
            <button type="button" onClick={clearFilters} className="tpc-btn mt-1">
              Clear filters
            </button>
          </EmptyState>
        </div>
      ) : (
        <section className="space-y-4" data-testid="crm-inbox-table">
          {PRIORITY_BUCKETS.map((bucket) => (
            <PrioritySection
              key={bucket.key}
              bucket={bucket.label}
              count={groupedThreads[bucket.key].length}
            >
              <div className="space-y-3">
                {groupedThreads[bucket.key].map((thread) => {
                  const expanded = expandedThreadId === thread.thread_id;
                  return (
                    <article
                      key={thread.thread_id}
                      className="overflow-hidden rounded-md border border-rule bg-bg"
                    >
                      <StageBanner
                        stageName={thread.streak_stage_name}
                        stageColor={thread.streak_stage_color}
                        effectivePriority={thread.effective_priority}
                        priority={thread.priority}
                        needsReview={thread.needs_review}
                      />
                      <div
                        role="button"
                        tabIndex={0}
                        aria-expanded={expanded}
                        className="cursor-pointer px-4 py-3 hover:bg-bg-2 focus:bg-bg-2 focus:outline-none"
                        onClick={() => setExpandedThreadId(expanded ? null : thread.thread_id)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            setExpandedThreadId(expanded ? null : thread.thread_id);
                          }
                        }}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-ink">{thread.subject}</span>
                          <span className="rounded-full bg-bg-2 px-2 py-0.5 text-xs font-medium text-ink-3">
                            {getMessageCount(thread.messages)}
                          </span>
                          {hasAnyAttachment(thread.messages) && (
                            <span
                              className="text-ink-3"
                              aria-label="Has attachment"
                              title="Has attachment"
                            >
                              <svg
                                className="h-4 w-4"
                                viewBox="0 0 20 20"
                                fill="none"
                                aria-hidden="true"
                              >
                                <path
                                  d="M7 10.5l4.95-4.95a2.47 2.47 0 013.5 3.5L8.75 15.75a4 4 0 01-5.66-5.66l7.07-7.07"
                                  className="stroke-current"
                                  strokeWidth="1.7"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 text-xs text-ink-3">{sender(thread)}</div>
                        <div className="mt-3 grid gap-3 md:grid-cols-12">
                          <div className="md:col-span-6">
                            <div className="text-xs font-semibold uppercase text-ink-3">Why</div>
                            <div className="mt-1 text-sm text-ink-2">
                              {truncateRationale(thread.rationale)}
                            </div>
                          </div>
                          <div className="md:col-span-3">
                            <div className="text-xs font-semibold uppercase text-ink-3">
                              Department
                            </div>
                            <div className="mt-1">
                              <DeptTags departments={thread.department} />
                            </div>
                          </div>
                          <div className="md:col-span-3">
                            <div className="text-xs font-semibold uppercase text-ink-3">Age</div>
                            <div className="mt-1 text-sm text-ink-2">
                              {formatAge(thread.age_days)}
                            </div>
                            <div className="text-xs text-ink-3">
                              {formatReceived(thread.received_at)}
                            </div>
                          </div>
                        </div>
                      </div>
                      {expanded && <ExpandedRow row={thread} />}
                    </article>
                  );
                })}
              </div>
            </PrioritySection>
          ))}
        </section>
      )}
    </main>
  );
}

export default CRMInbox;
