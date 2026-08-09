import { useMemo, useState } from 'react';
import type { TakeoffCategoryId, TakeoffLine, TakeoffItemDef } from '@/types';
import { TAKEOFF_CATEGORIES, takeoffGroupsOf, takeoffItemsOf } from '@/types';
import {
  selectAcceptedCount,
  useAutoCountStore,
  useMeasurementStore,
  useTakeoffStore,
  useUiStore,
} from '@/store';
import { Button, Field, Icon, NumberInput, Select, TextInput } from '@/components/common';
import { buildTakeoffReport, computeTakeoffLine } from '@/utils/takeoff';
import { formatCurrency, formatNumber } from '@/utils/format';

const CATEGORY_OPTIONS = TAKEOFF_CATEGORIES.map((c) => ({
  value: c.id,
  label: `${c.no}. ${c.label} — ${c.labelTh}`,
}));

/** หน้าถอดแบบประมาณราคา — กรอกตัวเลขเอง ไม่ผูกกับการวัดบนแบบ */
export function TakeoffPanel() {
  const lines = useTakeoffStore((s) => s.lines);
  const projectName = useTakeoffStore((s) => s.projectName);
  const setProjectName = useTakeoffStore((s) => s.setProjectName);
  const addLine = useTakeoffStore((s) => s.addLine);
  const clearAll = useTakeoffStore((s) => s.clearAll);
  const notify = useUiStore((s) => s.notify);
  const setBusy = useUiStore((s) => s.setBusy);

  const [categoryId, setCategoryId] = useState<TakeoffCategoryId>('architecture');
  const [groupId, setGroupId] = useState<string>('arch-wall');

  const groups = useMemo(() => takeoffGroupsOf(categoryId), [categoryId]);
  const items = useMemo(() => takeoffItemsOf(groupId), [groupId]);
  const report = useMemo(() => buildTakeoffReport(lines, projectName), [lines, projectName]);

  const changeCategory = (value: TakeoffCategoryId) => {
    setCategoryId(value);
    const first = takeoffGroupsOf(value)[0];
    setGroupId(first?.id ?? '');
  };

  const handleExport = async (kind: 'excel' | 'pdf') => {
    if (lines.length === 0) {
      notify('ยังไม่มีรายการถอดแบบ', 'error');
      return;
    }
    try {
      setBusy(kind === 'excel' ? 'กำลังสร้างไฟล์ Excel…' : 'กำลังสร้างไฟล์ PDF…');
      const { exportTakeoffToExcel, exportTakeoffToPdf } = await import('@/utils/export');
      if (kind === 'excel') await exportTakeoffToExcel(report);
      else await exportTakeoffToPdf(report);
      notify(`ส่งออก ${kind === 'excel' ? 'Excel' : 'PDF'} สำเร็จ`, 'success');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'ส่งออกไม่สำเร็จ', 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mt-panel-body mt-takeoff">
      <section className="mt-props__section">
        <h3>การคำนวณถอดแบบ</h3>
        <Field label="ชื่อโครงการ">
          <TextInput
            value={projectName}
            placeholder="เช่น บ้านพักอาศัย 2 ชั้น คุณสมชาย"
            onChange={(e) => setProjectName(e.target.value)}
          />
        </Field>

        <Field label="หมวดหลัก">
          <Select value={categoryId} options={CATEGORY_OPTIONS} onValueChange={changeCategory} />
        </Field>

        <Field label="หมวดงาน">
          <Select
            value={groupId}
            options={groups.map((g) => ({ value: g.id, label: `${g.no}. ${g.label}` }))}
            onValueChange={setGroupId}
          />
        </Field>

        {items.length === 0 ? (
          <p className="mt-takeoff__todo">
            หมวดนี้ยังไม่มีรายการงานย่อย — ตอนนี้ใส่สูตรไว้ครบเฉพาะ &quot;งานผนัง&quot;
          </p>
        ) : (
          <div className="mt-takeoff__add">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                className="mt-takeoff__add-item"
                onClick={() => addLine(item.id)}
                title={item.formula}
              >
                <Icon name="plus" size={14} />
                <span>
                  {item.no}. {item.name}
                </span>
                <em>{item.noteOnly ? 'ยังไม่มีสูตร' : (item.unitLabel ?? item.unit)}</em>
              </button>
            ))}
          </div>
        )}
      </section>

      {lines.length === 0 ? (
        <div className="mt-empty">
          <Icon name="table" size={32} strokeWidth={1.2} />
          <p>ยังไม่มีรายการถอดแบบ</p>
          <span>เลือกหมวดงานด้านบน แล้วกดรายการงานเพื่อเพิ่มลงตาราง</span>
        </div>
      ) : (
        <>
          {report.categories.map(({ category, groups: reportGroups, amount }) => (
            <section key={category.id} className="mt-takeoff__category">
              <header className="mt-takeoff__category-head">
                <h4>
                  {category.no}. {category.label}
                </h4>
                <span>{amount > 0 ? formatCurrency(amount) : '—'}</span>
              </header>

              {reportGroups.map(({ group, lines: groupLines, amount: groupAmount }) => (
                <div key={group.id} className="mt-takeoff__group">
                  <div className="mt-takeoff__group-head">
                    <span>
                      {group.no}. {group.label}
                    </span>
                    <span>{groupAmount > 0 ? formatCurrency(groupAmount) : '—'}</span>
                  </div>
                  {groupLines.map(({ line, item }) => (
                    <TakeoffLineRow key={line.id} line={line} item={item} />
                  ))}
                </div>
              ))}
            </section>
          ))}

          <div className="mt-takeoff__total">
            <span>รวมทั้งสิ้น</span>
            <strong>{formatCurrency(report.total)}</strong>
          </div>

          <div className="mt-panel-footer mt-panel-footer--split">
            <Button icon="excel" variant="primary" onClick={() => void handleExport('excel')}>
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
                if (window.confirm('ลบรายการถอดแบบทั้งหมด?')) clearAll();
              }}
            >
              ล้างตารางถอดแบบ
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function TakeoffLineRow({ line, item }: { line: TakeoffLine; item: TakeoffItemDef }) {
  const expandedId = useTakeoffStore((s) => s.expandedId);
  const setExpanded = useTakeoffStore((s) => s.setExpanded);
  const updateLine = useTakeoffStore((s) => s.updateLine);
  const setValue = useTakeoffStore((s) => s.setValue);
  const removeLine = useTakeoffStore((s) => s.removeLine);
  const duplicateLine = useTakeoffStore((s) => s.duplicateLine);
  const addOpening = useTakeoffStore((s) => s.addOpening);
  const updateOpening = useTakeoffStore((s) => s.updateOpening);
  const removeOpening = useTakeoffStore((s) => s.removeOpening);

  // จำนวนที่นับได้จากแบบ — ผลสดจากเครื่องมือนับอัตโนมัติก่อน ถ้าบันทึกไปแล้วค่อยนับจากจุดที่บันทึกไว้
  const liveCount = useAutoCountStore(selectAcceptedCount);
  const committedCount = useMeasurementStore((s) =>
    s.measurements
      .filter((m) => m.type === 'count' && m.page === s.currentPage)
      .reduce((total, m) => total + m.points.length, 0),
  );
  const availableCount = liveCount || committedCount;

  const open = expandedId === line.id;
  const result = computeTakeoffLine(line, item);

  return (
    <article className={`mt-takeoff__line ${open ? 'is-open' : ''}`}>
      <button
        type="button"
        className="mt-takeoff__line-head"
        onClick={() => setExpanded(open ? null : line.id)}
      >
        <Icon name={open ? 'chevronDown' : 'chevronRight'} size={14} />
        <span className="mt-takeoff__line-name">
          {line.level && <b className="mt-takeoff__level">{line.level}</b>}
          {item.name}
          {line.label && <em> — {line.label}</em>}
        </span>
        <span className="mt-takeoff__line-qty">
          {item.noteOnly ? '—' : `${formatNumber(result.quantity, 3)} ${item.unitLabel ?? item.unit}`}
        </span>
      </button>

      {result.workingText && <p className="mt-takeoff__working">{result.workingText}</p>}

      {open && (
        <div className="mt-takeoff__editor">
          {item.perLevel && (
            <Field label="ชั้น" hint="พิมพ์เองได้ เช่น ชั้น 2 หรือ ชั้นดาดฟ้า">
              <TextInput
                value={line.level ?? ''}
                placeholder="เช่น ชั้น 2"
                onChange={(e) => updateLine(line.id, { level: e.target.value })}
              />
            </Field>
          )}

          <Field label="ตำแหน่ง / รายละเอียด">
            <TextInput
              value={line.label}
              placeholder="เช่น ผนังห้องนอน 1 ทิศเหนือ"
              onChange={(e) => updateLine(line.id, { label: e.target.value })}
            />
          </Field>

          {!item.noteOnly && <p className="mt-takeoff__formula">สูตร: {item.formula}</p>}
          {item.hint && <p className="mt-field__hint">{item.hint}</p>}
          {item.link && (
            <a
              className="mt-takeoff__link"
              href={item.link.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Icon name="calibrate" size={14} />
              <span>{item.link.label}</span>
            </a>
          )}

          {item.pullAutoCount && (
            <div className="mt-takeoff__autocount">
              <Button
                icon="count"
                variant="ghost"
                disabled={availableCount === 0}
                onClick={() => setValue(line.id, 'quantity', availableCount)}
              >
                ดึงจำนวนจากการนับอัตโนมัติ
                {availableCount > 0 ? ` (${availableCount})` : ''}
              </Button>
              <span className="mt-field__hint">
                {availableCount === 0
                  ? 'ยังไม่มีผลนับ — ไปแท็บ "นับอัตโนมัติ" ลากกรอบคลุมสัญลักษณ์เสาเข็ม 1 ตัว แล้วค้นหา'
                  : liveCount > 0
                    ? 'จากผลค้นหาล่าสุดที่ยังไม่ได้บันทึก'
                    : 'จากจุดนับที่บันทึกไว้ในหน้านี้'}
              </span>
            </div>
          )}

          {/* รายการที่ยังไม่มีวิธีคิด แสดงแค่ช่องตำแหน่งด้านบนกับปุ่มจัดการ */}
          {!item.noteOnly && (
          <div className="mt-grid-2">
            {item.inputs.map((input) => (
              <Field key={input.key} label={input.label} inline>
                <NumberInput
                  value={line.values[input.key]}
                  min={input.min}
                  max={input.max}
                  step={input.step ?? 0.1}
                  suffix={input.unit}
                  onValueChange={(value) => setValue(line.id, input.key, value)}
                />
              </Field>
            ))}

            <Field label="เผื่อเสียหาย" inline>
              <NumberInput
                value={line.wastePercent}
                min={0}
                max={50}
                step={1}
                suffix="%"
                onValueChange={(wastePercent) => updateLine(line.id, { wastePercent })}
              />
            </Field>

            <Field label="ราคาต่อหน่วย" inline>
              <NumberInput
                value={line.unitPrice}
                min={0}
                step={10}
                suffix="บาท"
                onValueChange={(unitPrice) => updateLine(line.id, { unitPrice })}
              />
            </Field>
          </div>
          )}

          {item.deductOpenings && (
            <div className="mt-takeoff__openings">
              <div className="mt-takeoff__openings-head">
                <span>ช่องเปิดที่หักออก (ประตู / หน้าต่าง)</span>
                <Button icon="plus" variant="ghost" onClick={() => addOpening(line.id)}>
                  เพิ่มช่องเปิด
                </Button>
              </div>

              {line.openings.length === 0 ? (
                <p className="mt-field__hint">ยังไม่ได้หักช่องเปิด — ผนังทึบไม่ต้องใส่</p>
              ) : (
                <>
                  {/* หัวคอลัมน์แทนการใส่หน่วยในช่องกรอก ซึ่งเบียดจนอ่านตัวเลขไม่ออก */}
                  <div className="mt-takeoff__opening mt-takeoff__opening--head">
                    <span>ชนิดช่องเปิด</span>
                    <span>กว้าง (ม.)</span>
                    <span>สูง (ม.)</span>
                    <span>จำนวน (ช่อง)</span>
                    <span />
                  </div>
                  {line.openings.map((opening) => (
                    <div key={opening.id} className="mt-takeoff__opening">
                      <TextInput
                        value={opening.label}
                        placeholder="ประตู / หน้าต่าง"
                        onChange={(e) =>
                          updateOpening(line.id, opening.id, { label: e.target.value })
                        }
                      />
                      <NumberInput
                        value={opening.width}
                        min={0}
                        step={0.1}
                        onValueChange={(width) => updateOpening(line.id, opening.id, { width })}
                      />
                      <NumberInput
                        value={opening.height}
                        min={0}
                        step={0.1}
                        onValueChange={(height) => updateOpening(line.id, opening.id, { height })}
                      />
                      <NumberInput
                        value={opening.count}
                        min={0}
                        step={1}
                        onValueChange={(count) => updateOpening(line.id, opening.id, { count })}
                      />
                      <button
                        type="button"
                        className="mt-icon-btn"
                        title="ลบช่องเปิด"
                        onClick={() => removeOpening(line.id, opening.id)}
                      >
                        <Icon name="trash" size={14} />
                      </button>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {!item.noteOnly && (
          <dl className="mt-takeoff__figures">
            <div>
              <dt>ปริมาณก่อนหัก</dt>
              <dd>
                {formatNumber(result.baseQuantity, 3)} {item.unitLabel ?? item.unit}
              </dd>
            </div>
            {result.deduction > 0 && (
              <div>
                <dt>หักช่องเปิด</dt>
                <dd>
                  −{formatNumber(result.deduction, 3)} {item.unitLabel ?? item.unit}
                </dd>
              </div>
            )}
            <div>
              <dt>ปริมาณสุทธิ</dt>
              <dd>
                <strong>
                  {formatNumber(result.quantity, 3)} {item.unitLabel ?? item.unit}
                </strong>
              </dd>
            </div>
            {result.amount !== undefined && (
              <div>
                <dt>จำนวนเงิน</dt>
                <dd>
                  <strong>{formatCurrency(result.amount)}</strong>
                </dd>
              </div>
            )}
          </dl>
          )}

          {result.components.length > 0 && (
            <div className="mt-takeoff__components">
              <span>วัสดุโดยประมาณ</span>
              <ul>
                {result.components.map((c) => (
                  <li key={c.label}>
                    {c.label} <strong>{formatNumber(c.quantity, 2)}</strong> {c.unit}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-takeoff__line-actions">
            <Button icon="copy" variant="ghost" onClick={() => duplicateLine(line.id)}>
              ทำซ้ำ
            </Button>
            <Button icon="trash" variant="ghost" onClick={() => removeLine(line.id)}>
              ลบรายการ
            </Button>
          </div>
        </div>
      )}
    </article>
  );
}
