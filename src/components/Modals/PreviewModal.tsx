import { Fragment, useMemo } from 'react';
import type { PreviewKind } from '@/store';
import { useCostStore, useMeasurementStore, useTakeoffStore, useUiStore } from '@/store';
import { Button, Modal } from '@/components/common';
import { buildBoqReport } from '@/utils/boq';
import { buildTakeoffReport } from '@/utils/takeoff';
import { buildCostReport, travelAmount } from '@/utils/cost';
import { formatCurrency, formatNumber } from '@/utils/format';
import { scaleLabel } from '@/utils/scale';

const TITLES: Record<PreviewKind, string> = {
  takeoff: 'พรีวิว — การคำนวณถอดแบบ',
  cost: 'พรีวิว — ต้นทุนหน้างาน',
  boq: 'พรีวิว — BOQ',
};

/**
 * ดูเอกสารเต็มหน้าก่อนส่งออก — ตารางที่แสดงตรงกับไฟล์ที่จะได้
 * สร้างรายงานจากสโตร์โดยตรง จึงไม่มีข้อมูลชุดที่สองให้หลุดจากกัน
 */
export function PreviewModal() {
  const modal = useUiStore((s) => s.modal);
  const previewKind = useUiStore((s) => s.previewKind);
  const closeModal = useUiStore((s) => s.closeModal);
  const notify = useUiStore((s) => s.notify);
  const setBusy = useUiStore((s) => s.setBusy);

  const open = modal === 'preview' && previewKind !== null;

  const handleExport = async (format: 'excel' | 'pdf') => {
    if (!previewKind) return;
    try {
      setBusy(format === 'excel' ? 'กำลังสร้างไฟล์ Excel…' : 'กำลังสร้างไฟล์ PDF…');
      const api = await import('@/utils/export');

      if (previewKind === 'takeoff') {
        const report = buildTakeoffReport(
          useTakeoffStore.getState().lines,
          useTakeoffStore.getState().projectName,
        );
        if (format === 'excel') await api.exportTakeoffToExcel(report);
        else await api.exportTakeoffToPdf(report);
      } else if (previewKind === 'cost') {
        const report = buildCostReport(
          useCostStore.getState().entries,
          useCostStore.getState().projectName,
        );
        if (format === 'excel') await api.exportCostToExcel(report);
        else await api.exportCostToPdf(report);
      } else {
        const state = useMeasurementStore.getState();
        const report = buildBoqReport(state.measurements, state.scale, {
          ...useUiStore.getState().boqOptions,
          projectName: state.projectName,
          drawingName: state.doc?.name ?? '',
          scaleLabel: scaleLabel(state.scale),
        });
        if (format === 'excel') await api.exportBoqToExcel(report, state.measurements, state.scale);
        else await api.exportBoqToPdf(report);
      }

      if (format === 'pdf' && !api.isThaiFontLoaded()) {
        notify('ไม่พบฟอนต์ไทย — ข้อความไทยใน PDF จะเพี้ยน (ใช้ Excel แทนได้)', 'error');
        return;
      }
      notify(`ส่งออก ${format === 'excel' ? 'Excel' : 'PDF'} สำเร็จ`, 'success');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'ส่งออกไม่สำเร็จ', 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal
      open={open}
      title={previewKind ? TITLES[previewKind] : 'พรีวิว'}
      onClose={closeModal}
      width={960}
      footer={
        <>
          {/* พิมพ์ผ่านเบราว์เซอร์ได้ภาษาไทยถูกต้องเสมอ ต่างจาก jsPDF ที่วางสระ-วรรณยุกต์ซ้อนกัน */}
          <Button icon="pdf" variant="primary" onClick={() => window.print()}>
            พิมพ์ / บันทึกเป็น PDF
          </Button>
          <Button icon="excel" onClick={() => void handleExport('excel')}>
            ส่งออก Excel
          </Button>
          <Button icon="download" onClick={() => void handleExport('pdf')}>
            PDF (jsPDF)
          </Button>
          <Button onClick={closeModal}>ปิด</Button>
        </>
      }
    >
      {previewKind === 'takeoff' && <TakeoffPreview />}
      {previewKind === 'cost' && <CostPreview />}
      {previewKind === 'boq' && <BoqPreview />}
    </Modal>
  );
}

function TakeoffPreview() {
  const lines = useTakeoffStore((s) => s.lines);
  const projectName = useTakeoffStore((s) => s.projectName);
  const report = useMemo(() => buildTakeoffReport(lines, projectName), [lines, projectName]);

  if (report.categories.length === 0) return <EmptyPreview />;

  return (
    <div className="mt-preview">
      <PreviewHeading label="โครงการ" value={report.projectName || '-'} />
      <div className="mt-table-wrap">
        <table className="mt-table">
          <thead>
            <tr>
              <th>ลำดับ</th>
              <th>รายการ</th>
              <th>การคำนวณ</th>
              <th>หน่วย</th>
              <th className="num">ปริมาณ</th>
              <th className="num">ราคา/หน่วย</th>
              <th className="num">จำนวนเงิน</th>
              <th>หมายเหตุ</th>
            </tr>
          </thead>
          <tbody>
            {report.categories.map((entry) => (
              <PreviewCategory key={entry.category.id} entry={entry} />
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={6}>รวมทั้งสิ้น</td>
              <td className="num">{formatCurrency(report.total)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

type TakeoffCategoryEntry = ReturnType<typeof buildTakeoffReport>['categories'][number];

function PreviewCategory({ entry }: { entry: TakeoffCategoryEntry }) {
  return (
    <>
      <tr className="mt-preview__group">
        <td>{entry.category.no}.</td>
        <td colSpan={5}>
          {entry.category.label} — {entry.category.labelTh}
        </td>
        <td className="num">{entry.amount > 0 ? formatCurrency(entry.amount) : '—'}</td>
        <td />
      </tr>
      {entry.groups.map((groupEntry) => (
        <Fragment key={groupEntry.group.id}>
          <tr className="mt-preview__subgroup">
            <td>
              {entry.category.no}.{groupEntry.group.no}
            </td>
            <td colSpan={5}>{groupEntry.group.label}</td>
            <td className="num">{groupEntry.amount > 0 ? formatCurrency(groupEntry.amount) : '—'}</td>
            <td />
          </tr>
          {groupEntry.lines.map(({ line, item, result }, index) => (
            <tr key={line.id}>
              <td>
                {entry.category.no}.{groupEntry.group.no}.{index + 1}
              </td>
              <td>
                {[line.level, item.name, line.label].filter(Boolean).join(' — ')}
              </td>
              <td className="mt-preview__working">{result.workingText}</td>
              <td>{item.noteOnly ? '' : (item.unitLabel ?? item.unit)}</td>
              <td className="num">
                {item.noteOnly ? '-' : formatNumber(result.quantity, 3)}
              </td>
              <td className="num">
                {line.unitPrice !== undefined ? formatNumber(line.unitPrice, 2) : '-'}
              </td>
              <td className="num">
                {result.amount !== undefined ? formatNumber(result.amount, 2) : '-'}
              </td>
              <td>{line.notes ?? ''}</td>
            </tr>
          ))}
        </Fragment>
      ))}
    </>
  );
}

function CostPreview() {
  const entries = useCostStore((s) => s.entries);
  const projectName = useCostStore((s) => s.projectName);
  const report = useMemo(() => buildCostReport(entries, projectName), [entries, projectName]);

  if (entries.length === 0) return <EmptyPreview />;

  return (
    <div className="mt-preview">
      <PreviewHeading label="โครงการ / ไซต์งาน" value={report.projectName || '-'} />

      <h4>ค่าวัสดุ</h4>
      <div className="mt-table-wrap">
        <table className="mt-table">
          <thead>
            <tr>
              <th>วันที่</th>
              <th>รายการวัสดุ</th>
              <th>ร้านค้า</th>
              <th>เลขที่บิล</th>
              <th className="num">ราคารวม (VAT)</th>
              <th>หมายเหตุ</th>
            </tr>
          </thead>
          <tbody>
            {report.materials.map((entry) => (
              <tr key={entry.id}>
                <td>{entry.date}</td>
                <td>{entry.name || '-'}</td>
                <td>{entry.vendor ?? ''}</td>
                <td>{entry.reference ?? ''}</td>
                <td className="num">{formatNumber(entry.amount, 2)}</td>
                <td>{entry.notes ?? ''}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4}>รวมค่าวัสดุ</td>
              <td className="num">{formatCurrency(report.totals.material)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      <h4>ค่าแรงช่าง</h4>
      <div className="mt-table-wrap">
        <table className="mt-table">
          <thead>
            <tr>
              <th>วันที่</th>
              <th>รายการงาน / ทีมช่าง</th>
              <th>จำนวน</th>
              <th className="num">ราคา/หน่วย</th>
              <th className="num">ค่าเดินทาง</th>
              <th className="num">รวมเงิน</th>
              <th>หมายเหตุ</th>
            </tr>
          </thead>
          <tbody>
            {report.labour.map((entry) => (
              <tr key={entry.id}>
                <td>{entry.date}</td>
                <td>{entry.name || '-'}</td>
                <td>
                  {formatNumber(entry.quantity, 2)} {entry.unit}
                </td>
                <td className="num">{formatNumber(entry.unitPrice, 2)}</td>
                <td className="num">
                  {travelAmount(entry) > 0 ? formatNumber(travelAmount(entry), 2) : '-'}
                </td>
                <td className="num">{formatNumber(entry.amount, 2)}</td>
                <td>{entry.notes ?? ''}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={5}>รวมค่าแรง</td>
              <td className="num">{formatCurrency(report.totals.labour)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="mt-preview__total">
        <span>รวมต้นทุนทั้งสิ้น</span>
        <strong>{formatCurrency(report.totals.total)}</strong>
      </div>
    </div>
  );
}

function BoqPreview() {
  const measurements = useMeasurementStore((s) => s.measurements);
  const scale = useMeasurementStore((s) => s.scale);
  const doc = useMeasurementStore((s) => s.doc);
  const projectName = useMeasurementStore((s) => s.projectName);
  const boqOptions = useUiStore((s) => s.boqOptions);

  const report = useMemo(
    () =>
      buildBoqReport(measurements, scale, {
        ...boqOptions,
        projectName: projectName || boqOptions.projectName,
        drawingName: doc?.name ?? boqOptions.drawingName,
        scaleLabel: scaleLabel(scale),
      }),
    [boqOptions, doc?.name, measurements, projectName, scale],
  );

  if (report.rows.length === 0) return <EmptyPreview />;

  return (
    <div className="mt-preview">
      <PreviewHeading label="โครงการ" value={report.projectName || '-'} />
      <PreviewHeading label="แบบ" value={report.drawingName || '-'} />
      <PreviewHeading label="มาตราส่วน" value={report.scaleLabel} />

      <div className="mt-table-wrap">
        <table className="mt-table">
          <thead>
            <tr>
              <th>#</th>
              <th>รหัส</th>
              <th>รายการ</th>
              <th>หมวดงาน</th>
              <th>หน่วย</th>
              <th className="num">ปริมาณ</th>
              <th className="num">ราคา/หน่วย</th>
              <th className="num">จำนวนเงิน</th>
              <th>หมายเหตุ</th>
            </tr>
          </thead>
          <tbody>
            {report.rows.map((row) => (
              <tr key={`${row.no}-${row.code}`}>
                <td>{row.no}</td>
                <td>{row.code}</td>
                <td>{row.description}</td>
                <td>{row.category}</td>
                <td>{row.unit}</td>
                <td className="num">{formatNumber(row.quantity, 3)}</td>
                <td className="num">
                  {row.unitPrice !== undefined ? formatNumber(row.unitPrice, 2) : '—'}
                </td>
                <td className="num">
                  {row.amount !== undefined ? formatNumber(row.amount, 2) : '—'}
                </td>
                <td>{row.remark ?? ''}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={7}>รวมทั้งสิ้น</td>
              <td className="num">{formatCurrency(report.subtotal)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

const PreviewHeading = ({ label, value }: { label: string; value: string }) => (
  <p className="mt-preview__meta">
    <span>{label}:</span> {value}
  </p>
);

const EmptyPreview = () => <p className="mt-muted">ยังไม่มีรายการสำหรับแสดง</p>;
