import { Circle, Group, Rect } from 'react-konva';
import type Konva from 'konva';
import type { BBox, Point } from '@/types';

const COLOR = '#f97316';
/** Anything smaller than this stops being a recognisable symbol. */
const MIN_SIZE = 6;

interface TemplateBoxEditorProps {
  box: BBox;
  zoom: number;
  /** Bounds of the sheet, so handles cannot be dragged off the drawing. */
  page: { width: number; height: number };
  /** Fires continuously while dragging. */
  onResize: (box: BBox) => void;
  /** Fires once on release — the moment to regenerate the preview and re-search. */
  onResizeEnd: () => void;
}

/**
 * Draggable corners on the template box. Letting the user nudge the selection by hand
 * proved far more reliable than trying to detect the symbol's extent automatically —
 * they can see immediately whether a stray wall line is inside the box or not.
 */
export function TemplateBoxEditor({
  box,
  zoom,
  page,
  onResize,
  onResizeEnd,
}: TemplateBoxEditorProps) {
  const handleRadius = 5 / zoom;

  const corners: { key: string; point: Point; opposite: Point }[] = [
    {
      key: 'nw',
      point: { x: box.x, y: box.y },
      opposite: { x: box.x + box.width, y: box.y + box.height },
    },
    {
      key: 'ne',
      point: { x: box.x + box.width, y: box.y },
      opposite: { x: box.x, y: box.y + box.height },
    },
    {
      key: 'se',
      point: { x: box.x + box.width, y: box.y + box.height },
      opposite: { x: box.x, y: box.y },
    },
    {
      key: 'sw',
      point: { x: box.x, y: box.y + box.height },
      opposite: { x: box.x + box.width, y: box.y },
    },
  ];

  const applyCorner = (dragged: Point, opposite: Point) => {
    const x = Math.max(0, Math.min(dragged.x, opposite.x));
    const y = Math.max(0, Math.min(dragged.y, opposite.y));
    const right = Math.min(page.width, Math.max(dragged.x, opposite.x));
    const bottom = Math.min(page.height, Math.max(dragged.y, opposite.y));
    onResize({
      x,
      y,
      width: Math.max(MIN_SIZE, right - x),
      height: Math.max(MIN_SIZE, bottom - y),
    });
  };

  const setCursor = (e: Konva.KonvaEventObject<MouseEvent>, cursor: string) => {
    const container = e.target.getStage()?.container();
    if (container) container.style.cursor = cursor;
  };

  return (
    <Group>
      <Rect
        x={box.x}
        y={box.y}
        width={box.width}
        height={box.height}
        stroke={COLOR}
        strokeWidth={2}
        strokeScaleEnabled={false}
        fill="rgba(249, 115, 22, 0.08)"
        draggable
        onDragMove={(e) => {
          const node = e.target;
          const x = Math.max(0, Math.min(node.x(), page.width - box.width));
          const y = Math.max(0, Math.min(node.y(), page.height - box.height));
          node.position({ x, y });
          onResize({ ...box, x, y });
        }}
        onDragEnd={onResizeEnd}
        onMouseEnter={(e) => setCursor(e, 'move')}
        onMouseLeave={(e) => setCursor(e, '')}
      />

      {corners.map((corner) => (
        <Circle
          key={corner.key}
          x={corner.point.x}
          y={corner.point.y}
          radius={handleRadius}
          fill="#0f172a"
          stroke={COLOR}
          strokeWidth={2}
          strokeScaleEnabled={false}
          draggable
          onDragMove={(e) => applyCorner({ x: e.target.x(), y: e.target.y() }, corner.opposite)}
          onDragEnd={onResizeEnd}
          onMouseEnter={(e) => setCursor(e, 'nwse-resize')}
          onMouseLeave={(e) => setCursor(e, '')}
        />
      ))}
    </Group>
  );
}
