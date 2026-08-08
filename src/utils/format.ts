import type { LengthUnit, QuantityValue } from '@/types';
import { fromMillimetres, mm2ToM2, mmToM } from './scale';

const numberFormatters = new Map<number, Intl.NumberFormat>();

function formatterFor(digits: number): Intl.NumberFormat {
  let formatter = numberFormatters.get(digits);
  if (!formatter) {
    formatter = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
    numberFormatters.set(digits, formatter);
  }
  return formatter;
}

export function formatNumber(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return '—';
  return formatterFor(digits).format(value);
}

/** Fewer decimals for millimetres than for metres — same relative precision. */
const DIGITS_BY_UNIT: Record<LengthUnit, number> = { mm: 0, cm: 1, m: 3 };

export function formatLength(mm: number, unit: LengthUnit): string {
  return `${formatNumber(fromMillimetres(mm, unit), DIGITS_BY_UNIT[unit])} ${unit}`;
}

/** Areas are always reported in m² — the unit every BOQ uses. */
export function formatArea(mm2: number, digits = 3): string {
  return `${formatNumber(mm2ToM2(mm2), digits)} m²`;
}

export function formatVolume(m3: number, digits = 3): string {
  return `${formatNumber(m3, digits)} m³`;
}

export function formatWeight(kg: number, digits = 2): string {
  return `${formatNumber(kg, digits)} kg`;
}

export function formatAngle(deg: number, digits = 2): string {
  return `${formatNumber(deg, digits)}°`;
}

export function formatPercent(value: number, digits = 1): string {
  return `${formatNumber(value, digits)}%`;
}

export function formatMetres(mm: number, digits = 3): string {
  return `${formatNumber(mmToM(mm), digits)} m`;
}

const QUANTITY_DIGITS: Record<QuantityValue['unit'], number> = {
  m: 3,
  'm²': 3,
  'm³': 3,
  kg: 2,
  ton: 3,
  nos: 0,
  deg: 2,
  '%': 1,
};

/** `12.500 m`, `45.00°`, `3 nos` — the canonical way a quantity is written in the UI. */
export function formatQuantity(quantity: QuantityValue): string {
  const value = formatNumber(quantity.value, QUANTITY_DIGITS[quantity.unit]);
  if (quantity.unit === 'deg') return `${value}°`;
  if (quantity.unit === '%') return `${value}%`;
  return `${value} ${quantity.unit}`;
}

export function formatCurrency(value: number, currency = 'THB'): string {
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatDateTime(epochMs: number): string {
  return new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(epochMs));
}

export function formatDate(epochMs: number): string {
  return new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium' }).format(new Date(epochMs));
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${formatNumber(bytes / 1024, 1)} KB`;
  return `${formatNumber(bytes / (1024 * 1024), 1)} MB`;
}

/** `2026-08-08_143000` — safe for filenames on every OS. */
export function fileTimestamp(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  );
}

export function sanitiseFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '-').trim() || 'measurement';
}
