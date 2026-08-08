import { useEffect } from 'react';
import type { SymbolCategory } from '@/types';
import { categoryPreset, SYMBOL_CATEGORIES } from '@/types';
import { selectFilteredSymbols, useSymbolLibraryStore } from '@/store';
import { useAutoCount } from '@/hooks';
import { Button, Icon, Select, TextInput } from '@/components/common';
import { formatDate } from '@/utils/format';

const CATEGORY_OPTIONS: { value: SymbolCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'ทุกหมวด' },
  ...SYMBOL_CATEGORIES.map((c) => ({ value: c.id, label: c.label })),
];

/** Saved symbols, reusable across pages and projects. */
export function SymbolLibrary() {
  const symbols = useSymbolLibraryStore(selectFilteredSymbols);
  const total = useSymbolLibraryStore((s) => s.symbols.length);
  const filter = useSymbolLibraryStore((s) => s.filter);
  const setFilter = useSymbolLibraryStore((s) => s.setFilter);
  const refresh = useSymbolLibraryStore((s) => s.refresh);
  const remove = useSymbolLibraryStore((s) => s.remove);
  const { useFromLibrary } = useAutoCount();

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (total === 0) {
    return (
      <div className="mt-empty">
        <Icon name="folder" size={28} strokeWidth={1.2} />
        <p>คลังสัญลักษณ์ยังว่าง</p>
        <span>เลือกสัญลักษณ์จากแบบแล้วกด &quot;บันทึกเข้าคลัง&quot; เพื่อนำกลับมาใช้ซ้ำ</span>
      </div>
    );
  }

  return (
    <div className="mt-symbol-library">
      <div className="mt-history__filter-row">
        <TextInput
          value={filter.query}
          placeholder="ค้นหาชื่อหรือรหัส"
          onChange={(e) => setFilter({ query: e.target.value })}
        />
        <Select
          value={filter.category}
          options={CATEGORY_OPTIONS}
          onValueChange={(category) => setFilter({ category })}
        />
      </div>

      {symbols.length === 0 ? (
        <p className="mt-muted">ไม่พบสัญลักษณ์ที่ตรงกับเงื่อนไข</p>
      ) : (
        <ul className="mt-symbol-grid">
          {symbols.map((symbol) => (
            <li key={symbol.id} className="mt-symbol-card">
              <button
                type="button"
                className="mt-symbol-card__main"
                title="ใช้สัญลักษณ์นี้ค้นหาในหน้าปัจจุบัน"
                onClick={() => void useFromLibrary(symbol)}
              >
                <img src={symbol.image} alt={symbol.name} />
                <div>
                  <strong>{symbol.name}</strong>
                  <span className="mt-muted">{categoryPreset(symbol.category).label}</span>
                  <span className="mt-muted">
                    ใช้ {symbol.usageCount} ครั้ง · {formatDate(symbol.updatedAt)}
                  </span>
                </div>
              </button>
              <Button
                size="sm"
                icon="trash"
                iconOnly
                variant="ghost"
                title="ลบออกจากคลัง"
                onClick={() => {
                  if (window.confirm(`ลบ "${symbol.name}" ออกจากคลัง?`)) void remove(symbol.id);
                }}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
