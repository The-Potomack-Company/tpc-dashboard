import type { SVGProps } from "react";
import { ICON_MANIFEST, type IconName } from "./manifest";

/**
 * Icon — renders an inline SVG from the manifest by name.
 *
 * Usage:
 *   <Icon name="search" />
 *   <Icon name="trash" size={16} className="text-err" />
 *
 * The SVG uses `stroke="currentColor"`, so color tracks the parent text
 * token (e.g. `text-ink`, `text-accent`). `size` overrides both width
 * and height. All other props pass through to the underlying `<svg>`.
 */
export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
  name: IconName;
  size?: number;
  title?: string;
}

export function Icon({ name, size, title, ...rest }: IconProps) {
  const render = ICON_MANIFEST[name];
  if (!render) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn(`<Icon> unknown name: ${name}`);
    }
    return null;
  }
  const svgProps: SVGProps<SVGSVGElement> = { ...rest };
  if (size !== undefined) {
    svgProps.width = size;
    svgProps.height = size;
  }
  if (title) {
    svgProps["aria-hidden"] = undefined;
    svgProps["aria-label"] = title;
    svgProps.role = "img";
  }
  return render(svgProps);
}

export default Icon;
