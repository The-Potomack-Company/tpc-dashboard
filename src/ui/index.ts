// src/ui/index.ts — Phase 7 barrel.
//
// Public surface for the unified TPC design system as consumed inside
// the dashboard. Mirrors the cataloger Phase 22 layout one-for-one
// so a future shared package can hoist this without divergence.

export * from "./primitives/Button";
export * from "./primitives/Badge";
export * from "./primitives/Input";
export * from "./primitives/Card";
export * from "./primitives/Eyebrow";
export * from "./primitives/Bar";
export * from "./primitives/Placeholder";

export * from "./icons/Icon";
export type { IconName } from "./icons/manifest";
export {
  DashboardAppIcon,
  DashboardAppMark,
  VoiceAppIcon,
  VoiceAppMark,
  ExtensionAppIcon,
  ExtensionAppMark,
} from "./icons/AppIcons";

export * from "./tokens";
