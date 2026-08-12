import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { BoqReport } from '@/types';
import { fileTimestamp, formatDateTime, formatNumber, sanitiseFileName } from '../format';

/**
 * jsPDF's built-in fonts have no Thai glyphs. Drop a TTF at
 * `public/fonts/Sarabun-Regular.ttf` and it is picked up automatically;
 * without it we fall back to Helvetica (Latin text still renders fine).
 */
const THAI_FONT_NAME = 'Sarabun';
const THAI_FONT_URL = `${import.meta.env.BASE_URL}fonts/Sarabun-Regular.ttf`;
const THAI_FONT_BOLD_URL = `${import.meta.env.BASE_URL}fonts/Sarabun-Bold.ttf`;

const fontCache = new Map<string, string | null>();
let thaiFontLoaded = false;

/** จริงเมื่อไฟล์ล่าสุดฝังฟอนต์ไทยได้ — ใช้เตือนผู้ใช้ว่าไฟล์ที่ได้จะอ่านภาษาไทยไม่ออก */
export const isThaiFontLoaded = (): boolean => thaiFontLoaded;

async function fetchFont(url: string): Promise<string | null> {
  const cached = fontCache.get(url);
  if (cached !== undefined) return cached;
  let result: string | null = null;
  try {
    const response = await fetch(url);
    // เสิร์ฟเวอร์สแตติกบางตัวตอบ index.html เมื่อไม่พบไฟล์ จึงต้องเช็กชนิดข้อมูลด้วย
    if (response.ok && !response.headers.get('content-type')?.includes('text/html')) {
      result = arrayBufferToBase64(await response.arrayBuffer());
    }
  } catch {
    result = null;
  }
  fontCache.set(url, result);
  return result;
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

export async function registerFont(doc: jsPDF): Promise<string> {
  const [regular, bold] = await Promise.all([
    fetchFont(THAI_FONT_URL),
    fetchFont(THAI_FONT_BOLD_URL),
  ]);

  if (!regular) {
    thaiFontLoaded = false;
    return 'helvetica';
  }

  doc.addFileToVFS(`${THAI_FONT_NAME}.ttf`, regular);
  doc.addFont(`${THAI_FONT_NAME}.ttf`, THAI_FONT_NAME, 'normal');

  // ไม่มีตัวหนาก็ใช้ตัวปกติแทน ดีกว่าให้ jsPDF สลับไปฟอนต์ละตินตอนสั่ง bold
  doc.addFileToVFS(`${THAI_FONT_NAME}-Bold.ttf`, bold ?? regular);
  doc.addFont(`${THAI_FONT_NAME}-Bold.ttf`, THAI_FONT_NAME, 'bold');

  thaiFontLoaded = true;
  return THAI_FONT_NAME;
}

const LOGO_URL = `${import.meta.env.BASE_URL}logo-crystal.jpg`;
let logoCache: string | null | undefined;

/** โลโก้บริษัทเป็น data URL สำหรับฝังใน PDF — แคชไว้ใช้ซ้ำได้ทุกไฟล์ที่ส่งออก */
export async function loadLogoDataUrl(): Promise<string | null> {
  if (logoCache !== undefined) return logoCache;
  try {
    const response = await fetch(LOGO_URL);
    if (!response.ok || response.headers.get('content-type')?.includes('text/html')) {
      logoCache = null;
    } else {
      logoCache = `data:image/jpeg;base64,${arrayBufferToBase64(await response.arrayBuffer())}`;
    }
  } catch {
    logoCache = null;
  }
  return logoCache;
}

/** วาดโลโก้มุมซ้ายบน คงสัดส่วนภาพจริงตามความสูงที่กำหนด */
export function drawLogo(doc: jsPDF, dataUrl: string | null, x = 14, y = 8, height = 14): void {
  if (!dataUrl) return;
  const props = doc.getImageProperties(dataUrl);
  const width = (props.width / props.height) * height;
  doc.addImage(dataUrl, 'JPEG', x, y, width, height);
}

/**
 * เส้นฐานของบรรทัดข้อมูล (โครงการ/วันที่) — โลโก้กินพื้นที่ถึง 22mm
 * และสระบนภาษาไทยลอยเหนือเส้นฐานราว 4mm จึงต้องเริ่มที่ 28mm ไม่งั้นทับกัน
 */
export const HEADER_META_Y = 28;

export interface PdfExportOptions {
  /** PNG data URL of the marked-up drawing, appended as a reference page. */
  snapshot?: string;
}

export async function exportBoqToPdf(
  report: BoqReport,
  options: PdfExportOptions = {},
): Promise<void> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const [font, logo] = await Promise.all([registerFont(doc), loadLogoDataUrl()]);
  const pageWidth = doc.internal.pageSize.getWidth();

  drawLogo(doc, logo);
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
  metaLeft.forEach((line, i) => doc.text(line, 14, HEADER_META_Y + i * 5));
  metaRight.forEach((line, i) =>
    doc.text(line, pageWidth - 14, HEADER_META_Y + i * 5, { align: 'right' }),
  );

  const tableY = HEADER_META_Y + 14;

  autoTable(doc, {
    startY: tableY,
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

  const afterTableY = getLastAutoTableY(doc, tableY) + 8;
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
      head: [['หมวดงานหลัก / Group', 'หมวดงาน / Category', 'หน่วย', 'ปริมาณรวม', 'จำนวนเงิน']],
      body: report.summary.map((row) => [
        row.group ?? '-',
        row.category,
        row.unit,
        formatNumber(row.quantity, 3),
        formatNumber(row.amount, 2),
      ]),
      styles: { font, fontSize: 9, cellPadding: 2 },
      headStyles: { font, fillColor: [51, 65, 85], textColor: 255 },
      theme: 'grid',
      tableWidth: 190,
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
export function getLastAutoTableY(doc: jsPDF, fallback: number): number {
  const withTable = doc as jsPDF & { lastAutoTable?: { finalY?: number } };
  return withTable.lastAutoTable?.finalY ?? fallback;
}
