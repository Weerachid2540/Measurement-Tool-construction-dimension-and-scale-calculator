import * as ExcelJSNamespace from 'exceljs';
import { saveAs } from 'file-saver';
import type { BoqReport, Measurement, MeasurementSession, ScaleSettings } from '@/types';
import { computeMeasurement, TYPE_LABELS } from '../measurement';
import { computeMaterial } from '../materials';
import { fileTimestamp, formatDateTime, sanitiseFileName } from '../format';
import { scaleLabel } from '../scale';

// The browser bundle is CJS; depending on the interop it lands on `default` or the namespace.
type ExcelModule = typeof ExcelJSNamespace & { default?: typeof ExcelJSNamespace };
const Excel: typeof ExcelJSNamespace =
  (ExcelJSNamespace as ExcelModule).default ?? ExcelJSNamespace;

const HEADER_FILL = 'FF0EA5E9';
const HEADER_FONT = 'FFFFFFFF';

function styleHeader(row: ExcelJSNamespace.Row): void {
  row.font = { bold: true, color: { argb: HEADER_FONT } };
  row.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  row.height = 22;
  row.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };
  });
}

function borderAll(sheet: ExcelJSNamespace.Worksheet, fromRow: number, toRow: number): void {
  for (let r = fromRow; r <= toRow; r += 1) {
    sheet.getRow(r).eachCell((cell) => {
      cell.border = {
        top: { style: 'hair' },
        left: { style: 'hair' },
        bottom: { style: 'hair' },
        right: { style: 'hair' },
      };
    });
  }
}

/** BOQ + raw measurement detail in a single workbook. */
export async function exportBoqToExcel(
  report: BoqReport,
  measurements: Measurement[],
  scale: ScaleSettings,
): Promise<void> {
  const workbook = new Excel.Workbook();
  workbook.creator = 'Measurement Tool';
  workbook.created = new Date();

  buildBoqSheet(workbook, report);
  buildSummarySheet(workbook, report);
  buildMeasurementSheet(workbook, measurements, scale);

  const buffer = await workbook.xlsx.writeBuffer();
  const name = sanitiseFileName(report.drawingName || report.projectName || 'BOQ');
  saveAs(
    new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    `BOQ_${name}_${fileTimestamp()}.xlsx`,
  );
}

function buildBoqSheet(workbook: ExcelJSNamespace.Workbook, report: BoqReport): void {
  const sheet = workbook.addWorksheet('BOQ', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true },
  });

  sheet.columns = [
    { key: 'no', width: 6 },
    { key: 'code', width: 12 },
    { key: 'description', width: 52 },
    { key: 'category', width: 24 },
    { key: 'unit', width: 8 },
    { key: 'quantity', width: 14 },
    { key: 'unitPrice', width: 14 },
    { key: 'amount', width: 16 },
    { key: 'remark', width: 28 },
  ];

  sheet.mergeCells('A1:I1');
  const title = sheet.getCell('A1');
  title.value = 'BILL OF QUANTITIES (BOQ)';
  title.font = { bold: true, size: 16 };
  title.alignment = { horizontal: 'center' };

  sheet.getCell('A2').value = 'โครงการ / Project:';
  sheet.getCell('B2').value = report.projectName || '-';
  sheet.getCell('A3').value = 'แบบ / Drawing:';
  sheet.getCell('B3').value = report.drawingName || '-';
  sheet.getCell('E2').value = 'มาตราส่วน / Scale:';
  sheet.getCell('F2').value = report.scaleLabel;
  sheet.getCell('E3').value = 'วันที่ / Date:';
  sheet.getCell('F3').value = formatDateTime(report.createdAt);
  for (const ref of ['A2', 'A3', 'E2', 'E3']) sheet.getCell(ref).font = { bold: true };

  const headerRow = sheet.addRow({
    no: 'No.',
    code: 'Code',
    description: 'รายการ / Description',
    category: 'หมวดงาน / Category',
    unit: 'หน่วย',
    quantity: 'ปริมาณ',
    unitPrice: 'ราคา/หน่วย',
    amount: 'จำนวนเงิน',
    remark: 'หมายเหตุ',
  });
  styleHeader(headerRow);

  const firstDataRow = headerRow.number + 1;
  for (const row of report.rows) {
    sheet.addRow({
      no: row.no,
      code: row.code,
      description: row.description,
      category: row.category,
      unit: row.unit,
      quantity: row.quantity,
      unitPrice: row.unitPrice ?? null,
      amount: row.amount ?? null,
      remark: row.remark ?? '',
    });
  }
  const lastDataRow = sheet.rowCount;

  sheet.getColumn('quantity').numFmt = '#,##0.000';
  sheet.getColumn('unitPrice').numFmt = '#,##0.00';
  sheet.getColumn('amount').numFmt = '#,##0.00';
  borderAll(sheet, firstDataRow, lastDataRow);

  const totalRow = sheet.addRow({
    description: 'รวมทั้งสิ้น / Subtotal',
    amount: report.subtotal,
  });
  totalRow.font = { bold: true };
  totalRow.getCell('amount').numFmt = '#,##0.00';

  sheet.views = [{ state: 'frozen', ySplit: headerRow.number }];
  sheet.autoFilter = { from: { row: headerRow.number, column: 1 }, to: { row: lastDataRow, column: 9 } };
}

function buildSummarySheet(workbook: ExcelJSNamespace.Workbook, report: BoqReport): void {
  const sheet = workbook.addWorksheet('Summary');
  sheet.columns = [
    { key: 'category', width: 32 },
    { key: 'unit', width: 10 },
    { key: 'quantity', width: 16 },
    { key: 'amount', width: 18 },
  ];
  styleHeader(
    sheet.addRow({
      category: 'หมวดงาน / Category',
      unit: 'หน่วย',
      quantity: 'ปริมาณรวม',
      amount: 'จำนวนเงิน',
    }),
  );
  for (const row of report.summary) sheet.addRow(row);
  sheet.getColumn('quantity').numFmt = '#,##0.000';
  sheet.getColumn('amount').numFmt = '#,##0.00';
  borderAll(sheet, 2, sheet.rowCount);
}

function buildMeasurementSheet(
  workbook: ExcelJSNamespace.Workbook,
  measurements: Measurement[],
  scale: ScaleSettings,
): void {
  const sheet = workbook.addWorksheet('Measurements');
  sheet.columns = [
    { key: 'label', width: 10 },
    { key: 'type', width: 22 },
    { key: 'page', width: 8 },
    { key: 'primary', width: 18 },
    { key: 'unit', width: 8 },
    { key: 'length', width: 14 },
    { key: 'area', width: 14 },
    { key: 'angle', width: 12 },
    { key: 'volume', width: 14 },
    { key: 'weight', width: 14 },
    { key: 'notes', width: 30 },
  ];
  styleHeader(
    sheet.addRow({
      label: 'Label',
      type: 'ชนิด',
      page: 'หน้า',
      primary: 'ค่าหลัก',
      unit: 'หน่วย',
      length: 'ความยาว (m)',
      area: 'พื้นที่ (m²)',
      angle: 'มุม (°)',
      volume: 'ปริมาตร (m³)',
      weight: 'น้ำหนัก (kg)',
      notes: 'หมายเหตุ',
    }),
  );

  for (const m of measurements) {
    const result = computeMeasurement(m, scale);
    const material = computeMaterial(m, result);
    sheet.addRow({
      label: m.label,
      type: TYPE_LABELS[m.type],
      page: m.page,
      primary: result.primary.value,
      unit: result.primary.unit,
      length: result.lengthMm !== undefined ? result.lengthMm / 1000 : null,
      area: result.areaMm2 !== undefined ? result.areaMm2 / 1_000_000 : null,
      angle: result.angleDeg ?? null,
      volume: material?.volumeM3 ?? null,
      weight: material?.weightKg ?? null,
      notes: m.notes ?? '',
    });
  }

  for (const key of ['primary', 'length', 'area', 'angle', 'volume', 'weight']) {
    sheet.getColumn(key).numFmt = '#,##0.000';
  }
  sheet.getCell('A' + (sheet.rowCount + 2)).value = `มาตราส่วน: ${scaleLabel(scale)}`;
  borderAll(sheet, 2, sheet.rowCount);
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
}

/** Flat export of the whole saved history — one row per session. */
export async function exportHistoryToExcel(sessions: MeasurementSession[]): Promise<void> {
  const workbook = new Excel.Workbook();
  workbook.creator = 'Measurement Tool';
  const sheet = workbook.addWorksheet('History');
  sheet.columns = [
    { key: 'name', width: 28 },
    { key: 'project', width: 24 },
    { key: 'document', width: 30 },
    { key: 'kind', width: 10 },
    { key: 'scale', width: 12 },
    { key: 'count', width: 14 },
    { key: 'tags', width: 24 },
    { key: 'created', width: 22 },
    { key: 'updated', width: 22 },
  ];
  styleHeader(
    sheet.addRow({
      name: 'ชื่อการวัด',
      project: 'โครงการ',
      document: 'ไฟล์',
      kind: 'ชนิด',
      scale: 'มาตราส่วน',
      count: 'จำนวนรายการ',
      tags: 'แท็ก',
      created: 'สร้างเมื่อ',
      updated: 'แก้ไขล่าสุด',
    }),
  );

  for (const session of sessions) {
    sheet.addRow({
      name: session.name,
      project: session.projectName,
      document: session.documentName,
      kind: session.documentKind,
      scale: scaleLabel(session.scale),
      count: session.measurements.length,
      tags: session.tags.join(', '),
      created: formatDateTime(session.createdAt),
      updated: formatDateTime(session.updatedAt),
    });
  }
  borderAll(sheet, 2, sheet.rowCount);

  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(
    new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    `MeasurementHistory_${fileTimestamp()}.xlsx`,
  );
}
