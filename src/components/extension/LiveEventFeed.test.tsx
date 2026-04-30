import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LiveEventFeed } from './LiveEventFeed';

// Mock the data hook — component reads everything (data, paused, pause/resume,
// loading/error) through the hook contract proven in Plan 02-03.
const liveFeedMock = vi.fn();
vi.mock('../../hooks/extension/useLiveFeed', () => ({
  useLiveFeed: () => liveFeedMock(),
}));

// Mock the auth store via selector — same pattern Plan 02-05 uses for the
// dev-gate split (see RecentErrorsTable.test.tsx).
const authStateMock = vi.fn();
vi.mock('../../stores/authStore', () => ({
  useAuthStore: <T,>(selector: (s: unknown) => T): T => selector(authStateMock()),
}));

// JSDom does NOT implement HTMLDialogElement.showModal/.close natively —
// polyfill them so PayloadViewerModal effects can run without throwing.
beforeEach(() => {
  if (typeof HTMLDialogElement !== 'undefined') {
    if (!HTMLDialogElement.prototype.showModal) {
      HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
        this.setAttribute('open', '');
      };
    }
    if (!HTMLDialogElement.prototype.close) {
      HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
        this.removeAttribute('open');
        this.dispatchEvent(new Event('close'));
      };
    }
  }
  liveFeedMock.mockReset();
  authStateMock.mockReset();
  // Default: admin (non-dev) email.
  authStateMock.mockReturnValue({ profile: { email: 'admin@example.com' } });
});

const SAMPLE_ROWS = [
  {
    id: '1',
    created_at: '2026-04-29T18:15:00Z',
    user_email: 'a@x.com',
    event_type: 'catalog_single',
    error_message: null,
    extension_version: '2.0.1',
    items_content: { foo: 1 },
  },
  {
    id: '2',
    created_at: '2026-04-29T18:14:50Z',
    user_email: 'b@x.com',
    event_type: 'catalog_batch',
    error_message: 'boom',
    extension_version: '2.0.1',
    items_content: { bar: 2 },
  },
  {
    id: '3',
    created_at: '2026-04-29T18:14:40Z',
    user_email: null,
    event_type: 'portal_upload',
    error_message: null,
    extension_version: '2.0.1',
    items_content: { upload: 3 },
  },
  {
    id: '4',
    created_at: '2026-04-29T18:14:30Z',
    user_email: 'c@x.com',
    event_type: 'spreadsheet_transform',
    error_message: null,
    extension_version: '2.0.1',
    items_content: { rows: 12 },
  },
  {
    id: '5',
    created_at: '2026-04-29T18:14:20Z',
    user_email: 'd@x.com',
    event_type: 'data_import',
    error_message: null,
    extension_version: '2.0.1',
    items_content: { dataset: 'x' },
  },
];

function makeHookReturn(over: Partial<ReturnType<typeof baseHookReturn>> = {}) {
  return { ...baseHookReturn(), ...over };
}

function baseHookReturn() {
  return {
    data: SAMPLE_ROWS,
    isLoading: false,
    error: null as unknown,
    refetch: vi.fn(),
    paused: false,
    pause: vi.fn(),
    resume: vi.fn(),
  };
}

describe('<LiveEventFeed>', () => {
  // ---------------------------------------------------------------------------
  // Test 1 — Initial mount running state
  // ---------------------------------------------------------------------------
  it('renders the running subtitle, green pulsing dot, and Pause button when not paused', () => {
    liveFeedMock.mockReturnValue(makeHookReturn());
    render(<LiveEventFeed />);
    // Subtitle copy verbatim from UI-SPEC § Copywriting EXT-08.
    expect(
      screen.getByText('Tailing latest 50 events · refreshes every 10s'),
    ).toBeInTheDocument();
    // Pause button visible (the running state's only control).
    expect(
      screen.getByRole('button', { name: 'Pause live feed' }),
    ).toBeInTheDocument();
    // sr-only Live label present so screen readers announce running state.
    expect(screen.getByText('Live')).toBeInTheDocument();
    // Live dot uses bg-green-500 + animate-pulse — locate via test container.
    const feed = screen.getByTestId('live-event-feed');
    const dot = feed.querySelector('span[aria-hidden="true"]');
    expect(dot).not.toBeNull();
    expect(dot!.className).toMatch(/bg-green-500/);
    expect(dot!.className).toMatch(/animate-pulse/);
  });

  // ---------------------------------------------------------------------------
  // Test 2 — Pause click
  // ---------------------------------------------------------------------------
  it('clicking Pause calls hook.pause() and (after re-render with paused=true) flips subtitle and dot', async () => {
    let paused = false;
    const pauseSpy = vi.fn(() => {
      paused = true;
    });
    liveFeedMock.mockImplementation(() =>
      makeHookReturn({
        paused,
        pause: pauseSpy,
      }),
    );
    const { rerender } = render(<LiveEventFeed />);
    await userEvent.click(screen.getByRole('button', { name: 'Pause live feed' }));
    expect(pauseSpy).toHaveBeenCalledOnce();

    // Hook now reports paused=true — rerender to read the new value.
    rerender(<LiveEventFeed />);
    expect(
      screen.getByText('Paused · 5 events shown at pause time'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Resume live feed' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Paused')).toBeInTheDocument();
    const feed = screen.getByTestId('live-event-feed');
    const dot = feed.querySelector('span[aria-hidden="true"]');
    expect(dot!.className).toMatch(/bg-gray-400/);
    expect(dot!.className).not.toMatch(/animate-pulse/);
  });

  // ---------------------------------------------------------------------------
  // Test 3 — Resume click
  // ---------------------------------------------------------------------------
  it('clicking Resume calls hook.resume() and flips back to running subtitle/button', async () => {
    let paused = true;
    const resumeSpy = vi.fn(() => {
      paused = false;
    });
    liveFeedMock.mockImplementation(() =>
      makeHookReturn({
        paused,
        resume: resumeSpy,
      }),
    );
    const { rerender } = render(<LiveEventFeed />);
    await userEvent.click(screen.getByRole('button', { name: 'Resume live feed' }));
    expect(resumeSpy).toHaveBeenCalledOnce();
    rerender(<LiveEventFeed />);
    expect(
      screen.getByText('Tailing latest 50 events · refreshes every 10s'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Pause live feed' }),
    ).toBeInTheDocument();
  });

  // ---------------------------------------------------------------------------
  // Test 4 — Row rendering with badges
  // ---------------------------------------------------------------------------
  it('renders 5 rows with timestamp + badge + email; error rows get red left border + red timestamp', () => {
    liveFeedMock.mockReturnValue(makeHookReturn());
    render(<LiveEventFeed />);
    // 5 rows total.
    expect(screen.getAllByRole('listitem')).toHaveLength(5);
    // Each event-type badge appears exactly once.
    expect(screen.getByText('catalog_single')).toBeInTheDocument();
    expect(screen.getByText('catalog_batch')).toBeInTheDocument();
    expect(screen.getByText('portal_upload')).toBeInTheDocument();
    expect(screen.getByText('spreadsheet_transform')).toBeInTheDocument();
    expect(screen.getByText('data_import')).toBeInTheDocument();
    // Badge palette — verbatim from UI-SPEC § Color "Live-feed event-type badge palette".
    expect(screen.getByText('catalog_single').className).toMatch(/bg-slate-100/);
    expect(screen.getByText('catalog_single').className).toMatch(/text-slate-700/);
    expect(screen.getByText('catalog_batch').className).toMatch(/bg-sky-100/);
    expect(screen.getByText('catalog_batch').className).toMatch(/text-sky-700/);
    expect(screen.getByText('portal_upload').className).toMatch(/bg-teal-100/);
    expect(screen.getByText('portal_upload').className).toMatch(/text-teal-700/);
    expect(screen.getByText('spreadsheet_transform').className).toMatch(/bg-amber-100/);
    // text-amber-800 (NOT -700) is the locked exception per UI-SPEC § Accessibility.
    expect(screen.getByText('spreadsheet_transform').className).toMatch(/text-amber-800/);
    expect(screen.getByText('data_import').className).toMatch(/bg-violet-100/);
    expect(screen.getByText('data_import').className).toMatch(/text-violet-700/);
    // The catalog_batch row is the only one with error_message — its <li> child
    // carries the red left border. Find it by walking up from the badge.
    const errorBadge = screen.getByText('catalog_batch');
    const errorRow = errorBadge.closest('li')!.firstElementChild as HTMLElement;
    expect(errorRow.className).toMatch(/border-l-red-500/);
    // Timestamp (sibling of badge) should be red on the error row.
    const errorRowTimestamp = errorRow.querySelector('span.tabular-nums');
    expect(errorRowTimestamp).not.toBeNull();
    expect(errorRowTimestamp!.className).toMatch(/text-red-600/);
    // Non-error timestamps stay gray.
    const successBadge = screen.getByText('catalog_single');
    const successRow = successBadge.closest('li')!.firstElementChild as HTMLElement;
    const successRowTimestamp = successRow.querySelector('span.tabular-nums');
    expect(successRowTimestamp!.className).toMatch(/text-gray-500/);
  });

  // ---------------------------------------------------------------------------
  // Test 5 — Admin row click is no-op
  // ---------------------------------------------------------------------------
  it('admin row click is a no-op (no payload modal opens)', async () => {
    authStateMock.mockReturnValue({ profile: { email: 'admin@example.com' } });
    liveFeedMock.mockReturnValue(makeHookReturn());
    render(<LiveEventFeed />);
    // Admin rows render as <div>, not <button> — there's no clickable element
    // with aria-haspopup. Click the email cell directly to confirm no modal opens.
    await userEvent.click(screen.getByText('a@x.com'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    // No row-buttons advertised either.
    const rowButtons = screen.queryAllByRole('button').filter((b) => b.getAttribute('aria-haspopup') === 'dialog');
    expect(rowButtons).toHaveLength(0);
  });

  // ---------------------------------------------------------------------------
  // Test 6 — Dev row click opens the PayloadViewerModal with the right title
  // ---------------------------------------------------------------------------
  it('dev row click opens the PayloadViewerModal with `${event_type} payload — ${user_email}`', async () => {
    authStateMock.mockReturnValue({ profile: { email: 'josh@potomackco.com' } });
    liveFeedMock.mockReturnValue(makeHookReturn());
    render(<LiveEventFeed />);
    const rowButtons = screen
      .getAllByRole('button')
      .filter((b) => b.getAttribute('aria-haspopup') === 'dialog');
    expect(rowButtons.length).toBeGreaterThan(0);
    // Click the first row (catalog_single, a@x.com).
    await userEvent.click(rowButtons[0]);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(
      screen.getByText('catalog_single payload — a@x.com'),
    ).toBeInTheDocument();
  });

  // ---------------------------------------------------------------------------
  // Test 7 — Empty state
  // ---------------------------------------------------------------------------
  it('shows "Waiting for events…" italic muted message when data is an empty array', () => {
    liveFeedMock.mockReturnValue(makeHookReturn({ data: [] }));
    render(<LiveEventFeed />);
    const msg = screen.getByText(/Waiting for events/);
    expect(msg).toBeInTheDocument();
    expect(msg.className).toMatch(/italic/);
    expect(msg.className).toMatch(/text-gray-500/);
  });

  // ---------------------------------------------------------------------------
  // Test 8 — Error state with locked Phase 1 ErrorState contract
  // ---------------------------------------------------------------------------
  it('renders <ErrorState> with locked heading/body and Retry that calls refetch', async () => {
    const refetchSpy = vi.fn();
    liveFeedMock.mockReturnValue(
      makeHookReturn({
        data: undefined,
        error: new Error('network down'),
        refetch: refetchSpy,
      }),
    );
    render(<LiveEventFeed />);
    expect(screen.getByText("Couldn't load live feed")).toBeInTheDocument();
    expect(
      screen.getByText('Polling failed. Retry below to start tailing again.'),
    ).toBeInTheDocument();
    const retry = screen.getByRole('button', { name: /retry/i });
    await userEvent.click(retry);
    expect(refetchSpy).toHaveBeenCalledOnce();
  });

  // ---------------------------------------------------------------------------
  // Test 9 — Pause/Resume aria-labels
  // ---------------------------------------------------------------------------
  it('Pause button has aria-label="Pause live feed"; Resume button has aria-label="Resume live feed"', () => {
    // Running -> Pause label.
    liveFeedMock.mockReturnValue(makeHookReturn());
    const { rerender } = render(<LiveEventFeed />);
    expect(
      screen.getByRole('button', { name: 'Pause live feed' }),
    ).toBeInTheDocument();
    // Paused -> Resume label.
    liveFeedMock.mockReturnValue(makeHookReturn({ paused: true }));
    rerender(<LiveEventFeed />);
    expect(
      screen.getByRole('button', { name: 'Resume live feed' }),
    ).toBeInTheDocument();
  });

  // ---------------------------------------------------------------------------
  // Test 10 — Subtitle has aria-live="polite" + aria-atomic="true"
  // ---------------------------------------------------------------------------
  it('subtitle <p> has aria-live="polite" and aria-atomic="true" so SR announces Pause/Resume', () => {
    liveFeedMock.mockReturnValue(makeHookReturn());
    render(<LiveEventFeed />);
    const subtitle = screen.getByText(
      'Tailing latest 50 events · refreshes every 10s',
    );
    expect(subtitle).toHaveAttribute('aria-live', 'polite');
    expect(subtitle).toHaveAttribute('aria-atomic', 'true');
  });
});
