import { useCallback, useRef, type RefObject } from 'react';
import type Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { Measurement, MeasurementType, Point, ToolId } from '@/types';
import { ZOOM_LIMITS } from '@/types';
import { useMeasurementStore, useUiStore } from '@/store';
import { nearestPoint, snapToAngle } from '@/utils/geometry';
import { isComplete, isFull, outlinePoints } from '@/utils/measurement';
import { realMmToPx, toMillimetres } from '@/utils/scale';

const DRAWING_TOOLS: ToolId[] = [
  'line',
  'polyline',
  'rectangle',
  'polygon',
  'circle',
  'angle',
  'count',
];

/** Pointer travel (screen px) above which a press counts as a drag, not a click. */
const CLICK_SLOP = 5;
const WHEEL_ZOOM_STEP = 1.08;

export interface CanvasInteraction {
  onPointerDown: (e: KonvaEventObject<PointerEvent>) => void;
  onPointerMove: () => void;
  onPointerUp: (e: KonvaEventObject<PointerEvent>) => void;
  onPointerLeave: () => void;
  onDblClick: () => void;
  onContextMenu: (e: KonvaEventObject<PointerEvent>) => void;
  onWheel: (e: KonvaEventObject<WheelEvent>) => void;
  /** Applies the active snapping rules to an arbitrary image-space point. */
  snapPoint: (raw: Point, shiftKey: boolean) => Point;
}

export function useCanvasInteraction(
  stageRef: RefObject<Konva.Stage>,
  measurementsOnPage: Measurement[],
): CanvasInteraction {
  const pressOrigin = useRef<{ x: number; y: number } | null>(null);
  const openModal = useUiStore((s) => s.openModal);

  const readPointer = useCallback((): Point | null => {
    const stage = stageRef.current;
    if (!stage) return null;
    const position = stage.getRelativePointerPosition();
    return position ? { x: position.x, y: position.y } : null;
  }, [stageRef]);

  const snapPoint = useCallback(
    (raw: Point, shiftKey: boolean): Point => {
      const { grid, snap, scale, draft, view } = useMeasurementStore.getState();
      let point = raw;

      // 1. Existing vertices win — they keep chained measurements watertight.
      if (snap.toVertices) {
        const candidates = measurementsOnPage.flatMap((m) => outlinePoints(m.type, m.points));
        const hit = nearestPoint(candidates, point, snap.thresholdPx / view.zoom);
        if (hit) return hit;
      }

      // 2. Grid intersections.
      if (grid.enabled && grid.snapToGrid) {
        const stepPx = realMmToPx(toMillimetres(grid.spacing, grid.unit), scale);
        if (stepPx > 1) {
          point = {
            x: Math.round(point.x / stepPx) * stepPx,
            y: Math.round(point.y / stepPx) * stepPx,
          };
        }
      }

      // 3. Ortho/45° constraint relative to the previous point.
      if (shiftKey && snap.orthoWithShift && draft.length > 0) {
        point = snapToAngle(draft[draft.length - 1], point, 45);
      }

      return point;
    },
    [measurementsOnPage],
  );

  const finishDraft = useCallback(() => {
    const state = useMeasurementStore.getState();
    if (state.activeTool === 'calibrate' || state.activeTool === 'select') return;
    if (!DRAWING_TOOLS.includes(state.activeTool)) return;
    const type = state.activeTool as MeasurementType;
    if (isComplete(type, state.draft)) state.commitDraft();
    else state.cancelDraft();
  }, []);

  const handleClick = useCallback(
    (point: Point, target: Konva.Node) => {
      const state = useMeasurementStore.getState();
      const tool = state.activeTool;

      if (tool === 'pan') return;

      if (tool === 'select') {
        // Clicking bare canvas (the stage or the drawing image) clears the selection.
        if (target === target.getStage() || target.name() === 'backdrop') {
          state.clearSelection();
        }
        return;
      }

      if (tool === 'calibrate') {
        const draft = [...state.draft, point];
        if (draft.length >= 2) {
          useMeasurementStore.setState({ draft: draft.slice(0, 2) });
          openModal('calibrate');
        } else {
          state.addDraftPoint(point);
        }
        return;
      }

      const type = tool as MeasurementType;
      state.addDraftPoint(point);
      const draft = useMeasurementStore.getState().draft;
      if (isFull(type, draft)) useMeasurementStore.getState().commitDraft();
    },
    [openModal],
  );

  const onPointerDown = useCallback((e: KonvaEventObject<PointerEvent>) => {
    const stage = e.target.getStage();
    const pointer = stage?.getPointerPosition();
    pressOrigin.current = pointer ? { x: pointer.x, y: pointer.y } : null;
  }, []);

  const onPointerMove = useCallback(() => {
    const raw = readPointer();
    if (!raw) return;
    const shiftKey = shiftPressed();
    useMeasurementStore.getState().setCursor(snapPoint(raw, shiftKey));
  }, [readPointer, snapPoint]);

  const onPointerUp = useCallback(
    (e: KonvaEventObject<PointerEvent>) => {
      const stage = e.target.getStage();
      const pointer = stage?.getPointerPosition();
      const origin = pressOrigin.current;
      pressOrigin.current = null;

      // A drag (panning) should never place a point.
      if (origin && pointer && Math.hypot(pointer.x - origin.x, pointer.y - origin.y) > CLICK_SLOP) {
        return;
      }

      const raw = readPointer();
      if (!raw) return;
      handleClick(snapPoint(raw, e.evt.shiftKey), e.target);
    },
    [handleClick, readPointer, snapPoint],
  );

  const onPointerLeave = useCallback(() => {
    useMeasurementStore.getState().setCursor(null);
  }, []);

  const onDblClick = useCallback(() => {
    const { activeTool } = useMeasurementStore.getState();
    if (activeTool === 'polyline' || activeTool === 'polygon' || activeTool === 'count') {
      finishDraft();
    }
  }, [finishDraft]);

  const onContextMenu = useCallback(
    (e: KonvaEventObject<PointerEvent>) => {
      e.evt.preventDefault();
      finishDraft();
    },
    [finishDraft],
  );

  const onWheel = useCallback(
    (e: KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();
      const stage = stageRef.current;
      const pointer = stage?.getPointerPosition();
      if (!pointer) return;
      const { view, zoomBy } = useMeasurementStore.getState();
      const direction = e.evt.deltaY > 0 ? 1 / WHEEL_ZOOM_STEP : WHEEL_ZOOM_STEP;
      const next = view.zoom * direction;
      if (next < ZOOM_LIMITS.min || next > ZOOM_LIMITS.max) return;
      zoomBy(direction, pointer);
    },
    [stageRef],
  );

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerLeave,
    onDblClick,
    onContextMenu,
    onWheel,
    snapPoint,
  };
}

/** Konva does not expose modifier state on move events, so track it globally. */
let shiftDown = false;
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Shift') shiftDown = true;
  });
  window.addEventListener('keyup', (e) => {
    if (e.key === 'Shift') shiftDown = false;
  });
  window.addEventListener('blur', () => {
    shiftDown = false;
  });
}
const shiftPressed = (): boolean => shiftDown;
