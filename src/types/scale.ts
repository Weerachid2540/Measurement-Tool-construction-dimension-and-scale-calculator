export type LengthUnit = 'mm' | 'cm' | 'm';

/** Units a quantity can be reported in on the BOQ. */
export type QuantityUnit = 'm' | 'm²' | 'm³' | 'kg' | 'ton' | 'nos' | 'deg' | '%';

export interface ScalePreset {
  id: string;
  label: string;
  /** Denominator of the drawing scale — `1:ratio`. */
  ratio: number;
}

export const CUSTOM_SCALE_ID = 'custom';

export const SCALE_PRESETS: readonly ScalePreset[] = [
  { id: '1:1', label: '1:1', ratio: 1 },
  { id: '1:5', label: '1:5', ratio: 5 },
  { id: '1:10', label: '1:10', ratio: 10 },
  { id: '1:20', label: '1:20', ratio: 20 },
  { id: '1:25', label: '1:25', ratio: 25 },
  { id: '1:50', label: '1:50', ratio: 50 },
  { id: '1:75', label: '1:75', ratio: 75 },
  { id: '1:100', label: '1:100', ratio: 100 },
  { id: '1:150', label: '1:150', ratio: 150 },
  { id: '1:200', label: '1:200', ratio: 200 },
  { id: '1:500', label: '1:500', ratio: 500 },
  { id: '1:1000', label: '1:1000', ratio: 1000 },
] as const;

/**
 * Everything needed to turn a pixel distance on the raster into a real-world one.
 *
 *   realMm = px / pxPerPaperMm * ratio
 *
 * `pxPerPaperMm` is exact for PDFs (derived from the render scale) and an
 * assumption for bitmaps until the user calibrates against a known dimension.
 */
export interface ScaleSettings {
  /** A `ScalePreset.id`, or `CUSTOM_SCALE_ID`. */
  presetId: string;
  ratio: number;
  pxPerPaperMm: number;
  unit: LengthUnit;
  calibrated: boolean;
  /** Only meaningful for bitmap sources. */
  sourceDpi?: number;
}
