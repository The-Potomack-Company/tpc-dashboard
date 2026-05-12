// Generic error surface with a Retry button.
//
// Error-state headings have role="alert" per 03-UI-SPEC.md § Accessibility
// Floor so screen readers announce the failure.
//
// Phase 7: shell adopts .tpc-card; heading uses text-err; Retry adopts
// the shared .tpc-btn .tpc-btn-secondary treatment.

interface ErrorStateProps {
  heading: string;
  body: string;
  onRetry: () => void;
}

export function ErrorState({ heading, body, onRetry }: ErrorStateProps) {
  return (
    <div className="tpc-card p-8 flex flex-col items-center text-center">
      <h2
        role="alert"
        className="text-xl font-semibold text-err"
      >
        {heading}
      </h2>
      <p className="mt-4 text-base text-ink-3">{body}</p>
      <button
        type="button"
        onClick={onRetry}
        className="tpc-btn tpc-btn-secondary mt-6 font-semibold"
      ><span>Retry</span></button>
    </div>
  );
}
