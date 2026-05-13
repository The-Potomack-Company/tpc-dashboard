import type { ReactElement, SVGProps } from "react";

/**
 * Icon manifest — single source of truth for inline SVG glyphs.
 *
 * Each entry is a function returning a React `<svg>` element. The viewBox
 * is `0 0 24 24` for the core library (`Icon` + `IconExt` groups in the
 * design-handoff prototype). `stroke="currentColor"` so the color tracks
 * the surrounding text token (e.g. text-ink, text-accent).
 *
 * To add a new icon: drop the inline-SVG body inside `svgEl(...)` and
 * add the key + entry below. Update the `IconName` union if you need
 * stricter typing at call sites.
 */

type IconRenderer = (props: SVGProps<SVGSVGElement>) => ReactElement;

function svgEl(children: ReactElement, defaultSize = 14): IconRenderer {
  return (props) => (
    <svg
      width={defaultSize}
      height={defaultSize}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

/**
 * Core icon manifest — merges Icon + IconExt from prototype-icons.jsx.
 */
export const ICON_MANIFEST: Record<string, IconRenderer> = {
  // Core (from prototype-primitives.jsx `Icon`)
  mic: svgEl(
    <>
      <rect x="9" y="3" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v3" />
    </>,
  ),
  search: svgEl(
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </>,
  ),
  plus: svgEl(<path d="M12 5v14M5 12h14" />),
  chev: svgEl(<path d="m9 6 6 6-6 6" />),
  back: svgEl(<path d="m15 6-6 6 6 6" />),
  camera: svgEl(
    <>
      <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
      <circle cx="12" cy="13" r="3.5" />
    </>,
  ),
  upload: svgEl(<path d="M12 16V4M7 9l5-5 5 5M4 20h16" />),
  download: svgEl(<path d="M12 4v12M7 11l5 5 5-5M4 20h16" />),
  check: svgEl(<path d="m5 12 5 5 9-10" strokeWidth="1.8" />),
  x: svgEl(<path d="M6 6l12 12M18 6 6 18" />),
  settings: svgEl(
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 13A7.5 7.5 0 0 0 19.5 12a7.5 7.5 0 0 0-.1-1l2-1.5-2-3.4-2.3.9a7.5 7.5 0 0 0-1.7-1l-.4-2.5h-4l-.4 2.5a7.5 7.5 0 0 0-1.7 1l-2.3-.9-2 3.4 2 1.5a7.5 7.5 0 0 0 0 2l-2 1.5 2 3.4 2.3-.9c.5.4 1.1.7 1.7 1l.4 2.5h4l.4-2.5c.6-.3 1.2-.6 1.7-1l2.3.9 2-3.4Z" />
    </>,
  ),
  home: svgEl(<path d="m3 11 9-7 9 7v9a2 2 0 0 1-2 2h-4v-7h-6v7H5a2 2 0 0 1-2-2z" />),
  stop: svgEl(<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />),
  play: svgEl(<path d="M8 5v14l11-7z" fill="currentColor" />),
  pause: svgEl(
    <>
      <rect x="6" y="5" width="4" height="14" fill="currentColor" />
      <rect x="14" y="5" width="4" height="14" fill="currentColor" />
    </>,
  ),
  filter: svgEl(<path d="M3 5h18l-7 8v6l-4-2v-4z" />),
  users: svgEl(
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2 20c0-3.5 3-6 7-6s7 2.5 7 6" />
      <circle cx="17" cy="7" r="2.5" />
      <path d="M22 17c0-2.5-2-4-4.5-4" />
    </>,
  ),
  sparkle: svgEl(<path d="M12 3v18M3 12h18M6 6l12 12M18 6 6 18" />),
  trending: svgEl(
    <>
      <path d="m3 17 6-6 4 4 8-8" />
      <path d="M15 7h6v6" />
    </>,
  ),
  help: svgEl(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .7-1 1.4V14" />
      <circle cx="12" cy="17" r="0.6" fill="currentColor" />
    </>,
    12,
  ),
  dot: svgEl(<circle cx="3" cy="3" r="2.5" fill="currentColor" />, 6),
  dots: svgEl(
    <>
      <circle cx="5" cy="12" r="1.5" fill="currentColor" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
      <circle cx="19" cy="12" r="1.5" fill="currentColor" />
    </>,
  ),
  ext: svgEl(
    <>
      <path d="M14 3h7v7M10 14 21 3M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />
    </>,
  ),
  folder: svgEl(
    <path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
  ),
  file: svgEl(
    <>
      <path d="M6 2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" />
      <path d="M15 2v5h5" />
    </>,
  ),

  // Extended (from prototype-icons.jsx `IconExt`)
  warn: svgEl(
    <>
      <path d="M12 3 2 20h20z" />
      <path d="M12 9v5" />
      <circle cx="12" cy="17" r="0.6" fill="currentColor" stroke="none" />
    </>,
  ),
  info: svgEl(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <circle cx="12" cy="8" r="0.6" fill="currentColor" stroke="none" />
    </>,
  ),
  err: svgEl(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 8l8 8M16 8l-8 8" />
    </>,
  ),
  success: svgEl(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12 3 3 5-6" />
    </>,
  ),
  pending: svgEl(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>,
  ),
  edit: svgEl(
    <>
      <path d="M4 20h4L20 8l-4-4L4 16z" />
      <path d="M14 6l4 4" />
    </>,
  ),
  trash: svgEl(
    <>
      <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
      <path d="M10 11v6M14 11v6" />
    </>,
  ),
  copy: svgEl(
    <>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" />
    </>,
  ),
  link: svgEl(
    <>
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7L11 7" />
      <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7L13 17" />
    </>,
  ),
  share: svgEl(
    <>
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="6" r="2.5" />
      <circle cx="18" cy="18" r="2.5" />
      <path d="M8 11l8-4M8 13l8 4" />
    </>,
  ),
  refresh: svgEl(
    <>
      <path d="M20 12a8 8 0 0 1-14 5.3M4 12a8 8 0 0 1 14-5.3" />
      <path d="M20 3v5h-5M4 21v-5h5" />
    </>,
  ),
  sync: svgEl(
    <>
      <path d="M21 13a9 9 0 0 1-15 5.7L3 16" />
      <path d="M3 11a9 9 0 0 1 15-5.7L21 8" />
      <path d="M3 21v-5h5M21 3v5h-5" />
    </>,
  ),
  export: svgEl(
    <>
      <path d="M12 3v12M8 7l4-4 4 4" />
      <path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" />
    </>,
  ),
  import: svgEl(
    <>
      <path d="M12 15V3M8 11l4 4 4-4" />
      <path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" />
    </>,
  ),
  send: svgEl(
    <>
      <path d="M4 20 20 12 4 4l3 8-3 8z" />
      <path d="M7 12h13" />
    </>,
  ),
  tag: svgEl(
    <>
      <path d="M4 12V4h8l9 9-8 8z" />
      <circle cx="8" cy="8" r="1.2" />
    </>,
  ),
  receipt: svgEl(
    <>
      <path d="M5 3h14v18l-3-2-3 2-3-2-3 2-2-1z" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </>,
  ),
  image: svgEl(
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="2" />
      <path d="m4 19 5-5 4 4 3-3 4 4" />
    </>,
  ),
  hammer: svgEl(
    <>
      <path d="M14 4l6 6-4 4-6-6zM10 10 3 17a2 2 0 0 0 3 3l7-7" />
      <path d="M4 22h16" />
    </>,
  ),
  eye: svgEl(
    <>
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </>,
  ),
  eyeOff: svgEl(
    <>
      <path d="M3 3l18 18" />
      <path d="M10 10a3 3 0 0 0 4 4" />
      <path d="M22 12s-3 7-10 7c-2 0-3.7-.5-5.2-1.4M2 12s3-7 10-7c2 0 3.7.5 5.2 1.4" />
    </>,
  ),
  clock: svgEl(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>,
  ),
  bell: svgEl(
    <>
      <path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </>,
  ),
  lock: svgEl(
    <>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>,
  ),
  key: svgEl(
    <>
      <circle cx="8" cy="15" r="4" />
      <path d="M11 12l9-9M17 6l3 3" />
    </>,
  ),
  user: svgEl(
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>,
  ),
  building: svgEl(
    <>
      <rect x="5" y="3" width="14" height="18" rx="1" />
      <path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2" />
    </>,
  ),
  phone: svgEl(
    <>
      <rect x="7" y="2" width="10" height="20" rx="2" />
      <path d="M10 19h4" />
    </>,
  ),
  globe: svgEl(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
    </>,
  ),
  grid: svgEl(
    <>
      <rect x="3" y="3" width="8" height="8" rx="1" />
      <rect x="13" y="3" width="8" height="8" rx="1" />
      <rect x="3" y="13" width="8" height="8" rx="1" />
      <rect x="13" y="13" width="8" height="8" rx="1" />
    </>,
  ),
  list: svgEl(
    <>
      <path d="M8 6h13M8 12h13M8 18h13" />
      <circle cx="4" cy="6" r="0.5" fill="currentColor" stroke="none" />
      <circle cx="4" cy="12" r="0.5" fill="currentColor" stroke="none" />
      <circle cx="4" cy="18" r="0.5" fill="currentColor" stroke="none" />
    </>,
  ),
  columns: svgEl(
    <>
      <rect x="3" y="4" width="18" height="16" rx="1" />
      <path d="M9 4v16M15 4v16" />
    </>,
  ),
  menu: svgEl(<path d="M4 7h16M4 12h16M4 17h16" />),
  chevDown: svgEl(<path d="m6 9 6 6 6-6" />),
  chevUp: svgEl(<path d="m6 15 6-6 6 6" />),
  arrowUp: svgEl(<path d="M12 20V4M6 10l6-6 6 6" />),
  arrowDown: svgEl(<path d="M12 4v16M6 14l6 6 6-6" />),
  arrowRight: svgEl(<path d="M4 12h16M14 6l6 6-6 6" />),
  external: svgEl(
    <>
      <path d="M14 4h6v6M10 14 20 4" />
      <path d="M20 14v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h6" />
    </>,
  ),
  chart: svgEl(
    <>
      <path d="M4 20V4M4 20h16" />
      <path d="M8 15v-5M12 15v-8M16 15v-3" />
    </>,
  ),
  pulse: svgEl(<path d="M3 12h4l3-7 4 14 3-7h4" />),
  wave: svgEl(<path d="M2 12h2v6M6 12h2v2M10 12h2v8M14 12h2v3M18 12h2v6" />),
  mic2: svgEl(
    <>
      <rect x="9" y="3" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </>,
  ),
  waveform: svgEl(<path d="M3 12h1M7 8v8M11 5v14M15 9v6M19 11v2" />),
  doc: svgEl(
    <>
      <path d="M6 2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" />
      <path d="M15 2v5h5M8 13h8M8 17h5" />
    </>,
  ),
  attach: svgEl(
    <path d="M21 12 12 21a5 5 0 0 1-7-7l9-9a3.5 3.5 0 0 1 5 5l-9 9a2 2 0 0 1-3-3l8-8" />,
  ),
  ai: svgEl(<path d="M12 4v4M12 16v4M4 12h4M16 12h4M6 6l3 3M15 15l3 3M6 18l3-3M15 9l3-3" />),
  spark: svgEl(<path d="M12 3v5M12 16v5M3 12h5M16 12h5M7 7l3 3M14 14l3 3M7 17l3-3M14 10l3-3" />),
};

export type IconName = keyof typeof ICON_MANIFEST;
