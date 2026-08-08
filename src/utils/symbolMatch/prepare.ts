import type { BBox } from '@/types';
import type { GrayImage } from './types';

/**
 * Correlating a full-resolution A1 sheet (~12M pixels) is needlessly slow — a symbol
 * stays recognisable at a fraction of that. The search runs on a shrunk copy and the
 * hits are scaled back up; a pixel or two of positional error is irrelevant for a
 * count marker.
 */
const MAX_SEARCH_PIXELS = 2_600_000;
/** Below this a template loses the detail that separates similar symbols. */
const MIN_TEMPLATE_SIDE = 8;

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

  const template = drawToGray(
    image,
    templateBox.x,
    templateBox.y,
    templateBox.width,
    templateBox.height,
    templateBox.width / downscale,
    templateBox.height / downscale,
  );

  return { image: searchImage, template, downscale };
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
