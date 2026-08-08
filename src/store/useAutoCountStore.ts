import { create } from 'zustand';
import type { BBox, Point } from '@/types';
import type { SearchHandle } from '@/utils/symbolMatch';
import type { SymbolMatch, SymbolSearchOptions } from '@/utils/symbolMatch';
import { DEFAULT_SEARCH_OPTIONS } from '@/utils/symbolMatch';

export type AutoCountStage = 'idle' | 'selecting' | 'ready' | 'searching' | 'review';

interface AutoCountState {
  stage: AutoCountStage;
  /** Region the user dragged around one instance of the symbol. */
  templateBox: BBox | null;
  templatePreview: string | null;
  /** Live drag rectangle, before the user releases. */
  dragStart: Point | null;
  dragCurrent: Point | null;
  options: SymbolSearchOptions;
  matches: SymbolMatch[];
  /** Parallel to `matches` — lets the user veto false positives before committing. */
  accepted: boolean[];
  progress: number;
  error: string | null;
  /** Held so the search can be cancelled; never rendered. */
  handle: SearchHandle | null;
}

interface AutoCountActions {
  beginSelection: () => void;
  setDrag: (start: Point | null, current: Point | null) => void;
  setTemplate: (box: BBox, preview: string) => void;
  setOptions: (patch: Partial<SymbolSearchOptions>) => void;
  startSearch: (handle: SearchHandle) => void;
  setProgress: (progress: number) => void;
  setMatches: (matches: SymbolMatch[]) => void;
  setError: (message: string | null) => void;
  toggleMatch: (index: number) => void;
  setAllAccepted: (value: boolean) => void;
  cancelSearch: () => void;
  reset: () => void;
}

export type AutoCountStore = AutoCountState & AutoCountActions;

const initialState: AutoCountState = {
  stage: 'idle',
  templateBox: null,
  templatePreview: null,
  dragStart: null,
  dragCurrent: null,
  options: { ...DEFAULT_SEARCH_OPTIONS },
  matches: [],
  accepted: [],
  progress: 0,
  error: null,
  handle: null,
};

export const useAutoCountStore = create<AutoCountStore>((set, get) => ({
  ...initialState,

  beginSelection: () =>
    set({
      ...initialState,
      options: get().options,
      stage: 'selecting',
    }),

  setDrag: (dragStart, dragCurrent) => set({ dragStart, dragCurrent }),

  setTemplate: (templateBox, templatePreview) =>
    set({
      templateBox,
      templatePreview,
      stage: 'ready',
      dragStart: null,
      dragCurrent: null,
      matches: [],
      accepted: [],
      error: null,
    }),

  setOptions: (patch) => set((state) => ({ options: { ...state.options, ...patch } })),

  startSearch: (handle) => set({ stage: 'searching', progress: 0, error: null, handle }),

  setProgress: (progress) => set({ progress }),

  setMatches: (matches) =>
    set({
      matches,
      accepted: matches.map(() => true),
      stage: 'review',
      progress: 100,
      handle: null,
    }),

  setError: (error) =>
    set((state) => ({
      error,
      stage: error ? (state.templateBox ? 'ready' : 'selecting') : state.stage,
      handle: null,
    })),

  toggleMatch: (index) =>
    set((state) => {
      const accepted = [...state.accepted];
      accepted[index] = !accepted[index];
      return { accepted };
    }),

  setAllAccepted: (value) =>
    set((state) => ({ accepted: state.matches.map(() => value) })),

  cancelSearch: () => {
    get().handle?.cancel();
    set({ stage: get().templateBox ? 'ready' : 'selecting', handle: null, progress: 0 });
  },

  reset: () => {
    get().handle?.cancel();
    set({ ...initialState, options: get().options });
  },
}));

/** Points to commit, in image space. */
export const selectAcceptedPoints = (state: AutoCountStore): Point[] =>
  state.matches.filter((_, index) => state.accepted[index]).map(({ x, y }) => ({ x, y }));

export const selectAcceptedCount = (state: AutoCountStore): number =>
  state.accepted.reduce((total, value) => total + (value ? 1 : 0), 0);
