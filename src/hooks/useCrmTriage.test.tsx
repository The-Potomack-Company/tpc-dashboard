import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  getEffectivePriority,
  getLatestMessage,
  getMessageCount,
  hasAnyAttachment,
  sortTriageRows,
  useCrmTriage,
} from './useCrmTriage';
import type { Priority, TriageRow } from '../services/crm/types';

type ChannelHandler = (payload: { new: { is_current: boolean } }) => void;

const { capturedHandlers } = vi.hoisted(() => ({
  capturedHandlers: [] as ChannelHandler[],
}));

vi.mock('../lib/supabase', () => {
  return {
    supabase: {
      channel: (_name: string) => {
        const builder: {
          on: (event: string, filter: unknown, handler: ChannelHandler) => typeof builder;
          subscribe: () => { unsubscribe: () => void };
        } = {
          on(_event, _filter, handler) {
            capturedHandlers.push(handler);
            return builder;
          },
          subscribe() {
            return { unsubscribe: () => undefined };
          },
        };
        return builder;
      },
      removeChannel: () => undefined,
      from: () => ({
        select: () => Promise.resolve({ data: [], error: null }),
      }),
    },
  };
});

function row(input: {
  id: string;
  received_at: string;
  priority: Priority;
  effective_priority: Priority;
}): TriageRow {
  return {
    thread_id: input.id,
    streak_box_key: input.id,
    streak_pipeline_key: null,
    streak_stage_key: null,
    streak_stage_name: null,
    streak_stage_color: null,
    subject: input.id,
    from_email: null,
    from_name: null,
    received_at: input.received_at,
    snippet: null,
    body_text: null,
    body_source: null,
    messages: [],
    classification_id: null,
    classified_at: null,
    department: [],
    priority: input.priority,
    effective_priority: input.effective_priority,
    rationale: null,
    model: null,
    gmail_thread_id: null,
    last_polled_at: null,
    age_days: 0,
    needs_review: false,
  };
}

describe('useCrmTriage age-bump rules', () => {
  it('keeps HIGH as HIGH', () => {
    expect(getEffectivePriority('high', 30)).toBe('high');
  });

  // 2x age-bump ladder (locked 2026-05-20).
  it('bumps STANDARD at 10 days to HIGH', () => {
    expect(getEffectivePriority('standard', 9.99)).toBe('standard');
    expect(getEffectivePriority('standard', 10)).toBe('high');
  });

  it('bumps LOW at 14 days to STANDARD', () => {
    expect(getEffectivePriority('low', 13.99)).toBe('low');
    expect(getEffectivePriority('low', 14)).toBe('standard');
  });

  it('bumps LOW at 30 days to HIGH', () => {
    expect(getEffectivePriority('low', 29.99)).toBe('standard');
    expect(getEffectivePriority('low', 30)).toBe('high');
  });

  it('does not age-bump rows flagged needs_review', () => {
    // Empty-body LOW row sitting 60 days stays LOW (no promotion on unreadable input).
    expect(getEffectivePriority('low', 60, true)).toBe('low');
    expect(getEffectivePriority('standard', 60, true)).toBe('standard');
  });

  it('sorts HIGH before STANDARD before LOW and oldest first inside each bucket', () => {
    const sorted = sortTriageRows([
      row({
        id: 'standard-newer',
        priority: 'standard',
        effective_priority: 'standard',
        received_at: '2026-05-18T12:00:00.000Z',
      }),
      row({
        id: 'low',
        priority: 'low',
        effective_priority: 'low',
        received_at: '2026-05-01T12:00:00.000Z',
      }),
      row({
        id: 'high-newer',
        priority: 'high',
        effective_priority: 'high',
        received_at: '2026-05-17T12:00:00.000Z',
      }),
      row({
        id: 'high-older',
        priority: 'standard',
        effective_priority: 'high',
        received_at: '2026-05-10T12:00:00.000Z',
      }),
      row({
        id: 'standard-older',
        priority: 'low',
        effective_priority: 'standard',
        received_at: '2026-05-12T12:00:00.000Z',
      }),
    ]);

    expect(sorted.map((item) => item.thread_id)).toEqual([
      'high-older',
      'high-newer',
      'standard-older',
      'standard-newer',
      'low',
    ]);
  });
});

describe('useCrmTriage message helpers', () => {
  const messages = [
    {
      messageId: 'msg-1',
      from: { name: 'Sender', email: 'sender@example.com' },
      date: '2026-05-20T12:00:00.000Z',
      snippet: 'First',
      bodyText: 'First body',
      hasAttachments: false,
      isForward: false,
    },
    {
      messageId: 'msg-2',
      from: { name: 'Sender', email: 'sender@example.com' },
      date: '2026-05-20T13:00:00.000Z',
      snippet: 'Second',
      bodyText: 'Second body',
      hasAttachments: true,
      isForward: false,
    },
  ];

  it('summarizes already-sorted structured messages', () => {
    expect(getLatestMessage(messages)?.messageId).toBe('msg-2');
    expect(getMessageCount(messages)).toBe(2);
    expect(hasAnyAttachment(messages)).toBe(true);
  });
});

describe('useCrmTriage realtime subscription', () => {
  function makeWrapper() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    function Wrapper({ children }: { children: ReactNode }) {
      return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    }
    return { Wrapper, queryClient, invalidateSpy };
  }

  it('invalidates the triage query when a crm_classifications INSERT arrives', async () => {
    capturedHandlers.length = 0;
    const { Wrapper, invalidateSpy } = makeWrapper();

    renderHook(() => useCrmTriage(), { wrapper: Wrapper });

    // The realtime subscription registers a postgres_changes handler on mount.
    await waitFor(() => expect(capturedHandlers.length).toBeGreaterThan(0));
    const handler = capturedHandlers[capturedHandlers.length - 1];

    handler({ new: { is_current: true } });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['crm', 'triage'] });
  });

  it('fires onClassificationInsert callback alongside invalidation', async () => {
    capturedHandlers.length = 0;
    const { Wrapper } = makeWrapper();
    const onInsert = vi.fn();

    renderHook(() => useCrmTriage({ onClassificationInsert: onInsert }), { wrapper: Wrapper });

    await waitFor(() => expect(capturedHandlers.length).toBeGreaterThan(0));
    const handler = capturedHandlers[capturedHandlers.length - 1];

    handler({ new: { is_current: true } });

    expect(onInsert).toHaveBeenCalledTimes(1);
  });
});
