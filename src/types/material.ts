import type { QuantityUnit } from './scale';

export type MaterialKind =
  | 'concrete'
  | 'steel'
  | 'formwork'
  | 'masonry'
  | 'finishing'
  | 'earthwork'
  | 'custom';

/**
 * How a raw geometric measurement should be turned into a material quantity.
 *
 * Which fields matter depends on the measurement's geometry:
 *  - area-based (rectangle / polygon / circle) → `thicknessMm` gives a volume
 *  - length-based (line / polyline)            → `widthMm` × `depthMm` gives a volume,
 *                                                `rebarDiameterMm` gives a weight
 */
export interface MaterialSpec {
  kind: MaterialKind;
  /** Free-text override for the BOQ description, e.g. "พื้น ค.ส.ล. หนา 0.12 ม.". */
  name?: string;
  thicknessMm?: number;
  widthMm?: number;
  depthMm?: number;
  rebarDiameterMm?: number;
  /** Number of bars running along the measured length. */
  barsPerMember?: number;
  /** Formwork is usually counted on both faces of a beam/wall. */
  formworkSides?: number;
  wastePercent?: number;
  unitPrice?: number;
}

export interface MaterialResult {
  kind: MaterialKind;
  description: string;
  /** Billable quantity, already including waste. */
  quantity: number;
  unit: QuantityUnit;
  lengthM?: number;
  areaM2?: number;
  volumeM3?: number;
  weightKg?: number;
  unitPrice?: number;
  amount?: number;
}

export interface MaterialPreset {
  kind: MaterialKind;
  label: string;
  /** kg/m³ — used when converting a volume into a weight. */
  densityKgM3?: number;
  defaultUnit: QuantityUnit;
  hint: string;
}

export const MATERIAL_PRESETS: readonly MaterialPreset[] = [
  {
    kind: 'concrete',
    label: 'คอนกรีต (Concrete)',
    densityKgM3: 2400,
    defaultUnit: 'm³',
    hint: 'พื้นที่ × ความหนา หรือ ความยาว × กว้าง × ลึก',
  },
  {
    kind: 'steel',
    label: 'เหล็กเสริม (Reinforcement)',
    densityKgM3: 7850,
    defaultUnit: 'kg',
    hint: 'ความยาว × จำนวนเส้น × น้ำหนักต่อเมตร (D²/162.2)',
  },
  {
    kind: 'formwork',
    label: 'ไม้แบบ (Formwork)',
    defaultUnit: 'm²',
    hint: 'พื้นที่สัมผัสแบบ หรือ ความยาว × ความลึก × จำนวนด้าน',
  },
  {
    kind: 'masonry',
    label: 'งานก่อ (Masonry)',
    densityKgM3: 1800,
    defaultUnit: 'm²',
    hint: 'พื้นที่ผนัง (คิดเป็น ตร.ม.)',
  },
  {
    kind: 'finishing',
    label: 'งานตกแต่งผิว (Finishing)',
    defaultUnit: 'm²',
    hint: 'พื้นที่ฉาบ/ทาสี/ปูกระเบื้อง',
  },
  {
    kind: 'earthwork',
    label: 'งานดิน (Earthwork)',
    densityKgM3: 1800,
    defaultUnit: 'm³',
    hint: 'พื้นที่ × ความลึก',
  },
  {
    kind: 'custom',
    label: 'กำหนดเอง (Custom)',
    defaultUnit: 'm',
    hint: 'ใช้ค่าที่วัดได้โดยตรง',
  },
] as const;

/** Common Thai rebar designations and their nominal diameters. */
export const REBAR_SIZES: readonly { id: string; diameterMm: number }[] = [
  { id: 'RB6', diameterMm: 6 },
  { id: 'RB9', diameterMm: 9 },
  { id: 'DB10', diameterMm: 10 },
  { id: 'DB12', diameterMm: 12 },
  { id: 'DB16', diameterMm: 16 },
  { id: 'DB20', diameterMm: 20 },
  { id: 'DB25', diameterMm: 25 },
  { id: 'DB28', diameterMm: 28 },
  { id: 'DB32', diameterMm: 32 },
] as const;
