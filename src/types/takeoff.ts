import type { MaterialKind } from './material';
import type { QuantityUnit } from './scale';

/**
 * การคำนวณถอดแบบประมาณราคา — โครงสร้าง 3 ชั้น
 *
 *   หมวดหลัก (TakeoffCategory)  เช่น 2. ARCHITECTURE WORK
 *     └ หมวดงาน (TakeoffGroup)  เช่น งานผนัง
 *         └ รายการงาน (TakeoffItem) เช่น งานก่อผนังอิฐมอญครึ่งแผ่น + สูตรของมัน
 *
 * ผู้ใช้สร้าง "แถวถอดแบบ" (TakeoffLine) จากรายการงาน แล้วกรอกตัวเลขเอง
 * แยกจากการวัดบนแบบโดยสิ้นเชิง — ถอดแบบด้วยตัวเลขจากแบบพิมพ์ก็ทำได้โดยไม่ต้องเปิดไฟล์
 */

export type TakeoffCategoryId = 'structure' | 'architecture' | 'electrical' | 'sanitary';

export interface TakeoffCategory {
  id: TakeoffCategoryId;
  no: number;
  /** ชื่อหมวดตามที่ใช้ในเอกสารประมาณราคา */
  label: string;
  labelTh: string;
}

export const TAKEOFF_CATEGORIES: readonly TakeoffCategory[] = [
  { id: 'structure', no: 1, label: 'STRUCTURE WORK', labelTh: 'งานโครงสร้าง' },
  { id: 'architecture', no: 2, label: 'ARCHITECTURE WORK', labelTh: 'งานสถาปัตยกรรม' },
  { id: 'electrical', no: 3, label: 'ELECTRICAL SYSTEM', labelTh: 'งานระบบไฟฟ้า' },
  { id: 'sanitary', no: 4, label: 'PIPING-SANITARY SYSTEM', labelTh: 'งานระบบสุขาภิบาล' },
] as const;

export type TakeoffGroupId = string;

export interface TakeoffGroup {
  id: TakeoffGroupId;
  category: TakeoffCategoryId;
  no: number;
  label: string;
  /** วัสดุที่ตั้งให้อัตโนมัติเมื่อผูกรายการวัดเข้ากับหมวดงานนี้ใน BOQ */
  materialKind: MaterialKind;
}

export const TAKEOFF_GROUPS: readonly TakeoffGroup[] = [
  // 1. STRUCTURE WORK
  { id: 'str-earthwork', category: 'structure', no: 1, label: 'งานดิน', materialKind: 'earthwork' },
  { id: 'str-foundation', category: 'structure', no: 2, label: 'งานฐานรากและเสาเข็ม', materialKind: 'concrete' },
  { id: 'str-column', category: 'structure', no: 3, label: 'งานเสา', materialKind: 'concrete' },
  { id: 'str-beam', category: 'structure', no: 4, label: 'งานคาน', materialKind: 'concrete' },
  { id: 'str-slab', category: 'structure', no: 5, label: 'งานพื้น', materialKind: 'concrete' },
  { id: 'str-stair', category: 'structure', no: 6, label: 'งานบันได', materialKind: 'concrete' },
  { id: 'str-roof-frame', category: 'structure', no: 7, label: 'งานโครงหลังคา', materialKind: 'steel' },

  // 2. ARCHITECTURE WORK
  { id: 'arch-wall', category: 'architecture', no: 1, label: 'งานผนัง', materialKind: 'masonry' },
  { id: 'arch-floor', category: 'architecture', no: 2, label: 'งานพื้น', materialKind: 'finishing' },
  { id: 'arch-ceiling', category: 'architecture', no: 3, label: 'งานฝ้าเพดาน', materialKind: 'finishing' },
  { id: 'arch-paint', category: 'architecture', no: 4, label: 'งานทาสีผนัง', materialKind: 'finishing' },
  { id: 'arch-door-window', category: 'architecture', no: 5, label: 'งานประตูและหน้าต่าง', materialKind: 'custom' },
  { id: 'arch-roof', category: 'architecture', no: 6, label: 'งานหลังคา', materialKind: 'finishing' },
  { id: 'arch-sanitary', category: 'architecture', no: 7, label: 'งานสุขภัณฑ์', materialKind: 'custom' },
  { id: 'arch-misc', category: 'architecture', no: 8, label: 'งานเบ็ดเตล็ด', materialKind: 'custom' },

  // 3. ELECTRICAL SYSTEM
  { id: 'ele-conduit', category: 'electrical', no: 1, label: 'งานเดินท่อร้อยสาย', materialKind: 'custom' },
  { id: 'ele-wiring', category: 'electrical', no: 2, label: 'งานเดินสายไฟฟ้า', materialKind: 'custom' },
  { id: 'ele-fixture', category: 'electrical', no: 3, label: 'งานดวงโคม สวิตช์ และเต้ารับ', materialKind: 'custom' },
  { id: 'ele-panel', category: 'electrical', no: 4, label: 'งานตู้ควบคุมไฟฟ้า', materialKind: 'custom' },
  { id: 'ele-communication', category: 'electrical', no: 5, label: 'งานระบบสื่อสารและสัญญาณ', materialKind: 'custom' },
  { id: 'ele-grounding', category: 'electrical', no: 6, label: 'งานสายดินและระบบป้องกันฟ้าผ่า', materialKind: 'custom' },

  // 4. PIPING-SANITARY SYSTEM
  { id: 'san-supply', category: 'sanitary', no: 1, label: 'งานท่อน้ำดี', materialKind: 'custom' },
  { id: 'san-drain', category: 'sanitary', no: 2, label: 'งานท่อน้ำทิ้งและท่อโสโครก', materialKind: 'custom' },
  { id: 'san-vent', category: 'sanitary', no: 3, label: 'งานท่อระบายอากาศ', materialKind: 'custom' },
  { id: 'san-fixture', category: 'sanitary', no: 4, label: 'งานสุขภัณฑ์และอุปกรณ์', materialKind: 'custom' },
  { id: 'san-tank', category: 'sanitary', no: 5, label: 'งานถังเก็บน้ำและเครื่องสูบน้ำ', materialKind: 'custom' },
  { id: 'san-septic', category: 'sanitary', no: 6, label: 'งานบ่อบำบัดและบ่อพัก', materialKind: 'concrete' },
] as const;

/** ช่องกรอกตัวเลขหนึ่งช่องของสูตร */
export interface TakeoffInputDef {
  key: string;
  label: string;
  /** หน่วยที่แสดงท้ายช่องกรอก เช่น "ม." */
  unit: string;
  defaultValue: number;
  min?: number;
  max?: number;
  step?: number;
  /** ค่าที่ไม่ได้คูณอยู่ในสูตรปริมาณ (เช่น ความหนาปูนฉาบ ซึ่งใช้คิดวัสดุอย่างเดียว) */
  excludeFromWorking?: boolean;
}

/**
 * ปริมาณวัสดุโดยประมาณต่อหนึ่งหน่วยของรายการ — ใช้เป็นตัวช่วย ไม่ใช่ราคากลาง
 *
 * `perUnit` เป็นฟังก์ชันได้ เพราะบางวัสดุขึ้นกับค่าที่กรอก เช่น ปูนฉาบใช้ตามความหนาที่ฉาบ
 */
export interface TakeoffComponent {
  label: string;
  perUnit: number | ((v: Record<string, number>) => number);
  unit: string;
}

export interface TakeoffItemDef {
  id: string;
  groupId: TakeoffGroupId;
  no: number;
  name: string;
  unit: QuantityUnit;
  /** สูตรที่แสดงให้ผู้ใช้เห็นบนหน้าจอ */
  formula: string;
  inputs: readonly TakeoffInputDef[];
  /** ยังไม่มีวิธีคิด — แสดงแค่ช่องตำแหน่ง/รายละเอียด ไม่คิดปริมาณและไม่เข้ายอดเงิน */
  noteOnly?: boolean;
  /** รายการนี้หักช่องเปิด (ประตู/หน้าต่าง) ออกจากปริมาณได้ */
  deductOpenings: boolean;
  /** ปริมาณก่อนหักช่องเปิดและก่อนคูณจำนวนชุด */
  base: (v: Record<string, number>) => number;
  /**
   * ตัวคูณพื้นที่ช่องเปิดที่หักออก — ปกติ 1
   * งานที่ทำสองด้าน (ฉาบ/ทาสี) ต้องหักช่องเปิดตามจำนวนด้านด้วย
   */
  openingFactor?: (v: Record<string, number>) => number;
  components?: readonly TakeoffComponent[];
  hint?: string;
  /** ลิงก์อ้างอิงภายนอก เช่น เครื่องคำนวณของผู้ผลิต — เปิดในแท็บใหม่ */
  link?: { url: string; label: string };
}

const n = (v: Record<string, number>, key: string): number => {
  const value = v[key];
  return Number.isFinite(value) ? value : 0;
};

/** ผนังทั่วไป: ยาว × สูง แล้วหักช่องเปิด */
const wallInputs: readonly TakeoffInputDef[] = [
  { key: 'length', label: 'ความกว้าง (ความยาวผนัง)', unit: 'ม.', defaultValue: 4, min: 0, step: 0.1 },
  { key: 'height', label: 'ความสูงผนัง', unit: 'ม.', defaultValue: 2.8, min: 0, step: 0.1 },
];

const sidesInput: TakeoffInputDef = {
  key: 'sides',
  label: 'จำนวนด้านที่ทำ',
  unit: 'ด้าน',
  defaultValue: 2,
  min: 1,
  max: 2,
  step: 1,
};

const wallArea = (v: Record<string, number>): number => n(v, 'length') * n(v, 'height');


/**
 * ความหนาฉาบเป็นตัวแปร ไม่ใช่ค่าตายตัวของรายการ — ผนังมวลเบาก็ฉาบ 15 มม. ได้
 * ปริมาณปูนแปรผันตรงกับความหนา จึงเทียบบัญญัติไตรยางศ์จากค่าครอบคลุมที่ 10 มม.
 */
const plasterThicknessInput = (defaultValue: number): TakeoffInputDef => ({
  key: 'plasterThicknessMm',
  label: 'ความหนาปูนฉาบ',
  unit: 'มม.',
  defaultValue,
  min: 5,
  max: 40,
  step: 1,
  excludeFromWorking: true,
});

/**
 * ปูนฉาบผนังก่ออิฐ/บล็อก — หน้างานคิดเป็นช่วงความหนา ไม่ได้แปรผันต่อเนื่อง
 * ถุง 50 กก. ฉาบบาง (≤12 มม.) ได้ 2.5 ตร.ม. ฉาบหนา (>12 มม.) ได้ 2.0 ตร.ม.
 */
const BRICK_PLASTER_THIN_MM = 12;
const BRICK_PLASTER_COVERAGE_THIN = 2.5;
const BRICK_PLASTER_COVERAGE_THICK = 2.0;

const brickPlasterBagsPerSqm = (v: Record<string, number>): number => {
  const thickness = n(v, 'plasterThicknessMm') || 10;
  return (
    1 /
    (thickness <= BRICK_PLASTER_THIN_MM
      ? BRICK_PLASTER_COVERAGE_THIN
      : BRICK_PLASTER_COVERAGE_THICK)
  );
};

/** ปูนฉาบอิฐมวลเบามีค่าอ้างอิงที่ 10 มม. อย่างเดียว จึงเทียบบัญญัติไตรยางศ์ตามความหนา */
const AAC_PLASTER_COVERAGE_10MM = 2.7;

/**
 * รายการที่ยังไม่ตกลงวิธีคิด — มีแต่ช่องตำแหน่ง/รายละเอียดไว้จดไปก่อน
 * ไม่คิดปริมาณและไม่เข้ายอดเงิน จนกว่าจะใส่สูตรให้
 */
const noteOnlyItem = (
  id: string,
  no: number,
  name: string,
  unit: QuantityUnit,
  hint?: string,
): TakeoffItemDef => ({
  id,
  groupId: 'arch-wall',
  no,
  name,
  unit,
  formula: 'ยังไม่กำหนดวิธีคิด',
  inputs: [],
  noteOnly: true,
  deductOpenings: false,
  base: () => 0,
  ...(hint ? { hint } : {}),
});

const plasterBagsPerSqm =
  (coverageAt10mm: number) =>
  (v: Record<string, number>): number => {
    const thickness = n(v, 'plasterThicknessMm') || 10;
    return thickness / 10 / coverageAt10mm;
  };

const WALL_ITEMS: readonly TakeoffItemDef[] = [
  {
    id: 'wall-brick-half',
    groupId: 'arch-wall',
    no: 1,
    name: 'งานก่อผนังอิฐมอญครึ่งแผ่น',
    unit: 'm²',
    formula: '(ความสูง × ความกว้าง) − (ความสูงประตู/หน้าต่าง × ความกว้างประตู/หน้าต่าง)',
    inputs: wallInputs,
    deductOpenings: true,
    base: wallArea,
    components: [
      { label: 'อิฐมอญ', perUnit: 138, unit: 'ก้อน' },
      { label: 'ปูนก่อสำเร็จ', perUnit: 0.9, unit: 'ถุง' },
    ],
  },
  {
    id: 'wall-brick-full',
    groupId: 'arch-wall',
    no: 2,
    name: 'งานก่อผนังอิฐมอญเต็มแผ่น',
    unit: 'm²',
    formula: '(ความสูง × ความกว้าง) − พื้นที่ช่องเปิด',
    inputs: wallInputs,
    deductOpenings: true,
    base: wallArea,
    components: [
      { label: 'อิฐมอญ', perUnit: 276, unit: 'ก้อน' },
      { label: 'ปูนก่อสำเร็จ', perUnit: 1.8, unit: 'ถุง' },
    ],
  },
  {
    id: 'wall-cmu',
    groupId: 'arch-wall',
    no: 3,
    name: 'งานก่อผนังคอนกรีตบล็อก',
    unit: 'm²',
    formula: '(ความสูง × ความกว้าง) − พื้นที่ช่องเปิด',
    inputs: wallInputs,
    deductOpenings: true,
    base: wallArea,
    components: [
      { label: 'คอนกรีตบล็อก 7 ซม.', perUnit: 12.5, unit: 'ก้อน' },
      { label: 'ปูนก่อสำเร็จ', perUnit: 0.5, unit: 'ถุง' },
    ],
  },
  {
    id: 'wall-aac',
    groupId: 'arch-wall',
    no: 4,
    name: 'งานก่อผนังอิฐมวลเบา',
    unit: 'm²',
    formula: '(ความสูง × ความกว้าง) − พื้นที่ช่องเปิด',
    inputs: wallInputs,
    deductOpenings: true,
    base: wallArea,
    // ก้อน 20×60 ซม. = 0.12 ตร.ม./ก้อน · ปูนก่อมวลเบา 1 ถุง ก่อผนังหนา 7.5 ซม. ได้ 26 ตร.ม.
    components: [
      { label: 'อิฐมวลเบา 20×60×7.5 ซม.', perUnit: 1 / (0.2 * 0.6), unit: 'ก้อน' },
      { label: 'ปูนก่อมวลเบา (1 ถุง ≈ 26 ตร.ม.)', perUnit: 1 / 26, unit: 'ถุง' },
    ],
  },
  {
    id: 'wall-light-frame',
    groupId: 'arch-wall',
    no: 5,
    name: 'งานผนังเบาโครงคร่าว (ยิปซัม / ไฟเบอร์ซีเมนต์)',
    unit: 'm²',
    formula: '(ความสูง × ความกว้าง × จำนวนด้าน) − (พื้นที่ช่องเปิด × จำนวนด้าน)',
    inputs: [...wallInputs, sidesInput],
    deductOpenings: true,
    base: (v) => wallArea(v) * n(v, 'sides'),
    openingFactor: (v) => n(v, 'sides'),
    components: [
      { label: 'แผ่นยิปซัม 1.20×2.40 ม.', perUnit: 0.35, unit: 'แผ่น' },
      { label: 'โครงคร่าว', perUnit: 3.2, unit: 'ม.' },
    ],
    hint: 'นับพื้นที่ตามจำนวนด้านที่ปิดแผ่น — ผนังปิดสองด้านคิด 2 เท่า',
    link: {
      url: 'https://furringline.com/calculator/',
      label: 'เครื่องคำนวณปริมาณวัสดุ และราคาเบื้องต้น (furringline.com)',
    },
  },
  {
    id: 'wall-plaster-brick',
    groupId: 'arch-wall',
    no: 6,
    name: 'งานฉาบปูนผนังก่ออิฐมอญ / คอนกรีตบล็อก',
    unit: 'm²',
    formula: '(ความสูง × ความกว้าง × จำนวนด้าน) − (พื้นที่ช่องเปิด × จำนวนด้าน)',
    inputs: [...wallInputs, sidesInput, plasterThicknessInput(15)],
    deductOpenings: true,
    base: (v) => wallArea(v) * n(v, 'sides'),
    openingFactor: (v) => n(v, 'sides'),
    components: [
      {
        label: 'ปูนฉาบสำเร็จ 50 กก.',
        perUnit: brickPlasterBagsPerSqm,
        unit: 'ถุง',
      },
    ],
    hint: `ปูนฉาบ 50 กก. 1 ถุง — ฉาบหนาไม่เกิน ${BRICK_PLASTER_THIN_MM} มม. ได้ ${BRICK_PLASTER_COVERAGE_THIN} ตร.ม. · หนากว่านั้นได้ ${BRICK_PLASTER_COVERAGE_THICK} ตร.ม.`,
  },
  {
    id: 'wall-plaster-aac',
    groupId: 'arch-wall',
    no: 7,
    name: 'งานฉาบปูนผนังอิฐมวลเบา',
    unit: 'm²',
    formula: '(ความสูง × ความกว้าง × จำนวนด้าน) − (พื้นที่ช่องเปิด × จำนวนด้าน)',
    inputs: [...wallInputs, sidesInput, plasterThicknessInput(10)],
    deductOpenings: true,
    base: (v) => wallArea(v) * n(v, 'sides'),
    openingFactor: (v) => n(v, 'sides'),
    components: [
      {
        label: 'ปูนฉาบอิฐมวลเบา 50 กก.',
        perUnit: plasterBagsPerSqm(AAC_PLASTER_COVERAGE_10MM),
        unit: 'ถุง',
      },
    ],
    hint: `ปูนฉาบอิฐมวลเบา 1 ถุง ฉาบหนา 10 มม. ได้ 2.56–2.8 ตร.ม. (ใช้ค่ากลาง ${AAC_PLASTER_COVERAGE_10MM}) — ฉาบหนา 15 มม. ก็แก้ช่องความหนาได้`,
  },
  {
    id: 'wall-tile',
    groupId: 'arch-wall',
    no: 8,
    name: 'งานบุผิวผนัง (กระเบื้อง / หิน)',
    unit: 'm²',
    formula: '(ความสูง × ความกว้าง) − พื้นที่ช่องเปิด',
    inputs: wallInputs,
    deductOpenings: true,
    base: wallArea,
    components: [
      { label: 'กระเบื้องบุผนัง', perUnit: 1.05, unit: 'ตร.ม.' },
      { label: 'ปูนกาว', perUnit: 0.25, unit: 'ถุง' },
    ],
  },
  {
    id: 'wall-stiffener',
    groupId: 'arch-wall',
    no: 9,
    name: 'งานเสาเอ็น / ทับหลัง ค.ส.ล.',
    unit: 'm',
    formula: 'จำนวนท่อน × ความยาวเฉลี่ยต่อท่อน',
    inputs: [
      { key: 'pieces', label: 'จำนวนท่อน', unit: 'ท่อน', defaultValue: 4, min: 0, step: 1 },
      { key: 'length', label: 'ความยาวเฉลี่ยต่อท่อน', unit: 'ม.', defaultValue: 2.8, min: 0, step: 0.1 },
    ],
    deductOpenings: false,
    base: (v) => n(v, 'pieces') * n(v, 'length'),
    hint: 'ตามมาตรฐานต้องมีเสาเอ็นทุกระยะไม่เกิน 3 ม. และรอบวงกบทุกช่อง',
  },
  noteOnlyItem('wall-tie-bar', 10, 'เหล็กหนวดกุ้งงานก่ออิฐ', 'nos'),
  {
    id: 'wall-corner-bead',
    groupId: 'arch-wall',
    no: 11,
    name: 'จับเซี้ยมปูน',
    unit: 'm',
    formula: 'จำนวนมุม × ความยาวเฉลี่ยต่อมุม',
    inputs: [
      { key: 'corners', label: 'จำนวนมุม / เซี้ยม', unit: 'มุม', defaultValue: 4, min: 0, step: 1 },
      {
        key: 'length',
        label: 'ความยาวเฉลี่ยต่อมุม',
        unit: 'ม.',
        defaultValue: 2.8,
        min: 0,
        step: 0.1,
      },
    ],
    deductOpenings: false,
    base: (v) => n(v, 'corners') * n(v, 'length'),
    hint: 'นับทั้งเซี้ยมมุมผนัง มุมเสา และขอบวงกบประตู-หน้าต่าง',
  },
  noteOnlyItem('wall-wire-mesh', 12, 'ตะแกรงกรงไก่', 'm²'),
  noteOnlyItem(
    'wall-waterproof-admix',
    13,
    'น้ำยากันซึมผสมปูนฉาบ (เฉพาะฉาบภายนอก)',
    'm²',
    'คิดเฉพาะด้านที่ฉาบภายนอก',
  ),
];

export const TAKEOFF_ITEMS: readonly TakeoffItemDef[] = [...WALL_ITEMS];

export const takeoffCategory = (id: TakeoffCategoryId): TakeoffCategory | undefined =>
  TAKEOFF_CATEGORIES.find((c) => c.id === id);

export const takeoffGroup = (id: TakeoffGroupId): TakeoffGroup | undefined =>
  TAKEOFF_GROUPS.find((g) => g.id === id);

export const takeoffGroupsOf = (category: TakeoffCategoryId): TakeoffGroup[] =>
  TAKEOFF_GROUPS.filter((g) => g.category === category);

export const takeoffItem = (id: string): TakeoffItemDef | undefined =>
  TAKEOFF_ITEMS.find((i) => i.id === id);

export const takeoffItemsOf = (groupId: TakeoffGroupId): TakeoffItemDef[] =>
  TAKEOFF_ITEMS.filter((i) => i.groupId === groupId);

/** ชื่อเต็มของหมวดงานพร้อมหมวดหลัก เช่น "2. ARCHITECTURE WORK / งานผนัง" */
export const takeoffGroupPath = (id: TakeoffGroupId): string => {
  const group = takeoffGroup(id);
  if (!group) return '';
  const category = takeoffCategory(group.category);
  return category ? `${category.no}. ${category.label} / ${group.label}` : group.label;
};

/** ช่องเปิดที่หักออกจากปริมาณ เช่น ประตูหรือหน้าต่างในผนังบานนั้น */
export interface TakeoffOpening {
  id: string;
  label: string;
  width: number;
  height: number;
  count: number;
}

/** หนึ่งบรรทัดในตารางถอดแบบ — ผู้ใช้กรอกตัวเลขเองทั้งหมด */
export interface TakeoffLine {
  id: string;
  itemId: string;
  /** ตำแหน่ง/รายละเอียด เช่น "ผนังห้องนอน 1 ทิศเหนือ" */
  label: string;
  values: Record<string, number>;
  openings: TakeoffOpening[];
  /** จำนวนชุดที่เหมือนกันทุกประการ */
  count: number;
  wastePercent: number;
  unitPrice?: number;
  notes?: string;
}

export interface TakeoffLineResult {
  /** ปริมาณก่อนหักช่องเปิด (ต่อหนึ่งชุด) */
  baseQuantity: number;
  /** ปริมาณช่องเปิดที่หักออก (ต่อหนึ่งชุด) */
  deduction: number;
  /** ปริมาณสุทธิ รวมจำนวนชุดและเผื่อเสียหายแล้ว */
  quantity: number;
  unit: QuantityUnit;
  amount?: number;
  /** สูตรพร้อมตัวเลขจริง เช่น "(2.80 × 4.00) − (2.10 × 0.90 × 1) = 9.31" */
  workingText: string;
  components: { label: string; quantity: number; unit: string }[];
}

export interface TakeoffGroupTotal {
  groupId: TakeoffGroupId;
  groupLabel: string;
  categoryId: TakeoffCategoryId;
  lines: number;
  amount: number;
}

export interface TakeoffReport {
  projectName: string;
  createdAt: number;
  categories: {
    category: TakeoffCategory;
    groups: {
      group: TakeoffGroup;
      lines: { line: TakeoffLine; item: TakeoffItemDef; result: TakeoffLineResult }[];
      amount: number;
    }[];
    amount: number;
  }[];
  total: number;
}
