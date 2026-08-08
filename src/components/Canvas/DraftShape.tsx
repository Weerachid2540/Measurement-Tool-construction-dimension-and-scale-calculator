import { Circle, Group, Label, Line, Rect, Tag, Text } from 'react-konva';
import type { Point, ScaleSettings, ToolId } from '@/types';
import { distance, flattenPoints, polygonArea, polylineLength } from '@/utils/geometry';
import { mm2ToM2, mmToM, pxAreaToRealMm2, pxToRealMm } from '@/utils/scale';
import { formatNumber } from '@/utils/format';
import { defaultColorFor, withAlpha } from '@/utils/colors';

interface SharedPreviewProps {
  stroke: string;
  strokeWidth: number;
  strokeScaleEnabled: boolean;
  dash: number[];
  listening: boolean;
}

interface DraftShapeProps {
  tool: ToolId;
  points: Point[];
  cursor: Point | null;
  zoom: number;
  scale: ScaleSettings;
  color: string | null;
}

/** The rubber-band preview of the shape currently being drawn, with a live readout. */
export function DraftShape({ tool, points, cursor, zoom, scale, color }: DraftShapeProps) {
  if (points.length === 0 && !cursor) return null;
  if (tool === 'select' || tool === 'pan') return null;

  const stroke = tool === 'calibrate' ? '#f97316' : (color ?? defaultColorFor(drawTypeOf(tool)));
  const preview = cursor ? [...points, cursor] : points;
  if (preview.length === 0) return null;

  const dash = [8 / zoom, 6 / zoom];
  const shared: SharedPreviewProps = {
    stroke,
    strokeWidth: 2,
    strokeScaleEnabled: false,
    dash,
    listening: false,
  };

  return (
    <Group listening={false}>
      {renderPreview(tool, preview, shared, stroke, zoom)}

      {preview.map((point, index) => (
        <Circle
          key={index}
          x={point.x}
          y={point.y}
          radius={3.5 / zoom}
          fill={stroke}
          listening={false}
        />
      ))}

      {cursor && preview.length >= 2 && (
        <Label x={cursor.x} y={cursor.y} scaleX={1 / zoom} scaleY={1 / zoom} listening={false}>
          <Tag fill="rgba(15,23,42,0.9)" stroke={stroke} strokeWidth={1} cornerRadius={4} />
          <Text
            text={liveReadout(tool, preview, scale)}
            fontSize={12}
            padding={5}
            fill="#f8fafc"
          />
        </Label>
      )}
    </Group>
  );
}

function renderPreview(
  tool: ToolId,
  preview: Point[],
  shared: SharedPreviewProps,
  stroke: string,
  zoom: number,
) {
  if (tool === 'rectangle' && preview.length >= 2) {
    const [a, b] = preview;
    return (
      <Rect
        x={Math.min(a.x, b.x)}
        y={Math.min(a.y, b.y)}
        width={Math.abs(b.x - a.x)}
        height={Math.abs(b.y - a.y)}
        fill={withAlpha(stroke, 0.12)}
        {...shared}
      />
    );
  }

  if (tool === 'circle' && preview.length >= 2) {
    return (
      <Group>
        <Circle
          x={preview[0].x}
          y={preview[0].y}
          radius={distance(preview[0], preview[1])}
          fill={withAlpha(stroke, 0.12)}
          {...shared}
        />
        <Line points={flattenPoints(preview.slice(0, 2))} {...shared} />
      </Group>
    );
  }

  if (tool === 'count') {
    return (
      <Group>
        {preview.map((point, index) => (
          <Circle key={index} x={point.x} y={point.y} radius={9 / zoom} {...shared} />
        ))}
      </Group>
    );
  }

  return (
    <Line
      points={flattenPoints(preview)}
      closed={tool === 'polygon' && preview.length > 2}
      fill={tool === 'polygon' ? withAlpha(stroke, 0.1) : undefined}
      {...shared}
    />
  );
}

/** Live length/area/count while the shape is still open. */
function liveReadout(tool: ToolId, preview: Point[], scale: ScaleSettings): string {
  if (tool === 'polygon' && preview.length >= 3) {
    const areaM2 = mm2ToM2(pxAreaToRealMm2(polygonArea(preview), scale));
    const perimeterM = mmToM(pxToRealMm(polylineLength(preview, true), scale));
    return `${formatNumber(areaM2, 3)} m²  ·  รอบรูป ${formatNumber(perimeterM, 3)} m`;
  }

  if (tool === 'rectangle' && preview.length >= 2) {
    const w = mmToM(pxToRealMm(Math.abs(preview[1].x - preview[0].x), scale));
    const h = mmToM(pxToRealMm(Math.abs(preview[1].y - preview[0].y), scale));
    return `${formatNumber(w, 3)} × ${formatNumber(h, 3)} m  =  ${formatNumber(w * h, 3)} m²`;
  }

  if (tool === 'circle' && preview.length >= 2) {
    const r = mmToM(pxToRealMm(distance(preview[0], preview[1]), scale));
    return `r ${formatNumber(r, 3)} m  ·  ${formatNumber(Math.PI * r * r, 3)} m²`;
  }

  if (tool === 'count') return `${preview.length - 1} จุด`;

  const lengthM = mmToM(pxToRealMm(polylineLength(preview), scale));
  const suffix = tool === 'calibrate' ? '  (ระยะอ้างอิง)' : '';
  return `${formatNumber(lengthM, 3)} m${suffix}`;
}

const drawTypeOf = (tool: ToolId) =>
  tool === 'calibrate' || tool === 'select' || tool === 'pan' ? 'line' : tool;
