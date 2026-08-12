import { create } from 'zustand';
import type { CostEntry, CostKind } from '@/types';
import { createId } from '@/utils/id';
import { newCostEntry } from '@/utils/cost';

/** ต้นทุนผูกกับโครงการ ไม่ใช่ไฟล์แบบ จึงเก็บใน localStorage เหมือนตารางถอดแบบ */
const STORAGE_KEY = 'measurement-tool.cost';

interface CostState {
  entries: CostEntry[];
  projectName: string;
}

interface CostActions {
  addEntry: (kind: CostKind) => void;
  updateEntry: (id: string, patch: Partial<Omit<CostEntry, 'id' | 'kind'>>) => void;
  duplicateEntry: (id: string) => void;
  removeEntry: (id: string) => void;
  setProjectName: (name: string) => void;
  clearAll: () => void;
}

export type CostStore = CostState & CostActions;

const readStored = (): CostState => {
  if (typeof localStorage === 'undefined') return { entries: [], projectName: '' };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { entries: [], projectName: '' };
    const parsed = JSON.parse(raw) as Partial<CostState>;
    const entries = Array.isArray(parsed.entries) ? parsed.entries : [];
    return {
      // ค่าวัสดุเคยกรอกเป็นจำนวน × ราคาต่อหน่วย ย้ายมาเป็นยอดรวมช่องเดียว
      entries: entries.map((entry) =>
        entry.kind === 'material' && entry.amount === undefined
          ? { ...entry, amount: entry.quantity * entry.unitPrice }
          : entry,
      ),
      projectName: parsed.projectName ?? '',
    };
  } catch {
    return { entries: [], projectName: '' };
  }
};

const persist = (entries: CostEntry[], projectName: string): void => {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ entries, projectName }));
  } catch {
    // โควตาเต็ม — ข้อมูลบนหน้าจอยังใช้ได้ตามปกติ
  }
};

export const useCostStore = create<CostStore>((set) => {
  /** ทุก action ที่แก้ข้อมูลผ่านตัวนี้ เพื่อให้เซฟลง localStorage ที่เดียว */
  const commit = (update: (state: CostStore) => Partial<CostState>) =>
    set((state) => {
      const patch = update(state);
      persist(patch.entries ?? state.entries, patch.projectName ?? state.projectName);
      return patch;
    });

  return {
    ...readStored(),

    addEntry: (kind) => commit((state) => ({ entries: [...state.entries, newCostEntry(kind)] })),

    updateEntry: (id, patch) =>
      commit((state) => ({
        entries: state.entries.map((e) => (e.id === id ? { ...e, ...patch } : e)),
      })),

    duplicateEntry: (id) =>
      commit((state) => {
        const index = state.entries.findIndex((e) => e.id === id);
        if (index < 0) return {};
        const entries = [...state.entries];
        entries.splice(index + 1, 0, { ...state.entries[index], id: createId('cost') });
        return { entries };
      }),

    removeEntry: (id) => commit((state) => ({ entries: state.entries.filter((e) => e.id !== id) })),

    setProjectName: (projectName) => commit(() => ({ projectName })),

    clearAll: () => commit(() => ({ entries: [] })),
  };
});
