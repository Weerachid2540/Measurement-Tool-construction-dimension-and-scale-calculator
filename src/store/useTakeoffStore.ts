import { create } from 'zustand';
import type { TakeoffLine, TakeoffOpening } from '@/types';
import { takeoffItem } from '@/types';
import { createId } from '@/utils/id';
import { newOpening, newTakeoffLine } from '@/utils/takeoff';

/**
 * ตารางถอดแบบ — เก็บใน localStorage ของเครื่อง ไม่ผูกกับไฟล์แบบที่เปิดอยู่
 * เพราะถอดแบบด้วยตัวเลขจากแบบพิมพ์ได้โดยไม่ต้องเปิดไฟล์เลย
 */
const STORAGE_KEY = 'measurement-tool.takeoff';

interface TakeoffState {
  lines: TakeoffLine[];
  projectName: string;
  /** แถวที่กำลังกางดูรายละเอียด */
  expandedId: string | null;
}

interface TakeoffActions {
  addLine: (itemId: string, label?: string) => void;
  duplicateLine: (id: string) => void;
  updateLine: (id: string, patch: Partial<Omit<TakeoffLine, 'id' | 'itemId'>>) => void;
  setValue: (id: string, key: string, value: number) => void;
  removeLine: (id: string) => void;
  addOpening: (id: string, label?: string) => void;
  updateOpening: (id: string, openingId: string, patch: Partial<Omit<TakeoffOpening, 'id'>>) => void;
  removeOpening: (id: string, openingId: string) => void;
  setProjectName: (name: string) => void;
  setExpanded: (id: string | null) => void;
  clearAll: () => void;
}

export type TakeoffStore = TakeoffState & TakeoffActions;

const readStored = (): Pick<TakeoffState, 'lines' | 'projectName'> => {
  if (typeof localStorage === 'undefined') return { lines: [], projectName: '' };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { lines: [], projectName: '' };
    const parsed = JSON.parse(raw) as Partial<TakeoffState>;
    // ทิ้งแถวที่อ้างรายการงานที่ไม่มีแล้ว (เช่นหลังอัปเดตชุดรายการ) แทนที่จะพังทั้งหน้า
    const lines = Array.isArray(parsed.lines) ? parsed.lines.filter((l) => takeoffItem(l.itemId)) : [];
    return { lines, projectName: parsed.projectName ?? '' };
  } catch {
    return { lines: [], projectName: '' };
  }
};

const persist = (lines: TakeoffLine[], projectName: string): void => {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ lines, projectName }));
  } catch {
    // โควตาเต็ม — ปล่อยผ่าน ข้อมูลบนหน้าจอยังใช้งานได้ตามปกติ
  }
};

/** ทุก action ที่แก้ข้อมูลผ่านตัวนี้เพื่อให้เซฟลง localStorage ที่เดียว */
const commit = (
  set: (fn: (state: TakeoffStore) => Partial<TakeoffStore>) => void,
  update: (state: TakeoffStore) => Partial<TakeoffState>,
): void => {
  set((state) => {
    const patch = update(state);
    persist(patch.lines ?? state.lines, patch.projectName ?? state.projectName);
    return patch;
  });
};

const mapLine = (
  lines: TakeoffLine[],
  id: string,
  fn: (line: TakeoffLine) => TakeoffLine,
): TakeoffLine[] => lines.map((line) => (line.id === id ? fn(line) : line));

export const useTakeoffStore = create<TakeoffStore>((set) => ({
  ...readStored(),
  expandedId: null,

  addLine: (itemId, label = '') => {
    const item = takeoffItem(itemId);
    if (!item) return;
    const line = newTakeoffLine(item, label);
    commit(set, (state) => ({ lines: [...state.lines, line] }));
    set({ expandedId: line.id });
  },

  duplicateLine: (id) =>
    commit(set, (state) => {
      const source = state.lines.find((l) => l.id === id);
      if (!source) return {};
      const copy: TakeoffLine = {
        ...source,
        id: createId('tk'),
        values: { ...source.values },
        openings: source.openings.map((o) => ({ ...o, id: createId('op') })),
      };
      const index = state.lines.findIndex((l) => l.id === id);
      const lines = [...state.lines];
      lines.splice(index + 1, 0, copy);
      return { lines };
    }),

  updateLine: (id, patch) =>
    commit(set, (state) => ({ lines: mapLine(state.lines, id, (line) => ({ ...line, ...patch })) })),

  setValue: (id, key, value) =>
    commit(set, (state) => ({
      lines: mapLine(state.lines, id, (line) => ({
        ...line,
        values: { ...line.values, [key]: value },
      })),
    })),

  removeLine: (id) => commit(set, (state) => ({ lines: state.lines.filter((l) => l.id !== id) })),

  addOpening: (id, label) =>
    commit(set, (state) => ({
      lines: mapLine(state.lines, id, (line) => ({
        ...line,
        openings: [...line.openings, newOpening(label)],
      })),
    })),

  updateOpening: (id, openingId, patch) =>
    commit(set, (state) => ({
      lines: mapLine(state.lines, id, (line) => ({
        ...line,
        openings: line.openings.map((o) => (o.id === openingId ? { ...o, ...patch } : o)),
      })),
    })),

  removeOpening: (id, openingId) =>
    commit(set, (state) => ({
      lines: mapLine(state.lines, id, (line) => ({
        ...line,
        openings: line.openings.filter((o) => o.id !== openingId),
      })),
    })),

  setProjectName: (projectName) => commit(set, () => ({ projectName })),

  setExpanded: (expandedId) => set({ expandedId }),

  clearAll: () => commit(set, () => ({ lines: [] })),
}));
