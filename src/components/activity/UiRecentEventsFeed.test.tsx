import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Phase 3 / D-32 / D-33 — UiRecentEventsFeed tests.
// Mirrors Phase 2 LiveEventFeed tests verbatim where possible (pause/resume
// flow, indicator-dot states, row-click → PayloadViewerModal). DOES NOT
// re-test isDev gating — UiRecentEventsFeed has no internal gate; the parent
// <DeveloperPanel> render-conditional gate handles dev-only access.

const useUiRecentEventsFeedMock = vi.fn();
vi.mock('../../hooks/activity/useUiRecentEventsFeed', () => ({
  useUiRecentEventsFeed: () => useUiRecentEventsFeedMock(),
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
  useUiRecentEventsFeedMock.mockReset();
});

import { UiRecentEventsFeed } from './UiRecentEventsFeed';

const SAMPLE_ROWS = [
  {
    id: '1',
    app_source: 'tpc-app',
    app_version: '1.2.3',
    user_id: 'u-1',
    user_email: 'a@x.com',
    session_id: 's-1',
    interaction_type: 'view',
    page_path: '/dashboard',
    element_id: null,
    metadata: { foo: 1 },
    created_at: '2026-04-29T18:15:00Z',
  },
  {
    id: '2',
    app_source: 'tpc-app',
    app_version: '1.2.3',
    user_id: 'u-2',
    user_email: 'b@x.com',
    session_id: 's-2',
    interaction_type: 'click',
    page_path: '/items',
    element_id: 'btn-save',
    metadata: { btn: 'save' },
    created_at: '2026-04-29T18:14:50Z',
  },
  {
    id: '3',
    app_source: 'tpc-app',
    app_version: '1.2.3',
    user_id: 'u-3',
    user_email: null,
    session_id: 's-3',
    interaction_type: 'focus',
    page_path: '/sessions',
    element_id: 'input-1',
    metadata: null,
    created_at: '2026-04-29T18:14:40Z',
  },
  {
    id: '4',
    app_source: 'tpc-app',
    app_version: '1.2.3',
    user_id: 'u-4',
    user_email: 'c@x.com',
    session_id: 's-4',
    interaction_type: 'blur',
    page_path: '/items',
    element_id: 'input-2',
    metadata: null,
    created_at: '2026-04-29T18:14:30Z',
  },
  {
    id: '5',
    app_source: 'tpc-app',
    app_version: '1.2.3',
    user_id: 'u-5',
    user_email: 'd@x.com',
    session_id: 's-5',
    interaction_type: 'submit',
    page_path: '/profile',
    element_id: 'form-1',
    metadata: null,
    created_at: '2026-04-29T18:14:20Z',
  },
  {
    id: '6',
    app_source: 'tpc-app',
    app_version: '1.2.3',
    user_id: 'u-6',
    user_email: 'e@x.com',
    session_id: 's-6',
    interaction_type: 'walkthrough_step',
    page_path: '/welcome',
    element_id: 'step-1',
    metadata: { step: 1 },
    created_at: '2026-04-29T18:14:10Z',
  },
];

function makeHookReturn(over: Partial<ReturnType<typeof base>> = {}) {
  return { ...base(), ...over };
}

function base() {
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

describe('<UiRecentEventsFeed>', () => {
  it('Test 1: section heading "Recent UI events" + running subheading "Tailing latest 50 ui_interactions · refreshes every 10s"', () => {
    useUiRecentEventsFeedMock.mockReturnValue(makeHookReturn());
    render(<UiRecentEventsFeed />);
    expect(screen.getByText('Recent UI events')).toBeInTheDocument();
    expect(
      screen.getByText('Tailing latest 50 ui_interactions · refreshes every 10s'),
    ).toBeInTheDocument();
  });

  it('Test 2: when paused, subheading reads "Paused · {n} events shown at pause time" with the actual row count', () => {
    useUiRecentEventsFeedMock.mockReturnValue(
      makeHookReturn({ paused: true }),
    );
    render(<UiRecentEventsFeed />);
    expect(
      screen.getByText('Paused · 6 events shown at pause time'),
    ).toBeInTheDocument();
  });

  it('Test 3a: live indicator dot is green pulsing when running (bg-green-500 + motion-safe:animate-pulse) and sr-only "Live" label', () => {
    useUiRecentEventsFeedMock.mockReturnValue(makeHookReturn());
    render(<UiRecentEventsFeed />);
    expect(screen.getByText('Live')).toBeInTheDocument();
    const feed = screen.getByTestId('ui-recent-events-feed');
    const dot = feed.querySelector('span[aria-hidden="true"]');
    expect(dot).not.toBeNull();
    expect(dot!.className).toMatch(/bg-green-500/);
    expect(dot!.className).toMatch(/animate-pulse/);
  });

  it('Test 3b: live indicator dot is static gray when paused (bg-gray-400, no animate-pulse) and sr-only "Paused" label', () => {
    useUiRecentEventsFeedMock.mockReturnValue(
      makeHookReturn({ paused: true }),
    );
    render(<UiRecentEventsFeed />);
    expect(screen.getByText('Paused')).toBeInTheDocument();
    const feed = screen.getByTestId('ui-recent-events-feed');
    const dot = feed.querySelector('span[aria-hidden="true"]');
    expect(dot!.className).toMatch(/bg-gray-400/);
    expect(dot!.className).not.toMatch(/animate-pulse/);
  });

  it('Test 4: Pause button visible when running; clicking calls hook.pause()', async () => {
    const pauseSpy = vi.fn();
    useUiRecentEventsFeedMock.mockReturnValue(
      makeHookReturn({ pause: pauseSpy }),
    );
    render(<UiRecentEventsFeed />);
    const btn = screen.getByRole('button', { name: 'Pause' });
    await userEvent.click(btn);
    expect(pauseSpy).toHaveBeenCalledOnce();
  });

  it('Test 5: Resume button visible when paused; clicking calls hook.resume()', async () => {
    const resumeSpy = vi.fn();
    useUiRecentEventsFeedMock.mockReturnValue(
      makeHookReturn({ paused: true, resume: resumeSpy }),
    );
    render(<UiRecentEventsFeed />);
    const btn = screen.getByRole('button', { name: 'Resume' });
    await userEvent.click(btn);
    expect(resumeSpy).toHaveBeenCalledOnce();
  });

  it('Test 6: row content layout — [timestamp] [interaction_type chip] [user_email] [page_path] in order', () => {
    useUiRecentEventsFeedMock.mockReturnValue(makeHookReturn());
    render(<UiRecentEventsFeed />);
    const items = screen.getAllByRole('listitem');
    expect(items.length).toBe(6);
    const firstRowButton = items[0].querySelector('button');
    expect(firstRowButton).not.toBeNull();
    const children = firstRowButton!.children;
    // 4 spans: timestamp, chip, user_email, page_path.
    expect(children.length).toBe(4);
    // Span 2 (index 1) is the chip — its text is the interaction_type.
    expect(children[1].textContent).toBe('view');
    // Span 3 (index 2) is the user_email.
    expect(children[2].textContent).toBe('a@x.com');
    // Span 4 (index 3) is the page_path.
    expect(children[3].textContent).toBe('/dashboard');
  });

  it('Test 7: interaction_type chip palette matches UI-SPEC § Recent Events Feed (view/click/focus/blur/submit/walkthrough_step)', () => {
    useUiRecentEventsFeedMock.mockReturnValue(makeHookReturn());
    render(<UiRecentEventsFeed />);
    expect(screen.getByText('view').className).toMatch(/bg-slate-100/);
    expect(screen.getByText('view').className).toMatch(/text-slate-700/);
    expect(screen.getByText('click').className).toMatch(/bg-sky-100/);
    expect(screen.getByText('click').className).toMatch(/text-sky-700/);
    expect(screen.getByText('focus').className).toMatch(/bg-teal-100/);
    expect(screen.getByText('focus').className).toMatch(/text-teal-700/);
    expect(screen.getByText('blur').className).toMatch(/bg-gray-100/);
    expect(screen.getByText('blur').className).toMatch(/text-gray-500/);
    expect(screen.getByText('submit').className).toMatch(/bg-violet-100/);
    expect(screen.getByText('submit').className).toMatch(/text-violet-700/);
    expect(screen.getByText('walkthrough_step').className).toMatch(/bg-amber-100/);
    // amber-800 (NOT amber-700) per UI-SPEC § Accessibility AA contrast.
    expect(screen.getByText('walkthrough_step').className).toMatch(/text-amber-800/);
  });

  it('Test 8: row click opens PayloadViewerModal with title "UI interaction — {interaction_type}" and the full row payload', async () => {
    useUiRecentEventsFeedMock.mockReturnValue(makeHookReturn());
    render(<UiRecentEventsFeed />);
    const rowButtons = screen
      .getAllByRole('button')
      .filter((b) => b.getAttribute('aria-haspopup') === 'dialog');
    expect(rowButtons.length).toBe(6);
    await userEvent.click(rowButtons[1]); // 2nd row → click event
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('UI interaction — click')).toBeInTheDocument();
    // Payload body should contain the row's metadata fields ("btn-save").
    const body = screen.getByTestId('payload-modal-body');
    expect(body.textContent).toContain('btn-save');
  });

  it('Test 9: empty state renders italic muted "Waiting for events…" centered', () => {
    useUiRecentEventsFeedMock.mockReturnValue(makeHookReturn({ data: [] }));
    render(<UiRecentEventsFeed />);
    const msg = screen.getByText(/Waiting for events/);
    expect(msg.className).toMatch(/italic/);
    expect(msg.className).toMatch(/text-gray-500/);
  });

  it('Test 10: loading state renders TableSkeleton with 6 rows', () => {
    useUiRecentEventsFeedMock.mockReturnValue(
      makeHookReturn({ data: undefined, isLoading: true }),
    );
    const { container } = render(<UiRecentEventsFeed />);
    const skeletonRows = container.querySelectorAll('tbody tr');
    expect(skeletonRows.length).toBe(6);
  });

  it("Test 11: error state renders locked <ErrorState> heading=\"Couldn't load UI events\" body=\"Polling failed. Retry below to start tailing again.\" onRetry={refetch}", async () => {
    const refetchSpy = vi.fn();
    useUiRecentEventsFeedMock.mockReturnValue(
      makeHookReturn({
        data: undefined,
        error: new Error('boom'),
        refetch: refetchSpy,
      }),
    );
    render(<UiRecentEventsFeed />);
    expect(screen.getByText("Couldn't load UI events")).toBeInTheDocument();
    expect(
      screen.getByText('Polling failed. Retry below to start tailing again.'),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(refetchSpy).toHaveBeenCalledOnce();
  });
});
