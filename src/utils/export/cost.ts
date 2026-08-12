import * as ExcelJSNamespace from 'exceljs';
import { saveAs } from 'file-saver';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { CostEntry, CostReport } from '@/types';
import { LABOUR_TYPES } from '@/types';
import { fileTimestamp, formatDateTime, formatNumber, sanitiseFileName } from '../format';
import { travelAmount } from '../cost';
import { getLastAutoTableY, registerFont } from './pdf';

type ExcelModule = typeof ExcelJSNamespace & { default?: typeof ExcelJSNamespace };
const Excel: typeof ExcelJSNamespace =
  (ExcelJSNamespace as ExcelModule).default ?? ExcelJSNamespace;

const HEADER_FILL = 'FF0EA5E9';

const labourLabel = (entry: CostEntry): string =>
  LABOUR_TYPES.find((t) => t.id === entry.labourType)?.label ?? '';

/** ต้นทุนหน้างานเป็น Excel — วัสดุกับค่าแรงคนละชีต พร้อมชีตสรุป */
export async function exportCostToExcel(report: CostReport): Promise<void> {
  const workbook = new Excel.Workbook();
  workbook.creator = 'Cost Estimation and Quantity Takeoff Services';
  workbook.created = new Date();

  buildEntrySheet(workbook, 'ค่าวัสดุ', report.materials, report.totals.material, true);
  buildEntrySheet(workbook, 'ค่าแรง', report.labour, report.totals.labour, false);
  buildSummarySheet(workbook, report);

  const buffer = await workbook.xlsx.writeBuffer();
  const name = sanitiseFileName(report.projectName || 'Cost');
  saveAs(
    new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    `Cost_${name}_${fileTimestamp()}.xlsx`,
  );
}

function buildEntrySheet(
  workbook: ExcelJSNamespace.Workbook,
  title: string,
  entries: (CostEntry & { amount: number })[],
  total: number,
  isMaterial: boolean,
): void {
  const sheet = workbook.addWorksheet(title);
  // ค่าวัสดุกรอกยอดรวมจากบิลช่องเดียว จึงไม่มีคอลัมน์จำนวน/ราคาต่อหน่วยเหมือนค่าแรง
  sheet.columns = isMaterial
    ? [
        { key: 'date', width: 14 },
        { key: 'name', width: 44 },
        { key: 'amount', width: 18 },
        { key: 'vendor', width: 24 },
        { key: 'reference', width: 16 },
        { key: 'notes', width: 24 },
      ]
    : [
        { key: 'date', width: 14 },
        { key: 'name', width: 36 },
        { key: 'type', width: 12 },
        { key: 'quantity', width: 12 },
        { key: 'unit', width: 10 },
        { key: 'unitPrice', width: 14 },
        { key: 'travelDays', width: 14 },
        { key: 'travelRate', width: 16 },
        { key: 'amount', width: 16 },
        { key: 'vendor', width: 24 },
        { key: 'notes', width: 24 },
      ];

  const header = sheet.addRow(
    isMaterial
      ? {
          date: 'วันที่',
          name: 'รายการวัสดุ',
          amount: 'ราคารวม (รวม VAT)',
          vendor: 'ร้านค้า',
          reference: 'เลขที่บิล',
          notes: 'หมายเหตุ',
        }
      : {
          date: 'วันที่',
          name: 'รายการงาน / ทีมช่าง',
          type: 'แบบค่าแรง',
          quantity: 'จำนวน',
          unit: 'หน่วย',
          unitPrice: 'ราคา/หน่วย',
          travelDays: 'ค่าเดินทาง (วัน)',
          travelRate: 'ค่าเดินทาง/วัน',
          amount: 'รวมเงิน',
          vendor: 'ผู้รับเหมา',
          notes: 'หมายเหตุ',
        },
  );
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  header.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
  });

  for (const entry of entries) {
    sheet.addRow(
      isMaterial
        ? {
            date: entry.date,
            name: entry.name,
            amount: entry.amount,
            vendor: entry.vendor ?? '',
            reference: entry.reference ?? '',
            notes: entry.notes ?? '',
          }
        : {
            date: entry.date,
            name: entry.name,
            type: labourLabel(entry),
            quantity: entry.quantity,
            unit: entry.unit,
            unitPrice: entry.unitPrice,
            travelDays: entry.travelDays ?? 0,
            travelRate: entry.travelRate ?? 0,
            amount: entry.amount,
            vendor: entry.vendor ?? '',
            notes: entry.notes ?? '',
          },
    );
  }

  const totalRow = sheet.addRow({ name: `รวม${title}`, amount: total });
  totalRow.font = { bold: true };

  if (!isMaterial) {
    sheet.getColumn('quantity').numFmt = '#,##0.00';
    sheet.getColumn('unitPrice').numFmt = '#,##0.00';
    sheet.getColumn('travelRate').numFmt = '#,##0.00';
  }
  sheet.getColumn('amount').numFmt = '#,##0.00';
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
}

/** ต้นทุนหน้างานเป็น PDF สำหรับส่งรายงานให้เจ้าของงาน */
export async function exportCostToPdf(report: CostReport): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const font = await registerFont(doc);
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFont(font, 'bold');
  doc.setFontSize(16);
  doc.text('รายงานต้นทุนหน้างาน', pageWidth / 2, 16, { align: 'center' });

  doc.setFont(font, 'normal');
  doc.setFontSize(10);
  doc.text(`โครงการ: ${report.projectName || '-'}`, 14, 24);
  doc.text(`วันที่: ${formatDateTime(report.createdAt)}`, pageWidth - 14, 24, { align: 'right' });

  autoTable(doc, {
    startY: 30,
    head: [['วันที่', 'รายการวัสดุ', 'ร้านค้า', 'เลขที่บิล', 'ราคารวม (VAT)', 'หมายเหตุ']],
    body: report.materials.map((entry) => [
      entry.date,
      entry.name,
      entry.vendor ?? '',
      entry.reference ?? '',
      formatNumber(entry.amount, 2),
      entry.notes ?? '',
    ]),
    foot: [['', 'รวมค่าวัสดุ', '', '', formatNumber(report.totals.material, 2), '']],
    styles: { font, fontSize: 9, cellPadding: 1.8 },
    headStyles: { font, fillColor: [14, 165, 233], textColor: 255, halign: 'center' },
    footStyles: { font, fillColor: [226, 232, 240], textColor: 20, fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 22 }, 4: { halign: 'right', cellWidth: 30 } },
    theme: 'grid',
  });

  autoTable(doc, {
    startY: getLastAutoTableY(doc, 30) + 8,
    head: [
      [
        'วันที่',
        'รายการงาน / ทีมช่าง',
        'แบบ',
        'จำนวน',
        'ราคา/หน่วย',
        'ค่าเดินทาง',
        'รวมเงิน',
        'หมายเหตุ',
      ],
    ],
    body: report.labour.map((entry) => [
      entry.date,
      entry.name,
      labourLabel(entry),
      `${formatNumber(entry.quantity, 2)} ${entry.unit}`,
      formatNumber(entry.unitPrice, 2),
      travelAmount(entry) > 0
        ? `${entry.travelDays ?? 0} วัน × ${formatNumber(entry.travelRate ?? 0, 2)}`
        : '-',
      formatNumber(entry.amount, 2),
      entry.notes ?? '',
    ]),
    foot: [['', 'รวมค่าแรง', '', '', '', '', formatNumber(report.totals.labour, 2), '']],
    styles: { font, fontSize: 9, cellPadding: 1.8 },
    headStyles: { font, fillColor: [14, 165, 233], textColor: 255, halign: 'center' },
    footStyles: { font, fillColor: [226, 232, 240], textColor: 20, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 20 },
      3: { halign: 'right' },
      4: { halign: 'right' },
      6: { halign: 'right', cellWidth: 26 },
    },
    theme: 'grid',
  });

  const y = getLastAutoTableY(doc, 30) + 10;
  doc.setFont(font, 'bold');
  doc.setFontSize(12);
  doc.text(`รวมต้นทุนทั้งสิ้น: ${formatNumber(report.totals.total, 2)} บาท`, pageWidth - 14, y, {
    align: 'right',
  });

  const name = sanitiseFileName(report.projectName || 'Cost');
  doc.save(`Cost_${name}_${fileTimestamp()}.pdf`);
}

function buildSummarySheet(workbook: ExcelJSNamespace.Workbook, report: CostReport): void {
  const sheet = workbook.addWorksheet('สรุป');
  sheet.columns = [
    { key: 'label', width: 30 },
    { key: 'value', width: 22 },
  ];

  sheet.addRow({ label: 'โครงการ / ไซต์งาน', value: report.projectName || '-' }).font = {
    bold: true,
  };
  sheet.addRow({ label: 'วันที่ออกรายงาน', value: formatDateTime(report.createdAt) });
  sheet.addRow({});
  sheet.addRow({ label: 'ค่าวัสดุ (รวม VAT)', value: report.totals.material });
  sheet.addRow({ label: 'ค่าแรง (รวมค่าเดินทาง)', value: report.totals.labour });
  sheet.addRow({ label: '— เฉพาะค่าเดินทาง', value: report.totals.travel });
  const totalRow = sheet.addRow({ label: 'รวมทั้งสิ้น', value: report.totals.total });
  totalRow.font = { bold: true };

  sheet.getColumn('value').numFmt = '#,##0.00';
}
