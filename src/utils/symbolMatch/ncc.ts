import type { GrayImage, SymbolMatch, SymbolSearchOptions } from './types';

/**
 * Normalised cross-correlation template matching.
 *
 * Construction drawings are line art: the same symbol is drawn identically every
 * time, so correlation on raw luminance is both faster and more reliable here than
 * a learned detector would be — and it runs entirely offline.
 *
 * NCC(window) = ( ΣIT − N·mI·mT ) / ( √(ΣI² − N·mI²) · √(ΣT² − N·mT²) )
 *
 * ΣI and ΣI² come from integral images in O(1) per window, so only ΣIT is actually
 * summed — and only for windows that survive the contrast pre-filter.
 */

interface Integrals {
  sum: Float64Array;
  sumSq: Float64Array;
  stride: number;
}

function buildIntegrals(image: GrayImage): Integrals {
  const { data, width, height } = image;
  const stride = width + 1;
  const sum = new Float64Array(stride * (height + 1));
  const sumSq = new Float64Array(stride * (height + 1));

  for (let y = 0; y < height; y += 1) {
    let rowSum = 0;
    let rowSumSq = 0;
    const row = y * width;
    const out = (y + 1) * stride;
    const prev = y * stride;
    for (let x = 0; x < width; x += 1) {
      const value = data[row + x];
      rowSum += value;
      rowSumSq += value * value;
      sum[out + x + 1] = sum[prev + x + 1] + rowSum;
      sumSq[out + x + 1] = sumSq[prev + x + 1] + rowSumSq;
    }
  }
  return { sum, sumSq, stride };
}

const areaSum = (table: Float64Array, stride: number, x: number, y: number, w: number, h: number) =>
  table[(y + h) * stride + x + w] -
  table[y * stride + x + w] -
  table[(y + h) * stride + x] +
  table[y * stride + x];

interface TemplateStats {
  mean: number;
  /** ΣT² − N·mT², i.e. N·variance. */
  variance: number;
  data: Float32Array;
  width: number;
  height: number;
  count: number;
}

function templateStats(template: GrayImage): TemplateStats {
  const count = template.width * template.height;
  let sum = 0;
  let sumSq = 0;
  for (let i = 0; i < count; i += 1) {
    const value = template.data[i];
    sum += value;
    sumSq += value * value;
  }
  const mean = sum / count;
  return {
    mean,
    variance: sumSq - count * mean * mean,
    data: template.data,
    width: template.width,
    height: template.height,
    count,
  };
}

/** Rotates a template by a multiple of 90°, which needs no interpolation. */
export function rotateTemplate(template: GrayImage, degrees: 90 | 180 | 270): GrayImage {
  const { data, width: w, height: h } = template;
  const rotated =
    degrees === 180
      ? { data: new Float32Array(w * h), width: w, height: h }
      : { data: new Float32Array(w * h), width: h, height: w };

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

/** Windows this much flatter or busier than the template cannot be the symbol. */
const MIN_STD_RATIO = 0.35;
const MAX_STD_RATIO = 2.8;
/** Anything below this is blank paper. */
const MIN_ABSOLUTE_STD = 2;

function searchOneOrientation(
  image: GrayImage,
  integrals: Integrals,
  template: GrayImage,
  rotation: number,
  threshold: number,
  onProgress: (fraction: number) => void,
  progressBase: number,
  progressSpan: number,
): SymbolMatch[] {
  const stats = templateStats(template);
  if (stats.variance <= 1e-6) return [];

  const templateStd = Math.sqrt(stats.variance / stats.count);
  const { sum, sumSq, stride } = integrals;
  const { width: tw, height: th, count: n, mean: tMean } = stats;
  const maxX = image.width - tw;
  const maxY = image.height - th;
  if (maxX < 0 || maxY < 0) return [];

  const matches: SymbolMatch[] = [];
  const denomTemplate = Math.sqrt(stats.variance);
  const progressEvery = Math.max(1, Math.floor(maxY / 40));

  for (let y = 0; y <= maxY; y += 1) {
    for (let x = 0; x <= maxX; x += 1) {
      const windowSum = areaSum(sum, stride, x, y, tw, th);
      const windowSumSq = areaSum(sumSq, stride, x, y, tw, th);
      const mean = windowSum / n;
      const variance = windowSumSq - n * mean * mean;
      if (variance <= 1e-6) continue;

      const std = Math.sqrt(variance / n);
      if (std < MIN_ABSOLUTE_STD) continue;
      const ratio = std / templateStd;
      if (ratio < MIN_STD_RATIO || ratio > MAX_STD_RATIO) continue;

      // Only now is the expensive ΣIT worth computing.
      let cross = 0;
      for (let ty = 0; ty < th; ty += 1) {
        const imageRow = (y + ty) * image.width + x;
        const templateRow = ty * tw;
        for (let tx = 0; tx < tw; tx += 1) {
          cross += image.data[imageRow + tx] * stats.data[templateRow + tx];
        }
      }

      const score = (cross - n * mean * tMean) / (Math.sqrt(variance) * denomTemplate);
      if (score >= threshold) {
        matches.push({ x: x + tw / 2, y: y + th / 2, score, rotation });
      }
    }

    if (y % progressEvery === 0) onProgress(progressBase + (y / maxY) * progressSpan);
  }

  return matches;
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
 * Runs the full search. `downscale` is the factor the caller shrank the image by;
 * results are converted back to full-resolution coordinates before returning.
 */
export function findMatches(
  image: GrayImage,
  template: GrayImage,
  options: SymbolSearchOptions,
  downscale: number,
  onProgress: (fraction: number) => void,
): SymbolMatch[] {
  const integrals = buildIntegrals(image);
  const orientations: { template: GrayImage; rotation: number }[] = [{ template, rotation: 0 }];
  if (options.matchRotations) {
    orientations.push(
      { template: rotateTemplate(template, 90), rotation: 90 },
      { template: rotateTemplate(template, 180), rotation: 180 },
      { template: rotateTemplate(template, 270), rotation: 270 },
    );
  }

  const span = 1 / orientations.length;
  const all: SymbolMatch[] = [];
  orientations.forEach((orientation, index) => {
    all.push(
      ...searchOneOrientation(
        image,
        integrals,
        orientation.template,
        orientation.rotation,
        options.threshold,
        onProgress,
        index * span,
        span,
      ),
    );
  });

  const minDistance = Math.max(3, Math.min(template.width, template.height) * 0.6);
  const kept = suppressOverlaps(all, minDistance, options.maxResults);

  return kept.map((match) => ({
    ...match,
    x: match.x * downscale,
    y: match.y * downscale,
  }));
}
