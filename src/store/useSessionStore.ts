import { create } from 'zustand';
import type { MeasurementSession, SessionFilter } from '@/types';
import { DEFAULT_SESSION_FILTER } from '@/types';
import {
  clearAllSessions,
  deleteSession,
  filterSessions,
  getAllSessions,
  importSessionsJson,
  putSession,
} from '@/utils/db';

interface SessionStoreState {
  sessions: MeasurementSession[];
  filter: SessionFilter;
  loading: boolean;
  error: string | null;
}

interface SessionStoreActions {
  refresh: () => Promise<void>;
  save: (session: MeasurementSession) => Promise<void>;
  remove: (id: string) => Promise<void>;
  clear: () => Promise<void>;
  importJson: (json: string) => Promise<number>;
  setFilter: (patch: Partial<SessionFilter>) => void;
  resetFilter: () => void;
}

export type SessionStore = SessionStoreState & SessionStoreActions;

export const useSessionStore = create<SessionStore>((set, get) => ({
  sessions: [],
  filter: { ...DEFAULT_SESSION_FILTER },
  loading: false,
  error: null,

  refresh: async () => {
    set({ loading: true, error: null });
    try {
      set({ sessions: await getAllSessions(), loading: false });
    } catch (error) {
      set({ loading: false, error: toMessage(error) });
    }
  },

  save: async (session) => {
    try {
      await putSession(session);
      await get().refresh();
    } catch (error) {
      set({ error: toMessage(error) });
      throw error;
    }
  },

  remove: async (id) => {
    await deleteSession(id);
    await get().refresh();
  },

  clear: async () => {
    await clearAllSessions();
    await get().refresh();
  },

  importJson: async (json) => {
    const count = await importSessionsJson(json);
    await get().refresh();
    return count;
  },

  setFilter: (patch) => set((state) => ({ filter: { ...state.filter, ...patch } })),
  resetFilter: () => set({ filter: { ...DEFAULT_SESSION_FILTER } }),
}));

/** Derived, filtered + sorted view of the history. */
export const selectFilteredSessions = (state: SessionStore): MeasurementSession[] =>
  filterSessions(state.sessions, state.filter);

const toMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'เกิดข้อผิดพลาดที่ไม่รู้จัก';
