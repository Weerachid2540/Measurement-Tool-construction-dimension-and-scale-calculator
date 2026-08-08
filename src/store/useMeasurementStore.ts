import { create } from 'zustand';
import type {
  GridSettings,
  LengthUnit,
  Measurement,
  MeasurementSession,
  MeasurementType,
  Point,
  RenderedPage,
  ScaleSettings,
  SnapSettings,
  SourceDocument,
  ToolId,
  Viewport,
} from '@/types';
import { DEFAULT_GRID, DEFAULT_SNAP, ZOOM_LIMITS } from '@/types';
import { clamp } from '@/utils/geometry';
import { createId } from '@/utils/id';
import { defaultColorFor } from '@/utils/colors';
import { isComplete, nextLabel } from '@/utils/measurement';
import { DEFAULT_SCALE, scaleFromPresetId } from '@/utils/scale';

const HISTORY_LIMIT = 60;

interface DocumentState {
  doc: SourceDocument | null;
  page: RenderedPage | null;
  currentPage: number;
}

interface MeasurementStoreState extends DocumentState {
  scale: ScaleSettings;
  measurements: Measurement[];
  /** Points of the shape currently being drawn. */
  draft: Point[];
  /** Live cursor position in image space, used for the rubber-band preview. */
  cursor: Point | null;
  activeTool: ToolId;
  activeColor: string | null;
  selectedIds: string[];
  view: Viewport;
  grid: GridSettings;
  snap: SnapSettings;
  sessionId: string | null;
  sessionName: string;
  projectName: string;
  isDirty: boolean;
  past: Measurement[][];
  future: Measurement[][];
}

interface MeasurementStoreActions {
  setDocument: (doc: SourceDocument, page: RenderedPage) => void;
  setPage: (page: RenderedPage) => void;
  closeDocument: () => void;

  setTool: (tool: ToolId) => void;
  setActiveColor: (color: string | null) => void;
  setCursor: (point: Point | null) => void;

  addDraftPoint: (point: Point) => void;
  updateLastDraftPoint: (point: Point) => void;
  commitDraft: () => Measurement | null;
  cancelDraft: () => void;
  popDraftPoint: () => void;

  addMeasurement: (measurement: Measurement) => void;
  updateMeasurement: (id: string, patch: Partial<Measurement>) => void;
  moveVertex: (id: string, index: number, point: Point) => void;
  removeMeasurements: (ids: string[]) => void;
  duplicateMeasurement: (id: string) => void;
  clearMeasurements: () => void;

  select: (ids: string[]) => void;
  toggleSelect: (id: string) => void;
  clearSelection: () => void;

  setScale: (patch: Partial<ScaleSettings>) => void;
  setScalePreset: (presetId: string) => void;
  setDisplayUnit: (unit: LengthUnit) => void;

  setView: (view: Partial<Viewport>) => void;
  zoomBy: (factor: number, focus?: Point) => void;
  resetView: (containerSize?: { width: number; height: number }) => void;

  setGrid: (patch: Partial<GridSettings>) => void;
  setSnap: (patch: Partial<SnapSettings>) => void;

  undo: () => void;
  redo: () => void;

  setSessionMeta: (patch: { sessionName?: string; projectName?: string }) => void;
  markSaved: (sessionId: string) => void;
  loadSession: (session: MeasurementSession) => void;
  newSession: () => void;
}

export type MeasurementStore = MeasurementStoreState & MeasurementStoreActions;

const initialState: MeasurementStoreState = {
  doc: null,
  page: null,
  currentPage: 1,
  scale: { ...DEFAULT_SCALE },
  measurements: [],
  draft: [],
  cursor: null,
  activeTool: 'select',
  activeColor: null,
  selectedIds: [],
  view: { zoom: 1, x: 0, y: 0 },
  grid: { ...DEFAULT_GRID },
  snap: { ...DEFAULT_SNAP },
  sessionId: null,
  sessionName: 'การวัดใหม่',
  projectName: '',
  isDirty: false,
  past: [],
  future: [],
};

/** Drops points that land on top of their predecessor (within half an image pixel). */
function dedupeConsecutive(points: Point[]): Point[] {
  const result: Point[] = [];
  for (const point of points) {
    const previous = result[result.length - 1];
    if (previous && Math.hypot(point.x - previous.x, point.y - previous.y) < 0.5) continue;
    result.push({ ...point });
  }
  return result;
}

/** Snapshot the measurement list before a mutation so undo/redo stays trivial. */
function pushHistory(state: MeasurementStoreState): Pick<
  MeasurementStoreState,
  'past' | 'future' | 'isDirty'
> {
  const past = [...state.past, state.measurements].slice(-HISTORY_LIMIT);
  return { past, future: [], isDirty: true };
}

export const useMeasurementStore = create<MeasurementStore>((set, get) => ({
  ...initialState,

  setDocument: (doc, page) =>
    set({
      doc,
      page,
      currentPage: page.pageNumber,
      measurements: [],
      draft: [],
      selectedIds: [],
      past: [],
      future: [],
      isDirty: false,
      sessionId: null,
      sessionName: doc.name.replace(/\.[^.]+$/, ''),
      scale: {
        ...get().scale,
        pxPerPaperMm: page.pxPerPaperMm,
        // A PDF's paper size is known exactly, so it starts out calibrated.
        calibrated: doc.kind === 'pdf',
      },
      view: { zoom: 1, x: 0, y: 0 },
    }),

  setPage: (page) =>
    set((state) => ({
      page,
      currentPage: page.pageNumber,
      draft: [],
      selectedIds: [],
      scale: { ...state.scale, pxPerPaperMm: page.pxPerPaperMm },
    })),

  closeDocument: () => set({ ...initialState, scale: { ...DEFAULT_SCALE } }),

  setTool: (tool) =>
    set((state) => ({
      activeTool: tool,
      draft: [],
      selectedIds: tool === 'select' ? state.selectedIds : [],
    })),

  setActiveColor: (color) => set({ activeColor: color }),
  setCursor: (point) => set({ cursor: point }),

  addDraftPoint: (point) => set((state) => ({ draft: [...state.draft, point] })),

  updateLastDraftPoint: (point) =>
    set((state) => {
      if (state.draft.length === 0) return {};
      const draft = [...state.draft];
      draft[draft.length - 1] = point;
      return { draft };
    }),

  popDraftPoint: () => set((state) => ({ draft: state.draft.slice(0, -1) })),

  cancelDraft: () => set({ draft: [] }),

  commitDraft: () => {
    const state = get();
    const tool = state.activeTool;
    // autoCount commits through its own flow, not the draft.
    if (tool === 'select' || tool === 'pan' || tool === 'calibrate' || tool === 'autoCount') {
      return null;
    }
    const type: MeasurementType = tool;
    // Finishing with a double-click leaves a duplicate of the last point behind.
    const points = dedupeConsecutive(state.draft);
    if (!isComplete(type, points)) {
      set({ draft: [] });
      return null;
    }

    const now = Date.now();
    const measurement: Measurement = {
      id: createId('m'),
      page: state.currentPage,
      type,
      label: nextLabel(type, state.measurements),
      points,
      color: state.activeColor ?? defaultColorFor(type),
      visible: true,
      locked: false,
      createdAt: now,
      updatedAt: now,
    };

    set({
      ...pushHistory(state),
      measurements: [...state.measurements, measurement],
      draft: [],
      selectedIds: [measurement.id],
    });
    return measurement;
  },

  addMeasurement: (measurement) =>
    set((state) => ({
      ...pushHistory(state),
      measurements: [...state.measurements, measurement],
    })),

  updateMeasurement: (id, patch) =>
    set((state) => ({
      ...pushHistory(state),
      measurements: state.measurements.map((m) =>
        m.id === id ? { ...m, ...patch, updatedAt: Date.now() } : m,
      ),
    })),

  moveVertex: (id, index, point) =>
    set((state) => ({
      ...pushHistory(state),
      measurements: state.measurements.map((m) => {
        if (m.id !== id || index < 0 || index >= m.points.length) return m;
        const points = [...m.points];
        points[index] = point;
        return { ...m, points, updatedAt: Date.now() };
      }),
    })),

  removeMeasurements: (ids) =>
    set((state) => {
      const removing = new Set(ids);
      return {
        ...pushHistory(state),
        measurements: state.measurements.filter((m) => !removing.has(m.id)),
        selectedIds: state.selectedIds.filter((id) => !removing.has(id)),
      };
    }),

  duplicateMeasurement: (id) =>
    set((state) => {
      const source = state.measurements.find((m) => m.id === id);
      if (!source) return {};
      const offset = 12;
      const now = Date.now();
      const copy: Measurement = {
        ...source,
        id: createId('m'),
        label: nextLabel(source.type, state.measurements),
        points: source.points.map((p) => ({ x: p.x + offset, y: p.y + offset })),
        createdAt: now,
        updatedAt: now,
      };
      return {
        ...pushHistory(state),
        measurements: [...state.measurements, copy],
        selectedIds: [copy.id],
      };
    }),

  clearMeasurements: () =>
    set((state) => ({ ...pushHistory(state), measurements: [], selectedIds: [] })),

  select: (ids) => set({ selectedIds: ids }),

  toggleSelect: (id) =>
    set((state) => ({
      selectedIds: state.selectedIds.includes(id)
        ? state.selectedIds.filter((x) => x !== id)
        : [...state.selectedIds, id],
    })),

  clearSelection: () => set({ selectedIds: [] }),

  setScale: (patch) =>
    set((state) => ({ scale: { ...state.scale, ...patch }, isDirty: true })),

  setScalePreset: (presetId) =>
    set((state) => ({ scale: scaleFromPresetId(presetId, state.scale), isDirty: true })),

  setDisplayUnit: (unit) => set((state) => ({ scale: { ...state.scale, unit } })),

  setView: (view) => set((state) => ({ view: { ...state.view, ...view } })),

  zoomBy: (factor, focus) =>
    set((state) => {
      const zoom = clamp(state.view.zoom * factor, ZOOM_LIMITS.min, ZOOM_LIMITS.max);
      if (!focus) return { view: { ...state.view, zoom } };
      // Keep the point under the cursor anchored while zooming.
      const worldX = (focus.x - state.view.x) / state.view.zoom;
      const worldY = (focus.y - state.view.y) / state.view.zoom;
      return {
        view: { zoom, x: focus.x - worldX * zoom, y: focus.y - worldY * zoom },
      };
    }),

  resetView: (containerSize) =>
    set((state) => {
      if (!state.page || !containerSize) return { view: { zoom: 1, x: 0, y: 0 } };
      const padding = 32;
      const zoom = clamp(
        Math.min(
          (containerSize.width - padding) / state.page.width,
          (containerSize.height - padding) / state.page.height,
        ),
        ZOOM_LIMITS.min,
        ZOOM_LIMITS.max,
      );
      return {
        view: {
          zoom,
          x: (containerSize.width - state.page.width * zoom) / 2,
          y: (containerSize.height - state.page.height * zoom) / 2,
        },
      };
    }),

  setGrid: (patch) => set((state) => ({ grid: { ...state.grid, ...patch } })),
  setSnap: (patch) => set((state) => ({ snap: { ...state.snap, ...patch } })),

  undo: () =>
    set((state) => {
      if (state.past.length === 0) return {};
      const previous = state.past[state.past.length - 1];
      return {
        measurements: previous,
        past: state.past.slice(0, -1),
        future: [state.measurements, ...state.future].slice(0, HISTORY_LIMIT),
        selectedIds: [],
        isDirty: true,
      };
    }),

  redo: () =>
    set((state) => {
      if (state.future.length === 0) return {};
      const next = state.future[0];
      return {
        measurements: next,
        past: [...state.past, state.measurements].slice(-HISTORY_LIMIT),
        future: state.future.slice(1),
        selectedIds: [],
        isDirty: true,
      };
    }),

  setSessionMeta: (patch) =>
    set((state) => ({
      sessionName: patch.sessionName ?? state.sessionName,
      projectName: patch.projectName ?? state.projectName,
      isDirty: true,
    })),

  markSaved: (sessionId) => set({ sessionId, isDirty: false }),

  loadSession: (session) =>
    set((state) => ({
      sessionId: session.id,
      sessionName: session.name,
      projectName: session.projectName,
      scale: { ...session.scale },
      measurements: session.measurements.map((m) => ({ ...m })),
      selectedIds: [],
      draft: [],
      past: [],
      future: [],
      isDirty: false,
      currentPage: state.currentPage,
    })),

  newSession: () =>
    set((state) => ({
      sessionId: null,
      sessionName: 'การวัดใหม่',
      measurements: [],
      selectedIds: [],
      draft: [],
      past: [],
      future: [],
      isDirty: false,
      scale: { ...state.scale },
    })),
}));

/* ---------------------------------- selectors --------------------------------- */

export const selectVisibleMeasurements = (state: MeasurementStore): Measurement[] =>
  state.measurements.filter((m) => m.page === state.currentPage);

export const selectSelectedMeasurements = (state: MeasurementStore): Measurement[] =>
  state.measurements.filter((m) => state.selectedIds.includes(m.id));

export const selectCanUndo = (state: MeasurementStore): boolean => state.past.length > 0;
export const selectCanRedo = (state: MeasurementStore): boolean => state.future.length > 0;
