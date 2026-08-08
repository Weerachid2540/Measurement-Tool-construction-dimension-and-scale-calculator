import { useCallback } from 'react';
import type { Measurement } from '@/types';
import {
  selectAcceptedPoints,
  useAutoCountStore,
  useMeasurementStore,
  useUiStore,
} from '@/store';
import { getDrawingImage } from '@/components/Canvas/stageRegistry';
import { findSymbols, normaliseBox, templatePreview } from '@/utils/symbolMatch';
import { createId } from '@/utils/id';
import { defaultColorFor } from '@/utils/colors';
import { nextLabel } from '@/utils/measurement';

/** A selection smaller than this is almost certainly a stray click, not a symbol. */
const MIN_TEMPLATE_PX = 6;

export function useAutoCount() {
  const notify = useUiStore((s) => s.notify);

  /** Turns the drag rectangle into the template to search for. */
  const commitSelection = useCallback((): boolean => {
    const { dragStart, dragCurrent, setTemplate, setDrag } = useAutoCountStore.getState();
    const image = getDrawingImage();
    setDrag(null, null);
    if (!dragStart || !dragCurrent || !image) return false;

    const box = normaliseBox(dragStart, dragCurrent, image.naturalWidth, image.naturalHeight);
    if (box.width < MIN_TEMPLATE_PX || box.height < MIN_TEMPLATE_PX) {
      notify('กรอบเล็กเกินไป — ลากให้คลุมสัญลักษณ์ทั้งตัว', 'error');
      return false;
    }

    setTemplate(box, templatePreview(image, box));
    return true;
  }, [notify]);

  const search = useCallback(async (): Promise<void> => {
    const store = useAutoCountStore.getState();
    const image = getDrawingImage();
    if (!store.templateBox || !image) {
      notify('ยังไม่ได้เลือกสัญลักษณ์', 'error');
      return;
    }

    const handle = findSymbols(image, store.templateBox, store.options, (percent) =>
      useAutoCountStore.getState().setProgress(percent),
    );
    useAutoCountStore.getState().startSearch(handle);

    try {
      const matches = await handle.result;
      useAutoCountStore.getState().setMatches(matches);
      notify(
        matches.length > 0
          ? `พบสัญลักษณ์ที่คล้ายกัน ${matches.length} จุด — ตรวจสอบแล้วกดยืนยัน`
          : 'ไม่พบสัญลักษณ์ที่ตรงกัน ลองลดค่าความคล้ายลง',
        matches.length > 0 ? 'success' : 'info',
      );
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      const message = error instanceof Error ? error.message : 'ค้นหาไม่สำเร็จ';
      useAutoCountStore.getState().setError(message);
      notify(message, 'error');
    }
  }, [notify]);

  /** Writes the approved hits into the drawing as a single count measurement. */
  const commit = useCallback((): void => {
    const points = selectAcceptedPoints(useAutoCountStore.getState());
    if (points.length === 0) {
      notify('ยังไม่ได้เลือกจุดที่จะบันทึก', 'error');
      return;
    }

    const measurementStore = useMeasurementStore.getState();
    const now = Date.now();
    const measurement: Measurement = {
      id: createId('m'),
      page: measurementStore.currentPage,
      type: 'count',
      label: nextLabel('count', measurementStore.measurements),
      points,
      color: measurementStore.activeColor ?? defaultColorFor('count'),
      notes: 'นับอัตโนมัติจากสัญลักษณ์ต้นแบบ',
      visible: true,
      locked: false,
      createdAt: now,
      updatedAt: now,
    };

    measurementStore.addMeasurement(measurement);
    measurementStore.select([measurement.id]);
    useAutoCountStore.getState().reset();
    measurementStore.setTool('select');
    notify(`บันทึก ${points.length} จุดเป็นรายการ ${measurement.label}`, 'success');
  }, [notify]);

  return { commitSelection, search, commit };
}
