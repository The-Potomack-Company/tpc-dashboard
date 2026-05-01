import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach } from 'vitest';
import { RawItemInspector } from './RawItemInspector';
import type { ItemListRow } from '../../services/activity/queries';

// Phase 3 / Plan 03-06 / Task 2 — RawItemInspector tests.
//
// Dev-only by convention (caller wraps in `isDevAccount` branch). NOT
// internally gated — Test 21 verifies the component renders unconditionally.
//
// JSDom does NOT implement HTMLDialogElement.showModal()/close() natively
// — polyfill them so PayloadViewerModal can mount without throwing.

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
});

const ITEM: ItemListRow = {
  id: 'i1',
  receipt_number: 'R001',
  title: 'Painting',
  ai_status: 'done',
  description: 'A nice painting on canvas.',
  category: 'Art',
  estimate: '$100-200',
  measurements: '24x36 inches',
  transcript: 'Transcript line 1.\nTranscript line 2.',
  created_at: '2026-03-01T00:00:00Z',
  photo_count: 2,
};

describe('<RawItemInspector>', () => {
  it('Test 19: renders heading "Raw item data" + preview of transcript/description/measurements/estimate', () => {
    const { container } = render(<RawItemInspector item={ITEM} />);
    expect(
      screen.getByRole('heading', { name: /Raw item data/i }),
    ).toBeInTheDocument();
    // Scope queries to the <dl> preview block — the (mounted but closed)
    // PayloadViewerModal serializes the same fields into a JSON <pre> body,
    // so a global query would match both.
    const dl = container.querySelector('dl')!;
    expect(within(dl).getByText(/Transcript line 1/i)).toBeInTheDocument();
    expect(within(dl).getByText(/A nice painting/i)).toBeInTheDocument();
    expect(within(dl).getByText('24x36 inches')).toBeInTheDocument();
    expect(within(dl).getByText('$100-200')).toBeInTheDocument();
  });

  it('Test 20: clicking "View full JSON" opens the PayloadViewerModal with the item payload', async () => {
    const user = userEvent.setup();
    render(<RawItemInspector item={ITEM} />);
    const trigger = screen.getByRole('button', { name: /View full JSON/i });
    expect(trigger).toBeInTheDocument();
    await user.click(trigger);
    // Modal heading uses the item's receipt number.
    expect(screen.getByText(/Raw item — R001/i)).toBeInTheDocument();
    // Body should render some of the item fields as JSON.
    expect(screen.getByTestId('payload-modal-body').textContent).toContain('R001');
  });

  it('Test 21: NO internal isDev gating — component renders regardless of caller context', () => {
    render(<RawItemInspector item={ITEM} />);
    expect(screen.getByRole('heading', { name: /Raw item data/i })).toBeInTheDocument();
    // No conditional rendering at the top level — the component is the
    // caller's responsibility to gate.
  });

  it('Test 21b: falls back to item.id in the modal title when receipt_number is null', async () => {
    const noReceipt: ItemListRow = { ...ITEM, receipt_number: null };
    const user = userEvent.setup();
    render(<RawItemInspector item={noReceipt} />);
    await user.click(screen.getByRole('button', { name: /View full JSON/i }));
    expect(screen.getByText(/Raw item — i1/i)).toBeInTheDocument();
  });
});
