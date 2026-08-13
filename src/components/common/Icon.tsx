import type { CSSProperties } from 'react';

/** Stroke-based 24×24 glyphs, drawn with `currentColor` so they inherit button state. */
const PATHS = {
  select: 'M4 3l7 17 2.5-6.5L20 11z',
  pan: 'M9 11V5a1.5 1.5 0 013 0v6m0-1V4.5a1.5 1.5 0 013 0V11m0-1a1.5 1.5 0 013 0v6a5 5 0 01-5 5h-2.5a5 5 0 01-4.3-2.5L6 15a1.5 1.5 0 012.4-1.8L9 14V7.5a1.5 1.5 0 013 0',
  line: 'M4 20L20 4M4 20h.01M20 4h.01',
  polyline: 'M3 18l5-8 5 4 8-11',
  rectangle: 'M4 6h16v12H4z',
  polygon: 'M12 3l8 6-3 10H7L4 9z',
  circle: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 12h9',
  angle: 'M4 20h16M4 20L16 4M4 20a10 10 0 004-3',
  count: 'M5 9h14M5 15h14M10 4l-2 16M16 4l-2 16',
  calibrate: 'M3 8h18v8H3zM7 8v4M11 8v3M15 8v4M19 8v3',
  grid: 'M3 9h18M3 15h18M9 3v18M15 3v18',
  undo: 'M9 14L4 9l5-5M4 9h9a7 7 0 010 14H8',
  redo: 'M15 14l5-5-5-5M20 9h-9a7 7 0 000 14h5',
  zoomIn: 'M11 4a7 7 0 100 14 7 7 0 000-14zM20 20l-4.5-4.5M11 8v6M8 11h6',
  zoomOut: 'M11 4a7 7 0 100 14 7 7 0 000-14zM20 20l-4.5-4.5M8 11h6',
  fit: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6',
  copy: 'M9 9h11v11H9zM4 15V4h11v3',
  eye: 'M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6zM12 9.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5z',
  eyeOff: 'M4 4l16 16M9.5 9.6A2.5 2.5 0 0012 14.5M6.3 6.6C3.7 8.2 2 12 2 12s3.6 6 10 6c1.7 0 3.2-.4 4.5-1M12 6c6.4 0 10 6 10 6a17 17 0 01-2.6 3.2',
  save: 'M5 4h11l3 3v13H5zM8 4v6h8V4M8 20v-6h8v6',
  upload: 'M12 16V4m0 0L7 9m5-5l5 5M4 17v3h16v-3',
  download: 'M12 4v12m0 0l-5-5m5 5l5-5M4 17v3h16v-3',
  excel: 'M5 3h9l5 5v13H5zM14 3v5h5M9 12l5 6M14 12l-5 6',
  pdf: 'M5 3h9l5 5v13H5zM14 3v5h5M8 13h2a1.5 1.5 0 010 3H8v-3zm0 3v3M13 13h1.5a2 2 0 010 4H13v-4z',
  close: 'M6 6l12 12M18 6L6 18',
  settings:
    'M12 9a3 3 0 100 6 3 3 0 000-6zM4 12l-1.5-1 1-3 1.8.3a8 8 0 011.6-1.6L6.6 4l3-1L11 4.5h2L14.4 3l3 1-.3 1.8a8 8 0 011.6 1.6l1.8-.3 1 3L20 12l1.5 1-1 3-1.8-.3a8 8 0 01-1.6 1.6l.3 1.8-3 1L13 19.5h-2L9.6 21l-3-1 .3-1.8a8 8 0 01-1.6-1.6L3.5 17l-1-3z',
  sun: 'M12 6a6 6 0 100 12 6 6 0 000-12zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
  moon: 'M20 14.5A8.5 8.5 0 019.5 4a8.5 8.5 0 1010.5 10.5z',
  layers: 'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5M3 17l9 5 9-5',
  cube: 'M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12v9M12 12L4 7.5',
  search: 'M11 4a7 7 0 100 14 7 7 0 000-14zM20 20l-4.5-4.5',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  check: 'M4 12l5 5L20 6',
  chevronLeft: 'M15 5l-7 7 7 7',
  chevronRight: 'M9 5l7 7-7 7',
  chevronDown: 'M5 9l7 7 7-7',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  history: 'M3 12a9 9 0 109-9 9 9 0 00-7.5 4M3 4v4h4M12 7v5l4 2',
  table: 'M3 5h18v14H3zM3 10h18M9 10v9M15 10v9',
  file: 'M6 3h8l4 4v14H6zM14 3v5h5',
  folder: 'M3 6h6l2 2h10v11H3z',
  lock: 'M6 11h12v9H6zM9 11V8a3 3 0 016 0v3',
  menu: 'M4 7h16M4 12h16M4 17h16',
  info: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 11v6M12 8h.01',
  warning: 'M12 4l9 16H3zM12 10v4M12 17h.01',
  panorama: 'M12 3a9 9 0 100 18 9 9 0 000-18zM3 12h18M12 3c2.5 2.4 4 5.5 4 9s-1.5 6.6-4 9c-2.5-2.4-4-5.5-4-9s1.5-6.6 4-9z',
  play: 'M7 4l13 8-13 8z',
  pause: 'M8 4h3v16H8zM13 4h3v16h-3z',
  expand: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5M9 15l-5 5M15 9l5-5M15 15l5 5M9 9L4 4',
} as const;

export type IconName = keyof typeof PATHS;

interface IconProps {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
  style?: CSSProperties;
}

export function Icon({ name, size = 20, strokeWidth = 1.7, className, style }: IconProps) {
  return (
    <svg
      className={className}
      style={style}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
