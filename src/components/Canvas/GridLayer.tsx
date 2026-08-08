import { useMemo } from 'react';
import { Group, Line } from 'react-konva';
import type { GridSettings, ScaleSettings, Size } from '@/types';
import { realMmToPx, toMillimetres } from '@/utils/scale';

const MAX_LINES = 400;

interface GridLayerProps {
  grid: GridSettings;
  scale: ScaleSettings;
  page: Size;
  zoom: number;
}

/** Real-world grid (e.g. every 1 m) drawn under the measurements. */
export function GridLayer({ grid, scale, page, zoom }: GridLayerProps) {
  const lines = useMemo(() => {
    if (!grid.enabled) return null;
    const stepPx = realMmToPx(toMillimetres(grid.spacing, grid.unit), scale);
    // Bail out when the grid would be denser than it is useful.
    if (!Number.isFinite(stepPx) || stepPx <= 2) return null;
    if (page.width / stepPx + page.height / stepPx > MAX_LINES * 2) return null;

    const vertical: { x: number; major: boolean }[] = [];
    const horizontal: { y: number; major: boolean }[] = [];
    for (let i = 0, x = 0; x <= page.width; i += 1, x = i * stepPx) {
      vertical.push({ x, major: i % grid.majorEvery === 0 });
    }
    for (let i = 0, y = 0; y <= page.height; i += 1, y = i * stepPx) {
      horizontal.push({ y, major: i % grid.majorEvery === 0 });
    }
    return { vertical, horizontal };
  }, [grid, page.height, page.width, scale]);

  if (!lines) return null;

  const stroke = (major: boolean) => (major ? 'rgba(56,189,248,0.45)' : 'rgba(148,163,184,0.25)');

  return (
    <Group listening={false}>
      {lines.vertical.map((line) => (
        <Line
          key={`v${line.x}`}
          points={[line.x, 0, line.x, page.height]}
          stroke={stroke(line.major)}
          strokeWidth={line.major ? 1.2 : 0.7}
          strokeScaleEnabled={false}
          perfectDrawEnabled={false}
          listening={false}
        />
      ))}
      {lines.horizontal.map((line) => (
        <Line
          key={`h${line.y}`}
          points={[0, line.y, page.width, line.y]}
          stroke={stroke(line.major)}
          strokeWidth={line.major ? 1.2 : 0.7}
          strokeScaleEnabled={false}
          perfectDrawEnabled={false}
          listening={false}
        />
      ))}
      {/* Sheet outline keeps the drawing edge visible at low zoom. */}
      <Line
        points={[0, 0, page.width, 0, page.width, page.height, 0, page.height]}
        closed
        stroke="rgba(148,163,184,0.6)"
        strokeWidth={1 / zoom}
        listening={false}
      />
    </Group>
  );
}
