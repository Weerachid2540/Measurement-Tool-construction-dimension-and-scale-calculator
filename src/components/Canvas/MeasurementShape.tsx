import { memo } from 'react';
import { Arc, Circle, Group, Label, Line, Rect, Tag, Text } from 'react-konva';
import type Konva from 'konva';
import type { Measurement, MeasurementResult, Point } from '@/types';
import { distance, flattenPoints, toDegrees } from '@/utils/geometry';
import { labelAnchor } from '@/utils/measurement';
import { withAlpha } from '@/utils/colors';
import { formatQuantity } from '@/utils/format';

const FILL_ALPHA = 0.16;
const SELECTED_STROKE_WIDTH = 3;
const BASE_STROKE_WIDTH = 2;

interface MeasurementShapeProps {
  measurement: Measurement;
  result: MeasurementResult;
  selected: boolean;
  /** Current stage zoom — used to keep handles and labels a constant screen size. */
  zoom: number;
  onSelect: (id: string, additive: boolean) => void;
  onVertexMove: (id: string, index: number, point: Point) => void;
}

function MeasurementShapeImpl({
  measurement,
  result,
  selected,
  zoom,
  onSelect,
  onVertexMove,
}: MeasurementShapeProps) {
  if (!measurement.visible) return null;

  const { points, color, type } = measurement;
  const strokeWidth = selected ? SELECTED_STROKE_WIDTH : BASE_STROKE_WIDTH;
  const fill = withAlpha(color, FILL_ALPHA);
  const anchor = labelAnchor(type, points);

  const handleClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    e.cancelBubble = true;
    onSelect(measurement.id, e.evt.shiftKey || e.evt.ctrlKey || e.evt.metaKey);
  };

  const common: CommonShapeProps = {
    stroke: color,
    strokeWidth,
    strokeScaleEnabled: false,
    hitStrokeWidth: 14 / zoom,
    onClick: handleClick,
    onTap: () => onSelect(measurement.id, false),
    perfectDrawEnabled: false,
  };

  return (
    <Group listening={!measurement.locked}>
      {renderGeometry(type, points, fill, common, zoom, color)}

      <Label x={anchor.x} y={anchor.y} scaleX={1 / zoom} scaleY={1 / zoom} listening={false}>
        <Tag
          fill="rgba(15, 23, 42, 0.86)"
          stroke={color}
          strokeWidth={1}
          cornerRadius={4}
          pointerDirection="down"
          pointerWidth={0}
          pointerHeight={0}
        />
        <Text
          text={`${measurement.label}  ${formatQuantity(result.primary)}`}
          fontSize={12}
          fontStyle="600"
          padding={5}
          fill="#e2e8f0"
        />
      </Label>

      {selected && !measurement.locked && (
        <VertexHandles
          points={points}
          color={color}
          zoom={zoom}
          onMove={(index, point) => onVertexMove(measurement.id, index, point)}
        />
      )}
    </Group>
  );
}

/** Props shared by every geometry primitive so selection and hit-testing behave alike. */
interface CommonShapeProps {
  stroke: string;
  strokeWidth: number;
  strokeScaleEnabled: boolean;
  hitStrokeWidth: number;
  perfectDrawEnabled: boolean;
  onClick: (e: Konva.KonvaEventObject<MouseEvent>) => void;
  onTap: () => void;
}

function renderGeometry(
  type: Measurement['type'],
  points: Point[],
  fill: string,
  common: CommonShapeProps,
  zoom: number,
  color: string,
) {
  switch (type) {
    case 'line':
    case 'polyline':
      return <Line points={flattenPoints(points)} {...common} />;

    case 'rectangle': {
      if (points.length < 2) return null;
      const [a, b] = points;
      return (
        <Rect
          x={Math.min(a.x, b.x)}
          y={Math.min(a.y, b.y)}
          width={Math.abs(b.x - a.x)}
          height={Math.abs(b.y - a.y)}
          fill={fill}
          {...common}
        />
      );
    }

    case 'polygon':
      return <Line points={flattenPoints(points)} closed fill={fill} {...common} />;

    case 'circle': {
      if (points.length < 2) return null;
      const radius = distance(points[0], points[1]);
      return (
        <Group>
          <Circle x={points[0].x} y={points[0].y} radius={radius} fill={fill} {...common} />
          <Line
            points={flattenPoints(points)}
            dash={[6 / zoom, 4 / zoom]}
            stroke={color}
            strokeWidth={1}
            strokeScaleEnabled={false}
            listening={false}
          />
        </Group>
      );
    }

    case 'angle': {
      if (points.length < 3) return null;
      const [armA, vertex, armB] = points;
      const arc = arcGeometry(armA, vertex, armB, 42 / zoom);
      return (
        <Group>
          <Line points={flattenPoints(points)} {...common} />
          <Arc
            x={vertex.x}
            y={vertex.y}
            innerRadius={arc.radius}
            outerRadius={arc.radius}
            angle={arc.sweep}
            rotation={arc.rotation}
            stroke={color}
            strokeWidth={1.5}
            strokeScaleEnabled={false}
            listening={false}
          />
        </Group>
      );
    }

    case 'count':
    default:
      return (
        <Group>
          {points.map((point, index) => (
            <Group key={`${point.x}-${point.y}-${index}`}>
              <Circle
                x={point.x}
                y={point.y}
                radius={9 / zoom}
                fill={fill}
                {...common}
                hitStrokeWidth={12 / zoom}
              />
              <Text
                x={point.x - 9 / zoom}
                y={point.y - 5 / zoom}
                width={18 / zoom}
                align="center"
                text={String(index + 1)}
                fontSize={10 / zoom}
                fill={color}
                listening={false}
              />
            </Group>
          ))}
        </Group>
      );
  }
}

/** Konva arcs sweep clockwise from `rotation`; normalise so the arc lands inside the angle. */
function arcGeometry(armA: Point, vertex: Point, armB: Point, radius: number) {
  const a1 = toDegrees(Math.atan2(armA.y - vertex.y, armA.x - vertex.x));
  const a2 = toDegrees(Math.atan2(armB.y - vertex.y, armB.x - vertex.x));
  let delta = a2 - a1;
  while (delta <= -180) delta += 360;
  while (delta > 180) delta -= 360;
  return delta >= 0
    ? { rotation: a1, sweep: delta, radius }
    : { rotation: a2, sweep: -delta, radius };
}

interface VertexHandlesProps {
  points: Point[];
  color: string;
  zoom: number;
  onMove: (index: number, point: Point) => void;
}

function VertexHandles({ points, color, zoom, onMove }: VertexHandlesProps) {
  return (
    <>
      {points.map((point, index) => (
        <Circle
          key={index}
          x={point.x}
          y={point.y}
          radius={5 / zoom}
          fill="#0f172a"
          stroke={color}
          strokeWidth={2}
          strokeScaleEnabled={false}
          draggable
          onDragMove={(e) => onMove(index, { x: e.target.x(), y: e.target.y() })}
          onMouseEnter={(e) => {
            const container = e.target.getStage()?.container();
            if (container) container.style.cursor = 'move';
          }}
          onMouseLeave={(e) => {
            const container = e.target.getStage()?.container();
            if (container) container.style.cursor = '';
          }}
        />
      ))}
    </>
  );
}

export const MeasurementShape = memo(MeasurementShapeImpl);
