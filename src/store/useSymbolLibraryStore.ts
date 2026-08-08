import { create } from 'zustand';
import type { SymbolLibraryFilter, SymbolLibraryItem } from '@/types';
import { DEFAULT_SYMBOL_FILTER } from '@/types';
import { deleteSymbol, filterSymbols, getAllSymbols, putSymbol } from '@/utils/db';

interface SymbolLibraryState {
  symbols: SymbolLibraryItem[];
  filter: SymbolLibraryFilter;
  loading: boolean;
  error: string | null;
}

interface SymbolLibraryActions {
  refresh: () => Promise<void>;
  save: (symbol: SymbolLibraryItem) => Promise<void>;
  remove: (id: string) => Promise<void>;
  /** Records that a symbol was used, which drives the most-used ordering. */
  markUsed: (id: string) => Promise<void>;
  setFilter: (patch: Partial<SymbolLibraryFilter>) => void;
}

export type SymbolLibraryStore = SymbolLibraryState & SymbolLibraryActions;

export const useSymbolLibraryStore = create<SymbolLibraryStore>((set, get) => ({
  symbols: [],
  filter: { ...DEFAULT_SYMBOL_FILTER },
  loading: false,
  error: null,

  refresh: async () => {
    set({ loading: true, error: null });
    try {
      set({ symbols: await getAllSymbols(), loading: false });
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : 'โหลดคลังสัญลักษณ์ไม่สำเร็จ',
      });
    }
  },

  save: async (symbol) => {
    await putSymbol(symbol);
    await get().refresh();
  },

  remove: async (id) => {
    await deleteSymbol(id);
    await get().refresh();
  },

  markUsed: async (id) => {
    const symbol = get().symbols.find((s) => s.id === id);
    if (!symbol) return;
    await putSymbol({ ...symbol, usageCount: symbol.usageCount + 1, updatedAt: Date.now() });
    await get().refresh();
  },

  setFilter: (patch) => set((state) => ({ filter: { ...state.filter, ...patch } })),
}));

export const selectFilteredSymbols = (state: SymbolLibraryStore): SymbolLibraryItem[] =>
  filterSymbols(state.symbols, state.filter);
