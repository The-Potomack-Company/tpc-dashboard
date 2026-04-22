// Shimmer placeholder matching RecentSaleCard dimensions 1:1 so cards do not
// shift on data arrival. Five shimmer bars correspond to the five rows inside
// RecentSaleCard: sale_number (h-4 w-20), title (h-4 w-full), date (h-3 w-24),
// net revenue (h-4 w-28), sell-through (h-3 w-32).
//
// Contract: 04-UI-SPEC.md § Interaction Contract (Loading patterns).

export function RecentSaleCardSkeleton() {
  return (
    <div className="block p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 min-h-[128px] space-y-1">
      <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded motion-safe:animate-pulse" />
      <div className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded motion-safe:animate-pulse" />
      <div className="h-3 w-24 bg-gray-200 dark:bg-gray-700 rounded motion-safe:animate-pulse" />
      <div className="h-4 w-28 bg-gray-200 dark:bg-gray-700 rounded motion-safe:animate-pulse" />
      <div className="h-3 w-32 bg-gray-200 dark:bg-gray-700 rounded motion-safe:animate-pulse" />
    </div>
  );
}
