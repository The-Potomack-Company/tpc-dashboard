import { useEffect, useRef, useState } from 'react';

// Phase 1 / INFR-03 — shared UI kit.
// Minimal native <dialog>-based payload viewer (D-14). Used by /extension
// Recent Errors table (EXT-06) and potentially /live anomaly payloads (LIVE-07).
// Deliberately minimal: no syntax highlighting, no tree viewer, no external deps.

export interface PayloadViewerModalProps {
  payload: unknown;
  open: boolean;
  onClose: () => void;
  title?: string;
}

export function PayloadViewerModal({
  payload,
  open,
  onClose,
  title = 'Payload',
}: PayloadViewerModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [copied, setCopied] = useState(false);

  // Sync `open` prop → native dialog methods.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  // Propagate native <dialog>'s close event (Escape key, dialog.close()) to onClose.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handler = () => onClose();
    dialog.addEventListener('close', handler);
    return () => dialog.removeEventListener('close', handler);
  }, [onClose]);

  // Backdrop click: when user clicks the <dialog> element itself (outside the
  // inner content wrapper), close.
  function handleDialogClick(e: React.MouseEvent<HTMLDialogElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  const pretty = JSON.stringify(payload, null, 2);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(pretty);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked — swallow silently; button text stays "Copy".
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="rounded-lg border border-gray-200 bg-white p-0 shadow-xl backdrop:bg-black/40"
      data-testid="payload-modal"
      onClick={handleDialogClick}
    >
      <div className="flex max-h-[80vh] w-[min(800px,90vw)] flex-col">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-2">
          <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="rounded border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
              data-testid="payload-modal-copy"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
              data-testid="payload-modal-close"
              aria-label="Close"
            >
              Close
            </button>
          </div>
        </div>
        <pre
          className="m-0 max-h-[70vh] overflow-auto bg-gray-50 p-4 font-mono text-xs text-gray-800"
          data-testid="payload-modal-body"
        >
          {pretty}
        </pre>
      </div>
    </dialog>
  );
}
