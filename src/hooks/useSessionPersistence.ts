import { useCallback, useEffect } from 'react';
import type { MeasurementSession } from '@/types';
import { useMeasurementStore, useSessionStore, useUiStore } from '@/store';
import { createId } from '@/utils/id';
import { makeThumbnail } from '@/utils/fileLoader';

/** Save / load / delete of measuring sessions, wired to IndexedDB. */
export function useSessionPersistence() {
  const refresh = useSessionStore((s) => s.refresh);
  const saveSession = useSessionStore((s) => s.save);
  const removeSession = useSessionStore((s) => s.remove);
  const notify = useUiStore((s) => s.notify);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const save = useCallback(async (): Promise<void> => {
    const state = useMeasurementStore.getState();
    if (!state.doc || !state.page) {
      notify('ยังไม่ได้เปิดไฟล์แบบ', 'error');
      return;
    }

    const now = Date.now();
    const id = state.sessionId ?? createId('s');
    const existing = useSessionStore.getState().sessions.find((s) => s.id === id);

    let thumbnail = existing?.thumbnail;
    if (!thumbnail) {
      thumbnail = await makeThumbnail(state.page.src).catch(() => undefined);
    }

    const session: MeasurementSession = {
      id,
      name: state.sessionName.trim() || 'การวัดใหม่',
      projectName: state.projectName,
      documentName: state.doc.name,
      documentKind: state.doc.kind,
      pageCount: state.doc.pageCount,
      thumbnail,
      scale: { ...state.scale },
      measurements: state.measurements.map((m) => ({ ...m })),
      tags: existing?.tags ?? [],
      notes: existing?.notes,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    await saveSession(session);
    useMeasurementStore.getState().markSaved(id);
    notify(`บันทึก "${session.name}" แล้ว`, 'success');
  }, [notify, saveSession]);

  const load = useCallback(
    (session: MeasurementSession): void => {
      useMeasurementStore.getState().loadSession(session);
      notify(
        `เปิด "${session.name}" แล้ว — หากต้องการดูแบบ กรุณาเปิดไฟล์ ${session.documentName} อีกครั้ง`,
        'info',
      );
    },
    [notify],
  );

  const remove = useCallback(
    async (id: string): Promise<void> => {
      await removeSession(id);
      // The open session no longer has a saved counterpart — treat it as unsaved.
      if (useMeasurementStore.getState().sessionId === id) {
        useMeasurementStore.setState({ sessionId: null, isDirty: true });
      }
      notify('ลบประวัติการวัดแล้ว', 'success');
    },
    [notify, removeSession],
  );

  return { save, load, remove };
}
