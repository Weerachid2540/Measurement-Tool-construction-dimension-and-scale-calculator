import { useMemo } from 'react';
import { useMeasurementStore } from '@/store';
import { useMeasurementResults } from '@/hooks';
import { Button, Icon } from '@/components/common';
import { TYPE_LABELS } from '@/utils/measurement';
import { formatQuantity } from '@/utils/format';

export function MeasurementList() {
  const allMeasurements = useMeasurementStore((s) => s.measurements);
  const currentPage = useMeasurementStore((s) => s.currentPage);
  const scale = useMeasurementStore((s) => s.scale);
  const selectedIds = useMeasurementStore((s) => s.selectedIds);
  const select = useMeasurementStore((s) => s.select);
  const updateMeasurement = useMeasurementStore((s) => s.updateMeasurement);
  const removeMeasurements = useMeasurementStore((s) => s.removeMeasurements);
  const duplicateMeasurement = useMeasurementStore((s) => s.duplicateMeasurement);
  const clearMeasurements = useMeasurementStore((s) => s.clearMeasurements);

  const measurements = useMemo(
    () => allMeasurements.filter((m) => m.page === currentPage),
    [allMeasurements, currentPage],
  );
  const results = useMeasurementResults(measurements, scale);

  const totals = useMemo(() => {
    let lengthM = 0;
    let areaM2 = 0;
    let count = 0;
    for (const m of measurements) {
      const result = results.get(m.id);
      if (!result || !m.visible) continue;
      if (result.lengthMm) lengthM += result.lengthMm / 1000;
      if (result.areaMm2) areaM2 += result.areaMm2 / 1_000_000;
      if (result.count) count += result.count;
    }
    return { lengthM, areaM2, count };
  }, [measurements, results]);

  if (measurements.length === 0) {
    return (
      <div className="mt-empty">
        <Icon name="list" size={32} strokeWidth={1.2} />
        <p>ยังไม่มีรายการวัดในหน้านี้</p>
        <span>เลือกเครื่องมือจากแถบด้านซ้าย แล้วคลิกบนแบบเพื่อเริ่มวัด</span>
      </div>
    );
  }

  return (
    <div className="mt-panel-body">
      <div className="mt-summary-strip">
        <div>
          <span>ความยาวรวม</span>
          <strong>{totals.lengthM.toFixed(3)} m</strong>
        </div>
        <div>
          <span>พื้นที่รวม</span>
          <strong>{totals.areaM2.toFixed(3)} m²</strong>
        </div>
        <div>
          <span>นับได้</span>
          <strong>{totals.count} nos</strong>
        </div>
      </div>

      <ul className="mt-list">
        {measurements.map((measurement) => {
          const result = results.get(measurement.id);
          const selected = selectedIds.includes(measurement.id);
          return (
            <li
              key={measurement.id}
              className={`mt-list__item ${selected ? 'is-selected' : ''} ${
                measurement.visible ? '' : 'is-hidden'
              }`}
              onClick={() => select([measurement.id])}
            >
              <span className="mt-list__swatch" style={{ backgroundColor: measurement.color }} />
              <div className="mt-list__main">
                <div className="mt-list__title">
                  <strong>{measurement.label}</strong>
                  <span>{TYPE_LABELS[measurement.type]}</span>
                </div>
                <div className="mt-list__value">
                  {result ? formatQuantity(result.primary) : '—'}
                  {result && result.secondary.length > 0 && (
                    <em>
                      {result.secondary
                        .slice(0, 2)
                        .map((s) => `${s.label} ${formatQuantity(s)}`)
                        .join('  ·  ')}
                    </em>
                  )}
                </div>
              </div>
              <div className="mt-list__actions">
                <Button
                  icon={measurement.visible ? 'eye' : 'eyeOff'}
                  iconOnly
                  size="sm"
                  variant="ghost"
                  title={measurement.visible ? 'ซ่อน' : 'แสดง'}
                  onClick={(e) => {
                    e.stopPropagation();
                    updateMeasurement(measurement.id, { visible: !measurement.visible });
                  }}
                />
                <Button
                  icon="copy"
                  iconOnly
                  size="sm"
                  variant="ghost"
                  title="ทำสำเนา"
                  onClick={(e) => {
                    e.stopPropagation();
                    duplicateMeasurement(measurement.id);
                  }}
                />
                <Button
                  icon="trash"
                  iconOnly
                  size="sm"
                  variant="ghost"
                  title="ลบ"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeMeasurements([measurement.id]);
                  }}
                />
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-panel-footer">
        <Button
          variant="danger"
          size="sm"
          icon="trash"
          onClick={() => {
            if (window.confirm('ลบรายการวัดทั้งหมดในการวัดนี้?')) clearMeasurements();
          }}
        >
          ลบทั้งหมด
        </Button>
      </div>
    </div>
  );
}
