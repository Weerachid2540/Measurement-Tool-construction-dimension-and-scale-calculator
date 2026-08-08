/** A point in *image space* — i.e. pixels of the loaded drawing, independent of zoom/pan. */
export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface BBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Canvas viewport transform. `zoom` is a uniform scale, `x`/`y` a screen-space offset. */
export interface Viewport {
  zoom: number;
  x: number;
  y: number;
}
