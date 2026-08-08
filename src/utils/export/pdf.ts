import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { BoqReport } from '@/types';
import { fileTimestamp, formatDateTime, formatNumber, sanitiseFileName } from '../format';

/**
 * jsPDF's built-in fonts have no Thai glyphs. Drop a TTF at
 * `public/fonts/Sarabun-Regular.ttf` and it is picked up automatically;
 * without it we fall back to Helvetica (Latin text still renders fine).
 */
const THAI_FONT_URL = `${import.meta.env.BASE_URL}fonts/Sarabun-Regular.ttf`;
const THAI_FONT_NAME = 'Sarabun';

let cachedFontBase64: string | null | undefined;

async function fetchThaiFont(): Promise<string | null> {
  if (cachedFontBase64 !== undefined) return cachedFontBase64;
  try {
    const response = await fetch(THAI_FONT_URL);
    if (!response.ok) {
      cachedFontBase64 = null;
      return null;
    }
    cachedFontBase64 = arrayBufferToBase64(await response.arrayBuffer());
  } catch {
    cachedFontBase64 = null;
  }
  return cachedFontBase64;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function registerFont(doc: jsPDF): Promise<string> {
  const base64 = await fetchThaiFont();
  if (!base64) return 'helvetica';
  doc.addFileToVFS(`${THAI_FONT_NAME}.ttf`, base64);
  doc.addFont(`${THAI_FONT_NAME}.ttf`, THAI_FONT_NAME, 'normal');
  doc.addFont(`${THAI_FONT_NAME}.ttf`, THAI_FONT_NAME, 'bold');
  return THAI_FONT_NAME;
}

export interface PdfExportOptions {
  /** PNG data URL of the marked-up drawing, appended as a reference page. */
  snapshot?: string;
}

export async function exportBoqToPdf(
  report: BoqReport,
  options: PdfExportOptions = {},
): Promise<void> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const font = await registerFont(doc);
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFont(font, 'bold');
  doc.setFontSize(16);
  doc.text('BILL OF QUANTITIES (BOQ)', pageWidth / 2, 16, { align: 'center' });

  doc.setFont(font, 'normal');
  doc.setFontSize(10);
  const metaLeft = [
    `Project: ${report.projectName || '-'}`,
    `Drawing: ${report.drawingName || '-'}`,
  ];
  const metaRight = [`Scale: ${report.scaleLabel}`, `Date: ${formatDateTime(report.createdAt)}`];
  metaLeft.forEach((line, i) => doc.text(line, 14, 24 + i * 5));
  metaRight.forEach((line, i) => doc.text(line, pageWidth - 14, 24 + i * 5, { align: 'right' }));

  autoTable(doc, {
    startY: 38,
    head: [
      ['No.', 'Code', 'รายการ / Description', 'หมวดงาน', 'หน่วย', 'ปริมาณ', 'ราคา/หน่วย', 'จำนวนเงิน'],
    ],
    body: report.rows.map((row) => [
      String(row.no),
      row.code,
      row.description,
      row.category,
      row.unit,
      formatNumber(row.quantity, 3),
      row.unitPrice !== undefined ? formatNumber(row.unitPrice, 2) : '-',
      row.amount !== undefined ? formatNumber(row.amount, 2) : '-',
    ]),
    styles: { font, fontSize: 9, cellPadding: 2 },
    headStyles: { font, fillColor: [14, 165, 233], textColor: 255, halign: 'center' },
    columnStyles: {
      0: { halign: 'center', cellWidth: 12 },
      1: { cellWidth: 20 },
      4: { halign: 'center', cellWidth: 16 },
      5: { halign: 'right', cellWidth: 26 },
      6: { halign: 'right', cellWidth: 26 },
      7: { halign: 'right', cellWidth: 30 },
    },
    theme: 'grid',
  });

  const afterTableY = getLastAutoTableY(doc, 38) + 8;
  doc.setFont(font, 'bold');
  doc.setFontSize(11);
  doc.text(
    `รวมทั้งสิ้น / Subtotal: ${formatNumber(report.subtotal, 2)} ${report.currency}`,
    pageWidth - 14,
    afterTableY,
    { align: 'right' },
  );

  if (report.summary.length > 0) {
    autoTable(doc, {
      startY: afterTableY + 6,
      head: [['หมวดงาน / Category', 'หน่วย', 'ปริมาณรวม', 'จำนวนเงิน']],
      body: report.summary.map((row) => [
        row.category,
        row.unit,
        formatNumber(row.quantity, 3),
        formatNumber(row.amount, 2),
      ]),
      styles: { font, fontSize: 9, cellPadding: 2 },
      headStyles: { font, fillColor: [51, 65, 85], textColor: 255 },
      theme: 'grid',
      tableWidth: 140,
    });
  }

  if (options.snapshot) appendSnapshotPage(doc, options.snapshot, font);

  const name = sanitiseFileName(report.drawingName || report.projectName || 'BOQ');
  doc.save(`BOQ_${name}_${fileTimestamp()}.pdf`);
}

function appendSnapshotPage(doc: jsPDF, snapshot: string, font: string): void {
  doc.addPage('a4', 'landscape');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  doc.setFont(font, 'bold');
  doc.setFontSize(12);
  doc.text('Marked-up Drawing', pageWidth / 2, 14, { align: 'center' });

  const props = doc.getImageProperties(snapshot);
  const maxWidth = pageWidth - 20;
  const maxHeight = pageHeight - 28;
  const ratio = Math.min(maxWidth / props.width, maxHeight / props.height);
  const width = props.width * ratio;
  const height = props.height * ratio;
  doc.addImage(snapshot, 'PNG', (pageWidth - width) / 2, 20, width, height);
}

/** `lastAutoTable` is attached by the plugin at runtime and is not in jsPDF's types. */
function getLastAutoTableY(doc: jsPDF, fallback: number): number {
  const withTable = doc as jsPDF & { lastAutoTable?: { finalY?: number } };
  return withTable.lastAutoTable?.finalY ?? fallback;
}
