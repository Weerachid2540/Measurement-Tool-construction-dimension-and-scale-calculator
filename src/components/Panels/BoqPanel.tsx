import { useMemo, useState } from 'react';
import { useMeasurementStore, useUiStore } from '@/store';
import { Button, Checkbox, Field, Icon, TextInput } from '@/components/common';
import { buildBoqReport } from '@/utils/boq';
import { formatCurrency, formatNumber } from '@/utils/format';
import { scaleLabel } from '@/utils/scale';
import { getStageSnapshot } from '@/components/Canvas/stageRegistry';

export function BoqPanel() {
  const measurements = useMeasurementStore((s) => s.measurements);
  const scale = useMeasurementStore((s) => s.scale);
  const doc = useMeasurementStore((s) => s.doc);
  const projectName = useMeasurementStore((s) => s.projectName);
  const setSessionMeta = useMeasurementStore((s) => s.setSessionMeta);
  const updateMeasurement = useMeasurementStore((s) => s.updateMeasurement);
  const boqOptions = useUiStore((s) => s.boqOptions);
  const setBoqOptions = useUiStore((s) => s.setBoqOptions);
  const notify = useUiStore((s) => s.notify);
  const setBusy = useUiStore((s) => s.setBusy);
  const openPreview = useUiStore((s) => s.openPreview);
  const [includeSnapshot, setIncludeSnapshot] = useState(true);

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

  const handleExcel = async () => {
    if (report.rows.length === 0) {
      notify('ยังไม่มีรายการสำหรับส่งออก', 'error');
      return;
    }
    try {
      setBusy('กำลังสร้างไฟล์ Excel…');
      const { exportBoqToExcel } = await import('@/utils/export');
      await exportBoqToExcel(report, measurements, scale);
      notify('ส่งออก Excel สำเร็จ', 'success');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'ส่งออก Excel ไม่สำเร็จ', 'error');
    } finally {
      setBusy(null);
    }
  };

  const handlePdf = async () => {
    if (report.rows.length === 0) {
      notify('ยังไม่มีรายการสำหรับส่งออก', 'error');
      return;
    }
    try {
      setBusy('กำลังสร้างไฟล์ PDF…');
      const { exportBoqToPdf, isThaiFontLoaded } = await import('@/utils/export');
      await exportBoqToPdf(report, {
        snapshot: includeSnapshot ? getStageSnapshot() : undefined,
      });
      // ไฟล์ยังออกได้ แต่ภาษาไทยจะอ่านไม่ออก ต้องบอกก่อนผู้ใช้ส่งให้ลูกค้า
      notify(
        isThaiFontLoaded()
          ? 'ส่งออก PDF สำเร็จ'
          : 'ไม่พบฟอนต์ไทย — ข้อความไทยใน PDF จะเพี้ยน (ใช้ Excel แทนได้)',
        isThaiFontLoaded() ? 'success' : 'error',
      );
    } catch (error) {
      notify(error instanceof Error ? error.message : 'ส่งออก PDF ไม่สำเร็จ', 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mt-panel-body mt-boq">
      <section className="mt-props__section">
        <Field label="ชื่อโครงการ">
          <TextInput
            value={projectName}
            placeholder="เช่น อาคารสำนักงาน 3 ชั้น"
            onChange={(e) => setSessionMeta({ projectName: e.target.value })}
          />
        </Field>
        <div className="mt-props__toggles">
          <Checkbox
            label="รวมรายการที่ซ่อน"
            checked={boqOptions.includeHiddenMeasurements}
            onCheckedChange={(includeHiddenMeasurements) =>
              setBoqOptions({ includeHiddenMeasurements })
            }
          />
          <Checkbox
            label="รวมรายการที่เหมือนกัน"
            checked={boqOptions.groupIdenticalItems}
            onCheckedChange={(groupIdenticalItems) => setBoqOptions({ groupIdenticalItems })}
          />
          <Checkbox
            label="แนบภาพแบบใน PDF"
            checked={includeSnapshot}
            onCheckedChange={setIncludeSnapshot}
          />
        </div>
      </section>

      {report.rows.length === 0 ? (
        <div className="mt-empty">
          <Icon name="table" size={32} strokeWidth={1.2} />
          <p>ยังไม่มีรายการใน BOQ</p>
          <span>วัดขนาดและกำหนดวัสดุในแท็บ &quot;คุณสมบัติ&quot; เพื่อสร้างรายการ</span>
        </div>
      ) : (
        <>
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
                    <td title={row.group}>{row.category}</td>
                    <td>{row.unit}</td>
                    <td className="num">{formatNumber(row.quantity, 3)}</td>
                    <td className="num">
                      {row.unitPrice !== undefined ? formatNumber(row.unitPrice, 2) : '—'}
                    </td>
                    <td className="num">
                      {row.amount !== undefined ? formatNumber(row.amount, 2) : '—'}
                    </td>
                    <td>
                      {/* หมายเหตุเก็บที่รายการวัด แก้จากตรงนี้หรือจากแท็บคุณสมบัติก็ได้ */}
                      {row.measurementId ? (
                        <TextInput
                          value={row.remark ?? ''}
                          placeholder="—"
                          onChange={(e) =>
                            updateMeasurement(row.measurementId as string, {
                              notes: e.target.value,
                            })
                          }
                        />
                      ) : (
                        (row.remark ?? '—')
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={8}>รวมทั้งสิ้น</td>
                  <td className="num">{formatCurrency(report.subtotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="mt-panel-footer mt-panel-footer--wrap">
            <Button icon="eye" variant="primary" onClick={() => openPreview('boq')}>
              พรีวิว
            </Button>
            <Button icon="excel" onClick={() => void handleExcel()}>
              ส่งออก Excel
            </Button>
            <Button icon="pdf" onClick={() => void handlePdf()}>
              ส่งออก PDF
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
