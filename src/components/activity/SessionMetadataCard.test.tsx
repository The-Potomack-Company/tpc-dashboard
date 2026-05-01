import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { SessionMetadataCard } from './SessionMetadataCard';
import type { SessionDetailRow } from '../../services/activity/queries';

// Phase 3 / Plan 03-06 / Task 2 — SessionMetadataCard tests.
//
// Pure presentation; the page (Plan 03-08) is responsible for ET-formatting
// the timestamps before passing them in. The component renders EMPTY (em-dash)
// for any null/empty value per UI-SPEC § Typography "Null / missing".

const FULL: SessionDetailRow = {
  session_id: 's1',
  name: 'Sale 0301',
  mode: 'sale',
  status: 'active',
  assigned_to_id: 'u1',
  assigned_to_display_name: 'Alice',
  created_by_id: 'u2',
  created_by_display_name: 'Bob',
  created_at: 'Mar 15, 10:30 AM ET',
  updated_at: 'Mar 15, 11:45 AM ET',
  notes: 'Some notes',
  review_notes: 'Some review notes',
};

describe('<SessionMetadataCard>', () => {
  it('Test 1: renders 9 metadata fields with the heading "Session details"', () => {
    render(<SessionMetadataCard session={FULL} />);
    expect(
      screen.getByRole('heading', { name: /Session details/i }),
    ).toBeInTheDocument();
    // 9 dt elements (one per field).
    const labels = ['Name', 'Mode', 'Status', 'Specialist', 'Created by', 'Created', 'Last updated', 'Notes', 'Review notes'];
    for (const label of labels) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    // Values render.
    expect(screen.getByText('Sale 0301')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Mar 15, 10:30 AM ET')).toBeInTheDocument();
  });

  it('Test 2: renders EMPTY (em-dash) for null/empty values', () => {
    const empty: SessionDetailRow = {
      ...FULL,
      assigned_to_display_name: null as unknown as string, // simulate null specialist
      notes: null as unknown as string,
      review_notes: null as unknown as string,
    };
    render(<SessionMetadataCard session={empty} />);
    // Em-dash characters appear at least 3 times (Specialist, Notes, Review notes).
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(3);
  });

  it('Test 3: renders Created and Last updated values (caller is responsible for ET formatting)', () => {
    render(<SessionMetadataCard session={FULL} />);
    expect(screen.getByText('Mar 15, 10:30 AM ET')).toBeInTheDocument();
    expect(screen.getByText('Mar 15, 11:45 AM ET')).toBeInTheDocument();
  });
});
