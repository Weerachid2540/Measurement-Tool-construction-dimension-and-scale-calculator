import type { MeasurementType } from '@/types';

/** Colour-coded by tool so a drawing stays readable at a glance. */
export const TYPE_COLORS: Record<MeasurementType, string> = {
  line: '#38bdf8',
  polyline: '#22d3ee',
  rectangle: '#a78bfa',
  polygon: '#4ade80',
  circle: '#fbbf24',
  angle: '#f472b6',
  count: '#fb923c',
};

/** Extra swatches offered in the colour picker. */
export const PALETTE: readonly string[] = [
  '#38bdf8',
  '#22d3ee',
  '#4ade80',
  '#a3e635',
  '#fbbf24',
  '#fb923c',
  '#f87171',
  '#f472b6',
  '#a78bfa',
  '#e2e8f0',
];

export const defaultColorFor = (type: MeasurementType): string => TYPE_COLORS[type];

/** Same colour at a given alpha — used for shape fills. */
export function withAlpha(hex: string, alpha: number): string {
  const normalised = hex.replace('#', '');
  const full =
    normalised.length === 3
      ? normalised
          .split('')
          .map((c) => c + c)
          .join('')
      : normalised;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return hex;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
