export interface BoqRow {
  no: number;
  /** รายการวัดต้นทางของแถวนี้ — ไม่มีเมื่อแถวถูกยุบรวมหลายรายการเข้าด้วยกัน */
  measurementId?: string;
  code: string;
  description: string;
  /** หมวดย่อย เช่น "1. งานผนัง (Wall)" หรือชนิดวัสดุเมื่อไม่ได้เลือกหมวดงาน */
  category: string;
  /** หมวดงานหลัก เช่น "งานสถาปัตยกรรม (ARCHITECTURE WORK)" */
  group?: string;
  unit: string;
  quantity: number;
  unitPrice?: number;
  amount?: number;
  remark?: string;
}

export interface BoqSummaryRow {
  category: string;
  group?: string;
  unit: string;
  quantity: number;
  amount: number;
}

export interface BoqReport {
  projectName: string;
  drawingName: string;
  scaleLabel: string;
  createdAt: number;
  rows: BoqRow[];
  summary: BoqSummaryRow[];
  subtotal: number;
  currency: string;
}

export interface BoqOptions {
  projectName: string;
  drawingName: string;
  scaleLabel: string;
  currency: string;
  /** Group rows that share a description + unit into one line. */
  groupIdenticalItems: boolean;
  includeHiddenMeasurements: boolean;
}
