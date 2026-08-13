import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type {
  DocumentKind,
  LoadedDocument,
  OpenedDocument,
  RenderedPage,
  SourceDocument,
} from '@/types';
import { createId } from './id';
import { DEFAULT_IMAGE_DPI, dpiToPxPerMm, pdfRenderScaleToPxPerPaperMm } from './scale';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

/** Keeps rasters sharp when zoomed in without exploding memory on A0 sheets. */
const MAX_RASTER_DIMENSION = 4000;
const TARGET_PDF_RENDER_SCALE = 3;

export const ACCEPTED_2D_TYPES = '.pdf,.png,.jpg,.jpeg,.webp,.dxf,image/*,application/pdf';
export const ACCEPTED_3D_TYPES = '.obj,.glb,.gltf,.ifc';
/** ภาพ/วิดีโอพาโนรามาแบบ equirectangular — ไม่ผ่าน loadDocument เพราะไม่ใช่เอกสารที่เอาไปวัด */
export const ACCEPTED_360_TYPES = '.jpg,.jpeg,.png,.webp,.mp4,.webm,.mov';

export class UnsupportedFileError extends Error {
  constructor(fileName: string) {
    super(
      `ไม่รองรับไฟล์ "${fileName}" — กรุณาใช้ PDF, DXF, JPG, PNG, WEBP, OBJ, GLB หรือ IFC`,
    );
    this.name = 'UnsupportedFileError';
  }
}

/** DWG เป็นฟอร์แมตปิดของ Autodesk อ่านในเบราว์เซอร์ไม่ได้ — บอกทางออกให้ชัดแทนที่จะบอกแค่ว่าไม่รองรับ */
export class DwgNotSupportedError extends Error {
  constructor() {
    super(
      'ไฟล์ DWG เป็นฟอร์แมตปิดของ Autodesk จึงเปิดตรง ๆ ไม่ได้ — ' +
        'ให้เปิดใน AutoCAD แล้ว Save As เป็น .dxf (ไฟล์ > บันทึกเป็น > AutoCAD DXF) แล้วนำมาเปิดที่นี่',
    );
    this.name = 'DwgNotSupportedError';
  }
}

export function detectKind(file: File): DocumentKind {
  const name = file.name.toLowerCase();
  if (name.endsWith('.dwg')) throw new DwgNotSupportedError();
  if (file.type === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  if (name.endsWith('.dxf')) return 'cad';
  if (file.type.startsWith('image/')) return 'image';
  if (/\.(obj|glb|gltf|ifc)$/.test(name)) return 'model3d';
  if (/\.(png|jpe?g|webp|bmp|gif)$/.test(name)) return 'image';
  throw new UnsupportedFileError(file.name);
}

// The proxy is kept module-level so page navigation does not re-parse the file.
let activePdf: PDFDocumentProxy | null = null;
let activePdfId: string | null = null;

export async function loadDocument(file: File): Promise<OpenedDocument> {
  const kind = detectKind(file);
  if (kind === 'pdf') return loadPdf(file);
  if (kind === 'image') return loadImage(file);
  if (kind === 'cad') {
    // dxf-parser โหลดเมื่อใช้จริงเท่านั้น จึงไม่ติดไปกับบันเดิลแรก
    const { loadDxf } = await import('./dxf');
    const { doc, page, unitLabel, unitAssumed } = await loadDxf(file);
    return {
      doc,
      page,
      note: unitAssumed
        ? `หน่วยในไฟล์ไม่ได้ระบุ — ตั้งเป็น${unitLabel}ให้ ควรวัดระยะที่รู้ค่าจริงเทียบก่อนใช้งาน`
        : `หน่วยในไฟล์: ${unitLabel} — มาตราส่วนพร้อมใช้งาน ไม่ต้องปรับเทียบ`,
    };
  }
  throw new UnsupportedFileError(file.name);
}

async function loadImage(file: File): Promise<LoadedDocument> {
  const src = URL.createObjectURL(file);
  const size = await imageSize(src);
  const doc: SourceDocument = {
    id: createId('doc'),
    name: file.name,
    kind: 'image',
    mimeType: file.type || 'image/*',
    sizeBytes: file.size,
    pageCount: 1,
    addedAt: Date.now(),
  };
  return {
    doc,
    page: {
      pageNumber: 1,
      src,
      width: size.width,
      height: size.height,
      // A bitmap carries no physical size, so assume screen DPI until calibrated.
      pxPerPaperMm: dpiToPxPerMm(DEFAULT_IMAGE_DPI),
    },
  };
}

async function loadPdf(file: File): Promise<LoadedDocument> {
  const buffer = await file.arrayBuffer();
  await releasePdf();
  activePdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
  const id = createId('doc');
  activePdfId = id;

  const doc: SourceDocument = {
    id,
    name: file.name,
    kind: 'pdf',
    mimeType: 'application/pdf',
    sizeBytes: file.size,
    pageCount: activePdf.numPages,
    addedAt: Date.now(),
  };
  return { doc, page: await renderPdfPage(1) };
}

/** Rasterises a PDF page. The render scale is capped so huge sheets stay within memory. */
export async function renderPdfPage(pageNumber: number): Promise<RenderedPage> {
  if (!activePdf) throw new Error('ยังไม่ได้เปิดไฟล์ PDF');
  const page = await activePdf.getPage(pageNumber);
  const baseViewport = page.getViewport({ scale: 1 });

  const fitScale = Math.min(
    MAX_RASTER_DIMENSION / baseViewport.width,
    MAX_RASTER_DIMENSION / baseViewport.height,
  );
  const renderScale = Math.max(1, Math.min(TARGET_PDF_RENDER_SCALE, fitScale));
  const viewport = page.getViewport({ scale: renderScale });

  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('เบราว์เซอร์ไม่รองรับ Canvas 2D');

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: context, viewport }).promise;

  return {
    pageNumber,
    src: canvas.toDataURL('image/png'),
    width: canvas.width,
    height: canvas.height,
    pxPerPaperMm: pdfRenderScaleToPxPerPaperMm(renderScale),
  };
}

export const hasActivePdf = (docId: string | null): boolean =>
  activePdf !== null && docId !== null && docId === activePdfId;

export async function releasePdf(): Promise<void> {
  if (!activePdf) return;
  const pdf = activePdf;
  activePdf = null;
  activePdfId = null;
  await pdf.destroy().catch(() => undefined);
}

function imageSize(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error('อ่านไฟล์ภาพไม่สำเร็จ'));
    img.src = src;
  });
}

/** Downscaled JPEG preview stored alongside a saved session. */
export async function makeThumbnail(src: string, maxSize = 320): Promise<string> {
  const img = await loadHtmlImage(src);
  const ratio = Math.min(maxSize / img.naturalWidth, maxSize / img.naturalHeight, 1);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.naturalWidth * ratio));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * ratio));
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.7);
}

export function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('โหลดรูปภาพไม่สำเร็จ'));
    img.src = src;
  });
}
