import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PayloadViewerModal } from './PayloadViewerModal';

// JSDom does NOT implement HTMLDialogElement.showModal() / close() natively.
// We polyfill them on the prototype so our effects can run without throwing.
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

describe('<PayloadViewerModal>', () => {
  const samplePayload = { eventType: 'catalog_single', count: 3, nested: { a: 1 } };

  it('is not open when open={false}', () => {
    render(
      <PayloadViewerModal payload={samplePayload} open={false} onClose={() => undefined} />,
    );
    const dialog = screen.getByTestId('payload-modal') as HTMLDialogElement;
    expect(dialog.hasAttribute('open')).toBe(false);
  });

  it('opens when open={true}', () => {
    render(
      <PayloadViewerModal payload={samplePayload} open={true} onClose={() => undefined} />,
    );
    const dialog = screen.getByTestId('payload-modal') as HTMLDialogElement;
    expect(dialog.hasAttribute('open')).toBe(true);
  });

  it('renders the payload as 2-space-indented JSON inside <pre>', () => {
    render(
      <PayloadViewerModal payload={samplePayload} open={true} onClose={() => undefined} />,
    );
    const body = screen.getByTestId('payload-modal-body');
    const expected = JSON.stringify(samplePayload, null, 2);
    expect(body.textContent).toBe(expected);
    expect(body.tagName.toLowerCase()).toBe('pre');
  });

  it('invokes onClose when the close button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<PayloadViewerModal payload={samplePayload} open={true} onClose={onClose} />);
    await user.click(screen.getByTestId('payload-modal-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('invokes onClose when the dialog backdrop is clicked (click on dialog element itself)', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<PayloadViewerModal payload={samplePayload} open={true} onClose={onClose} />);
    const dialog = screen.getByTestId('payload-modal') as HTMLDialogElement;
    // userEvent.click on the dialog (not its children) triggers handleDialogClick
    await user.click(dialog);
    expect(onClose).toHaveBeenCalled();
  });

  it('copies stringified payload to clipboard when Copy button clicked', async () => {
    // JSDom 28+ exposes navigator.clipboard as a read-only getter and
    // @testing-library/user-event v14 sets up its own clipboard fake during
    // setup() that masks navigator.clipboard. Disable user-event's clipboard
    // intercept (writeToClipboard: false is the default), then install our
    // stub via defineProperty after setup so the component's
    // navigator.clipboard.writeText reaches our spy.
    const writeText = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup({ writeToClipboard: false });
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
      writable: true,
    });
    render(
      <PayloadViewerModal payload={samplePayload} open={true} onClose={() => undefined} />,
    );
    await user.click(screen.getByTestId('payload-modal-copy'));
    expect(writeText).toHaveBeenCalledWith(JSON.stringify(samplePayload, null, 2));
  });

  it('uses custom title prop when provided', () => {
    render(
      <PayloadViewerModal
        payload={samplePayload}
        open={true}
        onClose={() => undefined}
        title="Event details"
      />,
    );
    expect(screen.getByText('Event details')).toBeInTheDocument();
  });

  it('defaults to title="Payload" when no title prop', () => {
    render(
      <PayloadViewerModal payload={samplePayload} open={true} onClose={() => undefined} />,
    );
    expect(screen.getByText('Payload')).toBeInTheDocument();
  });

  it('invokes onClose via the native close event (e.g. Escape key)', () => {
    const onClose = vi.fn();
    render(<PayloadViewerModal payload={samplePayload} open={true} onClose={onClose} />);
    const dialog = screen.getByTestId('payload-modal') as HTMLDialogElement;
    // Simulate native close (Escape key path) by calling .close() directly.
    dialog.close();
    expect(onClose).toHaveBeenCalled();
  });
});
