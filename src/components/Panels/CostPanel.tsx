import { useMemo } from 'react';
import type { CostEntry, CostKind, LabourType } from '@/types';
import { LABOUR_TYPES } from '@/types';
import { useCostStore, useUiStore } from '@/store';
import { Button, Field, Icon, NumberInput, Select, TextInput } from '@/components/common';
import { buildCostReport, entryAmount, labourUnit, travelAmount } from '@/utils/cost';
import { formatCurrency } from '@/utils/format';

const LABOUR_OPTIONS = LABOUR_TYPES.map((t) => ({ value: t.id, label: t.label }));

/** หมวดต้นทุน — ค่าวัสดุที่ซื้อจริงและค่าแรงช่างของแต่ละโครงการ */
export function CostPanel() {
  const entries = useCostStore((s) => s.entries);
  const projectName = useCostStore((s) => s.projectName);
  const setProjectName = useCostStore((s) => s.setProjectName);
  const addEntry = useCostStore((s) => s.addEntry);
  const clearAll = useCostStore((s) => s.clearAll);
  const notify = useUiStore((s) => s.notify);
  const setBusy = useUiStore((s) => s.setBusy);
  const openPreview = useUiStore((s) => s.openPreview);

  const report = useMemo(() => buildCostReport(entries, projectName), [entries, projectName]);

  const handleExport = async (kind: 'excel' | 'pdf') => {
    if (entries.length === 0) {
      notify('ยังไม่มีรายการต้นทุน', 'error');
      return;
    }
    try {
      setBusy(kind === 'excel' ? 'กำลังสร้างไฟล์ Excel…' : 'กำลังสร้างไฟล์ PDF…');
      const { exportCostToExcel, exportCostToPdf, isThaiFontLoaded } = await import(
        '@/utils/export'
      );
      if (kind === 'excel') {
        await exportCostToExcel(report);
      } else {
        await exportCostToPdf(report);
        if (!isThaiFontLoaded()) {
          notify('ไม่พบฟอนต์ไทย — ข้อความไทยใน PDF จะเพี้ยน (ใช้ Excel แทนได้)', 'error');
          return;
        }
      }
      notify(`ส่งออก ${kind === 'excel' ? 'Excel' : 'PDF'} สำเร็จ`, 'success');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'ส่งออกไม่สำเร็จ', 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mt-panel-body mt-cost">
      <section className="mt-props__section">
        <h3>ต้นทุนหน้างาน</h3>
        <Field label="ชื่อโครงการ / ไซต์งาน">
          <TextInput
            value={projectName}
            placeholder="เช่น อาคารเรียน 4 ชั้น โรงเรียนบ้านหนองบัว"
            onChange={(e) => setProjectName(e.target.value)}
          />
        </Field>
      </section>

      <div className="mt-cost__summary">
        <div>
          <span>ค่าวัสดุ</span>
          <strong>{formatCurrency(report.totals.material)}</strong>
        </div>
        <div>
          <span>
            ค่าแรง
            {report.totals.travel > 0 && ` (ค่าเดินทาง ${formatCurrency(report.totals.travel)})`}
          </span>
          <strong>{formatCurrency(report.totals.labour)}</strong>
        </div>
        <div className="mt-cost__summary-total">
          <span>รวมทั้งสิ้น</span>
          <strong>{formatCurrency(report.totals.total)}</strong>
        </div>
      </div>

      <CostSection
        title="ค่าวัสดุ"
        kind="material"
        entries={report.materials}
        total={report.totals.material}
        onAdd={() => addEntry('material')}
        emptyText="ยังไม่มีรายการซื้อวัสดุ"
      />

      <CostSection
        title="ค่าแรงช่าง"
        kind="labour"
        entries={report.labour}
        total={report.totals.labour}
        onAdd={() => addEntry('labour')}
        emptyText="ยังไม่มีรายการค่าแรง"
      />

      {entries.length > 0 && (
        <>
          <div className="mt-panel-footer mt-panel-footer--wrap">
            <Button icon="eye" variant="primary" onClick={() => openPreview('cost')}>
              พรีวิว
            </Button>
            <Button icon="excel" onClick={() => void handleExport('excel')}>
              ส่งออก Excel
            </Button>
            <Button icon="pdf" onClick={() => void handleExport('pdf')}>
              ส่งออก PDF
            </Button>
          </div>
          <div className="mt-panel-footer">
            <Button
              icon="trash"
              variant="ghost"
              onClick={() => {
                if (window.confirm('ลบรายการต้นทุนทั้งหมด?')) clearAll();
              }}
            >
              ล้างตารางต้นทุน
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

interface SectionProps {
  title: string;
  kind: CostKind;
  entries: (CostEntry & { amount: number })[];
  total: number;
  onAdd: () => void;
  emptyText: string;
}

function CostSection({ title, kind, entries, total, onAdd, emptyText }: SectionProps) {
  return (
    <section className="mt-cost__section">
      <header className="mt-cost__section-head">
        <h4>
          {title} <em>{entries.length} รายการ</em>
        </h4>
        <span>{formatCurrency(total)}</span>
      </header>

      {entries.length === 0 ? (
        <p className="mt-field__hint">{emptyText}</p>
      ) : (
        entries.map((entry) => <CostRow key={entry.id} entry={entry} />)
      )}

      <Button icon="plus" variant="ghost" onClick={onAdd}>
        เพิ่ม{kind === 'material' ? 'วัสดุ' : 'ค่าแรง'}
      </Button>
    </section>
  );
}

function CostRow({ entry }: { entry: CostEntry & { amount: number } }) {
  const updateEntry = useCostStore((s) => s.updateEntry);
  const duplicateEntry = useCostStore((s) => s.duplicateEntry);
  const removeEntry = useCostStore((s) => s.removeEntry);

  const isMaterial = entry.kind === 'material';

  /** เปลี่ยนแบบค่าแรงแล้วเปลี่ยนหน่วยตามให้ ถ้าผู้ใช้ยังไม่ได้พิมพ์หน่วยเอง */
  const changeLabourType = (labourType: LabourType) => {
    const followedUnit = LABOUR_TYPES.some((t) => t.unit === entry.unit);
    updateEntry(entry.id, {
      labourType,
      ...(followedUnit ? { unit: labourUnit(labourType) } : {}),
    });
  };

  return (
    <article className="mt-cost__row">
      <div className="mt-cost__row-main">
        <input
          type="date"
          className="mt-input mt-cost__date"
          value={entry.date}
          onChange={(e) => updateEntry(entry.id, { date: e.target.value })}
        />
        <TextInput
          value={entry.name}
          placeholder={isMaterial ? 'เช่น ปูนซีเมนต์ถุง 50 กก.' : 'เช่น ค่าแรงก่อผนัง ทีมช่างสมชาย'}
          onChange={(e) => updateEntry(entry.id, { name: e.target.value })}
        />
      </div>

      <div className="mt-cost__row-grid">
        {isMaterial ? (
          <Field label="ราคารวม (รวม VAT)" inline>
            <NumberInput
              value={entry.amount ?? 0}
              min={0}
              step={100}
              suffix="บาท"
              onValueChange={(amount) => updateEntry(entry.id, { amount })}
            />
          </Field>
        ) : (
          <>
            <Field label="แบบค่าแรง" inline>
              <Select
                value={entry.labourType ?? 'daily'}
                options={LABOUR_OPTIONS}
                onValueChange={changeLabourType}
              />
            </Field>

            <Field label="จำนวน" inline>
              <NumberInput
                value={entry.quantity}
                min={0}
                step={1}
                onValueChange={(quantity) => updateEntry(entry.id, { quantity })}
              />
            </Field>

            <Field label="หน่วย" inline>
              <TextInput
                value={entry.unit}
                placeholder="วัน / งาน"
                onChange={(e) => updateEntry(entry.id, { unit: e.target.value })}
              />
            </Field>

            <Field label="ราคาต่อหน่วย" inline>
              <NumberInput
                value={entry.unitPrice}
                min={0}
                step={10}
                suffix="บาท"
                onValueChange={(unitPrice) => updateEntry(entry.id, { unitPrice })}
              />
            </Field>

            <Field label="ค่าเดินทาง — จำนวน" inline>
              <NumberInput
                value={entry.travelDays ?? 0}
                min={0}
                step={1}
                suffix="วัน"
                onValueChange={(travelDays) => updateEntry(entry.id, { travelDays })}
              />
            </Field>

            <Field label="ค่าเดินทาง — ต่อวัน" inline>
              <NumberInput
                value={entry.travelRate ?? 0}
                min={0}
                step={50}
                suffix="บาท"
                onValueChange={(travelRate) => updateEntry(entry.id, { travelRate })}
              />
            </Field>
          </>
        )}

        <Field label={isMaterial ? 'ร้านค้า' : 'ผู้รับเหมา / หัวหน้าช่าง'} inline>
          <TextInput
            value={entry.vendor ?? ''}
            onChange={(e) => updateEntry(entry.id, { vendor: e.target.value })}
          />
        </Field>

        {isMaterial && (
          <Field label="เลขที่บิล" inline>
            <TextInput
              value={entry.reference ?? ''}
              onChange={(e) => updateEntry(entry.id, { reference: e.target.value })}
            />
          </Field>
        )}

        <Field label="หมายเหตุ" inline>
          <TextInput
            value={entry.notes ?? ''}
            placeholder="เช่น จ่ายเงินสด / ค้างบิล"
            onChange={(e) => updateEntry(entry.id, { notes: e.target.value })}
          />
        </Field>
      </div>

      <footer className="mt-cost__row-foot">
        <span className="mt-cost__amount">
          {formatCurrency(entryAmount(entry))}
          {!isMaterial && travelAmount(entry) > 0 && (
            <em> (รวมค่าเดินทาง {formatCurrency(travelAmount(entry))})</em>
          )}
        </span>
        <div className="mt-cost__row-actions">
          <button
            type="button"
            className="mt-icon-btn"
            title="ทำซ้ำรายการ"
            onClick={() => duplicateEntry(entry.id)}
          >
            <Icon name="copy" size={14} />
          </button>
          <button
            type="button"
            className="mt-icon-btn"
            title="ลบรายการ"
            onClick={() => removeEntry(entry.id)}
          >
            <Icon name="trash" size={14} />
          </button>
        </div>
      </footer>
    </article>
  );
}
