import type { Point } from './geometry';
import type { MaterialSpec } from './material';
import type { QuantityUnit } from './scale';

/** Every selectable mode in the toolbar. */
export type ToolId =
  | 'select'
  | 'pan'
  | 'line'
  | 'polyline'
  | 'rectangle'
  | 'polygon'
  | 'circle'
  | 'angle'
  | 'count'
  | 'autoCount'
  | 'calibrate';

/** Tools that produce a persisted measurement. `autoCount` produces a `count`. */
export type MeasurementType = Exclude<ToolId, 'select' | 'pan' | 'calibrate' | 'autoCount'>;

export const MEASUREMENT_TYPES: readonly MeasurementType[] = [
  'line',
  'polyline',
  'rectangle',
  'polygon',
  'circle',
  'angle',
  'count',
] as const;

/**
 * Point-count contract per type — enforced while drawing.
 * `max: null` means "as many as the user wants".
 */
export const TOOL_POINT_RULES: Record<MeasurementType, { min: number; max: number | null }> = {
  line: { min: 2, max: 2 },
  polyline: { min: 2, max: null },
  rectangle: { min: 2, max: 2 },
  polygon: { min: 3, max: null },
  circle: { min: 2, max: 2 },
  angle: { min: 3, max: 3 },
  count: { min: 1, max: null },
};

export interface Measurement {
  id: string;
  /** 1-based page of the source document this belongs to. */
  page: number;
  type: MeasurementType;
  label: string;
  /** Image-space points. Semantics per type: rectangle = 2 opposite corners, circle = [centre, edge], angle = [armA, vertex, armB]. */
  points: Point[];
  color: string;
  notes?: string;
  material?: MaterialSpec;
  visible: boolean;
  locked: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface QuantityValue {
  label: string;
  value: number;
  unit: QuantityUnit;
}

/** Everything derivable from a `Measurement` + the active `ScaleSettings`. */
export interface MeasurementResult {
  type: MeasurementType;
  /** Total length or perimeter, in millimetres. */
  lengthMm?: number;
  areaMm2?: number;
  radiusMm?: number;
  widthMm?: number;
  heightMm?: number;
  angleDeg?: number;
  slopePercent?: number;
  inclinationDeg?: number;
  riseMm?: number;
  runMm?: number;
  count?: number;
  /** The headline quantity, in display units (m, m², deg, nos). */
  primary: QuantityValue;
  secondary: QuantityValue[];
}
