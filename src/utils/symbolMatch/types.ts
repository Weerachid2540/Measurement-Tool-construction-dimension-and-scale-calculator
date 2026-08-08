import type { BBox } from '@/types';

/** A single-channel image, ready for correlation. Values are 0–255 luminance. */
export interface GrayImage {
  data: Float32Array;
  width: number;
  height: number;
}

export interface SymbolMatch {
  /** Centre of the match, in full-resolution image space. */
  x: number;
  y: number;
  /** Normalised cross-correlation score, 0–1. */
  score: number;
  /** Degrees the template was rotated by to produce this hit. */
  rotation: number;
}

export interface SymbolSearchOptions {
  /**
   * Minimum shape score to accept, 0–1. Applied when filtering results rather than
   * during the scan, so it can be re-tuned without searching again.
   */
  threshold: number;
  /** Also try the template rotated by 90/180/270°. */
  matchRotations: boolean;
  /** Safety valve so a bad threshold cannot lock up the UI. */
  maxResults: number;
}

export const DEFAULT_SEARCH_OPTIONS: SymbolSearchOptions = {
  // A clean vector symbol matches its twin at 0.9+ under F₂; 0.75 leaves room for
  // neighbouring linework before the user tunes it with the slider.
  threshold: 0.75,
  matchRotations: false,
  maxResults: 4000,
};

/** What the worker needs to run a search. Buffers are transferred, not copied. */
export interface SearchRequest {
  image: { data: Float32Array; width: number; height: number };
  template: { data: Float32Array; width: number; height: number };
  /** How much the image was shrunk before searching; results are scaled back up. */
  downscale: number;
  options: SymbolSearchOptions;
}

export type WorkerMessage =
  | { type: 'progress'; value: number }
  | { type: 'done'; matches: SymbolMatch[] }
  | { type: 'error'; message: string };

export interface SymbolTemplate {
  /** The region the user drew, in full-resolution image space. */
  box: BBox;
  /** Data URL preview shown in the panel. */
  preview: string;
}
