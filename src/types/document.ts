/** `cad` คือ DXF ที่ถูกแปลงเป็น raster แล้ว — ต่างจาก `image` ตรงที่รู้มาตราส่วนจริง */
export type DocumentKind = 'image' | 'pdf' | 'model3d' | 'cad';

export interface SourceDocument {
  id: string;
  name: string;
  kind: DocumentKind;
  mimeType: string;
  sizeBytes: number;
  pageCount: number;
  addedAt: number;
}

/** A rasterised page ready to be painted underneath the measurement layer. */
export interface RenderedPage {
  pageNumber: number;
  /** Object URL or data URL. */
  src: string;
  width: number;
  height: number;
  /** Pixels of this raster per millimetre of *paper*. Exact for PDF, assumed for bitmaps. */
  pxPerPaperMm: number;
}

export interface LoadedDocument {
  doc: SourceDocument;
  page: RenderedPage;
}

/** ข้อความแจ้งผู้ใช้หลังเปิดไฟล์สำเร็จ ต่างกันตามชนิดไฟล์ */
export interface OpenedDocument extends LoadedDocument {
  note?: string;
}
