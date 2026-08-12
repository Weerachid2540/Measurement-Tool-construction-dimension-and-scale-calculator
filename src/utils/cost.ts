import type { CostEntry, CostKind, CostReport, CostTotals, LabourType } from '@/types';
import { LABOUR_TYPES } from '@/types';
import { createId } from './id';

/** ค่าเดินทางของแถวค่าแรง (จำนวนวัน × ค่าเดินทางต่อวัน) */
export const travelAmount = (entry: CostEntry): number =>
  (entry.travelDays ?? 0) * (entry.travelRate ?? 0);

/** ค่าวัสดุใช้ยอดรวมจากบิล ส่วนค่าแรงคิดจากจำนวน × ราคา แล้วบวกค่าเดินทาง */
export const entryAmount = (entry: CostEntry): number =>
  entry.kind === 'material'
    ? (entry.amount ?? 0)
    : entry.quantity * entry.unitPrice + travelAmount(entry);

const today = (): string => new Date().toISOString().slice(0, 10);

export const labourUnit = (type: LabourType): string =>
  LABOUR_TYPES.find((t) => t.id === type)?.unit ?? 'งาน';

/** แถวใหม่ตั้งวันที่เป็นวันนี้ให้เลย เพราะส่วนใหญ่บันทึกวันที่ซื้อจริง */
export const newCostEntry = (kind: CostKind): CostEntry => ({
  id: createId('cost'),
  kind,
  date: today(),
  name: '',
  unit: kind === 'material' ? '' : labourUnit('daily'),
  quantity: kind === 'material' ? 0 : 1,
  unitPrice: 0,
  ...(kind === 'material'
    ? { amount: 0 }
    : { labourType: 'daily' as LabourType, travelDays: 0, travelRate: 0 }),
});

export function costTotals(entries: CostEntry[]): CostTotals {
  let material = 0;
  let labour = 0;
  let travel = 0;
  for (const entry of entries) {
    if (entry.kind === 'material') {
      material += entryAmount(entry);
    } else {
      labour += entryAmount(entry);
      travel += travelAmount(entry);
    }
  }
  return { material, labour, travel, total: material + labour };
}

/** เรียงตามวันที่เพื่อให้อ่านเป็นไทม์ไลน์การใช้จ่าย แถวที่ยังไม่ใส่วันที่ไปอยู่ท้าย */
const byDate = (a: CostEntry, b: CostEntry): number => (a.date || '9999').localeCompare(b.date || '9999');

export function buildCostReport(entries: CostEntry[], projectName: string): CostReport {
  const withAmount = (list: CostEntry[]) =>
    [...list].sort(byDate).map((entry) => ({ ...entry, amount: entryAmount(entry) }));

  return {
    projectName,
    createdAt: Date.now(),
    materials: withAmount(entries.filter((e) => e.kind === 'material')),
    labour: withAmount(entries.filter((e) => e.kind === 'labour')),
    totals: costTotals(entries),
  };
}
