import type { LengthUnit } from './scale';

export interface GridSettings {
  enabled: boolean;
  /** Grid spacing expressed in real-world units, not pixels. */
  spacing: number;
  unit: LengthUnit;
  /** Every n-th line is drawn heavier. */
  majorEvery: number;
  /** Snap new points to grid intersections. */
  snapToGrid: boolean;
}

export const DEFAULT_GRID: GridSettings = {
  enabled: false,
  spacing: 1,
  unit: 'm',
  majorEvery: 5,
  snapToGrid: false,
};

export interface SnapSettings {
  /** Snap to existing measurement vertices. */
  toVertices: boolean;
  /** Constrain new segments to 0/45/90° while Shift is held. */
  orthoWithShift: boolean;
  /** Pick-up radius, in screen pixels. */
  thresholdPx: number;
}

export const DEFAULT_SNAP: SnapSettings = {
  toVertices: true,
  orthoWithShift: true,
  thresholdPx: 12,
};

export const ZOOM_LIMITS = { min: 0.05, max: 40 } as const;
