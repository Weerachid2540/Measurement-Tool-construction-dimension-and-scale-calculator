import { useCallback } from 'react';
import { useMeasurementStore, useUiStore } from '@/store';
import { detectKind, loadDocument, renderPdfPage } from '@/utils/fileLoader';

/** Opens a drawing (PDF/JPG/PNG) or switches the workspace to 3D for a model file. */
export function useDocumentLoader() {
  const setDocument = useMeasurementStore((s) => s.setDocument);
  const setPage = useMeasurementStore((s) => s.setPage);
  const setMode = useUiStore((s) => s.setMode);
  const setBusy = useUiStore((s) => s.setBusy);
  const notify = useUiStore((s) => s.notify);

  const open = useCallback(
    async (file: File): Promise<void> => {
      try {
        if (detectKind(file) === 'model3d') {
          setMode('3d');
          notify('เปิดโหมด 3D — เลือกไฟล์โมเดลอีกครั้งในหน้าต่าง 3D', 'info');
          return;
        }

        // เปิดแบบใหม่แล้ว setDocument ล้างการวัดกับ undo/redo ทิ้งทั้งหมด ต้องถามก่อน
        // ไม่งั้นกดพลาดครั้งเดียวงานหายหมด (ปุ่ม "เริ่มการวัดใหม่" ก็ถามแบบเดียวกัน)
        const { doc: openDoc, isDirty } = useMeasurementStore.getState();
        if (
          openDoc &&
          isDirty &&
          !window.confirm('การวัดที่ยังไม่บันทึกจะหายไป — เปิดไฟล์ใหม่หรือไม่?')
        ) {
          return;
        }

        setBusy(`กำลังเปิด ${file.name}…`);
        const { doc, page } = await loadDocument(file);
        setDocument(doc, page);
        setMode('2d');
        notify(
          doc.kind === 'pdf'
            ? `เปิด ${doc.name} (${doc.pageCount} หน้า) — มาตราส่วนอ้างอิงกระดาษพร้อมใช้งาน`
            : `เปิด ${doc.name} — แนะนำให้ปรับเทียบมาตราส่วนก่อนวัด`,
          'success',
        );
      } catch (error) {
        notify(error instanceof Error ? error.message : 'เปิดไฟล์ไม่สำเร็จ', 'error');
      } finally {
        setBusy(null);
      }
    },
    [notify, setBusy, setDocument, setMode],
  );

  const goToPage = useCallback(
    async (pageNumber: number): Promise<void> => {
      const { doc, currentPage } = useMeasurementStore.getState();
      if (!doc || doc.kind !== 'pdf') return;
      const target = Math.min(Math.max(1, pageNumber), doc.pageCount);
      if (target === currentPage) return;
      try {
        setBusy(`กำลังเปิดหน้า ${target}…`);
        setPage(await renderPdfPage(target));
      } catch (error) {
        notify(error instanceof Error ? error.message : 'เปิดหน้าไม่สำเร็จ', 'error');
      } finally {
        setBusy(null);
      }
    },
    [notify, setBusy, setPage],
  );

  return { open, goToPage };
}
