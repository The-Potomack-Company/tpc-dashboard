import { Fragment, useMemo, useState } from 'react';
import { AccessDenied } from '../AccessDenied';
import { EmptyState } from '../EmptyState';
import { useAuthStore } from '../../stores/authStore';
import { useCrmTriage } from '../../hooks/useCrmTriage';
import type { TriageRow } from '../../services/crm/types';
import { DeptTags } from './DeptTags';
import { PriorityChip } from './PriorityChip';

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

const DATE_FORMAT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

function formatReceived(value: string): string {
  return DATE_FORMAT.format(new Date(value));
}

function sender(row: TriageRow): string {
  if (row.from_name && row.from_email) return `${row.from_name} <${row.from_email}>`;
  return row.from_name ?? row.from_email ?? 'Unknown sender';
}

function getPollMessage(response: PollResponse): string {
  const classified = response.classified ?? 0;
  const unchanged = response.skipped_unchanged ?? 0;
  const deferred = response.deferred?.length ?? 0;
  return `Classified ${classified} (${unchanged} unchanged, ${deferred} deferred)`;
}

function EmptyInbox({ onRefresh, isRefreshing }: { onRefresh: () => void; isRefreshing: boolean }) {
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
          {isRefreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </EmptyState>
    </div>
  );
}

export function CRMInbox() {
  const isAdmin = useAuthStore((s) => s.profile?.role === 'admin' && s.profile.is_active === true);
  const accessToken = useAuthStore((s) => s.session?.access_token);
  const { threads, isLoading, error, refetch } = useCrmTriage();
  const [expandedThreadId, setExpandedThreadId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  const expandedRow = useMemo(
    () => threads.find((thread) => thread.thread_id === expandedThreadId) ?? null,
    [threads, expandedThreadId],
  );

  if (!isAdmin) {
    return <AccessDenied />;
  }

  async function handleRefresh() {
    setIsRefreshing(true);
    setToast(null);

    try {
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

      setToast({ tone: 'ok', message: getPollMessage(payload) });
      await refetch();
    } catch (err) {
      setToast({
        tone: 'err',
        message: err instanceof Error ? err.message : 'Refresh failed',
      });
    } finally {
      setIsRefreshing(false);
    }
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
          onClick={() => void handleRefresh()}
          disabled={isRefreshing}
          className="tpc-btn tpc-btn-primary"
          aria-busy={isRefreshing}
        >
          {isRefreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </header>

      {toast && (
        <div
          role={toast.tone === 'err' ? 'alert' : 'status'}
          className={`mb-4 rounded-md px-4 py-3 text-sm ${
            toast.tone === 'err'
              ? 'bg-red-50 text-red-700'
              : 'bg-green-50 text-green-700'
          }`}
        >
          {toast.message}
        </div>
      )}

      {error && (
        <div role="alert" className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          {error instanceof Error ? error.message : 'Could not load CRM inbox'}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-24" aria-busy="true">
          <span className="sr-only">Loading CRM inbox</span>
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-accent" />
        </div>
      ) : threads.length === 0 ? (
        <EmptyInbox onRefresh={() => void handleRefresh()} isRefreshing={isRefreshing} />
      ) : (
        <section className="tpc-card overflow-hidden" data-testid="crm-inbox-table">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-rule text-sm">
              <thead className="bg-bg-2 text-left text-xs font-semibold uppercase text-ink-3">
                <tr>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Subject</th>
                  <th className="px-4 py-3">Departments</th>
                  <th className="px-4 py-3">From</th>
                  <th className="px-4 py-3">Received</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule bg-bg">
                {threads.map((thread) => {
                  const expanded = expandedRow?.thread_id === thread.thread_id;
                  return (
                    <Fragment key={thread.thread_id}>
                      <tr
                        role="button"
                        tabIndex={0}
                        aria-expanded={expanded}
                        className="cursor-pointer align-top hover:bg-bg-2 focus:bg-bg-2 focus:outline-none"
                        onClick={() => setExpandedThreadId(expanded ? null : thread.thread_id)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            setExpandedThreadId(expanded ? null : thread.thread_id);
                          }
                        }}
                      >
                        <td className="whitespace-nowrap px-4 py-3">
                          <PriorityChip priority={thread.effective_priority} />
                          {thread.effective_priority !== thread.priority && (
                            <div className="mt-1 text-xs text-ink-3">
                              Bumped from {thread.priority}
                            </div>
                          )}
                        </td>
                        <td className="min-w-72 px-4 py-3 font-medium text-ink">
                          {thread.subject}
                        </td>
                        <td className="min-w-56 px-4 py-3">
                          <DeptTags departments={thread.department} />
                        </td>
                        <td className="min-w-64 px-4 py-3 text-ink-2">{sender(thread)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-ink-2">
                          {formatReceived(thread.received_at)}
                        </td>
                      </tr>
                      {expanded && (
                        <tr className="bg-bg-2">
                          <td colSpan={5} className="px-4 py-4">
                            <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
                              <div>
                                <h2 className="mb-2 text-xs font-semibold uppercase text-ink-3">
                                  Body
                                </h2>
                                <p className="whitespace-pre-wrap text-sm leading-6 text-ink-2">
                                  {thread.body_text || thread.snippet || 'No body text available.'}
                                </p>
                              </div>
                              <div>
                                <h2 className="mb-2 text-xs font-semibold uppercase text-ink-3">
                                  Classifier rationale
                                </h2>
                                <p className="text-sm leading-6 text-ink-2">
                                  {thread.rationale ?? 'No rationale available.'}
                                </p>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}

export default CRMInbox;
