import { create } from 'zustand';
import type { BBox, Point } from '@/types';
import type { SearchHandle, SymbolMatch, SymbolSearchOptions } from '@/utils/symbolMatch';
import { DEFAULT_SEARCH_OPTIONS } from '@/utils/symbolMatch';

export type AutoCountStage = 'idle' | 'selecting' | 'ready' | 'searching' | 'review';

/** A candidate paired with its index in `allMatches`, which is what the UI toggles on. */
export interface VisibleMatch {
  match: SymbolMatch;
  index: number;
  rejected: boolean;
}

interface AutoCountState {
  stage: AutoCountStage;
  /** Region the user dragged around one instance of the symbol. */
  templateBox: BBox | null;
  templatePreview: string | null;
  /** Live drag rectangle, before the user releases. */
  dragStart: Point | null;
  dragCurrent: Point | null;
  options: SymbolSearchOptions;
  /**
   * Every candidate the worker found, down to a low floor. Raising the threshold
   * filters this list instead of triggering another scan.
   */
  allMatches: SymbolMatch[];
  /** Indices the user vetoed by hand. */
  rejected: number[];
  progress: number;
  error: string | null;
  /** Held so the search can be cancelled; never rendered. */
  handle: SearchHandle | null;
  /** Set when the template came from the library rather than a live crop. */
  libraryItemId: string | null;
  /** True once the box was edited after a search, so results are stale. */
  templateDirty: boolean;
}

interface AutoCountActions {
  beginSelection: () => void;
  setDrag: (start: Point | null, current: Point | null) => void;
  setTemplate: (box: BBox, preview: string) => void;
  /** Live resize of the template box; marks existing results stale. */
  resizeTemplate: (box: BBox, preview: string) => void;
  useLibrarySymbol: (id: string, preview: string) => void;
  setOptions: (patch: Partial<SymbolSearchOptions>) => void;
  startSearch: (handle: SearchHandle) => void;
  setProgress: (progress: number) => void;
  setMatches: (matches: SymbolMatch[]) => void;
  setError: (message: string | null) => void;
  toggleMatch: (index: number) => void;
  rejectAllVisible: () => void;
  clearRejections: () => void;
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
  allMatches: [],
  rejected: [],
  progress: 0,
  error: null,
  handle: null,
  libraryItemId: null,
  templateDirty: false,
};

export const useAutoCountStore = create<AutoCountStore>((set, get) => ({
  ...initialState,

  beginSelection: () => set({ ...initialState, options: get().options, stage: 'selecting' }),

  setDrag: (dragStart, dragCurrent) => set({ dragStart, dragCurrent }),

  setTemplate: (templateBox, templatePreview) =>
    set({
      templateBox,
      templatePreview,
      stage: 'ready',
      dragStart: null,
      dragCurrent: null,
      allMatches: [],
      rejected: [],
      error: null,
      libraryItemId: null,
      templateDirty: false,
    }),

  resizeTemplate: (templateBox, templatePreview) =>
    set((state) => ({
      templateBox,
      templatePreview,
      libraryItemId: null,
      // Keep any existing results on screen but flag them as out of date.
      templateDirty: state.allMatches.length > 0,
    })),

  useLibrarySymbol: (libraryItemId, templatePreview) =>
    set({
      libraryItemId,
      templatePreview,
      templateBox: null,
      stage: 'ready',
      allMatches: [],
      rejected: [],
      error: null,
      templateDirty: false,
      dragStart: null,
      dragCurrent: null,
    }),

  setOptions: (patch) => set((state) => ({ options: { ...state.options, ...patch } })),

  startSearch: (handle) => set({ stage: 'searching', progress: 0, error: null, handle }),

  setProgress: (progress) => set({ progress }),

  setMatches: (allMatches) =>
    set({
      allMatches,
      rejected: [],
      stage: 'review',
      progress: 100,
      handle: null,
      templateDirty: false,
    }),

  setError: (error) =>
    set((state) => ({
      error,
      stage: error ? (state.templateBox ? 'ready' : 'selecting') : state.stage,
      handle: null,
    })),

  toggleMatch: (index) =>
    set((state) => ({
      rejected: state.rejected.includes(index)
        ? state.rejected.filter((i) => i !== index)
        : [...state.rejected, index],
    })),

  rejectAllVisible: () =>
    set((state) => ({
      rejected: state.allMatches.map((_, index) => index),
    })),

  clearRejections: () => set({ rejected: [] }),

  cancelSearch: () => {
    get().handle?.cancel();
    set({ stage: get().templateBox ? 'ready' : 'selecting', handle: null, progress: 0 });
  },

  reset: () => {
    get().handle?.cancel();
    set({ ...initialState, options: get().options });
  },
}));

/** Candidates above the current threshold, with their veto state attached. */
export const selectVisibleMatches = (state: AutoCountStore): VisibleMatch[] => {
  const rejected = new Set(state.rejected);
  const visible: VisibleMatch[] = [];
  state.allMatches.forEach((match, index) => {
    if (match.score < state.options.threshold) return;
    visible.push({ match, index, rejected: rejected.has(index) });
  });
  return visible;
};

/** Points to commit, in image space. */
export const selectAcceptedPoints = (state: AutoCountStore): Point[] =>
  selectVisibleMatches(state)
    .filter((item) => !item.rejected)
    .map((item) => ({ x: item.match.x, y: item.match.y }));

export const selectAcceptedCount = (state: AutoCountStore): number =>
  selectVisibleMatches(state).reduce((total, item) => total + (item.rejected ? 0 : 1), 0);
