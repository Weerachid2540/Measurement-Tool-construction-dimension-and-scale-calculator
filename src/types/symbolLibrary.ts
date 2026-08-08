import type { MaterialKind } from './material';
import type { QuantityUnit } from './scale';

/**
 * What a symbol *means* is standard across the industry even though the drawn glyph
 * is not — every office draws its own hexagon. Categories therefore carry the naming
 * and BOQ defaults, while the artwork always comes from the user's own drawing.
 */
export type SymbolCategory =
  | 'door'
  | 'window'
  | 'lighting'
  | 'outlet'
  | 'switch'
  | 'sanitary'
  | 'sprinkler'
  | 'diffuser'
  | 'column'
  | 'gridline'
  | 'furniture'
  | 'other';

export interface SymbolCategoryPreset {
  id: SymbolCategory;
  label: string;
  /** Prefilled BOQ description; the user's code (e.g. "1A") is appended. */
  boqPrefix: string;
  unit: QuantityUnit;
  materialKind?: MaterialKind;
}

export const SYMBOL_CATEGORIES: readonly SymbolCategoryPreset[] = [
  { id: 'door', label: 'ประตู (Door)', boqPrefix: 'ประตู', unit: 'nos' },
  { id: 'window', label: 'หน้าต่าง (Window)', boqPrefix: 'หน้าต่าง', unit: 'nos' },
  { id: 'lighting', label: 'ดวงโคม (Lighting)', boqPrefix: 'ดวงโคม', unit: 'nos' },
  { id: 'outlet', label: 'เต้ารับ (Outlet)', boqPrefix: 'เต้ารับ', unit: 'nos' },
  { id: 'switch', label: 'สวิตช์ (Switch)', boqPrefix: 'สวิตช์', unit: 'nos' },
  { id: 'sanitary', label: 'สุขภัณฑ์ (Sanitary)', boqPrefix: 'สุขภัณฑ์', unit: 'nos' },
  { id: 'sprinkler', label: 'หัวสปริงเกลอร์ (Sprinkler)', boqPrefix: 'หัวสปริงเกลอร์', unit: 'nos' },
  { id: 'diffuser', label: 'หัวจ่ายลม (Diffuser)', boqPrefix: 'หัวจ่ายลม', unit: 'nos' },
  { id: 'column', label: 'เสา (Column)', boqPrefix: 'เสา', unit: 'nos', materialKind: 'concrete' },
  { id: 'gridline', label: 'หมุดเส้นกริด (Grid bubble)', boqPrefix: 'เส้นกริด', unit: 'nos' },
  { id: 'furniture', label: 'ครุภัณฑ์ (Furniture)', boqPrefix: 'ครุภัณฑ์', unit: 'nos' },
  { id: 'other', label: 'อื่นๆ (Other)', boqPrefix: 'รายการ', unit: 'nos' },
] as const;

export const categoryPreset = (id: SymbolCategory): SymbolCategoryPreset =>
  SYMBOL_CATEGORIES.find((c) => c.id === id) ?? SYMBOL_CATEGORIES[SYMBOL_CATEGORIES.length - 1];

/**
 * A symbol saved for reuse. The artwork is stored as a PNG together with its size
 * *on paper* — a sheet opened later may be rasterised at a different resolution, and
 * the stored glyph is rescaled to match before matching runs.
 */
export interface SymbolLibraryItem {
  id: string;
  /** User-facing name, e.g. "ประตู 1A". */
  name: string;
  /** The code written inside the symbol, e.g. "1A". Used to build BOQ lines. */
  code: string;
  category: SymbolCategory;
  /** Full-resolution crop of the symbol, as a data URL. */
  image: string;
  /** Physical size on the sheet, which is what survives a change of render scale. */
  paperWidthMm: number;
  paperHeightMm: number;
  /** Defaults applied when the count is committed. */
  boqDescription?: string;
  unit: QuantityUnit;
  unitPrice?: number;
  notes?: string;
  createdAt: number;
  updatedAt: number;
  /** Bumped on each use so the list can surface favourites first. */
  usageCount: number;
}

export interface SymbolLibraryFilter {
  query: string;
  category: SymbolCategory | 'all';
}

export const DEFAULT_SYMBOL_FILTER: SymbolLibraryFilter = { query: '', category: 'all' };
