import { useEffect, useRef, useState } from 'react';

// Phase 1 / INFR-03 — shared UI kit (Phase 7 unified-design migration).
// Minimal native <dialog>-based payload viewer (D-14). Used by /extension
// Recent Errors table (EXT-06) and potentially /live anomaly payloads (LIVE-07).
// Deliberately minimal: no syntax highlighting, no tree viewer, no external deps.
//
// Phase 7: surfaces use .tpc-card treatment, controls use tpc-btn-secondary,
// the payload <pre> uses bg-2 + ink + font-mono.

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

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handler = () => onClose();
    dialog.addEventListener('close', handler);
    return () => dialog.removeEventListener('close', handler);
  }, [onClose]);

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
      className="tpc-card p-0 shadow-xl backdrop:bg-black/40"
      data-testid="payload-modal"
      onClick={handleDialogClick}
    >
      <div className="flex max-h-[80vh] w-[min(800px,90vw)] flex-col">
        <div className="flex items-center justify-between border-b border-rule px-4 py-2">
          <h2 className="text-sm font-semibold text-ink">{title}</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="tpc-btn tpc-btn-secondary"
              data-testid="payload-modal-copy"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="tpc-btn tpc-btn-secondary"
              data-testid="payload-modal-close"
              aria-label="Close"
            >
              Close
            </button>
          </div>
        </div>
        <pre
          className="m-0 max-h-[70vh] overflow-auto bg-bg-2 p-4 font-mono text-xs text-ink"
          data-testid="payload-modal-body"
        >
          {pretty}
        </pre>
      </div>
    </dialog>
  );
}
