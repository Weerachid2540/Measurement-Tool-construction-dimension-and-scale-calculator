import { create } from 'zustand';
import type { BoqOptions } from '@/types';
import { DEFAULT_BOQ_OPTIONS } from '@/utils/boq';
import { createId } from '@/utils/id';

export type PanelTab =
  | 'measurements'
  | 'properties'
  | 'autoCount'
  | 'takeoff'
  | 'cost'
  | 'boq'
  | 'history';
export type WorkspaceMode = '2d' | '3d';
export type ThemeMode = 'dark' | 'light';

export interface Toast {
  id: string;
  message: string;
  tone: 'info' | 'success' | 'error';
}

export type ModalId =
  | 'calibrate'
  | 'saveSession'
  | 'boqOptions'
  | 'shortcuts'
  | 'saveSymbol'
  | 'about'
  | 'preview'
  | null;

/** เอกสารที่กำลังพรีวิวก่อนส่งออก */
export type PreviewKind = 'takeoff' | 'cost' | 'boq';

interface UiState {
  mode: WorkspaceMode;
  theme: ThemeMode;
  panelTab: PanelTab;
  panelOpen: boolean;
  modal: ModalId;
  toasts: Toast[];
  boqOptions: BoqOptions;
  busy: string | null;
  previewKind: PreviewKind | null;
}

interface UiActions {
  setMode: (mode: WorkspaceMode) => void;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  setPanelTab: (tab: PanelTab) => void;
  setPanelOpen: (open: boolean) => void;
  togglePanel: () => void;
  openModal: (modal: Exclude<ModalId, null>) => void;
  closeModal: () => void;
  notify: (message: string, tone?: Toast['tone']) => void;
  dismissToast: (id: string) => void;
  setBoqOptions: (patch: Partial<BoqOptions>) => void;
  setBusy: (label: string | null) => void;
  openPreview: (kind: PreviewKind) => void;
}

export type UiStore = UiState & UiActions;

const THEME_KEY = 'measurement-tool.theme';

const readStoredTheme = (): ThemeMode => {
  if (typeof localStorage === 'undefined') return 'dark';
  const stored = localStorage.getItem(THEME_KEY);
  return stored === 'light' || stored === 'dark' ? stored : 'dark';
};

const persistTheme = (theme: ThemeMode): void => {
  if (typeof localStorage !== 'undefined') localStorage.setItem(THEME_KEY, theme);
  if (typeof document !== 'undefined') document.documentElement.dataset.theme = theme;
};

export const useUiStore = create<UiStore>((set, get) => ({
  mode: '2d',
  theme: readStoredTheme(),
  panelTab: 'measurements',
  panelOpen: true,
  modal: null,
  toasts: [],
  boqOptions: { ...DEFAULT_BOQ_OPTIONS },
  busy: null,
  previewKind: null,

  setMode: (mode) => set({ mode }),

  setTheme: (theme) => {
    persistTheme(theme);
    set({ theme });
  },

  toggleTheme: () => get().setTheme(get().theme === 'dark' ? 'light' : 'dark'),

  setPanelTab: (panelTab) => set({ panelTab, panelOpen: true }),
  setPanelOpen: (panelOpen) => set({ panelOpen }),
  togglePanel: () => set((state) => ({ panelOpen: !state.panelOpen })),

  openModal: (modal) => set({ modal }),
  closeModal: () => set({ modal: null }),

  notify: (message, tone = 'info') => {
    const toast: Toast = { id: createId('t'), message, tone };
    set((state) => ({ toasts: [...state.toasts, toast] }));
    window.setTimeout(() => get().dismissToast(toast.id), 4000);
  },

  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),

  setBoqOptions: (patch) => set((state) => ({ boqOptions: { ...state.boqOptions, ...patch } })),

  setBusy: (busy) => set({ busy }),

  openPreview: (previewKind) => set({ previewKind, modal: 'preview' }),
}));

// Apply the persisted theme before React paints.
if (typeof document !== 'undefined') {
  document.documentElement.dataset.theme = readStoredTheme();
}
