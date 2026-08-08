import type { GrayImage, SymbolMatch, SymbolSearchOptions } from './types';

/**
 * Shape matching for CAD line art.
 *
 * Normalised cross-correlation was tried first and failed: it is invariant to contrast,
 * so any region with a similar black-to-white ratio scored highly regardless of shape,
 * and a drawing is full of those.
 *
 * Isolating the symbol with connected components was tried next and failed worse — a
 * tightly drawn box clips the symbol's outline, the outline then reads as "touching the
 * edge" and gets discarded, and matching proceeds against the few pixels left inside.
 *
 * What works is comparing inked pixels across the whole box with an F-measure biased
 * toward recall (see `shapeScore`). Blank paper scores 0 rather than ~0.9, a genuine
 * match scores near 1, and the source symbol scores exactly 1. Ink counts come from an
 * integral image, so windows whose ink volume cannot possibly match are rejected in
 * O(1) before the intersection is ever computed.
 */

/** 1 where there is ink, 0 where there is paper. */
interface BinaryImage {
  data: Uint8Array;
  width: number;
  height: number;
}

/**
 * Otsu's method — picks the luminance split that best separates ink from paper,
 * so scans, greyscale fills and anti-aliased strokes all threshold sensibly.
 */
export function otsuThreshold(image: GrayImage): number {
  const histogram = new Float64Array(256);
  for (let i = 0; i < image.data.length; i += 1) {
    const value = image.data[i];
    histogram[value < 0 ? 0 : value > 255 ? 255 : Math.round(value)] += 1;
  }

  const total = image.data.length;
  let sum = 0;
  for (let t = 0; t < 256; t += 1) sum += t * histogram[t];

  let sumBackground = 0;
  let weightBackground = 0;
  let best = 128;
  let bestVariance = -1;

  for (let t = 0; t < 256; t += 1) {
    weightBackground += histogram[t];
    if (weightBackground === 0) continue;
    const weightForeground = total - weightBackground;
    if (weightForeground === 0) break;

    sumBackground += t * histogram[t];
    const meanBackground = sumBackground / weightBackground;
    const meanForeground = (sum - sumBackground) / weightForeground;
    const between = weightBackground * weightForeground * (meanBackground - meanForeground) ** 2;

    if (between > bestVariance) {
      bestVariance = between;
      best = t;
    }
  }
  return best;
}

export function binarize(image: GrayImage, threshold: number): BinaryImage {
  const data = new Uint8Array(image.width * image.height);
  for (let i = 0; i < data.length; i += 1) data[i] = image.data[i] < threshold ? 1 : 0;
  return { data, width: image.width, height: image.height };
}

/** Running count of inked pixels, for O(1) ink totals over any rectangle. */
function buildInkIntegral(binary: BinaryImage): { table: Float64Array; stride: number } {
  const { data, width, height } = binary;
  const stride = width + 1;
  const table = new Float64Array(stride * (height + 1));

  for (let y = 0; y < height; y += 1) {
    let rowSum = 0;
    const row = y * width;
    const out = (y + 1) * stride;
    const prev = y * stride;
    for (let x = 0; x < width; x += 1) {
      rowSum += data[row + x];
      table[out + x + 1] = table[prev + x + 1] + rowSum;
    }
  }
  return { table, stride };
}

const areaSum = (table: Float64Array, stride: number, x: number, y: number, w: number, h: number) =>
  table[(y + h) * stride + x + w] -
  table[y * stride + x + w] -
  table[(y + h) * stride + x] +
  table[y * stride + x];

/**
 * Ink volume bounds for a candidate window. A copy of the same symbol carries roughly
 * the same amount of ink, so anything well outside this band is skipped without ever
 * touching its pixels. The upper bound is generous because symbols on a real drawing
 * usually sit against walls and leaders, which add ink inside the box.
 */
const MIN_INK_RATIO = 0.5;
const MAX_INK_RATIO = 2.6;

/**
 * Weight on recall in the F-measure. β² = 4 (β = 2) means "is all of the template's
 * ink present?" counts four times as much as "is there anything else in the box?".
 *
 * That asymmetry is deliberate: a false positive costs the user one click to dismiss,
 * while a missed symbol has to be found and placed by hand.
 */
const RECALL_WEIGHT = 4;

/**
 * F₂ over inked pixels.
 *   recall    = how much of the template's ink the window reproduces
 *   precision = how much of the window's ink the template accounts for
 */
function shapeScore(intersection: number, templateInk: number, windowInk: number): number {
  if (intersection === 0 || templateInk === 0 || windowInk === 0) return 0;
  const recall = intersection / templateInk;
  const precision = intersection / windowInk;
  return ((1 + RECALL_WEIGHT) * precision * recall) / (RECALL_WEIGHT * precision + recall);
}

/**
 * Collected down to this score; the UI filters upward from here, so sensitivity can
 * be tuned without paying for another scan.
 */
export const SEARCH_FLOOR = 0.5;

export function rotateBinary(template: BinaryImage, degrees: 90 | 180 | 270): BinaryImage {
  const { data, width: w, height: h } = template;
  const rotated: BinaryImage =
    degrees === 180
      ? { data: new Uint8Array(w * h), width: w, height: h }
      : { data: new Uint8Array(w * h), width: h, height: w };

  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const value = data[y * w + x];
      if (degrees === 90) rotated.data[x * rotated.width + (h - 1 - y)] = value;
      else if (degrees === 180) rotated.data[(h - 1 - y) * w + (w - 1 - x)] = value;
      else rotated.data[(w - 1 - x) * rotated.width + y] = value;
    }
  }
  return rotated;
}

function searchOneOrientation(
  image: BinaryImage,
  integral: { table: Float64Array; stride: number },
  template: BinaryImage,
  rotation: number,
  onProgress: (fraction: number) => void,
  progressBase: number,
  progressSpan: number,
): SymbolMatch[] {
  const { width: tw, height: th } = template;
  const maxX = image.width - tw;
  const maxY = image.height - th;
  if (maxX < 0 || maxY < 0) return [];

  let templateInk = 0;
  for (let i = 0; i < template.data.length; i += 1) templateInk += template.data[i];
  if (templateInk === 0) return [];

  const minInk = templateInk * MIN_INK_RATIO;
  const maxInk = templateInk * MAX_INK_RATIO;
  const { table, stride } = integral;
  const matches: SymbolMatch[] = [];
  const progressEvery = Math.max(1, Math.floor(maxY / 40));

  for (let y = 0; y <= maxY; y += 1) {
    for (let x = 0; x <= maxX; x += 1) {
      const windowInk = areaSum(table, stride, x, y, tw, th);
      if (windowInk < minInk || windowInk > maxInk) continue;

      // Ink volume is plausible — now check that it is in the same places.
      let intersection = 0;
      for (let ty = 0; ty < th; ty += 1) {
        const imageRow = (y + ty) * image.width + x;
        const templateRow = ty * tw;
        for (let tx = 0; tx < tw; tx += 1) {
          intersection += template.data[templateRow + tx] & image.data[imageRow + tx];
        }
      }

      const score = shapeScore(intersection, templateInk, windowInk);
      if (score >= SEARCH_FLOOR) {
        matches.push({ x: x + tw / 2, y: y + th / 2, score, rotation });
      }
    }

    if (y % progressEvery === 0) onProgress(progressBase + (y / maxY) * progressSpan);
  }

  return matches;
}

/**
 * Picks a sensible cut-off from the score distribution itself.
 *
 * Real matches cluster near the top (a symbol either is the same glyph or it is not),
 * while false positives trail off below. The widest gap between consecutive scores is
 * therefore the natural boundary between the two groups — far more reliable than any
 * fixed default, since the right number differs per drawing.
 *
 * Falls back to a conservative constant when the scores form a smooth ramp with no
 * obvious break, which is the case where no threshold would have been right anyway.
 */
export function suggestThreshold(scores: number[]): number {
  const FALLBACK = 0.85;
  const MIN_CUT = 0.7;
  const MAX_CUT = 0.97;
  const MIN_GAP = 0.03;

  if (scores.length < 2) return MIN_CUT;

  const sorted = [...scores].sort((a, b) => b - a);
  let bestGap = MIN_GAP;
  let cut = FALLBACK;

  for (let i = 0; i < sorted.length - 1; i += 1) {
    const gap = sorted[i] - sorted[i + 1];
    // Only consider breaks that leave a plausible group of matches above them.
    if (gap > bestGap && sorted[i] >= MIN_CUT) {
      bestGap = gap;
      cut = sorted[i + 1] + gap / 2;
    }
  }

  return Math.min(MAX_CUT, Math.max(MIN_CUT, cut));
}

/** Keeps the strongest hit in each neighbourhood so one symbol is not counted twice. */
export function suppressOverlaps(
  matches: SymbolMatch[],
  minDistance: number,
  maxResults: number,
): SymbolMatch[] {
  const sorted = [...matches].sort((a, b) => b.score - a.score);
  const kept: SymbolMatch[] = [];
  const minDistanceSq = minDistance * minDistance;

  for (const candidate of sorted) {
    let overlaps = false;
    for (const accepted of kept) {
      const dx = candidate.x - accepted.x;
      const dy = candidate.y - accepted.y;
      if (dx * dx + dy * dy < minDistanceSq) {
        overlaps = true;
        break;
      }
    }
    if (overlaps) continue;
    kept.push(candidate);
    if (kept.length >= maxResults) break;
  }

  return kept;
}

/**
 * Runs the full search and returns every candidate at or above `SEARCH_FLOOR`,
 * in full-resolution coordinates.
 */
export function findMatches(
  image: GrayImage,
  template: GrayImage,
  options: SymbolSearchOptions,
  downscale: number,
  onProgress: (fraction: number) => void,
): SymbolMatch[] {
  // One threshold derived from the whole sheet keeps ink defined consistently
  // between the template and every window it is compared against.
  const inkThreshold = otsuThreshold(image);
  const binaryImage = binarize(image, inkThreshold);
  const binaryTemplate = binarize(template, inkThreshold);
  const integral = buildInkIntegral(binaryImage);

  const orientations: { template: BinaryImage; rotation: number }[] = [
    { template: binaryTemplate, rotation: 0 },
  ];
  if (options.matchRotations) {
    orientations.push(
      { template: rotateBinary(binaryTemplate, 90), rotation: 90 },
      { template: rotateBinary(binaryTemplate, 180), rotation: 180 },
      { template: rotateBinary(binaryTemplate, 270), rotation: 270 },
    );
  }

  const span = 1 / orientations.length;
  const all: SymbolMatch[] = [];
  orientations.forEach((orientation, index) => {
    all.push(
      ...searchOneOrientation(
        binaryImage,
        integral,
        orientation.template,
        orientation.rotation,
        onProgress,
        index * span,
        span,
      ),
    );
  });

  // Symbols are rarely packed closer than their own width, and being slightly
  // conservative here is what stops one symbol registering as several.
  const minDistance = Math.max(3, Math.min(template.width, template.height) * 0.8);
  const kept = suppressOverlaps(all, minDistance, options.maxResults);

  return kept.map((match) => ({
    ...match,
    x: match.x * downscale,
    y: match.y * downscale,
  }));
}
