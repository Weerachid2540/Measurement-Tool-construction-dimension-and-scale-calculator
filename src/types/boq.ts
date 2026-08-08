export interface BoqRow {
  no: number;
  code: string;
  description: string;
  category: string;
  unit: string;
  quantity: number;
  unitPrice?: number;
  amount?: number;
  remark?: string;
}

export interface BoqSummaryRow {
  category: string;
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
