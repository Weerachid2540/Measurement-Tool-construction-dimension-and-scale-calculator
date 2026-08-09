import type {
  Measurement,
  MaterialKind,
  MaterialResult,
  MaterialSpec,
  MeasurementResult,
  QuantityUnit,
} from '@/types';
import { MATERIAL_PRESETS, workItemPreset } from '@/types';
import { formatNumber } from './format';
import { isAreaType, isLengthType } from './measurement';

export const CONCRETE_DENSITY_KG_M3 = 2400;
export const STEEL_DENSITY_KG_M3 = 7850;

/** Standard rebar mass: W (kg/m) = D² / 162.2 for D in millimetres. */
export const rebarWeightPerMetre = (diameterMm: number): number => (diameterMm * diameterMm) / 162.2;

export const presetFor = (kind: MaterialKind) =>
  MATERIAL_PRESETS.find((p) => p.kind === kind) ?? MATERIAL_PRESETS[MATERIAL_PRESETS.length - 1];

export const defaultMaterialSpec = (kind: MaterialKind): MaterialSpec => {
  switch (kind) {
    case 'concrete':
      return { kind, thicknessMm: 100, widthMm: 200, depthMm: 400, wastePercent: 3 };
    case 'steel':
      return { kind, rebarDiameterMm: 12, barsPerMember: 1, wastePercent: 5 };
    case 'formwork':
      return { kind, depthMm: 400, formworkSides: 2, wastePercent: 5 };
    case 'masonry':
      return { kind, thicknessMm: 100, wastePercent: 3 };
    case 'finishing':
      return { kind, wastePercent: 5 };
    case 'earthwork':
      return { kind, thicknessMm: 1000, wastePercent: 0 };
    default:
      return { kind, wastePercent: 0 };
  }
};

const mmToM = (mm: number | undefined): number => (mm ?? 0) / 1000;

/** ชื่อหมวดงานที่เลือกไว้ ใช้ตั้งชื่อรายการใน BOQ ถ้าผู้ใช้ไม่ได้พิมพ์เอง */
const workLabel = (spec: MaterialSpec): string | undefined =>
  spec.workItem ? workItemPreset(spec.workItem)?.boqName : undefined;

interface RawQuantity {
  quantity: number;
  unit: QuantityUnit;
  lengthM?: number;
  areaM2?: number;
  volumeM3?: number;
  weightKg?: number;
  description: string;
}

function concreteQuantity(m: Measurement, r: MeasurementResult, spec: MaterialSpec): RawQuantity {
  if (isAreaType(m.type) && r.areaMm2 !== undefined) {
    const areaM2 = r.areaMm2 / 1_000_000;
    const t = mmToM(spec.thicknessMm);
    const volumeM3 = areaM2 * t;
    return {
      quantity: volumeM3,
      unit: 'm³',
      areaM2,
      volumeM3,
      weightKg: volumeM3 * CONCRETE_DENSITY_KG_M3,
      description: `คอนกรีต หนา ${formatNumber(t, 3)} ม. (พื้นที่ ${formatNumber(areaM2, 3)} ตร.ม.)`,
    };
  }
  const lengthM = (r.lengthMm ?? 0) / 1000;
  const w = mmToM(spec.widthMm);
  const d = mmToM(spec.depthMm);
  const volumeM3 = lengthM * w * d;
  return {
    quantity: volumeM3,
    unit: 'm³',
    lengthM,
    volumeM3,
    weightKg: volumeM3 * CONCRETE_DENSITY_KG_M3,
    description: `คอนกรีต หน้าตัด ${formatNumber(w, 3)}×${formatNumber(d, 3)} ม. ยาว ${formatNumber(lengthM, 3)} ม.`,
  };
}

function steelQuantity(m: Measurement, r: MeasurementResult, spec: MaterialSpec): RawQuantity {
  // Length-based members are billed by bar weight; anything else by volume × density.
  if (isLengthType(m.type) || m.type === 'angle') {
    const lengthM = (r.lengthMm ?? 0) / 1000;
    const bars = Math.max(1, spec.barsPerMember ?? 1);
    const diameter = spec.rebarDiameterMm ?? 12;
    const totalLengthM = lengthM * bars;
    const weightKg = totalLengthM * rebarWeightPerMetre(diameter);
    return {
      quantity: weightKg,
      unit: 'kg',
      lengthM: totalLengthM,
      weightKg,
      description: `เหล็กเสริม Ø${diameter} มม. × ${bars} เส้น ยาวรวม ${formatNumber(totalLengthM, 2)} ม.`,
    };
  }
  const areaM2 = (r.areaMm2 ?? 0) / 1_000_000;
  const volumeM3 = areaM2 * mmToM(spec.thicknessMm);
  const weightKg = volumeM3 * STEEL_DENSITY_KG_M3;
  return {
    quantity: weightKg,
    unit: 'kg',
    areaM2,
    volumeM3,
    weightKg,
    description: `เหล็กแผ่น หนา ${formatNumber(mmToM(spec.thicknessMm), 4)} ม. พื้นที่ ${formatNumber(areaM2, 3)} ตร.ม.`,
  };
}

function formworkQuantity(m: Measurement, r: MeasurementResult, spec: MaterialSpec): RawQuantity {
  if (isAreaType(m.type) && r.areaMm2 !== undefined) {
    const areaM2 = r.areaMm2 / 1_000_000;
    return {
      quantity: areaM2,
      unit: 'm²',
      areaM2,
      description: `ไม้แบบ พื้นที่ ${formatNumber(areaM2, 3)} ตร.ม.`,
    };
  }
  const lengthM = (r.lengthMm ?? 0) / 1000;
  const sides = Math.max(1, spec.formworkSides ?? 2);
  const areaM2 = lengthM * mmToM(spec.depthMm) * sides;
  return {
    quantity: areaM2,
    unit: 'm²',
    lengthM,
    areaM2,
    description: `ไม้แบบ สูง ${formatNumber(mmToM(spec.depthMm), 3)} ม. × ${sides} ด้าน ยาว ${formatNumber(lengthM, 2)} ม.`,
  };
}

function areaBasedQuantity(
  r: MeasurementResult,
  spec: MaterialSpec,
  kind: MaterialKind,
): RawQuantity {
  const areaM2 = (r.areaMm2 ?? 0) / 1_000_000;
  const preset = presetFor(kind);
  // หมวดงานที่ผู้ใช้เลือกบอกได้ตรงกว่าชนิดวัสดุ เช่น "งานฝ้าเพดาน" แทน "งานตกแต่งผิว"
  const name = workLabel(spec) ?? preset.label;
  if (preset.defaultUnit === 'm³') {
    const volumeM3 = areaM2 * mmToM(spec.thicknessMm);
    return {
      quantity: volumeM3,
      unit: 'm³',
      areaM2,
      volumeM3,
      description: `${name} ลึก ${formatNumber(mmToM(spec.thicknessMm), 3)} ม.`,
    };
  }
  return {
    quantity: areaM2,
    unit: 'm²',
    areaM2,
    description: `${name} พื้นที่ ${formatNumber(areaM2, 3)} ตร.ม.`,
  };
}

/**
 * Turns a geometric result into a billable material quantity.
 * Returns `null` when the measurement has no material assigned.
 */
export function computeMaterial(
  measurement: Measurement,
  result: MeasurementResult,
): MaterialResult | null {
  const spec = measurement.material;
  if (!spec) return null;

  let raw: RawQuantity;
  switch (spec.kind) {
    case 'concrete':
      raw = concreteQuantity(measurement, result, spec);
      break;
    case 'steel':
      raw = steelQuantity(measurement, result, spec);
      break;
    case 'formwork':
      raw = formworkQuantity(measurement, result, spec);
      break;
    case 'masonry':
    case 'finishing':
    case 'earthwork':
      raw = areaBasedQuantity(result, spec, spec.kind);
      break;
    default:
      raw = {
        quantity: result.primary.value,
        unit: result.primary.unit,
        description: spec.name ?? workLabel(spec) ?? 'รายการกำหนดเอง',
      };
  }

  const waste = 1 + (spec.wastePercent ?? 0) / 100;
  const quantityWithWaste = raw.quantity * waste;
  const unitPrice = spec.unitPrice;

  return {
    kind: spec.kind,
    description: spec.name?.trim() || raw.description,
    quantity: quantityWithWaste,
    unit: raw.unit,
    lengthM: raw.lengthM,
    areaM2: raw.areaM2,
    volumeM3: raw.volumeM3,
    weightKg: raw.weightKg,
    unitPrice,
    amount: unitPrice !== undefined ? quantityWithWaste * unitPrice : undefined,
  };
}
