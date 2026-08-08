import type {
  Measurement,
  MeasurementResult,
  MeasurementType,
  Point,
  QuantityValue,
  ScaleSettings,
} from '@/types';
import { TOOL_POINT_RULES } from '@/types';
import {
  angleBetween,
  averagePoint,
  boundingBox,
  distance,
  inclination,
  midpoint,
  polygonArea,
  polygonCentroid,
  polylineLength,
  rectangleCorners,
  slopePercentFromAngle,
} from './geometry';
import { mm2ToM2, mmToM, pxAreaToRealMm2, pxToRealMm } from './scale';

export const TYPE_LABELS: Record<MeasurementType, string> = {
  line: 'ความยาว (Line)',
  polyline: 'เส้นต่อเนื่อง (Polyline)',
  rectangle: 'สี่เหลี่ยม (Rectangle)',
  polygon: 'พื้นที่ (Polygon)',
  circle: 'วงกลม (Circle)',
  angle: 'มุม/ความลาด (Angle)',
  count: 'นับจำนวน (Count)',
};

const LABEL_PREFIX: Record<MeasurementType, string> = {
  line: 'L',
  polyline: 'PL',
  rectangle: 'R',
  polygon: 'A',
  circle: 'C',
  angle: 'AN',
  count: 'N',
};

/** `L-01`, `A-02`, … unique within the measurements passed in. */
export function nextLabel(type: MeasurementType, existing: Measurement[]): string {
  const prefix = LABEL_PREFIX[type];
  const used = new Set(existing.filter((m) => m.type === type).map((m) => m.label));
  for (let i = 1; i < 1000; i += 1) {
    const candidate = `${prefix}-${String(i).padStart(2, '0')}`;
    if (!used.has(candidate)) return candidate;
  }
  return `${prefix}-${Date.now()}`;
}

/** True once the drawn points satisfy the minimum for the tool. */
export function isComplete(type: MeasurementType, points: Point[]): boolean {
  return points.length >= TOOL_POINT_RULES[type].min;
}

/** True when adding one more point would exceed the tool's maximum. */
export function isFull(type: MeasurementType, points: Point[]): boolean {
  const { max } = TOOL_POINT_RULES[type];
  return max !== null && points.length >= max;
}

/** The vertices actually painted on screen — rectangles and circles expand from 2 handles. */
export function outlinePoints(type: MeasurementType, points: Point[]): Point[] {
  if (type === 'rectangle' && points.length >= 2) return rectangleCorners(points[0], points[1]);
  return points;
}

export const isAreaType = (type: MeasurementType): boolean =>
  type === 'rectangle' || type === 'polygon' || type === 'circle';

export const isLengthType = (type: MeasurementType): boolean =>
  type === 'line' || type === 'polyline';

/** Where a measurement's label should sit, in image space. */
export function labelAnchor(type: MeasurementType, points: Point[]): Point {
  if (points.length === 0) return { x: 0, y: 0 };
  switch (type) {
    case 'line':
      return points.length >= 2 ? midpoint(points[0], points[1]) : points[0];
    case 'rectangle': {
      if (points.length < 2) return points[0];
      const box = boundingBox(rectangleCorners(points[0], points[1]));
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    }
    case 'circle':
      return points[0];
    case 'polygon':
      return polygonCentroid(points);
    case 'angle':
      return points.length >= 2 ? points[1] : points[0];
    default:
      return averagePoint(points);
  }
}

const quantity = (label: string, value: number, unit: QuantityValue['unit']): QuantityValue => ({
  label,
  value,
  unit,
});

const EMPTY_RESULT = (type: MeasurementType): MeasurementResult => ({
  type,
  primary: quantity('—', 0, type === 'count' ? 'nos' : 'm'),
  secondary: [],
});

/**
 * Derives every real-world figure for a measurement. Pure — nothing is cached on the
 * measurement itself, so changing the scale instantly re-values the whole drawing.
 */
export function computeMeasurement(
  measurement: Measurement,
  scale: ScaleSettings,
): MeasurementResult {
  const { type, points } = measurement;
  if (!isComplete(type, points)) return EMPTY_RESULT(type);

  switch (type) {
    case 'line': {
      const [a, b] = points;
      const lengthMm = pxToRealMm(distance(a, b), scale);
      const inclinationDeg = inclination(a, b);
      const runMm = pxToRealMm(Math.abs(b.x - a.x), scale);
      const riseMm = pxToRealMm(Math.abs(b.y - a.y), scale);
      return {
        type,
        lengthMm,
        inclinationDeg,
        slopePercent: slopePercentFromAngle(inclinationDeg),
        riseMm,
        runMm,
        primary: quantity('ความยาว', mmToM(lengthMm), 'm'),
        secondary: [
          quantity('มุมเอียง', inclinationDeg, 'deg'),
          quantity('ความลาด', slopePercentFromAngle(inclinationDeg), '%'),
          quantity('ระยะราบ (run)', mmToM(runMm), 'm'),
          quantity('ระยะดิ่ง (rise)', mmToM(riseMm), 'm'),
        ],
      };
    }

    case 'polyline': {
      const lengthMm = pxToRealMm(polylineLength(points), scale);
      return {
        type,
        lengthMm,
        primary: quantity('ความยาวรวม', mmToM(lengthMm), 'm'),
        secondary: [quantity('จำนวนช่วง', points.length - 1, 'nos')],
      };
    }

    case 'rectangle': {
      const [a, b] = points;
      const widthMm = pxToRealMm(Math.abs(b.x - a.x), scale);
      const heightMm = pxToRealMm(Math.abs(b.y - a.y), scale);
      const areaMm2 = widthMm * heightMm;
      const perimeterMm = 2 * (widthMm + heightMm);
      return {
        type,
        widthMm,
        heightMm,
        areaMm2,
        lengthMm: perimeterMm,
        primary: quantity('พื้นที่', mm2ToM2(areaMm2), 'm²'),
        secondary: [
          quantity('กว้าง', mmToM(widthMm), 'm'),
          quantity('ยาว', mmToM(heightMm), 'm'),
          quantity('เส้นรอบรูป', mmToM(perimeterMm), 'm'),
        ],
      };
    }

    case 'polygon': {
      const areaMm2 = pxAreaToRealMm2(polygonArea(points), scale);
      const perimeterMm = pxToRealMm(polylineLength(points, true), scale);
      return {
        type,
        areaMm2,
        lengthMm: perimeterMm,
        primary: quantity('พื้นที่', mm2ToM2(areaMm2), 'm²'),
        secondary: [
          quantity('เส้นรอบรูป', mmToM(perimeterMm), 'm'),
          quantity('จำนวนจุด', points.length, 'nos'),
        ],
      };
    }

    case 'circle': {
      const radiusMm = pxToRealMm(distance(points[0], points[1]), scale);
      const areaMm2 = Math.PI * radiusMm * radiusMm;
      const circumferenceMm = 2 * Math.PI * radiusMm;
      return {
        type,
        radiusMm,
        areaMm2,
        lengthMm: circumferenceMm,
        primary: quantity('พื้นที่', mm2ToM2(areaMm2), 'm²'),
        secondary: [
          quantity('รัศมี', mmToM(radiusMm), 'm'),
          quantity('เส้นผ่านศูนย์กลาง', mmToM(radiusMm * 2), 'm'),
          quantity('เส้นรอบวง', mmToM(circumferenceMm), 'm'),
        ],
      };
    }

    case 'angle': {
      const [armA, vertex, armB] = points;
      const angleDeg = angleBetween(armA, vertex, armB);
      // Slope is only meaningful for the acute reading of the angle.
      const acute = angleDeg > 90 ? 180 - angleDeg : angleDeg;
      const armALengthMm = pxToRealMm(distance(vertex, armA), scale);
      const armBLengthMm = pxToRealMm(distance(vertex, armB), scale);
      return {
        type,
        angleDeg,
        slopePercent: slopePercentFromAngle(acute),
        lengthMm: armALengthMm + armBLengthMm,
        primary: quantity('มุม', angleDeg, 'deg'),
        secondary: [
          quantity('ความลาด', slopePercentFromAngle(acute), '%'),
          quantity('แขน A', mmToM(armALengthMm), 'm'),
          quantity('แขน B', mmToM(armBLengthMm), 'm'),
        ],
      };
    }

    case 'count':
    default:
      return {
        type: 'count',
        count: points.length,
        primary: quantity('จำนวน', points.length, 'nos'),
        secondary: [],
      };
  }
}

/** Batch helper so panels can look results up by id without recomputing per render. */
export function computeAll(
  measurements: Measurement[],
  scale: ScaleSettings,
): Map<string, MeasurementResult> {
  const map = new Map<string, MeasurementResult>();
  for (const m of measurements) map.set(m.id, computeMeasurement(m, scale));
  return map;
}
