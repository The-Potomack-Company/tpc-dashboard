import { describe, expect, it } from 'vitest';
import { getEffectivePriority, sortTriageRows } from './useCrmTriage';
import type { Priority, TriageRow } from '../services/crm/types';

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
    subject: input.id,
    from_email: null,
    from_name: null,
    received_at: input.received_at,
    snippet: null,
    body_text: null,
    body_source: null,
    classification_id: null,
    classified_at: null,
    department: [],
    priority: input.priority,
    effective_priority: input.effective_priority,
    rationale: null,
    model: null,
    last_polled_at: null,
    age_days: 0,
  };
}

describe('useCrmTriage age-bump rules', () => {
  it('keeps HIGH as HIGH', () => {
    expect(getEffectivePriority('high', 30)).toBe('high');
  });

  it('bumps STANDARD at 5 days to HIGH', () => {
    expect(getEffectivePriority('standard', 4.99)).toBe('standard');
    expect(getEffectivePriority('standard', 5)).toBe('high');
  });

  it('bumps LOW at 7 days to STANDARD', () => {
    expect(getEffectivePriority('low', 6.99)).toBe('low');
    expect(getEffectivePriority('low', 7)).toBe('standard');
  });

  it('bumps LOW at 14 days to HIGH', () => {
    expect(getEffectivePriority('low', 13.99)).toBe('standard');
    expect(getEffectivePriority('low', 14)).toBe('high');
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
