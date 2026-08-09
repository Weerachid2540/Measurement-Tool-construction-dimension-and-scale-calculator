import type { MaterialKind } from './material';
import type { QuantityUnit } from './scale';

/**
 * หมวดงานตามแบบ BOQ ของงานก่อสร้างไทย — ใช้จัดกลุ่มรายการใน BOQ
 * แยกจาก `MaterialKind` โดยตั้งใจ: หมวดงานคือ "งานอะไร" (งานผนัง, งานฝ้า)
 * ส่วนวัสดุคือ "คิดปริมาณอย่างไร" (พื้นที่ × ความหนา, น้ำหนักเหล็ก)
 * งานผนังหนึ่งรายการอาจคิดเป็นงานก่อหรืองานตกแต่งผิวก็ได้
 */
export type WorkGroupId = 'architecture';

export type WorkItemId =
  | 'arch-wall'
  | 'arch-floor'
  | 'arch-ceiling'
  | 'arch-paint'
  | 'arch-door-window'
  | 'arch-roof'
  | 'arch-sanitary'
  | 'arch-misc';

export interface WorkItemPreset {
  id: WorkItemId;
  group: WorkGroupId;
  /** ลำดับที่แสดงใน BOQ เช่น 1. งานผนัง */
  no: number;
  label: string;
  /** ชื่อสั้นสำหรับตั้งเป็นรายการใน BOQ เมื่อผู้ใช้ไม่ได้พิมพ์เอง */
  boqName: string;
  /** วัสดุที่ตั้งให้อัตโนมัติเมื่อเลือกหมวดนี้ครั้งแรก */
  materialKind: MaterialKind;
  unit: QuantityUnit;
  hint: string;
}

export interface WorkGroupPreset {
  id: WorkGroupId;
  label: string;
  items: readonly WorkItemPreset[];
}

const ARCHITECTURE_ITEMS: readonly WorkItemPreset[] = [
  {
    id: 'arch-wall',
    group: 'architecture',
    no: 1,
    label: '1. งานผนัง (Wall)',
    boqName: 'งานผนัง',
    materialKind: 'masonry',
    unit: 'm²',
    hint: 'พื้นที่ผนังก่อ/ผนังเบา (ตร.ม.)',
  },
  {
    id: 'arch-floor',
    group: 'architecture',
    no: 2,
    label: '2. งานพื้น (Floor)',
    boqName: 'งานพื้น',
    materialKind: 'finishing',
    unit: 'm²',
    hint: 'พื้นที่ปูวัสดุพื้น (ตร.ม.)',
  },
  {
    id: 'arch-ceiling',
    group: 'architecture',
    no: 3,
    label: '3. งานฝ้าเพดาน (Ceiling)',
    boqName: 'งานฝ้าเพดาน',
    materialKind: 'finishing',
    unit: 'm²',
    hint: 'พื้นที่ฝ้าเพดาน (ตร.ม.)',
  },
  {
    id: 'arch-paint',
    group: 'architecture',
    no: 4,
    label: '4. งานทาสีผนัง (Wall painting)',
    boqName: 'งานทาสีผนัง',
    materialKind: 'finishing',
    unit: 'm²',
    hint: 'พื้นที่ทาสี — หักช่องเปิดตามต้องการ (ตร.ม.)',
  },
  {
    id: 'arch-door-window',
    group: 'architecture',
    no: 5,
    label: '5. งานประตูและหน้าต่าง (Door & Window)',
    boqName: 'งานประตูและหน้าต่าง',
    materialKind: 'custom',
    unit: 'nos',
    hint: 'นับเป็นชุด หรือคิดเป็นพื้นที่บาน',
  },
  {
    id: 'arch-roof',
    group: 'architecture',
    no: 6,
    label: '6. งานหลังคา (Roof)',
    boqName: 'งานหลังคา',
    materialKind: 'finishing',
    unit: 'm²',
    hint: 'พื้นที่หลังคาตามความลาดเอียง (ตร.ม.)',
  },
  {
    id: 'arch-sanitary',
    group: 'architecture',
    no: 7,
    label: '7. งานสุขภัณฑ์ (Sanitary)',
    boqName: 'งานสุขภัณฑ์',
    materialKind: 'custom',
    unit: 'nos',
    hint: 'นับจำนวนสุขภัณฑ์ (ชุด)',
  },
  {
    id: 'arch-misc',
    group: 'architecture',
    no: 8,
    label: '8. งานเบ็ดเตล็ด (Miscellaneous)',
    boqName: 'งานเบ็ดเตล็ด',
    materialKind: 'custom',
    unit: 'nos',
    hint: 'รายการย่อยที่ไม่เข้าหมวดอื่น',
  },
] as const;

export const WORK_GROUPS: readonly WorkGroupPreset[] = [
  {
    id: 'architecture',
    label: 'งานสถาปัตยกรรม (ARCHITECTURE WORK)',
    items: ARCHITECTURE_ITEMS,
  },
] as const;

export const WORK_ITEMS: readonly WorkItemPreset[] = WORK_GROUPS.flatMap((g) => g.items);

export const workItemPreset = (id: WorkItemId): WorkItemPreset | undefined =>
  WORK_ITEMS.find((item) => item.id === id);

export const workGroupPreset = (id: WorkGroupId): WorkGroupPreset | undefined =>
  WORK_GROUPS.find((group) => group.id === id);

/** ลำดับสำหรับเรียงหมวดใน BOQ — กลุ่ม × 100 + ลำดับข้อย่อย */
export const workItemOrder = (id: WorkItemId): number => {
  const item = workItemPreset(id);
  if (!item) return Number.MAX_SAFE_INTEGER;
  const groupIndex = WORK_GROUPS.findIndex((g) => g.id === item.group);
  return groupIndex * 100 + item.no;
};
