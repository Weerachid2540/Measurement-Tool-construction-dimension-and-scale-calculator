import { useCallback, useRef, type RefObject } from 'react';
import type Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { Measurement, MeasurementType, Point, ToolId } from '@/types';
import { ZOOM_LIMITS } from '@/types';
import { useAutoCountStore, useMeasurementStore, useUiStore } from '@/store';
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
  onTouchMove: (e: KonvaEventObject<TouchEvent>) => void;
  onTouchEnd: (e: KonvaEventObject<TouchEvent>) => void;
  /** Applies the active snapping rules to an arbitrary image-space point. */
  snapPoint: (raw: Point, shiftKey: boolean) => Point;
}

export function useCanvasInteraction(
  stageRef: RefObject<Konva.Stage>,
  measurementsOnPage: Measurement[],
  /** Called when the auto-count marquee is released. */
  onMarqueeEnd?: () => void,
): CanvasInteraction {
  const pressOrigin = useRef<{ x: number; y: number } | null>(null);
  const marqueeActive = useRef(false);
  const pinch = useRef<{ distance: number; center: Point } | null>(null);
  /** จริงระหว่างและหลังการหยิบสองนิ้ว จนกว่าจะยกนิ้วครบ — กันไม่ให้กลายเป็นคลิกวางจุด */
  const pinchActive = useRef(false);
  const openModal = useUiStore((s) => s.openModal);

  const readPointer = useCallback((): Point | null => {
    const stage = stageRef.current;
    if (!stage) return null;
    const position = stage.getRelativePointerPosition();
    return position ? { x: position.x, y: position.y } : null;
  }, [stageRef]);

  const snapPoint = useCallback(
    (raw: Point, shiftKey: boolean): Point => {
      const { grid, snap, scale, draft, view, activeTool } = useMeasurementStore.getState();
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

      // 3. ปรับเทียบมาตราส่วนล็อกแนวนอน/แนวตั้งเสมอ — ระยะที่ทราบค่าบนแบบแทบทั้งหมดเป็นเส้นตรง
      //    เอียงไปไม่กี่พิกเซลก็ทำให้มาตราส่วนคลาดทั้งไฟล์ กด Shift ถ้าต้องปรับเทียบกับเส้นเฉียง
      if (activeTool === 'calibrate' && draft.length > 0) {
        return shiftKey ? point : snapToAngle(draft[0], point, 90);
      }

      // 4. Ortho/45° constraint relative to the previous point.
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
    const active = state.activeTool;
    if (!DRAWING_TOOLS.includes(active)) return;
    const type = active as MeasurementType;
    if (isComplete(type, state.draft)) state.commitDraft();
    else state.cancelDraft();
  }, []);

  const handleClick = useCallback(
    (point: Point, target: Konva.Node) => {
      const state = useMeasurementStore.getState();
      const tool = state.activeTool;

      // Panning and auto-count are handled by drag, not by click.
      if (tool === 'pan' || tool === 'autoCount') return;

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

  const onPointerDown = useCallback(
    (e: KonvaEventObject<PointerEvent>) => {
      const stage = e.target.getStage();
      const pointer = stage?.getPointerPosition();
      pressOrigin.current = pointer ? { x: pointer.x, y: pointer.y } : null;

      // Auto-count is the one tool that draws by dragging a marquee.
      if (useMeasurementStore.getState().activeTool !== 'autoCount') return;
      if (useAutoCountStore.getState().stage !== 'selecting') return;
      const raw = readPointer();
      if (raw) {
        marqueeActive.current = true;
        useAutoCountStore.getState().setDrag(raw, raw);
      }
    },
    [readPointer],
  );

  const onPointerMove = useCallback(() => {
    const raw = readPointer();
    if (!raw) return;

    if (marqueeActive.current) {
      const { dragStart, setDrag } = useAutoCountStore.getState();
      setDrag(dragStart, raw);
      return;
    }

    const shiftKey = shiftPressed();
    useMeasurementStore.getState().setCursor(snapPoint(raw, shiftKey));
  }, [readPointer, snapPoint]);

  const onPointerUp = useCallback(
    (e: KonvaEventObject<PointerEvent>) => {
      const stage = e.target.getStage();
      const pointer = stage?.getPointerPosition();
      const origin = pressOrigin.current;
      pressOrigin.current = null;

      if (marqueeActive.current) {
        marqueeActive.current = false;
        onMarqueeEnd?.();
        return;
      }

      if (pinchActive.current) return;

      // A drag (panning) should never place a point.
      if (origin && pointer && Math.hypot(pointer.x - origin.x, pointer.y - origin.y) > CLICK_SLOP) {
        return;
      }

      const raw = readPointer();
      if (!raw) return;
      handleClick(snapPoint(raw, e.evt.shiftKey), e.target);
    },
    [handleClick, onMarqueeEnd, readPointer, snapPoint],
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

  /**
   * ซูมและเลื่อนด้วยสองนิ้วบนจอสัมผัส — ล้อเมาส์ใช้ไม่ได้บนมือถือ/แท็บเล็ต
   * นิ้วเดียวยังทำงานตามเครื่องมือที่เลือกอยู่ (วาด เลือก หรือลากเลื่อนเมื่ออยู่โหมด pan)
   */
  const onTouchMove = useCallback(
    (e: KonvaEventObject<TouchEvent>) => {
      const touches = e.evt.touches;
      if (touches.length < 2) {
        pinch.current = null;
        return;
      }

      e.evt.preventDefault();
      const stage = stageRef.current;
      if (!stage) return;

      // โหมด pan ปล่อยให้ Konva ลากเวทีเองอยู่ ต้องหยุดก่อนไม่งั้นภาพเลื่อนซ้อนสองชั้น
      if (stage.isDragging()) stage.stopDrag();

      const box = stage.container().getBoundingClientRect();
      const a = { x: touches[0].clientX - box.left, y: touches[0].clientY - box.top };
      const b = { x: touches[1].clientX - box.left, y: touches[1].clientY - box.top };
      const distance = Math.hypot(b.x - a.x, b.y - a.y);
      const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };

      const previous = pinch.current;
      pinch.current = { distance, center };
      pinchActive.current = true;
      if (!previous || previous.distance === 0) return;

      const store = useMeasurementStore.getState();

      // จุดกึ่งกลางสองนิ้วเลื่อนไปเท่าไร ภาพเลื่อนตามเท่านั้น
      const dx = center.x - previous.center.x;
      const dy = center.y - previous.center.y;
      if (dx !== 0 || dy !== 0) store.setView({ x: store.view.x + dx, y: store.view.y + dy });

      const factor = distance / previous.distance;
      const next = useMeasurementStore.getState().view.zoom * factor;
      if (next < ZOOM_LIMITS.min || next > ZOOM_LIMITS.max) return;
      store.zoomBy(factor, center);
    },
    [stageRef],
  );

  const onTouchEnd = useCallback((e: KonvaEventObject<TouchEvent>) => {
    pinch.current = null;
    // ปล่อยนิ้วครบแล้วค่อยเปิดให้คลิกวางจุดได้อีกครั้ง ไม่งั้นปลายนิ้วที่ยกทีหลังจะกลายเป็นคลิก
    if (e.evt.touches.length === 0) pinchActive.current = false;
  }, []);

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
    onTouchMove,
    onTouchEnd,
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
