import { useMemo } from 'react';
import type { Measurement, MeasurementResult, ScaleSettings } from '@/types';
import { computeAll } from '@/utils/measurement';

/**
 * Memoised `id → result` map. Recomputes when the measurements or the scale change,
 * which is exactly what should re-value the drawing.
 */
export function useMeasurementResults(
  measurements: Measurement[],
  scale: ScaleSettings,
): Map<string, MeasurementResult> {
  return useMemo(() => computeAll(measurements, scale), [measurements, scale]);
}
