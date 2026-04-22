// Generic error surface with a Retry button.
//
// Error-state headings have role="alert" per 03-UI-SPEC.md § Accessibility
// Floor so screen readers announce the failure. The Retry button uses the
// secondary-outline style (same pattern as Phase 1 Sign-out on the
// AccessDenied page): gray border + gray text, accent focus ring.

interface ErrorStateProps {
  heading: string;
  body: string;
  onRetry: () => void;
}

export function ErrorState({ heading, body, onRetry }: ErrorStateProps) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-8 flex flex-col items-center text-center">
      <h2
        role="alert"
        className="text-xl font-semibold text-red-600 dark:text-red-400"
      >
        {heading}
      </h2>
      <p className="mt-4 text-base text-gray-500 dark:text-gray-400">{body}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-6 h-10 px-4 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 focus:ring-2 focus:ring-accent outline-none"
      ><span>Retry</span></button>
    </div>
  );
}
