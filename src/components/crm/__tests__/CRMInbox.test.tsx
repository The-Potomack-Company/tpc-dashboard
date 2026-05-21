import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CRMInbox } from '../CRMInbox';
import type { TriageRow } from '../../../services/crm/types';

type UseCrmTriageOptions = { onClassificationInsert?: () => void };

const useCrmTriageMock = vi.fn<(options?: UseCrmTriageOptions) => unknown>();
const lastInsertCallback = { current: undefined as (() => void) | undefined };

vi.mock('../../../hooks/useCrmTriage', () => ({
  getMessageCount: (messages: TriageRow['messages']) => messages.length,
  hasAnyAttachment: (messages: TriageRow['messages']) =>
    messages.some((message) => message.hasAttachments),
  useCrmTriage: (options?: UseCrmTriageOptions) => {
    lastInsertCallback.current = options?.onClassificationInsert;
    return useCrmTriageMock(options);
  },
}));

vi.mock('../../../stores/authStore', () => ({
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector({
      profile: { role: 'admin', is_active: true },
      session: { access_token: 'token-123' },
    }),
}));

function makeThread(input: {
  id: string;
  subject: string;
  priority: TriageRow['priority'];
  effective_priority: TriageRow['effective_priority'];
  received_at: string;
  body_text?: string;
  rationale?: string;
}): TriageRow {
  return {
    thread_id: input.id,
    streak_box_key: input.id,
    streak_pipeline_key: 'pipeline',
    streak_stage_key: 'stage',
    streak_stage_name: 'New',
    subject: input.subject,
    from_email: `${input.id}@example.com`,
    from_name: `Sender ${input.id}`,
    received_at: input.received_at,
    snippet: null,
    body_text: input.body_text ?? `Body for ${input.subject}`,
    body_source: 'gmail',
    messages: [
      {
        messageId: `${input.id}-message`,
        from: { name: `Sender ${input.id}`, email: `${input.id}@example.com` },
        date: input.received_at,
        snippet: null ?? '',
        bodyText: input.body_text ?? `Body for ${input.subject}`,
        hasAttachments: false,
        isForward: false,
      },
    ],
    classification_id: `${input.id}-classification`,
    classified_at: '2026-05-20T12:00:00.000Z',
    department: ['furniture'],
    priority: input.priority,
    effective_priority: input.effective_priority,
    rationale: input.rationale ?? `Rationale for ${input.subject}`,
    model: 'gemini-2.5-flash',
    last_polled_at: '2026-05-20T12:30:00.000Z',
    age_days: 0,
    needs_review: false,
  };
}

const threads: TriageRow[] = [
  makeThread({
    id: 'stale-standard',
    subject: 'Stale signed painting',
    priority: 'standard',
    effective_priority: 'high',
    received_at: '2026-05-10T12:00:00.000Z',
    body_text: 'Full stale painting body',
    rationale: 'Standard item aged into high priority.',
  }),
  makeThread({
    id: 'fresh-high',
    subject: 'Fresh estate deadline',
    priority: 'high',
    effective_priority: 'high',
    received_at: '2026-05-19T12:00:00.000Z',
  }),
  makeThread({
    id: 'standard',
    subject: 'Standard furniture inquiry',
    priority: 'standard',
    effective_priority: 'standard',
    received_at: '2026-05-18T12:00:00.000Z',
  }),
  makeThread({
    id: 'low',
    subject: 'Low value books',
    priority: 'low',
    effective_priority: 'low',
    received_at: '2026-05-20T12:00:00.000Z',
  }),
];

function renderWithClient(node: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
  const result = render(<QueryClientProvider client={queryClient}>{node}</QueryClientProvider>);
  return { ...result, queryClient, invalidateSpy };
}

beforeEach(() => {
  useCrmTriageMock.mockReset();
  lastInsertCallback.current = undefined;
  useCrmTriageMock.mockReturnValue({
    threads,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  });
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ classified: 2, skipped_unchanged: 1, deferred: ['box-3'] }),
    }),
  );
});

describe('CRMInbox', () => {
  it('renders rows in priority order and marks age-bumped rows in the HIGH bucket', () => {
    renderWithClient(<CRMInbox />);

    const tableText = screen.getByTestId('crm-inbox-table').textContent ?? '';
    expect(tableText.indexOf('Stale signed painting')).toBeLessThan(
      tableText.indexOf('Fresh estate deadline'),
    );
    expect(tableText.indexOf('Fresh estate deadline')).toBeLessThan(
      tableText.indexOf('Standard furniture inquiry'),
    );
    expect(tableText.indexOf('Standard furniture inquiry')).toBeLessThan(
      tableText.indexOf('Low value books'),
    );
    expect(screen.getByText('↑ from standard')).toBeInTheDocument();
  });

  it('posts to crm-poll, shows the success toast, and invalidates the triage query', async () => {
    const user = userEvent.setup();
    const { invalidateSpy } = renderWithClient(<CRMInbox />);

    await user.click(screen.getByRole('button', { name: 'Refresh' }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/crm-poll', {
        method: 'POST',
        headers: { Authorization: 'Bearer token-123' },
      });
    });
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Classified 2 (1 unchanged, 1 deferred)',
    );
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['crm', 'triage'] });
  });

  it('shows a red error toast when the poll endpoint fails', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({ error: 'streak timeout' }),
      }),
    );
    renderWithClient(<CRMInbox />);

    await user.click(screen.getByRole('button', { name: 'Refresh' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Streak unavailable, try again');
  });

  it('increments the live counter on realtime classification inserts during a poll', async () => {
    const user = userEvent.setup();
    let resolvePoll: ((value: unknown) => void) | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            resolvePoll = (payload) =>
              resolve({ ok: true, status: 200, json: async () => payload });
          }),
      ),
    );
    renderWithClient(<CRMInbox />);

    await user.click(screen.getByRole('button', { name: 'Refresh' }));

    // Simulate two realtime inserts arriving while the poll is in flight.
    act(() => {
      lastInsertCallback.current?.();
      lastInsertCallback.current?.();
    });

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Polling… 2/ }),
      ).toBeInTheDocument();
    });

    // Finish the poll so the button returns to "Refresh".
    act(() => {
      resolvePoll?.({ classified: 2, skipped_unchanged: 0, deferred: [] });
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
    });
  });

  it('expands a row to show body text and classifier rationale', async () => {
    const user = userEvent.setup();
    renderWithClient(<CRMInbox />);

    await user.click(screen.getByText('Stale signed painting'));

    expect(screen.getByText('Full stale painting body')).toBeInTheDocument();
    // Rationale is now also rendered in the inline Why column. Two matches
    // is the expected state (column + expanded panel).
    expect(screen.getAllByText('Standard item aged into high priority.')).toHaveLength(2);
  });
});
