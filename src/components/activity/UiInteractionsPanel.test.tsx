import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

// Phase 3 / D-31 / D-32 — UiInteractionsPanel composition test.
// Mocks all 4 children to verify the panel composes them in order with
// the correct copy and `space-y-6` rhythm.

vi.mock('./UiTopPagesTable', () => ({
  UiTopPagesTable: () => <div data-testid="ui-top-pages-table-stub" />,
}));
vi.mock('./UiTopElementsTable', () => ({
  UiTopElementsTable: () => <div data-testid="ui-top-elements-table-stub" />,
}));
vi.mock('./WalkthroughFunnel', () => ({
  WalkthroughFunnel: () => <div data-testid="walkthrough-funnel-stub" />,
}));
vi.mock('./UiRecentEventsFeed', () => ({
  UiRecentEventsFeed: () => <div data-testid="ui-recent-events-feed-stub" />,
}));

import { UiInteractionsPanel } from './UiInteractionsPanel';

describe('<UiInteractionsPanel>', () => {
  it('Test 1: renders sub-panel heading "UI interactions (TPC App)" and subheading "app_source = \'tpc-app\' · admin-side observation"', () => {
    render(<UiInteractionsPanel />);
    expect(screen.getByText('UI interactions (TPC App)')).toBeInTheDocument();
    expect(
      screen.getByText("app_source = 'tpc-app' · admin-side observation"),
    ).toBeInTheDocument();
  });

  it('Test 2: composes 4 child components in order: TopPages, TopElements, WalkthroughFunnel, UiRecentEventsFeed', () => {
    render(<UiInteractionsPanel />);
    const stubs = [
      screen.getByTestId('ui-top-pages-table-stub'),
      screen.getByTestId('ui-top-elements-table-stub'),
      screen.getByTestId('walkthrough-funnel-stub'),
      screen.getByTestId('ui-recent-events-feed-stub'),
    ];
    // All 4 must be present.
    for (const s of stubs) expect(s).toBeInTheDocument();
    // DOM order: each subsequent stub follows the previous one in document flow.
    for (let i = 0; i < stubs.length - 1; i++) {
      // Node.compareDocumentPosition: DOCUMENT_POSITION_FOLLOWING = 4.
      const pos = stubs[i].compareDocumentPosition(stubs[i + 1]);
      expect(pos & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  it('Test 3: outer section uses `space-y-6` vertical rhythm between sub-panels', () => {
    render(<UiInteractionsPanel />);
    const panel = screen.getByTestId('ui-interactions-panel');
    expect(panel.className).toContain('space-y-6');
  });
});
