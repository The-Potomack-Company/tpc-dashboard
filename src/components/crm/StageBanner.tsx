import { stageBannerStyle, stageColorFor } from '../../lib/stageColor';
import type { Priority } from '../../services/crm/types';

type StageBannerProps = {
  stageName: string | null;
  stageColor: string | null;
  effectivePriority: Priority;
  priority: Priority;
  needsReview: boolean;
};

export function StageBanner({
  stageName,
  stageColor,
  effectivePriority,
  priority,
  needsReview,
}: StageBannerProps) {
  const bannerColor = stageColorFor(stageName, stageColor);
  const style = stageBannerStyle(bannerColor);

  return (
    <div
      className="flex w-full flex-wrap items-center justify-between gap-2 rounded-t-md px-4 py-2"
      style={style}
    >
      <span className="text-sm font-semibold">{stageName ?? 'No stage'}</span>
      <div className="flex flex-wrap items-center gap-2">
        {effectivePriority !== priority && (
          <span className="rounded-full bg-white/25 px-2 py-0.5 text-xs font-semibold">
            ↑ bumped (was {priority})
          </span>
        )}
        {needsReview && (
          <span className="rounded-full bg-err-wash px-2 py-0.5 text-xs font-semibold text-err">
            needs review
          </span>
        )}
      </div>
    </div>
  );
}
