import type {
  TakeoffItemDef,
  TakeoffLine,
  TakeoffLineResult,
  TakeoffOpening,
  TakeoffReport,
} from '@/types';
import { TAKEOFF_CATEGORIES, TAKEOFF_GROUPS, takeoffItem } from '@/types';
import { createId } from './id';
import { formatNumber } from './format';

/** พื้นที่ช่องเปิดหนึ่งรายการ (กว้าง × สูง × จำนวน) */
export const openingArea = (o: TakeoffOpening): number => o.width * o.height * o.count;

export const newOpening = (label = 'ประตู'): TakeoffOpening => ({
  id: createId('op'),
  label,
  width: 0.9,
  height: 2.1,
  count: 1,
});

/** แถวใหม่ที่กรอกค่าเริ่มต้นของสูตรไว้ให้แล้ว */
export const newTakeoffLine = (item: TakeoffItemDef, label = ''): TakeoffLine => ({
  id: createId('tk'),
  itemId: item.id,
  label,
  values: Object.fromEntries(item.inputs.map((input) => [input.key, input.defaultValue])),
  openings: [],
  wastePercent: 0,
});

/**
 * คำนวณปริมาณของหนึ่งแถว
 *
 *   ปริมาณ = (ฐานตามสูตร − ช่องเปิด × ตัวคูณด้าน) × (1 + เผื่อเสียหาย)
 *
 * ผลลัพธ์ไม่ติดลบ — ถ้าช่องเปิดใหญ่กว่าผนังแปลว่ากรอกผิด ให้เป็น 0 แทนที่จะหักกลับ
 */
export function computeTakeoffLine(line: TakeoffLine, item: TakeoffItemDef): TakeoffLineResult {
  // รายการที่ยังไม่มีวิธีคิด เป็นแค่บรรทัดจดไว้ ไม่มีปริมาณและไม่มีเงิน
  if (item.noteOnly) {
    return {
      baseQuantity: 0,
      deduction: 0,
      quantity: 0,
      unit: item.unit,
      workingText: '',
      components: [],
    };
  }

  const baseQuantity = item.base(line.values);
  const factor = item.deductOpenings ? (item.openingFactor?.(line.values) ?? 1) : 0;
  const openingTotal = line.openings.reduce((sum, o) => sum + openingArea(o), 0);
  const deduction = openingTotal * factor;

  const net = Math.max(0, baseQuantity - deduction);
  const waste = 1 + Math.max(0, line.wastePercent) / 100;
  const quantity = net * waste;

  return {
    baseQuantity,
    deduction,
    quantity,
    unit: item.unit,
    amount: line.unitPrice !== undefined ? quantity * line.unitPrice : undefined,
    workingText: workingText(line, item, baseQuantity, deduction, quantity),
    components: (item.components ?? []).map((c) => ({
      label: c.label,
      quantity: quantity * (typeof c.perUnit === 'function' ? c.perUnit(line.values) : c.perUnit),
      unit: c.unit,
    })),
  };
}

/** สูตรพร้อมตัวเลขจริง เพื่อให้ตรวจงานย้อนกลับได้โดยไม่ต้องเปิดโปรแกรม */
function workingText(
  line: TakeoffLine,
  item: TakeoffItemDef,
  baseQuantity: number,
  deduction: number,
  quantity: number,
): string {
  const inputs =
    item.workingExpr?.(line.values) ??
    item.inputs
      .filter((input) => !input.excludeFromWorking)
      .map((input) => formatNumber(line.values[input.key] ?? 0, 2))
      .join(' × ');
  let text = `(${inputs})`;

  if (deduction > 0) {
    const parts = line.openings
      .filter((o) => openingArea(o) > 0)
      .map((o) => `${formatNumber(o.width, 2)} × ${formatNumber(o.height, 2)} × ${o.count}`);
    const factor = item.openingFactor?.(line.values) ?? 1;
    const suffix = factor !== 1 ? ` × ${formatNumber(factor, 0)} ด้าน` : '';
    text += ` − (${parts.join(' + ')})${suffix}`;
  }

  if (line.wastePercent > 0) text += ` × เผื่อ ${formatNumber(line.wastePercent, 0)}%`;

  const netBefore = Math.max(0, baseQuantity - deduction);
  if (netBefore === 0 && baseQuantity > 0) text += ' → ช่องเปิดมากกว่าพื้นที่งาน ตรวจตัวเลขอีกครั้ง';

  return `${text} = ${formatNumber(quantity, 3)} ${item.unitLabel ?? item.unit}`;
}

/** ยอดรวมของแถวทั้งหมด (เฉพาะแถวที่ใส่ราคาต่อหน่วยไว้จึงจะมีจำนวนเงิน) */
export function takeoffTotal(lines: TakeoffLine[]): number {
  return lines.reduce((sum, line) => {
    const item = takeoffItem(line.itemId);
    if (!item) return sum;
    return sum + (computeTakeoffLine(line, item).amount ?? 0);
  }, 0);
}

/** จัดแถวทั้งหมดเข้าโครง หมวดหลัก → หมวดงาน → รายการ พร้อมยอดรวมทุกชั้น */
export function buildTakeoffReport(lines: TakeoffLine[], projectName: string): TakeoffReport {
  const categories = TAKEOFF_CATEGORIES.map((category) => {
    const groups = TAKEOFF_GROUPS.filter((g) => g.category === category.id)
      .map((group) => {
        const groupLines = lines
          .map((line) => {
            const item = takeoffItem(line.itemId);
            if (!item || item.groupId !== group.id) return null;
            return { line, item, result: computeTakeoffLine(line, item) };
          })
          .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

        return {
          group,
          lines: groupLines,
          amount: groupLines.reduce((sum, entry) => sum + (entry.result.amount ?? 0), 0),
        };
      })
      .filter((group) => group.lines.length > 0);

    return {
      category,
      groups,
      amount: groups.reduce((sum, group) => sum + group.amount, 0),
    };
  }).filter((category) => category.groups.length > 0);

  return {
    projectName,
    createdAt: Date.now(),
    categories,
    total: categories.reduce((sum, category) => sum + category.amount, 0),
  };
}
