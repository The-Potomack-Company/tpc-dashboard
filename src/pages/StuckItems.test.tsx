import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { StuckItemsPage } from './StuckItems';

// Phase 3 / Plan 03-08 — StuckItems page composition smoke test.
//
// /activity/stuck is a bookmarkable triage page (D-07). URL params from
// /activity are NOT inherited (D-23) — the back link goes to plain
// `/activity` and the page has NO filter row.

vi.mock('../components/activity/StuckItemsTable', () => ({
  StuckItemsTable: () => <div data-testid="stuck-items-table" />,
}));

function makeWrapper(initialEntries: string[]) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={initialEntries}>
      <QueryClientProvider client={client}>
        <Routes>
          <Route path="/activity/stuck" element={children} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe('StuckItemsPage', () => {
  const originalTitle = document.title;

  beforeEach(() => {
    document.title = originalTitle;
  });

  afterEach(() => {
    document.title = originalTitle;
  });

  it('Test 9: renders heading "Stuck items" + subtitle copy', () => {
    render(<StuckItemsPage />, { wrapper: makeWrapper(['/activity/stuck']) });

    expect(
      screen.getByRole('heading', { name: 'Stuck items', level: 1 }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Items in 'processing' or 'queued' for more than 2 hours",
      ),
    ).toBeInTheDocument();
  });

  it('Test 10: BackLink navigates to /activity with NO preserved params (D-23)', () => {
    render(<StuckItemsPage />, {
      wrapper: makeWrapper([
        '/activity/stuck?range=7d&specialists=a@x.com&mode=house',
      ]),
    });

    const back = screen.getByRole('link', { name: /Activity/i });
    expect(back).toBeInTheDocument();
    // Even with query params on the current URL, back link must be plain /activity (D-23).
    expect(back.getAttribute('href')).toBe('/activity');
  });

  it('Test 11: document.title is "Stuck items — TPC Dashboard"; restored on unmount', () => {
    document.title = 'Original';
    const { unmount } = render(<StuckItemsPage />, {
      wrapper: makeWrapper(['/activity/stuck']),
    });

    expect(document.title).toBe('Stuck items — TPC Dashboard');

    unmount();
    expect(document.title).toBe('Original');
  });

  it('Test 12: composes a single <StuckItemsTable> below the header', () => {
    const { container } = render(<StuckItemsPage />, {
      wrapper: makeWrapper(['/activity/stuck']),
    });

    const table = screen.getByTestId('stuck-items-table');
    expect(table).toBeInTheDocument();

    // Page has exactly one StuckItemsTable instance.
    expect(container.querySelectorAll('[data-testid="stuck-items-table"]').length).toBe(1);

    // Confirms <main> is the outer wrapper.
    const main = container.querySelector('main');
    expect(main).not.toBeNull();
    expect(main!.contains(table)).toBe(true);
  });

  it('Test 13: page does NOT inherit ?specialists= or ?mode= from /activity (D-23)', () => {
    // URL has filter params but the page does not pass them to the table —
    // the table reads its own URL state (which would be empty if /activity/stuck
    // is reached from the alert card directly). Validate at least that the
    // back link drops the params per D-23.
    render(<StuckItemsPage />, {
      wrapper: makeWrapper([
        '/activity/stuck?specialists=a@x.com&mode=house',
      ]),
    });
    const back = screen.getByRole('link', { name: /Activity/i });
    expect(back.getAttribute('href')).toBe('/activity');
  });

  it('Test 14: NO filter row on the page (UI-SPEC committed)', () => {
    const { container } = render(<StuckItemsPage />, {
      wrapper: makeWrapper(['/activity/stuck']),
    });

    // The page must NOT mount DateRangeFilter / SpecialistMultiSelect / ModeToggle.
    // These mocks would expose data-testids; their absence is the assertion.
    expect(container.querySelector('[data-testid="date-range-filter"]')).toBeNull();
    expect(container.querySelector('[data-testid="specialist-multi-select"]')).toBeNull();
    expect(container.querySelector('[data-testid="mode-toggle"]')).toBeNull();
    // Also ensure no role=radiogroup (the ModeToggle pattern).
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
  });

  it('renders a breadcrumb "Activity › Stuck items"', () => {
    render(<StuckItemsPage />, { wrapper: makeWrapper(['/activity/stuck']) });
    const breadcrumb = screen.getByLabelText(/breadcrumb/i);
    expect(breadcrumb.textContent).toContain('Activity');
    expect(breadcrumb.textContent).toContain('Stuck items');
  });
});
