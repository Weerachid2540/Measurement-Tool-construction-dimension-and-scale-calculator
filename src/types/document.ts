export type DocumentKind = 'image' | 'pdf' | 'model3d';

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
