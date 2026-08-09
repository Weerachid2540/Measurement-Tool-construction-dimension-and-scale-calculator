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
  { id: 'str-pile', category: 'structure', no: 1, label: 'งานเสาเข็ม', materialKind: 'concrete' },
  { id: 'str-foundation', category: 'structure', no: 2, label: 'งานฐานราก', materialKind: 'concrete' },
  { id: 'str-column', category: 'structure', no: 3, label: 'งานเสาคอนกรีต', materialKind: 'concrete' },
  { id: 'str-beam', category: 'structure', no: 4, label: 'งานคานคอนกรีต', materialKind: 'concrete' },
  { id: 'str-slab', category: 'structure', no: 5, label: 'งานพื้นคอนกรีต', materialKind: 'concrete' },
  { id: 'str-roof-frame', category: 'structure', no: 6, label: 'งานโครงสร้างเหล็กหลังคา', materialKind: 'steel' },
  { id: 'str-stair', category: 'structure', no: 7, label: 'งานโครงสร้างบันได', materialKind: 'concrete' },

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
  /** หัวข้อย่อยในหมวดงาน เช่น "งานดิน" ที่คลุมทั้งขุด ถมกลับ และขนทิ้ง */
  section?: string;
  /** เลขข้อที่แสดง ใช้เมื่อไม่ใช่เลขเรียงธรรมดา เช่น "1.2" ของข้อย่อย */
  code?: string;
  name: string;
  unit: QuantityUnit;
  /** หน่วยที่แสดงให้ผู้ใช้เห็น เมื่อคำไทยสื่อกว่ารหัสหน่วย เช่น "ต้น" แทน "nos" */
  unitLabel?: string;
  /** สูตรที่แสดงให้ผู้ใช้เห็นบนหน้าจอ */
  formula: string;
  inputs: readonly TakeoffInputDef[];
  /**
   * ข้อความแสดงการคำนวณ เมื่อสูตรไม่ใช่การคูณค่าที่กรอกเรียงกัน
   * เช่น ไม้แบบฐานราก (กว้าง+ยาว)×2×ความหนา — ปกติระบบเอาค่าที่กรอกมาคูณต่อกันให้เอง
   */
  workingExpr?: (v: Record<string, number>) => string;
  /** ยังไม่มีวิธีคิด — แสดงแค่ช่องตำแหน่ง/รายละเอียด ไม่คิดปริมาณและไม่เข้ายอดเงิน */
  noteOnly?: boolean;
  /** งานที่ทำซ้ำทุกชั้น — เปิดช่อง "ชั้น" ให้ผู้ใช้ใส่เอง (คาน พื้น) */
  perLevel?: boolean;
  /** งานที่นับตำแหน่งจากแบบได้ — เปิดปุ่มดึงผลจากเครื่องมือนับอัตโนมัติมาใส่ช่องปริมาณ */
  pullAutoCount?: boolean;
  /** รายการนี้หักช่องเปิด (ประตู/หน้าต่าง) ออกจากปริมาณได้ */
  deductOpenings: boolean;
  /** ปริมาณตามสูตร ก่อนหักช่องเปิดและก่อนเผื่อเสียหาย */
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

/**
 * รายการที่คิดปริมาณจากแบบเอง (เช่น เหล็กเสริม ซึ่งต้องอ่าน bar schedule)
 * เปิดช่องปริมาณช่องเดียว แต่ยังใช้เผื่อเสียหายและราคาต่อหน่วยได้ตามปกติ
 */
const manualQuantityItem = (
  id: string,
  groupId: TakeoffGroupId,
  no: number,
  name: string,
  unit: QuantityUnit,
  unitLabel: string,
  extra?: Partial<TakeoffItemDef>,
): TakeoffItemDef => ({
  id,
  groupId,
  no,
  name,
  unit,
  unitLabel,
  formula: 'กรอกปริมาณเอง',
  inputs: [{ key: 'quantity', label: 'ปริมาณ', unit: unitLabel, defaultValue: 0, min: 0, step: 1 }],
  workingExpr: () => 'กรอกปริมาณเอง',
  deductOpenings: false,
  base: (v) => n(v, 'quantity'),
  ...extra,
});

/** ช่องกรอกระยะเป็นเมตร ซึ่งเป็นหน่วยที่ใช้ถอดแบบงานโครงสร้างเกือบทั้งหมด */
const metreInput = (
  key: string,
  label: string,
  defaultValue: number,
  step = 0.05,
): TakeoffInputDef => ({ key, label, unit: 'ม.', defaultValue, min: 0, step });

const wholeInput = (
  key: string,
  label: string,
  unit: string,
  defaultValue: number,
): TakeoffInputDef => ({ key, label, unit, defaultValue, min: 0, step: 1 });

/** ตัวเลขในบรรทัดแสดงการคำนวณ — types ห้ามพึ่ง utils จึงจัดรูปแบบเองตรงนี้ */
const f = (value: number): string =>
  value.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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

/**
 * งานโครงสร้าง — คอนกรีตและไม้แบบคิดจากขนาดหน้าตัดตรงๆ ส่วนเหล็กเสริมเปิดช่องให้กรอกเอง
 * เพราะปริมาณเหล็กต้องอ่านจาก bar schedule ไม่ใช่สิ่งที่เดาจากขนาดหน้าตัดได้
 */
const STRUCTURE_ITEMS: readonly TakeoffItemDef[] = [
  // 1. งานเสาเข็ม — คิดเป็นจำนวนต้นทั้งหมด ชนิด/ขนาดเข็มระบุในช่องตำแหน่ง/รายละเอียด
  manualQuantityItem('str-pile-type', 'str-pile', 1, 'ชนิดเสาเข็ม', 'nos', 'ต้น', {
    pullAutoCount: true,
    hint: 'ระบุชนิดและขนาดในช่องตำแหน่ง/รายละเอียด เช่น เข็มตอก I-22 ยาว 12 ม.',
  }),
  manualQuantityItem('str-pile-test', 'str-pile', 2, 'ทดสอบเสาเข็ม', 'nos', 'ต้น', {
    pullAutoCount: true,
    hint: 'ระบุวิธีทดสอบในช่องตำแหน่ง/รายละเอียด เช่น Seismic Test หรือ Dynamic Load Test',
  }),
  manualQuantityItem('str-pile-chipping', 'str-pile', 3, 'งานสกัดเสาเข็ม', 'nos', 'ต้น', {
    pullAutoCount: true,
  }),

  // 2. งานฐานราก
  {
    id: 'str-footing-excavate',
    groupId: 'str-foundation',
    no: 1,
    section: 'งานดิน',
    code: '1.1',
    name: 'งานดินขุด',
    unit: 'm³',
    formula: 'ความกว้างหลุม × ความยาวหลุม × ความลึก × จำนวนหลุม',
    inputs: [
      metreInput('width', 'ความกว้างหลุม', 2),
      metreInput('length', 'ความยาวหลุม', 2),
      metreInput('depth', 'ความลึกหลุม', 1.5),
      wholeInput('count', 'จำนวนหลุม', 'หลุม', 1),
    ],
    deductOpenings: false,
    base: (v) => n(v, 'width') * n(v, 'length') * n(v, 'depth') * n(v, 'count'),
    hint: 'ขนาดหลุมรวมระยะทำงานรอบฐานรากแล้ว (ปกติเผื่อด้านละ 30–50 ซม.)',
  },
  {
    id: 'str-footing-backfill',
    groupId: 'str-foundation',
    no: 2,
    section: 'งานดิน',
    code: '1.2',
    name: 'งานถมดินกลับ',
    unit: 'm³',
    formula: 'ปริมาตรดินขุด − ปริมาตรโครงสร้างใต้ดิน',
    inputs: [
      { key: 'excavated', label: 'ปริมาตรดินขุด', unit: 'ลบ.ม.', defaultValue: 6, min: 0, step: 0.1 },
      {
        key: 'structure',
        label: 'ปริมาตรโครงสร้างใต้ดิน',
        unit: 'ลบ.ม.',
        defaultValue: 1.5,
        min: 0,
        step: 0.1,
      },
    ],
    deductOpenings: false,
    base: (v) => Math.max(0, n(v, 'excavated') - n(v, 'structure')),
    workingExpr: (v) => `${f(n(v, 'excavated'))} − ${f(n(v, 'structure'))}`,
    hint: 'ปริมาตรที่ถมกลับคิดเป็นดินแน่นในหลุม (bank volume)',
  },
  {
    id: 'str-footing-haul',
    groupId: 'str-foundation',
    no: 3,
    section: 'งานดิน',
    code: '1.3',
    name: 'งานขนย้ายดินไปทิ้ง',
    unit: 'm³',
    formula: '(ปริมาตรดินขุด − ปริมาตรดินถมกลับ) × ตัวคูณดินฟู',
    inputs: [
      { key: 'excavated', label: 'ปริมาตรดินขุด', unit: 'ลบ.ม.', defaultValue: 6, min: 0, step: 0.1 },
      {
        key: 'backfilled',
        label: 'ปริมาตรดินถมกลับ',
        unit: 'ลบ.ม.',
        defaultValue: 4.5,
        min: 0,
        step: 0.1,
      },
      {
        key: 'swell',
        label: 'ตัวคูณดินฟู',
        unit: 'เท่า',
        defaultValue: 1.25,
        min: 1,
        max: 2,
        step: 0.05,
      },
    ],
    deductOpenings: false,
    // ดินที่ขุดขึ้นมาแล้วฟูขึ้น 20–30% ปริมาตรบนรถบรรทุกจึงมากกว่าปริมาตรในหลุม
    base: (v) => Math.max(0, n(v, 'excavated') - n(v, 'backfilled')) * n(v, 'swell'),
    workingExpr: (v) =>
      `(${f(n(v, 'excavated'))} − ${f(n(v, 'backfilled'))}) × ${f(n(v, 'swell'))}`,
    hint: 'ดินเหนียว/ดินร่วนฟูราว 1.20–1.30 เท่า · ทราย 1.10–1.15 เท่า — คิดเป็นปริมาตรหลวมบนรถ',
  },
  {
    id: 'str-footing-sand',
    groupId: 'str-foundation',
    no: 4,
    code: '2.',
    name: 'งานทรายปรับระดับบดอัดแน่น',
    unit: 'm³',
    formula: 'ความกว้าง × ความยาว × ความหนา × จำนวนฐาน',
    inputs: [
      metreInput('width', 'ความกว้าง', 1.7),
      metreInput('length', 'ความยาว', 1.7),
      metreInput('thickness', 'ความหนาทราย', 0.05, 0.01),
      wholeInput('count', 'จำนวนฐาน', 'ฐาน', 1),
    ],
    deductOpenings: false,
    base: (v) => n(v, 'width') * n(v, 'length') * n(v, 'thickness') * n(v, 'count'),
  },
  {
    id: 'str-footing-lean',
    groupId: 'str-foundation',
    no: 5,
    code: '3.',
    name: "คอนกรีตหยาบ fc'=140 ksc.",
    unit: 'm³',
    formula: 'ความกว้าง × ความยาว × ความหนา × จำนวนฐาน',
    inputs: [
      metreInput('width', 'ความกว้าง', 1.7),
      metreInput('length', 'ความยาว', 1.7),
      metreInput('thickness', 'ความหนา', 0.05, 0.01),
      wholeInput('count', 'จำนวนฐาน', 'ฐาน', 1),
    ],
    deductOpenings: false,
    base: (v) => n(v, 'width') * n(v, 'length') * n(v, 'thickness') * n(v, 'count'),
    hint: 'ปกติขยายออกจากขอบฐานรากด้านละ 10 ซม.',
  },
  {
    id: 'str-footing-concrete',
    groupId: 'str-foundation',
    no: 6,
    code: '4.',
    name: 'คอนกรีตโครงสร้าง',
    unit: 'm³',
    formula: 'ความกว้าง × ความยาว × ความหนา × จำนวนฐาน',
    inputs: [
      metreInput('width', 'ความกว้างฐาน', 1.5),
      metreInput('length', 'ความยาวฐาน', 1.5),
      metreInput('thickness', 'ความหนาฐาน', 0.35),
      wholeInput('count', 'จำนวนฐาน', 'ฐาน', 1),
    ],
    deductOpenings: false,
    base: (v) => n(v, 'width') * n(v, 'length') * n(v, 'thickness') * n(v, 'count'),
    hint: "ระบุสเปกที่สั่งจากแพลนต์ในช่องตำแหน่ง/รายละเอียด เช่น fc'=280 ksc. (Cube) ผสมน้ำยากันซึม",
  },
  {
    id: 'str-footing-formwork',
    groupId: 'str-foundation',
    no: 7,
    code: '5.',
    name: 'งานไม้แบบ',
    unit: 'm²',
    formula: '(ความกว้าง + ความยาว) × 2 × ความหนา × จำนวนฐาน',
    inputs: [
      metreInput('width', 'ความกว้างฐาน', 1.5),
      metreInput('length', 'ความยาวฐาน', 1.5),
      metreInput('thickness', 'ความหนาฐาน', 0.35),
      wholeInput('count', 'จำนวนฐาน', 'ฐาน', 1),
      {
        key: 'nailPerSqm',
        label: 'ตะปูต่อไม้แบบ 1 ตร.ม.',
        unit: 'กก./ตร.ม.',
        defaultValue: 0.2,
        min: 0,
        step: 0.05,
        excludeFromWorking: true,
      },
    ],
    deductOpenings: false,
    base: (v) => (n(v, 'width') + n(v, 'length')) * 2 * n(v, 'thickness') * n(v, 'count'),
    workingExpr: (v) =>
      `(${f(n(v, 'width'))} + ${f(n(v, 'length'))}) × 2 × ${f(n(v, 'thickness'))} × ${n(v, 'count')}`,
    components: [{ label: 'ตะปู', perUnit: (v) => n(v, 'nailPerSqm'), unit: 'กก.' }],
    hint: 'อัตราตะปูแก้ได้ตามหน้างาน (ค่าเริ่มต้น 0.2 กก. ต่อไม้แบบ 1 ตร.ม.)',
  },
  manualQuantityItem(
    'str-footing-rebar',
    'str-foundation',
    8,
    'เหล็กเสริมคอนกรีต และลวดผูกเหล็ก',
    'kg',
    'กก.',
    {
      inputs: [
        { key: 'quantity', label: 'น้ำหนักเหล็กเสริม', unit: 'กก.', defaultValue: 0, min: 0, step: 1 },
        {
          key: 'tieWirePercent',
          label: 'ลวดผูกเหล็ก',
          unit: '% ของน้ำหนักเหล็ก',
          defaultValue: 1,
          min: 0,
          step: 0.1,
          excludeFromWorking: true,
        },
      ],
      components: [
        { label: 'ลวดผูกเหล็ก', perUnit: (v) => n(v, 'tieWirePercent') / 100, unit: 'กก.' },
      ],
      code: '6.',
      hint: 'อ่านน้ำหนักเหล็กจาก bar schedule (น้ำหนักต่อเมตร = D² ÷ 162.2) · ลวดผูกเหล็กปกติ 1% ของน้ำหนักเหล็ก',
    },
  ),

  // 3. งานเสาคอนกรีต
  {
    id: 'str-column-concrete',
    groupId: 'str-column',
    no: 1,
    name: 'คอนกรีตโครงสร้าง',
    unit: 'm³',
    formula: 'ความกว้าง × ความลึก × ความสูง × จำนวนต้น',
    inputs: [
      metreInput('width', 'ความกว้างหน้าตัด', 0.2, 0.01),
      metreInput('depth', 'ความลึกหน้าตัด', 0.2, 0.01),
      metreInput('height', 'ความสูงเสา', 3),
      wholeInput('count', 'จำนวนต้น', 'ต้น', 1),
    ],
    deductOpenings: false,
    base: (v) => n(v, 'width') * n(v, 'depth') * n(v, 'height') * n(v, 'count'),
    hint: "ระบุสเปกที่สั่งจากแพลนต์ในช่องตำแหน่ง/รายละเอียด เช่น fc'=280 ksc. (Cube)",
  },
  {
    id: 'str-column-formwork',
    groupId: 'str-column',
    no: 2,
    name: 'งานไม้แบบ',
    unit: 'm²',
    formula: '(ความกว้าง + ความลึก) × 2 × ความสูง × จำนวนต้น',
    inputs: [
      metreInput('width', 'ความกว้างหน้าตัด', 0.2, 0.01),
      metreInput('depth', 'ความลึกหน้าตัด', 0.2, 0.01),
      metreInput('height', 'ความสูงเสา', 3),
      wholeInput('count', 'จำนวนต้น', 'ต้น', 1),
      {
        key: 'nailPerSqm',
        label: 'ตะปูต่อไม้แบบ 1 ตร.ม.',
        unit: 'กก./ตร.ม.',
        defaultValue: 0.2,
        min: 0,
        step: 0.05,
        excludeFromWorking: true,
      },
    ],
    deductOpenings: false,
    base: (v) => (n(v, 'width') + n(v, 'depth')) * 2 * n(v, 'height') * n(v, 'count'),
    workingExpr: (v) =>
      `(${f(n(v, 'width'))} + ${f(n(v, 'depth'))}) × 2 × ${f(n(v, 'height'))} × ${n(v, 'count')}`,
    components: [{ label: 'ตะปู', perUnit: (v) => n(v, 'nailPerSqm'), unit: 'กก.' }],
    hint: 'อัตราตะปูแก้ได้ตามหน้างาน (ค่าเริ่มต้น 0.2 กก. ต่อไม้แบบ 1 ตร.ม.)',
  },
  manualQuantityItem(
    'str-column-rebar',
    'str-column',
    3,
    'เหล็กเสริมคอนกรีต และลวดผูกเหล็ก',
    'kg',
    'กก.',
    {
      inputs: [
        { key: 'quantity', label: 'น้ำหนักเหล็กเสริม', unit: 'กก.', defaultValue: 0, min: 0, step: 1 },
        {
          key: 'tieWirePercent',
          label: 'ลวดผูกเหล็ก',
          unit: '% ของน้ำหนักเหล็ก',
          defaultValue: 1,
          min: 0,
          step: 0.1,
          excludeFromWorking: true,
        },
      ],
      components: [
        { label: 'ลวดผูกเหล็ก', perUnit: (v) => n(v, 'tieWirePercent') / 100, unit: 'กก.' },
      ],
      hint: 'รวมเหล็กยืนและเหล็กปลอก อ่านจาก bar schedule · ลวดผูกเหล็กปกติ 1% ของน้ำหนักเหล็ก',
    },
  ),
  {
    id: 'str-column-grout',
    groupId: 'str-column',
    no: 4,
    name: 'Non-Shrink Grout',
    unit: 'm³',
    formula: 'ความกว้าง × ความยาว × ความหนา × จำนวนจุด',
    inputs: [
      metreInput('width', 'ความกว้างพื้นที่เกราท์', 0.3, 0.01),
      metreInput('length', 'ความยาวพื้นที่เกราท์', 0.3, 0.01),
      metreInput('thickness', 'ความหนาชั้นเกราท์', 0.025, 0.005),
      wholeInput('count', 'จำนวนจุด', 'จุด', 1),
    ],
    deductOpenings: false,
    base: (v) => n(v, 'width') * n(v, 'length') * n(v, 'thickness') * n(v, 'count'),
    hint: 'ใต้ Base Plate หรือรอยต่อเสาสำเร็จรูป — ปริมาณเป็น ลบ.ม. แปลงเป็นถุงตามสเปกผู้ผลิต',
  },

  // 4. งานคานคอนกรีต (แยกตามชั้น)
  {
    id: 'str-beam-sand',
    groupId: 'str-beam',
    no: 1,
    name: 'งานทรายปรับระดับบดอัดแน่น',
    unit: 'm³',
    formula: 'ความกว้าง × ความยาว × ความหนา',
    inputs: [
      metreInput('width', 'ความกว้าง', 0.3, 0.01),
      metreInput('length', 'ความยาว', 4),
      metreInput('thickness', 'ความหนาทราย', 0.05, 0.01),
    ],
    perLevel: true,
    deductOpenings: false,
    base: (v) => n(v, 'width') * n(v, 'length') * n(v, 'thickness'),
    hint: 'ใช้กับคานคอดินที่วางบนดิน',
  },
  {
    id: 'str-beam-lean',
    groupId: 'str-beam',
    no: 2,
    name: "งานคอนกรีตหยาบ fc'=140 ksc.",
    unit: 'm³',
    formula: 'ความกว้าง × ความยาว × ความหนา',
    inputs: [
      metreInput('width', 'ความกว้าง', 0.3, 0.01),
      metreInput('length', 'ความยาว', 4),
      metreInput('thickness', 'ความหนา', 0.05, 0.01),
    ],
    perLevel: true,
    deductOpenings: false,
    base: (v) => n(v, 'width') * n(v, 'length') * n(v, 'thickness'),
  },
  {
    id: 'str-beam-concrete',
    groupId: 'str-beam',
    no: 3,
    name: 'งานคอนกรีตโครงสร้าง',
    unit: 'm³',
    formula: 'ความกว้าง × ความลึก × ความยาว',
    inputs: [
      metreInput('width', 'ความกว้างคาน', 0.2, 0.01),
      metreInput('depth', 'ความลึกคาน', 0.4, 0.01),
      metreInput('length', 'ความยาวคาน', 4),
    ],
    perLevel: true,
    deductOpenings: false,
    base: (v) => n(v, 'width') * n(v, 'depth') * n(v, 'length'),
    hint: "ระบุสเปกที่สั่งจากแพลนต์ในช่องตำแหน่ง/รายละเอียด เช่น fc'=280 ksc. (Cube)",
  },
  {
    id: 'str-beam-formwork',
    groupId: 'str-beam',
    no: 4,
    name: 'งานไม้แบบ',
    unit: 'm²',
    formula: '(ความลึก × 2 + ความกว้าง) × ความยาว',
    inputs: [
      metreInput('width', 'ความกว้างคาน', 0.2, 0.01),
      metreInput('depth', 'ความลึกคาน', 0.4, 0.01),
      metreInput('length', 'ความยาวคาน', 4),
      {
        key: 'nailPerSqm',
        label: 'ตะปูต่อไม้แบบ 1 ตร.ม.',
        unit: 'กก./ตร.ม.',
        defaultValue: 0.2,
        min: 0,
        step: 0.05,
        excludeFromWorking: true,
      },
    ],
    perLevel: true,
    deductOpenings: false,
    // ข้างคานสองด้าน + ท้องคาน — หลังคานติดพื้นจึงไม่คิด
    base: (v) => (n(v, 'depth') * 2 + n(v, 'width')) * n(v, 'length'),
    workingExpr: (v) =>
      `(${f(n(v, 'depth'))} × 2 + ${f(n(v, 'width'))}) × ${f(n(v, 'length'))}`,
    components: [{ label: 'ตะปู', perUnit: (v) => n(v, 'nailPerSqm'), unit: 'กก.' }],
    hint: 'อัตราตะปูแก้ได้ตามหน้างาน (ค่าเริ่มต้น 0.2 กก. ต่อไม้แบบ 1 ตร.ม.)',
  },
  manualQuantityItem(
    'str-beam-rebar',
    'str-beam',
    5,
    'เหล็กเสริมคอนกรีต และลวดผูกเหล็ก',
    'kg',
    'กก.',
    {
      perLevel: true,
      inputs: [
        { key: 'quantity', label: 'น้ำหนักเหล็กเสริม', unit: 'กก.', defaultValue: 0, min: 0, step: 1 },
        {
          key: 'tieWirePercent',
          label: 'ลวดผูกเหล็ก',
          unit: '% ของน้ำหนักเหล็ก',
          defaultValue: 1,
          min: 0,
          step: 0.1,
          excludeFromWorking: true,
        },
      ],
      components: [
        { label: 'ลวดผูกเหล็ก', perUnit: (v) => n(v, 'tieWirePercent') / 100, unit: 'กก.' },
      ],
      hint: 'รวมเหล็กนอนและเหล็กปลอก อ่านจาก bar schedule · ลวดผูกเหล็กปกติ 1% ของน้ำหนักเหล็ก',
    },
  ),

  // 5. งานพื้นคอนกรีต (แยกตามชั้น)
  {
    id: 'str-slab-sand',
    groupId: 'str-slab',
    no: 1,
    name: 'งานทรายปรับระดับบดอัดแน่น',
    unit: 'm³',
    formula: 'ความกว้าง × ความยาว × ความหนา',
    inputs: [
      metreInput('width', 'ความกว้าง', 4),
      metreInput('length', 'ความยาว', 5),
      metreInput('thickness', 'ความหนาทราย', 0.05, 0.01),
    ],
    perLevel: true,
    deductOpenings: false,
    base: (v) => n(v, 'width') * n(v, 'length') * n(v, 'thickness'),
    // แผ่นพลาสติกคิดเป็นพื้นที่พื้น = ปริมาตรทราย ÷ ความหนาทราย
    components: [
      {
        label: 'แผ่นพลาสติกกันความชื้น',
        perUnit: (v) => {
          const thickness = n(v, 'thickness');
          return thickness > 0 ? 1 / thickness : 0;
        },
        unit: 'ตร.ม.',
      },
    ],
    hint: 'แผ่นพลาสติกคิดเป็นพื้นที่พื้น (กว้าง × ยาว) เผื่อทาบให้ใช้ช่องเผื่อเสียหาย',
  },
  {
    id: 'str-slab-concrete',
    groupId: 'str-slab',
    no: 2,
    name: 'งานคอนกรีตโครงสร้าง',
    unit: 'm³',
    formula: 'ความกว้าง × ความยาว × ความหนา',
    inputs: [
      metreInput('width', 'ความกว้าง', 4),
      metreInput('length', 'ความยาว', 5),
      metreInput('thickness', 'ความหนาพื้น', 0.12, 0.01),
    ],
    perLevel: true,
    deductOpenings: false,
    base: (v) => n(v, 'width') * n(v, 'length') * n(v, 'thickness'),
    hint: "ระบุสเปกที่สั่งจากแพลนต์ในช่องตำแหน่ง/รายละเอียด เช่น fc'=280 ksc. (Cube)",
  },
  {
    id: 'str-slab-formwork',
    groupId: 'str-slab',
    no: 3,
    name: 'งานไม้แบบ',
    unit: 'm²',
    formula: 'ความกว้าง × ความยาว',
    inputs: [
      metreInput('width', 'ความกว้าง', 4),
      metreInput('length', 'ความยาว', 5),
      {
        key: 'nailPerSqm',
        label: 'ตะปูต่อไม้แบบ 1 ตร.ม.',
        unit: 'กก./ตร.ม.',
        defaultValue: 0.2,
        min: 0,
        step: 0.05,
        excludeFromWorking: true,
      },
    ],
    perLevel: true,
    deductOpenings: false,
    base: (v) => n(v, 'width') * n(v, 'length'),
    components: [{ label: 'ตะปู', perUnit: (v) => n(v, 'nailPerSqm'), unit: 'กก.' }],
    hint: 'คิดเฉพาะท้องพื้น — ไม้แบบขอบพื้นให้เพิ่มอีกแถวหรือรวมในงานไม้แบบคาน',
  },
  manualQuantityItem(
    'str-slab-rebar',
    'str-slab',
    4,
    'เหล็กเสริมคอนกรีต และลวดผูกเหล็ก',
    'kg',
    'กก.',
    {
      perLevel: true,
      inputs: [
        { key: 'quantity', label: 'น้ำหนักเหล็กเสริม', unit: 'กก.', defaultValue: 0, min: 0, step: 1 },
        {
          key: 'tieWirePercent',
          label: 'ลวดผูกเหล็ก',
          unit: '% ของน้ำหนักเหล็ก',
          defaultValue: 1,
          min: 0,
          step: 0.1,
          excludeFromWorking: true,
        },
      ],
      components: [
        { label: 'ลวดผูกเหล็ก', perUnit: (v) => n(v, 'tieWirePercent') / 100, unit: 'กก.' },
      ],
      hint: 'เหล็กเส้นหรือไวร์เมชก็ได้ อ่านน้ำหนักจาก bar schedule · ลวดผูกเหล็กปกติ 1% ของน้ำหนักเหล็ก',
    },
  ),

  // 6. งานโครงสร้างเหล็กหลังคา
  {
    id: 'str-roof-steel',
    groupId: 'str-roof-frame',
    no: 1,
    name: 'เหล็กรูปพรรณโครงหลังคา',
    unit: 'kg',
    formula: 'ความยาวรวม × น้ำหนักต่อเมตร',
    inputs: [
      metreInput('length', 'ความยาวรวม', 20, 0.5),
      {
        key: 'weightPerM',
        label: 'น้ำหนักต่อเมตร',
        unit: 'กก./ม.',
        defaultValue: 5.31,
        min: 0,
        step: 0.01,
      },
    ],
    deductOpenings: false,
    base: (v) => n(v, 'length') * n(v, 'weightPerM'),
    hint: 'ดูน้ำหนักต่อเมตรจากตารางเหล็กรูปพรรณ เช่น C-100×50×20×2.3 = 5.31 กก./ม.',
  },
  {
    id: 'str-roof-purlin',
    groupId: 'str-roof-frame',
    no: 2,
    name: 'แปหลังคา',
    unit: 'kg',
    formula: 'ความยาวรวม × น้ำหนักต่อเมตร',
    inputs: [
      metreInput('length', 'ความยาวรวม', 30, 0.5),
      {
        key: 'weightPerM',
        label: 'น้ำหนักต่อเมตร',
        unit: 'กก./ม.',
        defaultValue: 2.25,
        min: 0,
        step: 0.01,
      },
    ],
    deductOpenings: false,
    base: (v) => n(v, 'length') * n(v, 'weightPerM'),
  },
  {
    id: 'str-roof-paint',
    groupId: 'str-roof-frame',
    no: 3,
    name: 'งานทาสีกันสนิมโครงหลังคา',
    unit: 'm²',
    formula: 'ความยาวรวม × เส้นรอบรูปหน้าตัด',
    inputs: [
      metreInput('length', 'ความยาวรวม', 20, 0.5),
      metreInput('perimeter', 'เส้นรอบรูปหน้าตัด', 0.34, 0.01),
    ],
    deductOpenings: false,
    base: (v) => n(v, 'length') * n(v, 'perimeter'),
    hint: 'เส้นรอบรูปหน้าตัด = ผลรวมความยาวทุกด้านของหน้าตัดเหล็ก',
  },

  // 7. งานโครงสร้างบันได
  {
    id: 'str-stair-concrete',
    groupId: 'str-stair',
    no: 1,
    name: 'โครงสร้างบันไดคอนกรีต',
    unit: 'm³',
    formula: 'ความกว้าง × ความยาวตามแนวลาด × ความหนาเฉลี่ย',
    inputs: [
      metreInput('width', 'ความกว้างบันได', 1.2),
      metreInput('length', 'ความยาวตามแนวลาด', 4.5),
      metreInput('thickness', 'ความหนาเฉลี่ย', 0.24, 0.01),
    ],
    perLevel: true,
    deductOpenings: false,
    base: (v) => n(v, 'width') * n(v, 'length') * n(v, 'thickness'),
    hint: 'ความหนาเฉลี่ย = ความหนาพื้นเอียง + ลูกตั้ง ÷ 2 (คิดเนื้อขั้นบันไดรวมไว้แล้ว)',
  },
  {
    id: 'str-stair-steel',
    groupId: 'str-stair',
    no: 2,
    name: 'โครงสร้างบันไดเหล็ก',
    unit: 'kg',
    formula: 'ความยาวรวม × น้ำหนักต่อเมตร',
    inputs: [
      metreInput('length', 'ความยาวรวม', 12, 0.5),
      {
        key: 'weightPerM',
        label: 'น้ำหนักต่อเมตร',
        unit: 'กก./ม.',
        defaultValue: 11.1,
        min: 0,
        step: 0.01,
      },
    ],
    perLevel: true,
    deductOpenings: false,
    base: (v) => n(v, 'length') * n(v, 'weightPerM'),
    hint: 'รวมแม่บันได ลูกนอน และเหล็กยึด — ดูน้ำหนักต่อเมตรจากตารางเหล็ก',
  },
];

export const TAKEOFF_ITEMS: readonly TakeoffItemDef[] = [...STRUCTURE_ITEMS, ...WALL_ITEMS];

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
  /** ชั้นของงาน เช่น "ชั้น 2" — ใช้เฉพาะรายการที่ตั้ง `perLevel` ไว้ */
  level?: string;
  values: Record<string, number>;
  openings: TakeoffOpening[];
  wastePercent: number;
  unitPrice?: number;
  notes?: string;
}

export interface TakeoffLineResult {
  /** ปริมาณก่อนหักช่องเปิด (ต่อหนึ่งชุด) */
  baseQuantity: number;
  /** ปริมาณช่องเปิดที่หักออก (ต่อหนึ่งชุด) */
  deduction: number;
  /** ปริมาณสุทธิ รวมเผื่อเสียหายแล้ว */
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
