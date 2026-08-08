import { useCallback } from 'react';
import type { BBox, Measurement, SymbolCategory, SymbolLibraryItem } from '@/types';
import { categoryPreset } from '@/types';
import {
  selectAcceptedPoints,
  useAutoCountStore,
  useMeasurementStore,
  useSymbolLibraryStore,
  useUiStore,
} from '@/store';
import { getDrawingImage } from '@/components/Canvas/stageRegistry';
import {
  cropToDataUrl,
  findSymbols,
  findSymbolsFromLibrary,
  normaliseBox,
  suggestThreshold,
  templatePreview,
} from '@/utils/symbolMatch';
import { createId } from '@/utils/id';
import { defaultColorFor } from '@/utils/colors';
import { nextLabel } from '@/utils/measurement';
import { loadHtmlImage } from '@/utils/fileLoader';

/** A selection smaller than this is almost certainly a stray click, not a symbol. */
const MIN_TEMPLATE_PX = 6;

export function useAutoCount() {
  const notify = useUiStore((s) => s.notify);
  const saveSymbol = useSymbolLibraryStore((s) => s.save);
  const markUsed = useSymbolLibraryStore((s) => s.markUsed);

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

  /** Live update while a corner handle is being dragged. */
  const resizeTemplate = useCallback((box: BBox): void => {
    useAutoCountStore.setState({ templateBox: box });
  }, []);

  /** Called on release: refresh the preview so the user sees exactly what will be matched. */
  const finishResize = useCallback((): void => {
    const { templateBox, resizeTemplate: applyResize } = useAutoCountStore.getState();
    const image = getDrawingImage();
    if (!templateBox || !image) return;
    applyResize(templateBox, templatePreview(image, templateBox));
  }, []);

  const search = useCallback(async (): Promise<void> => {
    const store = useAutoCountStore.getState();
    const sheet = getDrawingImage();
    if (!sheet) {
      notify('ยังไม่ได้เปิดไฟล์แบบ', 'error');
      return;
    }

    let handle;
    if (store.libraryItemId) {
      const symbol = useSymbolLibraryStore
        .getState()
        .symbols.find((s) => s.id === store.libraryItemId);
      if (!symbol) {
        notify('ไม่พบสัญลักษณ์ในคลัง', 'error');
        return;
      }
      const glyph = await loadHtmlImage(symbol.image).catch(() => null);
      if (!glyph) {
        notify('โหลดภาพสัญลักษณ์จากคลังไม่สำเร็จ', 'error');
        return;
      }
      const { pxPerPaperMm } = useMeasurementStore.getState().scale;
      handle = findSymbolsFromLibrary(
        sheet,
        glyph,
        { width: symbol.paperWidthMm, height: symbol.paperHeightMm },
        pxPerPaperMm,
        store.options,
        (percent) => useAutoCountStore.getState().setProgress(percent),
      );
    } else if (store.templateBox) {
      handle = findSymbols(sheet, store.templateBox, store.options, (percent) =>
        useAutoCountStore.getState().setProgress(percent),
      );
    } else {
      notify('ยังไม่ได้เลือกสัญลักษณ์', 'error');
      return;
    }

    useAutoCountStore.getState().startSearch(handle);

    try {
      const matches = await handle.result;
      const store2 = useAutoCountStore.getState();
      store2.setMatches(matches);

      if (matches.length > 0) {
        // Pick the cut-off from this drawing's own score distribution rather than
        // leaving whatever the user last dragged the slider to.
        const threshold = suggestThreshold(matches.map((m) => m.score));
        store2.setOptions({ threshold });
        const kept = matches.filter((m) => m.score >= threshold).length;
        notify(`พบ ${kept} จุด (ตั้งเกณฑ์อัตโนมัติที่ ${Math.round(threshold * 100)}%)`, 'success');
      } else {
        notify('ไม่พบสัญลักษณ์ที่ตรงกัน ลองเลือกต้นแบบใหม่', 'info');
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      const message = error instanceof Error ? error.message : 'ค้นหาไม่สำเร็จ';
      useAutoCountStore.getState().setError(message);
      notify(message, 'error');
    }
  }, [notify]);

  /** Stores the current template in the reusable library. */
  const saveToLibrary = useCallback(
    async (input: { name: string; code: string; category: SymbolCategory }): Promise<void> => {
      const { templateBox } = useAutoCountStore.getState();
      const image = getDrawingImage();
      if (!templateBox || !image) {
        notify('ยังไม่ได้เลือกสัญลักษณ์จากแบบ', 'error');
        return;
      }

      const { pxPerPaperMm } = useMeasurementStore.getState().scale;
      const preset = categoryPreset(input.category);
      const now = Date.now();

      const symbol: SymbolLibraryItem = {
        id: createId('sym'),
        name: input.name.trim() || `${preset.boqPrefix} ${input.code}`.trim(),
        code: input.code.trim(),
        category: input.category,
        image: cropToDataUrl(image, templateBox),
        // Physical size is what makes the glyph portable to a differently rendered sheet.
        paperWidthMm: templateBox.width / pxPerPaperMm,
        paperHeightMm: templateBox.height / pxPerPaperMm,
        boqDescription: `${preset.boqPrefix} ${input.code}`.trim(),
        unit: preset.unit,
        createdAt: now,
        updatedAt: now,
        usageCount: 0,
      };

      await saveSymbol(symbol);
      useAutoCountStore.setState({ libraryItemId: symbol.id });
      notify(`บันทึก "${symbol.name}" เข้าคลังแล้ว`, 'success');
    },
    [notify, saveSymbol],
  );

  /** Loads a saved symbol as the active template and runs the search. */
  const useFromLibrary = useCallback(
    async (symbol: SymbolLibraryItem): Promise<void> => {
      useMeasurementStore.getState().setTool('autoCount');
      useAutoCountStore.getState().useLibrarySymbol(symbol.id, symbol.image);
      await markUsed(symbol.id);
      await search();
    },
    [markUsed, search],
  );

  /** Writes the approved hits into the drawing as a single count measurement. */
  const commit = useCallback((): void => {
    const state = useAutoCountStore.getState();
    const points = selectAcceptedPoints(state);
    if (points.length === 0) {
      notify('ยังไม่ได้เลือกจุดที่จะบันทึก', 'error');
      return;
    }

    const symbol = state.libraryItemId
      ? useSymbolLibraryStore.getState().symbols.find((s) => s.id === state.libraryItemId)
      : undefined;

    const measurementStore = useMeasurementStore.getState();
    const now = Date.now();
    const measurement: Measurement = {
      id: createId('m'),
      page: measurementStore.currentPage,
      type: 'count',
      label: symbol?.code || nextLabel('count', measurementStore.measurements),
      points,
      color: measurementStore.activeColor ?? defaultColorFor('count'),
      notes: symbol?.boqDescription ?? 'นับอัตโนมัติจากสัญลักษณ์ต้นแบบ',
      material: symbol?.unitPrice !== undefined
        ? { kind: 'custom', name: symbol.boqDescription, unitPrice: symbol.unitPrice }
        : undefined,
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

  return { commitSelection, resizeTemplate, finishResize, search, saveToLibrary, useFromLibrary, commit };
}
