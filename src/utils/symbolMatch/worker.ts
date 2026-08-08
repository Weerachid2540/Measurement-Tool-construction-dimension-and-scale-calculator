/// <reference lib="webworker" />
import { findMatches } from './ncc';
import type { SearchRequest, WorkerMessage } from './types';

/**
 * Correlation is CPU-bound and takes seconds on a large sheet, so it runs off the
 * main thread to keep panning and zooming responsive while the search is going.
 */
// The app's tsconfig includes the DOM lib, so `self` is typed as a Window here.
const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = (event: MessageEvent<SearchRequest>) => {
  const { image, template, options, downscale } = event.data;
  const post = (message: WorkerMessage) => ctx.postMessage(message);

  try {
    let lastReported = -1;
    const matches = findMatches(image, template, options, downscale, (fraction) => {
      // Throttle to whole percent — postMessage is not free.
      const percent = Math.round(fraction * 100);
      if (percent !== lastReported) {
        lastReported = percent;
        post({ type: 'progress', value: percent });
      }
    });
    post({ type: 'done', matches });
  } catch (error) {
    post({
      type: 'error',
      message: error instanceof Error ? error.message : 'ค้นหาสัญลักษณ์ไม่สำเร็จ',
    });
  }
};
