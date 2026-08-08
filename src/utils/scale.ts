import type { LengthUnit, ScaleSettings } from '@/types';
import { CUSTOM_SCALE_ID, SCALE_PRESETS } from '@/types';

export const MM_PER_INCH = 25.4;
export const PT_PER_INCH = 72;
/** Browsers treat a CSS pixel as 1/96 inch, which is the best default for a bitmap. */
export const DEFAULT_IMAGE_DPI = 96;

export const dpiToPxPerMm = (dpi: number): number => dpi / MM_PER_INCH;
export const pxPerMmToDpi = (pxPerMm: number): number => pxPerMm * MM_PER_INCH;

/** pdf.js renders at `renderScale` × 72 dpi, so paper millimetres follow directly. */
export const pdfRenderScaleToPxPerPaperMm = (renderScale: number): number =>
  (renderScale * PT_PER_INCH) / MM_PER_INCH;

export const DEFAULT_SCALE: ScaleSettings = {
  presetId: '1:100',
  ratio: 100,
  pxPerPaperMm: dpiToPxPerMm(DEFAULT_IMAGE_DPI),
  unit: 'm',
  calibrated: false,
  sourceDpi: DEFAULT_IMAGE_DPI,
};

const MM_PER_UNIT: Record<LengthUnit, number> = { mm: 1, cm: 10, m: 1000 };

export const toMillimetres = (value: number, unit: LengthUnit): number =>
  value * MM_PER_UNIT[unit];

export const fromMillimetres = (mm: number, unit: LengthUnit): number => mm / MM_PER_UNIT[unit];

/** Raster pixels → real-world millimetres. */
export const pxToRealMm = (px: number, scale: ScaleSettings): number =>
  (px / scale.pxPerPaperMm) * scale.ratio;

/** Real-world millimetres → raster pixels. */
export const realMmToPx = (mm: number, scale: ScaleSettings): number =>
  (mm / scale.ratio) * scale.pxPerPaperMm;

/** Areas scale with the square of the linear factor. */
export const pxAreaToRealMm2 = (pxArea: number, scale: ScaleSettings): number =>
  pxArea * (scale.ratio / scale.pxPerPaperMm) ** 2;

export const mm2ToM2 = (mm2: number): number => mm2 / 1_000_000;
export const mmToM = (mm: number): number => mm / 1000;

/**
 * Derives `pxPerPaperMm` from a reference line the user has drawn over a known dimension.
 * Inverting `realMm = px / pxPerPaperMm * ratio` gives `pxPerPaperMm = px * ratio / realMm`.
 */
export function calibrationPxPerPaperMm(
  pixelLength: number,
  knownLength: number,
  unit: LengthUnit,
  ratio: number,
): number {
  const knownMm = toMillimetres(knownLength, unit);
  if (knownMm <= 0 || pixelLength <= 0) return DEFAULT_SCALE.pxPerPaperMm;
  return (pixelLength * ratio) / knownMm;
}

export function scaleLabel(scale: ScaleSettings): string {
  const preset = SCALE_PRESETS.find((p) => p.id === scale.presetId);
  if (preset) return preset.label;
  return `1:${formatRatio(scale.ratio)}`;
}

const formatRatio = (ratio: number): string =>
  Number.isInteger(ratio) ? String(ratio) : ratio.toFixed(2);

export function scaleFromPresetId(presetId: string, current: ScaleSettings): ScaleSettings {
  if (presetId === CUSTOM_SCALE_ID) return { ...current, presetId: CUSTOM_SCALE_ID };
  const preset = SCALE_PRESETS.find((p) => p.id === presetId);
  if (!preset) return current;
  return { ...current, presetId: preset.id, ratio: preset.ratio };
}

/** True when the drawing scale is plausible enough to trust the numbers. */
export const isScaleUsable = (scale: ScaleSettings): boolean =>
  scale.ratio > 0 && scale.pxPerPaperMm > 0;
