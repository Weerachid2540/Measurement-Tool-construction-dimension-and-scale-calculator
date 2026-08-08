import type Konva from 'konva';

/**
 * The exporters need a PNG of the marked-up drawing, but they are plain functions
 * rather than components. Registering the live stage here keeps that dependency
 * one-directional instead of threading a ref through the whole tree.
 */
let stage: Konva.Stage | null = null;

export const registerStage = (instance: Konva.Stage | null): void => {
  stage = instance;
};

export function getStageSnapshot(pixelRatio = 2): string | undefined {
  if (!stage) return undefined;
  try {
    return stage.toDataURL({ pixelRatio, mimeType: 'image/png' });
  } catch {
    // Tainted canvas (cross-origin image) — export without the snapshot.
    return undefined;
  }
}
