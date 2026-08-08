import type { BBox } from '@/types';
import { prepareSearch, prepareSearchWithStoredTemplate, type PreparedSearch } from './prepare';
import type { SearchRequest, SymbolMatch, SymbolSearchOptions, WorkerMessage } from './types';

export type { GrayImage, SymbolMatch, SymbolSearchOptions, SymbolTemplate } from './types';
export { DEFAULT_SEARCH_OPTIONS } from './types';
export { normaliseBox, templatePreview, chooseDownscale, cropToDataUrl } from './prepare';
export { SEARCH_FLOOR, suggestThreshold } from './matcher';

export interface SearchHandle {
  /** Resolves with the matches, or rejects if the search failed. */
  result: Promise<SymbolMatch[]>;
  /** Aborts the worker; `result` rejects with an AbortError. */
  cancel: () => void;
}

/**
 * Finds every occurrence of the symbol inside `templateBox` across the drawing.
 *
 * The image is prepared on the main thread (canvas access) and correlated in a
 * worker. Buffers are transferred rather than copied, so a large sheet does not
 * double its memory footprint on the way across.
 */
export function findSymbols(
  image: HTMLImageElement,
  templateBox: BBox,
  options: SymbolSearchOptions,
  onProgress?: (percent: number) => void,
): SearchHandle {
  return runSearch(() => prepareSearch(image, templateBox), options, onProgress);
}

/**
 * Same search, driven by a glyph from the symbol library instead of a live crop.
 * The stored artwork is rescaled to this sheet's resolution via its size on paper.
 */
export function findSymbolsFromLibrary(
  sheet: HTMLImageElement,
  glyph: HTMLImageElement,
  paperSizeMm: { width: number; height: number },
  sheetPxPerPaperMm: number,
  options: SymbolSearchOptions,
  onProgress?: (percent: number) => void,
): SearchHandle {
  return runSearch(
    () => prepareSearchWithStoredTemplate(sheet, glyph, paperSizeMm, sheetPxPerPaperMm),
    options,
    onProgress,
  );
}

function runSearch(
  prepare: () => PreparedSearch,
  options: SymbolSearchOptions,
  onProgress?: (percent: number) => void,
): SearchHandle {
  const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  let settled = false;
  let abort: (() => void) | null = null;

  const result = new Promise<SymbolMatch[]>((resolve, reject) => {
    abort = () => {
      const error = new Error('ยกเลิกการค้นหาแล้ว');
      error.name = 'AbortError';
      reject(error);
    };

    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const message = event.data;
      if (message.type === 'progress') {
        onProgress?.(message.value);
        return;
      }
      settled = true;
      worker.terminate();
      if (message.type === 'done') resolve(message.matches);
      else reject(new Error(message.message));
    };

    worker.onerror = (event) => {
      settled = true;
      worker.terminate();
      reject(new Error(event.message || 'ค้นหาสัญลักษณ์ไม่สำเร็จ'));
    };

    let request: SearchRequest;
    try {
      const prepared = prepare();
      request = {
        image: prepared.image,
        template: prepared.template,
        downscale: prepared.downscale,
        options,
      };
    } catch (error) {
      settled = true;
      worker.terminate();
      reject(error instanceof Error ? error : new Error('เตรียมภาพไม่สำเร็จ'));
      return;
    }

    worker.postMessage(request, [request.image.data.buffer, request.template.data.buffer]);
  });

  return {
    result,
    cancel: () => {
      if (settled) return;
      settled = true;
      worker.terminate();
      abort?.();
    },
  };
}
