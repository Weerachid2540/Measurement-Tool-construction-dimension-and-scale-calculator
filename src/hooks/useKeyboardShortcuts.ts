import { useEffect } from 'react';
import type { ToolId } from '@/types';
import { useAutoCountStore, useMeasurementStore, useUiStore } from '@/store';
import { isComplete } from '@/utils/measurement';

export const SHORTCUTS: readonly { keys: string; description: string }[] = [
  { keys: 'V', description: 'เครื่องมือเลือก (Select)' },
  { keys: 'H / Space', description: 'เลื่อนภาพ (Pan)' },
  { keys: 'L', description: 'วัดความยาว (Line)' },
  { keys: 'P', description: 'เส้นต่อเนื่อง (Polyline)' },
  { keys: 'R', description: 'สี่เหลี่ยม (Rectangle)' },
  { keys: 'G', description: 'พื้นที่ (Polygon)' },
  { keys: 'C', description: 'วงกลม (Circle)' },
  { keys: 'A', description: 'มุม/ความลาด (Angle)' },
  { keys: 'N', description: 'นับจำนวน (Count)' },
  { keys: 'M', description: 'นับสัญลักษณ์อัตโนมัติ (Auto-count)' },
  { keys: 'K', description: 'ปรับเทียบมาตราส่วน (Calibrate)' },
  { keys: 'Enter', description: 'จบรูปที่กำลังวาด' },
  { keys: 'Esc', description: 'ยกเลิกรูปที่กำลังวาด / ยกเลิกการเลือก' },
  { keys: 'Backspace', description: 'ลบจุดล่าสุดขณะวาด' },
  { keys: 'Delete', description: 'ลบรายการที่เลือก' },
  { keys: 'Ctrl + Z', description: 'ย้อนกลับ (Undo)' },
  { keys: 'Ctrl + Shift + Z / Ctrl + Y', description: 'ทำซ้ำ (Redo)' },
  { keys: 'Ctrl + D', description: 'ทำสำเนารายการที่เลือก' },
  { keys: 'Ctrl + S', description: 'บันทึกการวัด' },
  { keys: '+ / -', description: 'ซูมเข้า / ออก' },
  { keys: '0', description: 'พอดีหน้าจอ' },
  { keys: 'Shift (ค้างไว้)', description: 'ล็อกมุม 0/45/90°' },
  { keys: '?', description: 'แสดงคีย์ลัด' },
] as const;

const TOOL_KEYS: Record<string, ToolId> = {
  v: 'select',
  h: 'pan',
  l: 'line',
  p: 'polyline',
  r: 'rectangle',
  g: 'polygon',
  c: 'circle',
  a: 'angle',
  n: 'count',
  m: 'autoCount',
  k: 'calibrate',
};

const isTypingTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
  );
};

interface Options {
  onSave: () => void;
  onFitToScreen: () => void;
}

export function useKeyboardShortcuts({ onSave, onFitToScreen }: Options): void {
  useEffect(() => {
    const previousTool = { current: null as ToolId | null };

    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;
      const store = useMeasurementStore.getState();
      const ui = useUiStore.getState();
      const key = event.key.toLowerCase();
      const meta = event.ctrlKey || event.metaKey;

      if (meta) {
        switch (key) {
          case 'z':
            event.preventDefault();
            if (event.shiftKey) store.redo();
            else store.undo();
            return;
          case 'y':
            event.preventDefault();
            store.redo();
            return;
          case 'd':
            event.preventDefault();
            if (store.selectedIds[0]) store.duplicateMeasurement(store.selectedIds[0]);
            return;
          case 's':
            event.preventDefault();
            onSave();
            return;
          case 'a':
            event.preventDefault();
            store.select(
              store.measurements.filter((m) => m.page === store.currentPage).map((m) => m.id),
            );
            return;
          default:
            return;
        }
      }

      switch (event.key) {
        case 'Escape': {
          const autoCount = useAutoCountStore.getState();
          if (store.draft.length > 0) store.cancelDraft();
          else if (ui.modal) ui.closeModal();
          else if (autoCount.stage !== 'idle') autoCount.reset();
          else store.clearSelection();
          return;
        }
        case 'Enter': {
          if (store.draft.length === 0) return;
          const tool = store.activeTool;
          if (
            tool === 'select' ||
            tool === 'pan' ||
            tool === 'calibrate' ||
            tool === 'autoCount'
          ) {
            return;
          }
          if (isComplete(tool, store.draft)) store.commitDraft();
          return;
        }
        case 'Backspace':
          if (store.draft.length > 0) {
            event.preventDefault();
            store.popDraftPoint();
          }
          return;
        case 'Delete':
          if (store.selectedIds.length > 0) store.removeMeasurements(store.selectedIds);
          return;
        case ' ':
          if (store.activeTool !== 'pan') {
            event.preventDefault();
            previousTool.current = store.activeTool;
            store.setTool('pan');
          }
          return;
        case '+':
        case '=':
          store.zoomBy(1.2);
          return;
        case '-':
        case '_':
          store.zoomBy(1 / 1.2);
          return;
        case '0':
          onFitToScreen();
          return;
        case '?':
          ui.openModal('shortcuts');
          return;
        default:
          break;
      }

      const tool = TOOL_KEYS[key];
      if (!tool) return;
      useMeasurementStore.getState().setTool(tool);
      // Auto-count is driven from its panel, so bring it up with the tool.
      if (tool === 'autoCount') {
        useAutoCountStore.getState().beginSelection();
        ui.setPanelTab('autoCount');
      } else {
        useAutoCountStore.getState().reset();
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === ' ' && previousTool.current) {
        useMeasurementStore.getState().setTool(previousTool.current);
        previousTool.current = null;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [onFitToScreen, onSave]);
}
