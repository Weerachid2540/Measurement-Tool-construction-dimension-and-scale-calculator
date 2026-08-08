import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Image as KonvaImage, Layer, Stage } from 'react-konva';
import type Konva from 'konva';
import type { ToolId } from '@/types';
import { useMeasurementStore, useUiStore } from '@/store';
import {
  useAutoCount,
  useCanvasInteraction,
  useElementSize,
  useHtmlImage,
  useMeasurementResults,
} from '@/hooks';
import { MeasurementShape } from './MeasurementShape';
import { DraftShape } from './DraftShape';
import { GridLayer } from './GridLayer';
import { AutoCountOverlay } from './AutoCountOverlay';
import { registerDrawingImage, registerStage } from './stageRegistry';

const CURSOR_BY_TOOL: Record<ToolId, string> = {
  select: 'default',
  pan: 'grab',
  line: 'crosshair',
  polyline: 'crosshair',
  rectangle: 'crosshair',
  polygon: 'crosshair',
  circle: 'crosshair',
  angle: 'crosshair',
  count: 'copy',
  autoCount: 'crosshair',
  calibrate: 'crosshair',
};

export function MeasureCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const size = useElementSize(containerRef);

  const page = useMeasurementStore((s) => s.page);
  const view = useMeasurementStore((s) => s.view);
  const scale = useMeasurementStore((s) => s.scale);
  const grid = useMeasurementStore((s) => s.grid);
  const draft = useMeasurementStore((s) => s.draft);
  const cursor = useMeasurementStore((s) => s.cursor);
  const activeTool = useMeasurementStore((s) => s.activeTool);
  const activeColor = useMeasurementStore((s) => s.activeColor);
  const selectedIds = useMeasurementStore((s) => s.selectedIds);
  const setView = useMeasurementStore((s) => s.setView);
  const resetView = useMeasurementStore((s) => s.resetView);
  const select = useMeasurementStore((s) => s.select);
  const toggleSelect = useMeasurementStore((s) => s.toggleSelect);
  const moveVertex = useMeasurementStore((s) => s.moveVertex);
  const busy = useUiStore((s) => s.busy);

  // Filtering outside the selector keeps zustand from re-rendering on unrelated updates.
  const allMeasurements = useMeasurementStore((s) => s.measurements);
  const currentPage = useMeasurementStore((s) => s.currentPage);
  const measurements = useMemo(
    () => allMeasurements.filter((m) => m.page === currentPage),
    [allMeasurements, currentPage],
  );
  const results = useMeasurementResults(measurements, scale);
  const [image] = useHtmlImage(page?.src);

  const { commitSelection, resizeTemplate, finishResize } = useAutoCount();
  const interaction = useCanvasInteraction(stageRef, measurements, commitSelection);

  useEffect(() => {
    registerStage(stageRef.current);
    return () => registerStage(null);
  }, [page]);

  useEffect(() => {
    registerDrawingImage(image);
    return () => registerDrawingImage(null);
  }, [image]);

  // Fit the sheet to the viewport whenever a new page is opened.
  const pageKey = page ? `${page.pageNumber}:${page.src.length}` : '';
  useEffect(() => {
    if (!page || size.width === 0 || size.height === 0) return;
    resetView(size);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageKey, size.width, size.height]);

  const handleSelect = useCallback(
    (id: string, additive: boolean) => {
      // While a drawing tool is active a click means "place a point", never "select".
      if (useMeasurementStore.getState().activeTool !== 'select') return;
      if (additive) toggleSelect(id);
      else select([id]);
    },
    [select, toggleSelect],
  );

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const isPanning = activeTool === 'pan';

  if (!page) return null;

  return (
    <div
      ref={containerRef}
      className="mt-canvas"
      style={{ cursor: CURSOR_BY_TOOL[activeTool] }}
      data-tool={activeTool}
    >
      <Stage
        ref={stageRef}
        width={size.width}
        height={size.height}
        scaleX={view.zoom}
        scaleY={view.zoom}
        x={view.x}
        y={view.y}
        draggable={isPanning}
        onDragEnd={(e) => {
          // Vertex drags bubble up to the stage — only commit the stage's own move.
          if (e.target !== e.currentTarget) return;
          setView({ x: e.target.x(), y: e.target.y() });
        }}
        onPointerDown={interaction.onPointerDown}
        onPointerMove={interaction.onPointerMove}
        onPointerUp={interaction.onPointerUp}
        onPointerLeave={interaction.onPointerLeave}
        onDblClick={interaction.onDblClick}
        onDblTap={interaction.onDblClick}
        onContextMenu={interaction.onContextMenu}
        onWheel={interaction.onWheel}
      >
        <Layer listening>
          {image && (
            <KonvaImage
              name="backdrop"
              image={image}
              width={page.width}
              height={page.height}
              listening
            />
          )}
          <GridLayer grid={grid} scale={scale} page={page} zoom={view.zoom} />
        </Layer>

        <Layer>
          {measurements.map((measurement) => {
            const result = results.get(measurement.id);
            if (!result) return null;
            return (
              <MeasurementShape
                key={measurement.id}
                measurement={measurement}
                result={result}
                selected={selectedSet.has(measurement.id)}
                zoom={view.zoom}
                onSelect={handleSelect}
                onVertexMove={moveVertex}
              />
            );
          })}

          <DraftShape
            tool={activeTool}
            points={draft}
            cursor={cursor}
            zoom={view.zoom}
            scale={scale}
            color={activeColor}
          />

          <AutoCountOverlay
            zoom={view.zoom}
            pageSize={page}
            onTemplateResize={resizeTemplate}
            onTemplateResizeEnd={finishResize}
          />
        </Layer>
      </Stage>

      {busy && <div className="mt-canvas__busy">{busy}</div>}
    </div>
  );
}
