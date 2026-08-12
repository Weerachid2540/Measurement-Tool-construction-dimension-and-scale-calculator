import { useMeasurementStore, useUiStore, selectCanRedo, selectCanUndo } from '@/store';
import { useDocumentLoader } from '@/hooks';
import { Button, Checkbox, Icon, NumberInput, Select } from '@/components/common';
import { formatNumber } from '@/utils/format';
import { ScaleControl } from './ScaleControl';
import { ToolBar } from './ToolBar';

export function CanvasToolbar() {
  const doc = useMeasurementStore((s) => s.doc);
  const currentPage = useMeasurementStore((s) => s.currentPage);
  const view = useMeasurementStore((s) => s.view);
  const zoomBy = useMeasurementStore((s) => s.zoomBy);
  const resetView = useMeasurementStore((s) => s.resetView);
  const grid = useMeasurementStore((s) => s.grid);
  const setGrid = useMeasurementStore((s) => s.setGrid);
  const snap = useMeasurementStore((s) => s.snap);
  const setSnap = useMeasurementStore((s) => s.setSnap);
  const undo = useMeasurementStore((s) => s.undo);
  const redo = useMeasurementStore((s) => s.redo);
  const canUndo = useMeasurementStore(selectCanUndo);
  const canRedo = useMeasurementStore(selectCanRedo);
  const mode = useUiStore((s) => s.mode);
  const setMode = useUiStore((s) => s.setMode);
  const { goToPage } = useDocumentLoader();

  const is3d = mode === '3d';

  return (
    <div className="mt-canvas-toolbar">
      {/* เครื่องมือวัดย้ายมาอยู่แถวเดียวกับตัวควบคุมแบบ เพื่อคืนความกว้างทั้งหมดให้พื้นที่วาด */}
      <ToolBar />

      <div className="mt-canvas-toolbar__section">
        <ScaleControl />
      </div>

      <div className="mt-canvas-toolbar__section">
        <div className="mt-btn-group">
          <Button icon="undo" iconOnly onClick={undo} disabled={!canUndo} title="ย้อนกลับ (Ctrl+Z)" />
          <Button icon="redo" iconOnly onClick={redo} disabled={!canRedo} title="ทำซ้ำ (Ctrl+Y)" />
        </div>

        <div className="mt-btn-group">
          <Button icon="zoomOut" iconOnly onClick={() => zoomBy(1 / 1.2)} title="ซูมออก (-)" />
          <span className="mt-zoom-readout">{formatNumber(view.zoom * 100, 0)}%</span>
          <Button icon="zoomIn" iconOnly onClick={() => zoomBy(1.2)} title="ซูมเข้า (+)" />
          <Button
            icon="fit"
            iconOnly
            onClick={() => resetView(currentContainerSize())}
            title="พอดีหน้าจอ (0)"
          />
        </div>

        <div className="mt-inline-group">
          <Button
            icon="grid"
            active={grid.enabled}
            onClick={() => setGrid({ enabled: !grid.enabled })}
            size="sm"
            title="แสดง/ซ่อนเส้นกริด"
          >
            กริด
          </Button>
          {grid.enabled && (
            <>
              <NumberInput
                value={grid.spacing}
                min={0.01}
                step={0.5}
                onValueChange={(spacing) => setGrid({ spacing: spacing > 0 ? spacing : 1 })}
                suffix={grid.unit}
                style={{ width: 76 }}
              />
              <Checkbox
                label="สแนป"
                checked={grid.snapToGrid}
                onCheckedChange={(snapToGrid) => setGrid({ snapToGrid })}
              />
            </>
          )}
          <Checkbox
            label="จับจุด"
            checked={snap.toVertices}
            onCheckedChange={(toVertices) => setSnap({ toVertices })}
          />
        </div>
      </div>

      <div className="mt-canvas-toolbar__section mt-canvas-toolbar__section--end">
        {doc?.kind === 'pdf' && doc.pageCount > 1 && (
          <div className="mt-pager">
            <Button
              icon="chevronLeft"
              iconOnly
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => void goToPage(currentPage - 1)}
              title="หน้าก่อนหน้า"
            />
            {/* เลือกหน้าตรงๆ ได้ ไม่ต้องกดลูกศรทีละหน้าในไฟล์แบบที่มีหลายสิบหน้า */}
            <Select
              value={String(currentPage)}
              options={Array.from({ length: doc.pageCount }, (_, i) => ({
                value: String(i + 1),
                label: `หน้า ${i + 1} / ${doc.pageCount}`,
              }))}
              onValueChange={(value) => void goToPage(Number.parseInt(value, 10))}
              aria-label="เลือกหน้า"
            />
            <Button
              icon="chevronRight"
              iconOnly
              size="sm"
              disabled={currentPage >= doc.pageCount}
              onClick={() => void goToPage(currentPage + 1)}
              title="หน้าถัดไป"
            />
          </div>
        )}

        <div className="mt-btn-group">
          <Button size="sm" active={!is3d} onClick={() => setMode('2d')} title="โหมด 2D">
            <Icon name="layers" size={16} />
            2D
          </Button>
          <Button size="sm" active={is3d} onClick={() => setMode('3d')} title="โหมด 3D">
            <Icon name="cube" size={16} />
            3D
          </Button>
        </div>
      </div>
    </div>
  );
}

/** The canvas element owns its size; read it back for "fit to screen". */
function currentContainerSize(): { width: number; height: number } | undefined {
  const element = document.querySelector<HTMLElement>('.mt-canvas');
  if (!element) return undefined;
  return { width: element.clientWidth, height: element.clientHeight };
}
