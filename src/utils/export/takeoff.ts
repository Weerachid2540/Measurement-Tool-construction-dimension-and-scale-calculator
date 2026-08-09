import * as ExcelJSNamespace from 'exceljs';
import { saveAs } from 'file-saver';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { TakeoffReport } from '@/types';
import { fileTimestamp, formatDateTime, formatNumber, sanitiseFileName } from '../format';
import { getLastAutoTableY, registerFont } from './pdf';

type ExcelModule = typeof ExcelJSNamespace & { default?: typeof ExcelJSNamespace };
const Excel: typeof ExcelJSNamespace =
  (ExcelJSNamespace as ExcelModule).default ?? ExcelJSNamespace;

const HEADER_FILL = 'FF0EA5E9';
const CATEGORY_FILL = 'FF1E293B';
const GROUP_FILL = 'FFE2E8F0';

/** ตารางถอดแบบเป็นไฟล์ Excel — เรียงตามหมวดหลัก → หมวดงาน → รายการ */
export async function exportTakeoffToExcel(report: TakeoffReport): Promise<void> {
  const workbook = new Excel.Workbook();
  workbook.creator = 'Measurement Tool';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('ถอดแบบ', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true },
  });

  sheet.columns = [
    { key: 'no', width: 8 },
    { key: 'description', width: 46 },
    { key: 'working', width: 52 },
    { key: 'unit', width: 10 },
    { key: 'quantity', width: 14 },
    { key: 'unitPrice', width: 14 },
    { key: 'amount', width: 16 },
    { key: 'notes', width: 24 },
  ];

  sheet.mergeCells('A1:H1');
  const title = sheet.getCell('A1');
  title.value = 'การคำนวณถอดแบบประมาณราคา / QUANTITY TAKE-OFF';
  title.font = { bold: true, size: 16 };
  title.alignment = { horizontal: 'center' };

  sheet.getCell('A2').value = 'โครงการ / Project:';
  sheet.getCell('B2').value = report.projectName || '-';
  sheet.getCell('A3').value = 'วันที่ / Date:';
  sheet.getCell('B3').value = formatDateTime(report.createdAt);
  for (const ref of ['A2', 'A3']) sheet.getCell(ref).font = { bold: true };

  const header = sheet.addRow({
    no: 'ลำดับ',
    description: 'รายการ / Description',
    working: 'การคำนวณ / Working',
    unit: 'หน่วย',
    quantity: 'ปริมาณ',
    unitPrice: 'ราคา/หน่วย',
    amount: 'จำนวนเงิน',
    notes: 'หมายเหตุ',
  });
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  header.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
  });

  for (const entry of report.categories) {
    const categoryRow = sheet.addRow({
      no: `${entry.category.no}.`,
      description: `${entry.category.label} — ${entry.category.labelTh}`,
      amount: entry.amount || null,
    });
    categoryRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    categoryRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CATEGORY_FILL } };
    });

    for (const groupEntry of entry.groups) {
      const groupRow = sheet.addRow({
        no: `${entry.category.no}.${groupEntry.group.no}`,
        description: groupEntry.group.label,
        amount: groupEntry.amount || null,
      });
      groupRow.font = { bold: true };
      groupRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GROUP_FILL } };
      });

      groupEntry.lines.forEach(({ line, item, result }, index) => {
        sheet.addRow({
          no: `${entry.category.no}.${groupEntry.group.no}.${index + 1}`,
          description: line.label ? `${item.name} — ${line.label}` : item.name,
          working: result.workingText,
          // รายการที่ยังไม่มีวิธีคิด ปล่อยช่องตัวเลขว่างไว้ ไม่ใส่ 0 ให้เข้าใจผิดว่าคิดแล้ว
          unit: item.noteOnly ? '' : item.unit,
          quantity: item.noteOnly ? null : result.quantity,
          unitPrice: line.unitPrice ?? null,
          amount: result.amount ?? null,
          notes: line.notes ?? '',
        });
      });
    }
  }

  const totalRow = sheet.addRow({
    description: 'รวมทั้งสิ้น / Grand total',
    amount: report.total,
  });
  totalRow.font = { bold: true };

  sheet.getColumn('quantity').numFmt = '#,##0.000';
  sheet.getColumn('unitPrice').numFmt = '#,##0.00';
  sheet.getColumn('amount').numFmt = '#,##0.00';
  sheet.views = [{ state: 'frozen', ySplit: header.number }];

  buildMaterialSheet(workbook, report);

  const buffer = await workbook.xlsx.writeBuffer();
  const name = sanitiseFileName(report.projectName || 'Takeoff');
  saveAs(
    new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    `Takeoff_${name}_${fileTimestamp()}.xlsx`,
  );
}

/** รวมวัสดุโดยประมาณของทุกแถวเข้าด้วยกัน เพื่อใช้สั่งของ */
function buildMaterialSheet(workbook: ExcelJSNamespace.Workbook, report: TakeoffReport): void {
  const totals = new Map<string, { label: string; unit: string; quantity: number }>();
  for (const category of report.categories) {
    for (const group of category.groups) {
      for (const { result } of group.lines) {
        for (const component of result.components) {
          const key = `${component.label}|${component.unit}`;
          const entry = totals.get(key) ?? {
            label: component.label,
            unit: component.unit,
            quantity: 0,
          };
          entry.quantity += component.quantity;
          totals.set(key, entry);
        }
      }
    }
  }
  if (totals.size === 0) return;

  const sheet = workbook.addWorksheet('วัสดุโดยประมาณ');
  sheet.columns = [
    { key: 'label', width: 34 },
    { key: 'quantity', width: 16 },
    { key: 'unit', width: 12 },
  ];
  const header = sheet.addRow({ label: 'วัสดุ / Material', quantity: 'ปริมาณ', unit: 'หน่วย' });
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
  });
  for (const entry of totals.values()) sheet.addRow(entry);
  sheet.getColumn('quantity').numFmt = '#,##0.00';

  const note = sheet.addRow({
    label: 'ค่าประมาณตามอัตราส่วนมาตรฐาน ใช้ตรวจสอบเบื้องต้นเท่านั้น',
  });
  note.font = { italic: true, size: 9 };
}

/** ตารางถอดแบบเป็น PDF สำหรับแนบเอกสารเสนอราคา */
export async function exportTakeoffToPdf(report: TakeoffReport): Promise<void> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const font = await registerFont(doc);
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFont(font, 'bold');
  doc.setFontSize(16);
  doc.text('การคำนวณถอดแบบประมาณราคา', pageWidth / 2, 16, { align: 'center' });

  doc.setFont(font, 'normal');
  doc.setFontSize(10);
  doc.text(`โครงการ: ${report.projectName || '-'}`, 14, 24);
  doc.text(`วันที่: ${formatDateTime(report.createdAt)}`, pageWidth - 14, 24, { align: 'right' });

  const body: (string | number)[][] = [];
  const categoryRows: number[] = [];
  const groupRows: number[] = [];

  for (const entry of report.categories) {
    categoryRows.push(body.length);
    body.push([
      `${entry.category.no}.`,
      `${entry.category.label} — ${entry.category.labelTh}`,
      '',
      '',
      '',
      '',
      entry.amount > 0 ? formatNumber(entry.amount, 2) : '',
    ]);

    for (const groupEntry of entry.groups) {
      groupRows.push(body.length);
      body.push([
        `${entry.category.no}.${groupEntry.group.no}`,
        groupEntry.group.label,
        '',
        '',
        '',
        '',
        groupEntry.amount > 0 ? formatNumber(groupEntry.amount, 2) : '',
      ]);

      groupEntry.lines.forEach(({ line, item, result }, index) => {
        body.push([
          `${entry.category.no}.${groupEntry.group.no}.${index + 1}`,
          line.label ? `${item.name} — ${line.label}` : item.name,
          result.workingText,
          item.noteOnly ? '' : item.unit,
          item.noteOnly ? '-' : formatNumber(result.quantity, 3),
          line.unitPrice !== undefined ? formatNumber(line.unitPrice, 2) : '-',
          result.amount !== undefined ? formatNumber(result.amount, 2) : '-',
        ]);
      });
    }
  }

  autoTable(doc, {
    startY: 30,
    head: [['ลำดับ', 'รายการ', 'การคำนวณ', 'หน่วย', 'ปริมาณ', 'ราคา/หน่วย', 'จำนวนเงิน']],
    body,
    styles: { font, fontSize: 8, cellPadding: 1.8 },
    headStyles: { font, fillColor: [14, 165, 233], textColor: 255, halign: 'center' },
    columnStyles: {
      0: { cellWidth: 18 },
      1: { cellWidth: 62 },
      3: { halign: 'center', cellWidth: 14 },
      4: { halign: 'right', cellWidth: 22 },
      5: { halign: 'right', cellWidth: 22 },
      6: { halign: 'right', cellWidth: 26 },
    },
    theme: 'grid',
    // แถวหัวหมวดใช้พื้นเข้ม แถวหมวดงานใช้พื้นอ่อน เพื่อให้อ่านลำดับชั้นออกบนกระดาษ
    didParseCell: (data) => {
      if (data.section !== 'body') return;
      if (categoryRows.includes(data.row.index)) {
        data.cell.styles.fillColor = [30, 41, 59];
        data.cell.styles.textColor = 255;
        data.cell.styles.fontStyle = 'bold';
      } else if (groupRows.includes(data.row.index)) {
        data.cell.styles.fillColor = [226, 232, 240];
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });

  const y = getLastAutoTableY(doc, 30) + 8;
  doc.setFont(font, 'bold');
  doc.setFontSize(11);
  doc.text(`รวมทั้งสิ้น: ${formatNumber(report.total, 2)} บาท`, pageWidth - 14, y, {
    align: 'right',
  });

  const name = sanitiseFileName(report.projectName || 'Takeoff');
  doc.save(`Takeoff_${name}_${fileTimestamp()}.pdf`);
}
