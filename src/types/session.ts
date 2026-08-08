import type { DocumentKind } from './document';
import type { Measurement } from './measurement';
import type { ScaleSettings } from './scale';

/** A saved measuring session — the unit of the history panel. */
export interface MeasurementSession {
  id: string;
  name: string;
  projectName: string;
  documentName: string;
  documentKind: DocumentKind;
  pageCount: number;
  /** Small JPEG data URL used as the history card preview. */
  thumbnail?: string;
  scale: ScaleSettings;
  measurements: Measurement[];
  tags: string[];
  notes?: string;
  createdAt: number;
  updatedAt: number;
  /** Key into the `files` object store, when the source file was kept. */
  fileRef?: string;
}

export interface StoredFile {
  id: string;
  name: string;
  mimeType: string;
  blob: Blob;
  savedAt: number;
}

export interface SessionFilter {
  query: string;
  kind: DocumentKind | 'all';
  /** Epoch millis, inclusive. */
  from?: number;
  to?: number;
  sortBy: 'updatedAt' | 'createdAt' | 'name';
  sortDir: 'asc' | 'desc';
}

export const DEFAULT_SESSION_FILTER: SessionFilter = {
  query: '',
  kind: 'all',
  sortBy: 'updatedAt',
  sortDir: 'desc',
};
