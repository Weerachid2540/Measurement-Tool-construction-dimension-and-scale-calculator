import { useMemo } from 'react';
import { selectAcceptedCount, useAutoCountStore, useMeasurementStore, useUiStore } from '@/store';
import { useAutoCount } from '@/hooks';
import { Button, Checkbox, Field, Icon } from '@/components/common';
import { formatNumber } from '@/utils/format';
import { SymbolLibrary } from './SymbolLibrary';

/**
 * Symbol auto-count: pick one instance of a symbol, then find every other copy of it
 * on the sheet by shape matching. Everything runs locally in a worker.
 */
export function AutoCountPanel() {
  const stage = useAutoCountStore((s) => s.stage);
  const preview = useAutoCountStore((s) => s.templatePreview);
  const options = useAutoCountStore((s) => s.options);
  const setOptions = useAutoCountStore((s) => s.setOptions);
  const templateBox = useAutoCountStore((s) => s.templateBox);
  const templateDirty = useAutoCountStore((s) => s.templateDirty);
  const allMatches = useAutoCountStore((s) => s.allMatches);
  const acceptedCount = useAutoCountStore(selectAcceptedCount);
  const progress = useAutoCountStore((s) => s.progress);
  const error = useAutoCountStore((s) => s.error);
  const beginSelection = useAutoCountStore((s) => s.beginSelection);
  const rejectAllVisible = useAutoCountStore((s) => s.rejectAllVisible);
  const clearRejections = useAutoCountStore((s) => s.clearRejections);
  const cancelSearch = useAutoCountStore((s) => s.cancelSearch);
  const reset = useAutoCountStore((s) => s.reset);

  const hasDocument = useMeasurementStore((s) => s.page !== null);
  const setTool = useMeasurementStore((s) => s.setTool);
  const openModal = useUiStore((s) => s.openModal);
  const { search, commit } = useAutoCount();

  const aboveThreshold = useMemo(
    () => allMatches.filter((m) => m.score >= options.threshold).length,
    [allMatches, options.threshold],
  );

  /** Score spread helps the user see where the real cut-off sits. */
  const scoreRange = useMemo(() => {
    if (allMatches.length === 0) return null;
    const scores = allMatches.map((m) => m.score);
    return { best: Math.max(...scores), worst: Math.min(...scores) };
  }, [allMatches]);

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
          <li
            className={
              stage === 'ready' || stage === 'searching'
                ? 'is-active'
                : stage === 'review'
                  ? 'is-done'
                  : ''
            }
          >
            กดค้นหา
          </li>
          <li className={stage === 'review' ? 'is-active' : ''}>
            เลื่อนแถบความคล้ายจนจำนวนพอดี แล้วยืนยัน
          </li>
        </ol>

        {stage === 'idle' && (
          <Button variant="primary" icon="count" onClick={startOver}>
            เริ่มเลือกสัญลักษณ์
          </Button>
        )}

        {(stage === 'idle' || stage === 'selecting') && (
          <details className="mt-disclosure" open={stage === 'idle'}>
            <summary>คลังสัญลักษณ์ — ใช้ตัวที่เคยบันทึกไว้</summary>
            <SymbolLibrary />
          </details>
        )}

        {stage === 'selecting' && (
          <p className="mt-hint-box">
            <Icon name="info" size={16} />
            ลากกรอบให้<strong>แนบตัวสัญลักษณ์</strong> อย่าให้ติดเส้นอื่นหรือตัวอักษรข้างเคียง —
            กรอบที่สะอาดคือปัจจัยสำคัญที่สุดของความแม่น
          </p>
        )}
      </section>

      {preview && (
        <section className="mt-props__section">
          <h3>สัญลักษณ์ต้นแบบ</h3>
          <div className="mt-autocount__template">
            <img src={preview} alt="สัญลักษณ์ที่เลือก" />
            <div className="mt-autocount__template-actions">
              <Button size="sm" icon="select" onClick={startOver}>
                เลือกใหม่
              </Button>
              {templateBox && (
                <Button size="sm" icon="save" onClick={() => openModal('saveSymbol')}>
                  บันทึกเข้าคลัง
                </Button>
              )}
            </div>
          </div>

          {templateBox && (
            <p className="mt-hint-box">
              <Icon name="info" size={16} />
              ลากมุมกรอบสีส้มบนแบบเพื่อย่อ/ขยายต้นแบบได้ — ปล่อยแล้วกดค้นหาใหม่เพื่อดูผลที่เปลี่ยนไป
            </p>
          )}

          {templateDirty && (
            <p className="mt-hint-box mt-hint-box--warn">
              <Icon name="warning" size={16} />
              ต้นแบบถูกแก้ไขแล้ว — ผลด้านล่างยังเป็นของกรอบเดิม กดค้นหาใหม่เพื่ออัปเดต
            </p>
          )}

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
              <span>{progress}%</span>
              <Button size="sm" variant="danger" onClick={cancelSearch}>
                ยกเลิก
              </Button>
            </div>
          ) : (
            <Button variant="primary" icon="search" onClick={() => void search()}>
              {stage === 'review' ? 'ค้นหาใหม่' : 'ค้นหาสัญลักษณ์ที่เหมือนกัน'}
            </Button>
          )}

          {error && <p className="mt-error">{error}</p>}
        </section>
      )}

      {stage === 'review' && (
        <section className="mt-props__section">
          <h3>ผลการค้นหา</h3>

          <Field
            label={`ความคล้ายขั้นต่ำ — ${formatNumber(options.threshold * 100, 0)}%`}
            hint="ระบบตั้งให้อัตโนมัติจากการกระจายของคะแนน · เลื่อนปรับเองได้ทันทีโดยไม่ต้องค้นหาใหม่"
          >
            <input
              type="range"
              className="mt-range"
              min={0.5}
              max={0.98}
              step={0.01}
              value={options.threshold}
              onChange={(e) => setOptions({ threshold: Number.parseFloat(e.target.value) })}
            />
          </Field>

          <div className="mt-summary-strip">
            <div>
              <span>ผ่านเกณฑ์</span>
              <strong>{aboveThreshold}</strong>
            </div>
            <div>
              <span>จะบันทึก</span>
              <strong>{acceptedCount}</strong>
            </div>
            <div>
              <span>พบทั้งหมด</span>
              <strong>{allMatches.length}</strong>
            </div>
          </div>

          {scoreRange && (
            <p className="mt-muted mt-autocount__scores">
              คะแนนสูงสุด {formatNumber(scoreRange.best * 100, 0)}% · ต่ำสุด{' '}
              {formatNumber(scoreRange.worst * 100, 0)}%
            </p>
          )}

          {/*
            The template is cut from the searched image, so the symbol it came from
            must score ~100%. Anything lower means the pipeline itself is off, not
            that the threshold needs nudging — worth telling the user apart.
          */}
          {scoreRange && scoreRange.best < 0.95 && (
            <p className="mt-hint-box mt-hint-box--warn">
              <Icon name="warning" size={16} />
              คะแนนสูงสุดควรอยู่ที่ ~100% (ระบบต้องเจอสัญลักษณ์ต้นแบบของตัวเอง) — ได้เพียง{' '}
              {formatNumber(scoreRange.best * 100, 0)}% แปลว่ากรอบต้นแบบอาจคาบเส้นอื่นอยู่
              ลองเลือกใหม่ให้แนบตัวสัญลักษณ์
            </p>
          )}

          {aboveThreshold === 0 ? (
            <p className="mt-hint-box">
              <Icon name="warning" size={16} />
              ไม่มีตัวไหนผ่านเกณฑ์ — ลดความคล้ายลง หรือเลือกสัญลักษณ์ต้นแบบใหม่ให้กรอบแนบกว่านี้
            </p>
          ) : (
            <p className="mt-hint-box">
              <Icon name="info" size={16} />
              วงสีเขียวคือจุดที่จะบันทึก คลิกวงบนแบบเพื่อสลับเลือก/ไม่เลือกทีละจุด
            </p>
          )}

          <div className="mt-inline-group">
            <Button size="sm" onClick={clearRejections}>
              เลือกทั้งหมด
            </Button>
            <Button size="sm" onClick={rejectAllVisible}>
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
