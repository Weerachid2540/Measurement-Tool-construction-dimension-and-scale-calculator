import type { BBox, Point } from '@/types';

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const distance = (a: Point, b: Point): number => Math.hypot(b.x - a.x, b.y - a.y);

export const midpoint = (a: Point, b: Point): Point => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
});

export const toDegrees = (radians: number): number => (radians * 180) / Math.PI;
export const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

/** Total length of an open polyline, or the perimeter when `closed`. */
export function polylineLength(points: Point[], closed = false): number {
  if (points.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < points.length; i += 1) total += distance(points[i - 1], points[i]);
  if (closed && points.length > 2) total += distance(points[points.length - 1], points[0]);
  return total;
}

/** Shoelace formula. Returns an unsigned area, so winding order does not matter. */
export function polygonArea(points: Point[]): number {
  if (points.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

/** Arithmetic mean of the vertices — cheap and good enough for label anchoring. */
export function averagePoint(points: Point[]): Point {
  if (points.length === 0) return { x: 0, y: 0 };
  const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
  return { x: sum.x / points.length, y: sum.y / points.length };
}

/** Area-weighted centroid, falling back to the vertex average for degenerate shapes. */
export function polygonCentroid(points: Point[]): Point {
  if (points.length < 3) return averagePoint(points);
  let signedArea = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const cross = a.x * b.y - b.x * a.y;
    signedArea += cross;
    cx += (a.x + b.x) * cross;
    cy += (a.y + b.y) * cross;
  }
  signedArea /= 2;
  if (Math.abs(signedArea) < 1e-9) return averagePoint(points);
  return { x: cx / (6 * signedArea), y: cy / (6 * signedArea) };
}

/** Interior angle at `vertex`, in degrees, always within [0, 180]. */
export function angleBetween(a: Point, vertex: Point, b: Point): number {
  const v1 = { x: a.x - vertex.x, y: a.y - vertex.y };
  const v2 = { x: b.x - vertex.x, y: b.y - vertex.y };
  const m1 = Math.hypot(v1.x, v1.y);
  const m2 = Math.hypot(v2.x, v2.y);
  if (m1 < 1e-9 || m2 < 1e-9) return 0;
  const cosine = clamp((v1.x * v2.x + v1.y * v2.y) / (m1 * m2), -1, 1);
  return toDegrees(Math.acos(cosine));
}

/**
 * Inclination of a segment measured from horizontal, in degrees within [-90, 90].
 * Canvas Y grows downward, so it is negated to match drawing conventions.
 */
export function inclination(a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9) return 0;
  let deg = toDegrees(Math.atan2(-dy, dx));
  if (deg > 90) deg -= 180;
  if (deg < -90) deg += 180;
  return deg;
}

/** Rise-over-run as a percentage. Clamped so a vertical segment does not return Infinity. */
export function slopePercentFromAngle(angleDeg: number): number {
  const normalised = clamp(Math.abs(angleDeg), 0, 89.999);
  return Math.tan(toRadians(normalised)) * 100;
}

/** Expands two opposite corners into the four corners of an axis-aligned rectangle. */
export function rectangleCorners(a: Point, b: Point): Point[] {
  return [
    { x: a.x, y: a.y },
    { x: b.x, y: a.y },
    { x: b.x, y: b.y },
    { x: a.x, y: b.y },
  ];
}

/** Constrains `p` to the nearest multiple of `stepDeg` around `origin`, preserving distance. */
export function snapToAngle(origin: Point, p: Point, stepDeg = 45): Point {
  const dx = p.x - origin.x;
  const dy = p.y - origin.y;
  const length = Math.hypot(dx, dy);
  if (length < 1e-9) return { ...p };
  const step = toRadians(stepDeg);
  const snapped = Math.round(Math.atan2(dy, dx) / step) * step;
  return {
    x: origin.x + Math.cos(snapped) * length,
    y: origin.y + Math.sin(snapped) * length,
  };
}

/** Nearest candidate within `threshold` image pixels, or `null`. */
export function nearestPoint(candidates: Point[], p: Point, threshold: number): Point | null {
  let best: Point | null = null;
  let bestDist = threshold;
  for (const candidate of candidates) {
    const d = distance(candidate, p);
    if (d <= bestDist) {
      bestDist = d;
      best = candidate;
    }
  }
  return best ? { ...best } : null;
}

export function pointToSegmentDistance(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq < 1e-9) return distance(p, a);
  const t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq, 0, 1);
  return distance(p, { x: a.x + t * dx, y: a.y + t * dy });
}

export function boundingBox(points: Point[]): BBox {
  if (points.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  let minX = points[0].x;
  let minY = points[0].y;
  let maxX = points[0].x;
  let maxY = points[0].y;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function isPointInPolygon(p: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const pi = polygon[i];
    const pj = polygon[j];
    const intersects =
      pi.y > p.y !== pj.y > p.y &&
      p.x < ((pj.x - pi.x) * (p.y - pi.y)) / (pj.y - pi.y || 1e-9) + pi.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

/** Flattens points into the `[x0, y0, x1, y1, …]` array Konva's Line expects. */
export function flattenPoints(points: Point[]): number[] {
  return points.flatMap((p) => [p.x, p.y]);
}
