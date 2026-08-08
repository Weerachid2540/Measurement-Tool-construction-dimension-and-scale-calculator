import type {
  BoqOptions,
  BoqReport,
  BoqRow,
  BoqSummaryRow,
  Measurement,
  ScaleSettings,
} from '@/types';
import { computeMeasurement, TYPE_LABELS } from './measurement';
import { computeMaterial, presetFor } from './materials';

export const DEFAULT_BOQ_OPTIONS: BoqOptions = {
  projectName: '',
  drawingName: '',
  scaleLabel: '',
  currency: 'THB',
  groupIdenticalItems: false,
  includeHiddenMeasurements: false,
};

/**
 * Builds the bill of quantities from the current measurements.
 *
 * Measurements with a material assigned are billed using the material quantity
 * (volume / weight / area); the rest fall back to their raw geometric quantity.
 */
export function buildBoqReport(
  measurements: Measurement[],
  scale: ScaleSettings,
  options: BoqOptions,
): BoqReport {
  const source = options.includeHiddenMeasurements
    ? measurements
    : measurements.filter((m) => m.visible);

  const rows: BoqRow[] = source.map((m, index) => {
    const result = computeMeasurement(m, scale);
    const material = computeMaterial(m, result);

    if (material) {
      return {
        no: index + 1,
        code: m.label,
        description: material.description,
        category: presetFor(material.kind).label,
        unit: material.unit,
        quantity: material.quantity,
        unitPrice: material.unitPrice,
        amount: material.amount,
        remark: m.notes,
      };
    }

    return {
      no: index + 1,
      code: m.label,
      description: m.notes?.trim() || `${result.primary.label} — ${TYPE_LABELS[m.type]}`,
      category: TYPE_LABELS[m.type],
      unit: result.primary.unit,
      quantity: result.primary.value,
      remark: m.notes,
    };
  });

  const finalRows = options.groupIdenticalItems ? groupRows(rows) : rows;

  return {
    projectName: options.projectName,
    drawingName: options.drawingName,
    scaleLabel: options.scaleLabel,
    createdAt: Date.now(),
    rows: finalRows,
    summary: summarise(finalRows),
    subtotal: finalRows.reduce((sum, row) => sum + (row.amount ?? 0), 0),
    currency: options.currency,
  };
}

/** Merges rows sharing description + unit + unit price into one line. */
function groupRows(rows: BoqRow[]): BoqRow[] {
  const groups = new Map<string, BoqRow>();
  for (const row of rows) {
    const key = `${row.category}|${row.description}|${row.unit}|${row.unitPrice ?? ''}`;
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, { ...row });
      continue;
    }
    existing.quantity += row.quantity;
    existing.amount =
      existing.unitPrice !== undefined ? existing.quantity * existing.unitPrice : undefined;
    existing.code = `${existing.code}, ${row.code}`;
  }
  return [...groups.values()].map((row, index) => ({ ...row, no: index + 1 }));
}

function summarise(rows: BoqRow[]): BoqSummaryRow[] {
  const totals = new Map<string, BoqSummaryRow>();
  for (const row of rows) {
    const key = `${row.category}|${row.unit}`;
    const entry = totals.get(key) ?? {
      category: row.category,
      unit: row.unit,
      quantity: 0,
      amount: 0,
    };
    entry.quantity += row.quantity;
    entry.amount += row.amount ?? 0;
    totals.set(key, entry);
  }
  return [...totals.values()].sort((a, b) => a.category.localeCompare(b.category));
}
