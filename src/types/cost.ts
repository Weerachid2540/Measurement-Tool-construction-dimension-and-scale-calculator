/**
 * หมวดต้นทุน — บันทึกค่าใช้จ่ายจริงของหน้างาน
 *
 * คนละเรื่องกับถอดแบบ: ถอดแบบคือ "ควรใช้เท่าไร" ส่วนต้นทุนคือ "จ่ายไปแล้วเท่าไร"
 * จึงเก็บแยกกันคนละชุด แล้วค่อยเอามาเทียบกันในหน้าสรุป
 */

export type CostKind = 'material' | 'labour';

/** ค่าแรงคิดได้สองแบบตามที่ตกลงกับช่าง */
export type LabourType = 'daily' | 'lumpsum';

export const LABOUR_TYPES: readonly { id: LabourType; label: string; unit: string }[] = [
  { id: 'daily', label: 'รายวัน', unit: 'วัน' },
  { id: 'lumpsum', label: 'เหมา', unit: 'งาน' },
] as const;

export interface CostEntry {
  id: string;
  kind: CostKind;
  /** วันที่ในรูปแบบ YYYY-MM-DD ตามที่ <input type="date"> ใช้ */
  date: string;
  /** ชื่อวัสดุ หรือชื่องาน/ทีมช่าง */
  name: string;
  /**
   * ค่าวัสดุกรอกยอดรวมจากบิลตรงๆ (รวม VAT แล้ว) ไม่ต้องแยกจำนวน × ราคา
   * เพราะบิลจริงมักรวมหลายขนาด หลายส่วนลด จนแตกกลับเป็นราคาต่อหน่วยไม่ได้
   */
  amount?: number;
  /** ค่าแรง: จำนวน × ราคาต่อหน่วย */
  unit: string;
  quantity: number;
  unitPrice: number;
  /** ค่าเดินทางของทีมช่าง คิดเป็นจำนวนวัน × ค่าเดินทางต่อวัน */
  travelDays?: number;
  travelRate?: number;
  /** ร้านค้า หรือผู้รับเหมา */
  vendor?: string;
  /** เลขที่บิล/ใบเสร็จ ไว้อ้างอิงตอนตรวจสอบย้อนหลัง */
  reference?: string;
  notes?: string;
  labourType?: LabourType;
}

export interface CostTotals {
  material: number;
  labour: number;
  /** ค่าเดินทาง รวมอยู่ใน `labour` แล้ว แยกไว้เพื่อให้เห็นว่าเป็นเงินเท่าไร */
  travel: number;
  total: number;
}

export interface CostReport {
  projectName: string;
  createdAt: number;
  materials: (CostEntry & { amount: number })[];
  labour: (CostEntry & { amount: number })[];
  totals: CostTotals;
}
