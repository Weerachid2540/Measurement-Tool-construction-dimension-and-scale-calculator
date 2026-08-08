import {
  selectAcceptedCount,
  useAutoCountStore,
  useMeasurementStore,
} from '@/store';
import { useAutoCount } from '@/hooks';
import { Button, Checkbox, Field, Icon } from '@/components/common';
import { formatNumber } from '@/utils/format';

/**
 * Symbol auto-count: pick one instance of a symbol, then find every other copy of it
 * on the sheet by template matching. Everything runs locally in a worker.
 */
export function AutoCountPanel() {
  const stage = useAutoCountStore((s) => s.stage);
  const preview = useAutoCountStore((s) => s.templatePreview);
  const options = useAutoCountStore((s) => s.options);
  const setOptions = useAutoCountStore((s) => s.setOptions);
  const matches = useAutoCountStore((s) => s.matches);
  const acceptedCount = useAutoCountStore(selectAcceptedCount);
  const progress = useAutoCountStore((s) => s.progress);
  const error = useAutoCountStore((s) => s.error);
  const beginSelection = useAutoCountStore((s) => s.beginSelection);
  const setAllAccepted = useAutoCountStore((s) => s.setAllAccepted);
  const cancelSearch = useAutoCountStore((s) => s.cancelSearch);
  const reset = useAutoCountStore((s) => s.reset);

  const hasDocument = useMeasurementStore((s) => s.page !== null);
  const setTool = useMeasurementStore((s) => s.setTool);
  const { search, commit } = useAutoCount();

  const startOver = () => {
    reset();
    setTool('autoCount');
    beginSelection();
  };

  if (!hasDocument) {
    return (
      <div className="mt-empty">
        <Icon name="count" size={32} strokeWidth={1.2} />
        <p>ยังไม่ได้เปิดไฟล์แบบ</p>
        <span>เปิดแบบก่อน แล้วจึงใช้การนับสัญลักษณ์อัตโนมัติได้</span>
      </div>
    );
  }

  return (
    <div className="mt-panel-body mt-autocount">
      <section className="mt-props__section">
        <h3>นับสัญลักษณ์อัตโนมัติ</h3>
        <ol className="mt-steps">
          <li className={stage === 'selecting' ? 'is-active' : stage !== 'idle' ? 'is-done' : ''}>
            ลากกรอบคลุมสัญลักษณ์ที่ต้องการนับ <strong>1 ตัว</strong>
          </li>
          <li className={stage === 'ready' || stage === 'searching' ? 'is-active' : stage === 'review' ? 'is-done' : ''}>
            ตั้งค่าความคล้าย แล้วกดค้นหา
          </li>
          <li className={stage === 'review' ? 'is-active' : ''}>
            ตรวจผล คลิกจุดที่ผิดเพื่อตัดออก แล้วยืนยัน
          </li>
        </ol>

        {stage === 'idle' && (
          <Button variant="primary" icon="count" onClick={startOver}>
            เริ่มเลือกสัญลักษณ์
          </Button>
        )}

        {stage === 'selecting' && (
          <p className="mt-hint-box">
            <Icon name="info" size={16} />
            ลากกรอบบนแบบให้คลุมสัญลักษณ์พอดี — กรอบยิ่งแนบตัวสัญลักษณ์ ผลลัพธ์ยิ่งแม่น
          </p>
        )}
      </section>

      {preview && (
        <section className="mt-props__section">
          <h3>สัญลักษณ์ต้นแบบ</h3>
          <div className="mt-autocount__template">
            <img src={preview} alt="สัญลักษณ์ที่เลือก" />
            <Button size="sm" icon="select" onClick={startOver}>
              เลือกใหม่
            </Button>
          </div>

          <Field
            label={`ความคล้ายขั้นต่ำ — ${formatNumber(options.threshold * 100, 0)}%`}
            hint="ลดค่าลงถ้าหาไม่เจอ · เพิ่มค่าขึ้นถ้าเจอของที่ไม่เกี่ยวปนมา"
          >
            <input
              type="range"
              className="mt-range"
              min={0.5}
              max={0.99}
              step={0.01}
              value={options.threshold}
              disabled={stage === 'searching'}
              onChange={(e) => setOptions({ threshold: Number.parseFloat(e.target.value) })}
            />
          </Field>

          <Checkbox
            label="ค้นหาสัญลักษณ์ที่หมุน 90° ด้วย (ช้าขึ้น ~4 เท่า)"
            checked={options.matchRotations}
            onCheckedChange={(matchRotations) => setOptions({ matchRotations })}
            disabled={stage === 'searching'}
          />

          {stage === 'searching' ? (
            <div className="mt-autocount__progress">
              <div className="mt-progress">
                <div className="mt-progress__bar" style={{ width: `${progress}%` }} />
              </div>
              <span>กำลังค้นหา {progress}%</span>
              <Button size="sm" variant="danger" onClick={cancelSearch}>
                ยกเลิก
              </Button>
            </div>
          ) : (
            <Button variant="primary" icon="search" onClick={() => void search()}>
              ค้นหาสัญลักษณ์ที่เหมือนกัน
            </Button>
          )}

          {error && <p className="mt-error">{error}</p>}
        </section>
      )}

      {stage === 'review' && (
        <section className="mt-props__section">
          <h3>ผลการค้นหา</h3>
          <div className="mt-summary-strip">
            <div>
              <span>พบทั้งหมด</span>
              <strong>{matches.length}</strong>
            </div>
            <div>
              <span>เลือกไว้</span>
              <strong>{acceptedCount}</strong>
            </div>
            <div>
              <span>ตัดออก</span>
              <strong>{matches.length - acceptedCount}</strong>
            </div>
          </div>

          <p className="mt-hint-box">
            <Icon name="info" size={16} />
            วงสีเขียวคือจุดที่จะบันทึก คลิกที่วงบนแบบเพื่อสลับเลือก/ไม่เลือก
          </p>

          <div className="mt-inline-group">
            <Button size="sm" onClick={() => setAllAccepted(true)}>
              เลือกทั้งหมด
            </Button>
            <Button size="sm" onClick={() => setAllAccepted(false)}>
              ไม่เลือกเลย
            </Button>
          </div>

          <div className="mt-panel-footer mt-panel-footer--split">
            <Button variant="ghost" onClick={reset}>
              ทิ้งผลลัพธ์
            </Button>
            <Button variant="primary" icon="check" onClick={commit} disabled={acceptedCount === 0}>
              ยืนยัน {acceptedCount} จุด
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
