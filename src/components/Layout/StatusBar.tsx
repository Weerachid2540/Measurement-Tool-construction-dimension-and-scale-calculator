import { useMeasurementStore } from '@/store';
import { formatLength, formatNumber } from '@/utils/format';
import { pxToRealMm, scaleLabel } from '@/utils/scale';

const HINTS: Partial<Record<string, string>> = {
  select: 'คลิกรูปเพื่อเลือก · ลากจุดสีเพื่อแก้ไข · Delete เพื่อลบ',
  pan: 'ลากเพื่อเลื่อนภาพ · สกรอลล์เพื่อซูม',
  line: 'คลิก 2 จุด · กด Shift ล็อกมุม 45°',
  polyline: 'คลิกทีละจุด · ดับเบิลคลิกหรือ Enter เพื่อจบ',
  rectangle: 'คลิกมุมตรงข้าม 2 จุด',
  polygon: 'คลิกทีละจุด · ดับเบิลคลิกหรือ Enter เพื่อปิดรูป',
  circle: 'คลิกจุดศูนย์กลาง แล้วคลิกที่ขอบ',
  angle: 'คลิกปลายแขนแรก → จุดยอดมุม → ปลายแขนที่สอง',
  count: 'คลิกเพื่อเพิ่มจุดนับ · Enter เพื่อจบ',
  autoCount: 'ลากกรอบคลุมสัญลักษณ์ 1 ตัว แล้วกดค้นหาในแผงด้านขวา',
  calibrate:
    'คลิก 2 จุดบนระยะที่ทราบค่า แล้วกรอกความยาวจริง · เส้นล็อกแนวนอน/แนวตั้งให้ (กด Shift เพื่อลากเฉียง)',
};

export function StatusBar() {
  const cursor = useMeasurementStore((s) => s.cursor);
  const scale = useMeasurementStore((s) => s.scale);
  const activeTool = useMeasurementStore((s) => s.activeTool);
  const page = useMeasurementStore((s) => s.page);
  const measurements = useMeasurementStore((s) => s.measurements);
  const currentPage = useMeasurementStore((s) => s.currentPage);

  const onPage = measurements.filter((m) => m.page === currentPage).length;

  return (
    <footer className="mt-statusbar">
      <span className="mt-statusbar__hint">{HINTS[activeTool] ?? ''}</span>

      <div className="mt-statusbar__meta">
        {page && (
          <span>
            ขนาดแบบ {page.width} × {page.height} px
          </span>
        )}
        <span>มาตราส่วน {scaleLabel(scale)}</span>
        <span>
          1 px ≈ {formatLength(pxToRealMm(1, scale), scale.unit)}
          {!scale.calibrated && ' (ประมาณ)'}
        </span>
        {cursor && (
          <span>
            X {formatNumber(pxToRealMm(cursor.x, scale) / 1000, 2)} m · Y{' '}
            {formatNumber(pxToRealMm(cursor.y, scale) / 1000, 2)} m
          </span>
        )}
        <span>{onPage} รายการในหน้านี้</span>
      </div>
    </footer>
  );
}
