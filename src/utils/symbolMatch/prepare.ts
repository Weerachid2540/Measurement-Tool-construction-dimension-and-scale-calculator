import type { BBox } from '@/types';
import type { GrayImage } from './types';

/**
 * Correlating a full-resolution A1 sheet (~12M pixels) is needlessly slow — a symbol
 * stays recognisable at a fraction of that. The search runs on a shrunk copy and the
 * hits are scaled back up; a pixel or two of positional error is irrelevant for a
 * count marker.
 */
const MAX_SEARCH_PIXELS = 2_600_000;
/**
 * Below this a template loses the strokes that separate one symbol from another.
 * CAD line work is thin, so shrinking too far turns distinct symbols into the same blob.
 */
const MIN_TEMPLATE_SIDE = 16;

export interface PreparedSearch {
  image: GrayImage;
  template: GrayImage;
  downscale: number;
}

/** Picks a shrink factor that respects both the image budget and template legibility. */
export function chooseDownscale(
  imageWidth: number,
  imageHeight: number,
  templateBox: BBox,
): number {
  const byArea = Math.sqrt((imageWidth * imageHeight) / MAX_SEARCH_PIXELS);
  const smallestSide = Math.max(1, Math.min(templateBox.width, templateBox.height));
  const byTemplate = smallestSide / MIN_TEMPLATE_SIDE;
  return Math.max(1, Math.min(byArea, byTemplate));
}

function toGray(imageData: ImageData): GrayImage {
  const { data, width, height } = imageData;
  const gray = new Float32Array(width * height);
  for (let i = 0, p = 0; i < gray.length; i += 1, p += 4) {
    // Rec. 601 luma — matches how the eye reads line weight on a drawing.
    gray[i] = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
  }
  return { data: gray, width, height };
}

function drawToGray(
  source: CanvasImageSource,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  dw: number,
  dh: number,
): GrayImage {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(dw));
  canvas.height = Math.max(1, Math.round(dh));
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('เบราว์เซอร์ไม่รองรับ Canvas 2D');

  // White backing so transparent PDFs/PNGs read as paper rather than black.
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(source, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

  return toGray(context.getImageData(0, 0, canvas.width, canvas.height));
}

/**
 * Turns the loaded drawing and the user's selection box into the two grayscale
 * buffers the matcher works on. Runs on the main thread because it needs a canvas;
 * the heavy correlation happens in the worker afterwards.
 */
/** Copies a rectangle out of a grayscale buffer, clamped to its bounds. */
function cropGray(source: GrayImage, x: number, y: number, w: number, h: number): GrayImage {
  const left = Math.max(0, Math.min(x, source.width - 1));
  const top = Math.max(0, Math.min(y, source.height - 1));
  const width = Math.max(1, Math.min(w, source.width - left));
  const height = Math.max(1, Math.min(h, source.height - top));

  const data = new Float32Array(width * height);
  for (let row = 0; row < height; row += 1) {
    const start = (top + row) * source.width + left;
    data.set(source.data.subarray(start, start + width), row * width);
  }
  return { data, width, height };
}

export function prepareSearch(image: HTMLImageElement, templateBox: BBox): PreparedSearch {
  const downscale = chooseDownscale(image.naturalWidth, image.naturalHeight, templateBox);

  const searchImage = drawToGray(
    image,
    0,
    0,
    image.naturalWidth,
    image.naturalHeight,
    image.naturalWidth / downscale,
    image.naturalHeight / downscale,
  );

  /*
   * The template is cut out of the already-downscaled sheet rather than resampled
   * separately from the original. Two independent resamples land on different
   * subpixel phases, so the template's pixels never lined up with the very symbol
   * it was taken from — every score was noise. Cropping here guarantees the source
   * symbol scores exactly 1.0, which is also a useful self-check.
   */
  const template = cropGray(
    searchImage,
    Math.round(templateBox.x / downscale),
    Math.round(templateBox.y / downscale),
    Math.round(templateBox.width / downscale),
    Math.round(templateBox.height / downscale),
  );

  return { image: searchImage, template, downscale };
}

/**
 * Prepares a search using a glyph saved in the library rather than a fresh crop.
 *
 * The stored artwork is redrawn at the size it would occupy on *this* sheet, derived
 * from its physical size on paper — so a symbol captured from a 150 dpi render still
 * matches on a sheet rasterised at a different resolution.
 *
 * Note this cannot reach the exact-pixel agreement of a live crop: the two images are
 * resampled independently, so expect scores in the high eighties rather than 100%.
 */
export function prepareSearchWithStoredTemplate(
  sheet: HTMLImageElement,
  glyph: HTMLImageElement,
  paperSizeMm: { width: number; height: number },
  sheetPxPerPaperMm: number,
): PreparedSearch {
  const targetWidth = Math.max(1, paperSizeMm.width * sheetPxPerPaperMm);
  const targetHeight = Math.max(1, paperSizeMm.height * sheetPxPerPaperMm);

  const downscale = chooseDownscale(sheet.naturalWidth, sheet.naturalHeight, {
    x: 0,
    y: 0,
    width: targetWidth,
    height: targetHeight,
  });

  const searchImage = drawToGray(
    sheet,
    0,
    0,
    sheet.naturalWidth,
    sheet.naturalHeight,
    sheet.naturalWidth / downscale,
    sheet.naturalHeight / downscale,
  );

  const template = drawToGray(
    glyph,
    0,
    0,
    glyph.naturalWidth,
    glyph.naturalHeight,
    targetWidth / downscale,
    targetHeight / downscale,
  );

  return { image: searchImage, template, downscale };
}

/** Full-resolution PNG of the selection, stored in the library for reuse. */
export function cropToDataUrl(image: HTMLImageElement, box: BBox): string {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(box.width));
  canvas.height = Math.max(1, Math.round(box.height));
  const context = canvas.getContext('2d');
  if (!context) return '';
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(
    image,
    box.x,
    box.y,
    box.width,
    box.height,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  return canvas.toDataURL('image/png');
}

/** Small PNG of the selected symbol, shown back to the user for confirmation. */
export function templatePreview(
  image: HTMLImageElement,
  box: BBox,
  maxSide = 96,
): string {
  const ratio = Math.min(maxSide / box.width, maxSide / box.height, 4);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(box.width * ratio));
  canvas.height = Math.max(1, Math.round(box.height * ratio));
  const context = canvas.getContext('2d');
  if (!context) return '';
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(
    image,
    box.x,
    box.y,
    box.width,
    box.height,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  return canvas.toDataURL('image/png');
}

/** Normalises a drag into a positive-size box clamped to the drawing. */
export function normaliseBox(
  a: { x: number; y: number },
  b: { x: number; y: number },
  imageWidth: number,
  imageHeight: number,
): BBox {
  const x = Math.max(0, Math.min(a.x, b.x));
  const y = Math.max(0, Math.min(a.y, b.y));
  const right = Math.min(imageWidth, Math.max(a.x, b.x));
  const bottom = Math.min(imageHeight, Math.max(a.y, b.y));
  return { x, y, width: Math.max(0, right - x), height: Math.max(0, bottom - y) };
}
