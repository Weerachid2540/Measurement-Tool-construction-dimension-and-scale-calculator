import { useMemo, useState } from 'react';
import type { LengthUnit } from '@/types';
import { useMeasurementStore, useUiStore } from '@/store';
import { Button, Field, Modal, NumberInput, Select } from '@/components/common';
import { distance } from '@/utils/geometry';
import { calibrationPxPerPaperMm, pxToRealMm } from '@/utils/scale';
import { formatLength, formatNumber } from '@/utils/format';

const UNIT_OPTIONS: { value: LengthUnit; label: string }[] = [
  { value: 'mm', label: 'มิลลิเมตร' },
  { value: 'cm', label: 'เซนติเมตร' },
  { value: 'm', label: 'เมตร' },
];

/**
 * Turns a reference line drawn over a known dimension into an exact `pxPerPaperMm`,
 * which is what makes measurements on scanned or photographed drawings trustworthy.
 */
export function CalibrateModal() {
  const modal = useUiStore((s) => s.modal);
  const closeModal = useUiStore((s) => s.closeModal);
  const notify = useUiStore((s) => s.notify);
  const draft = useMeasurementStore((s) => s.draft);
  const scale = useMeasurementStore((s) => s.scale);
  const setScale = useMeasurementStore((s) => s.setScale);
  const cancelDraft = useMeasurementStore((s) => s.cancelDraft);
  const setTool = useMeasurementStore((s) => s.setTool);

  const [knownLength, setKnownLength] = useState(1);
  const [unit, setUnit] = useState<LengthUnit>('m');

  const open = modal === 'calibrate';
  const pixelLength = useMemo(
    () => (draft.length >= 2 ? distance(draft[0], draft[1]) : 0),
    [draft],
  );

  const close = () => {
    cancelDraft();
    closeModal();
  };

  const apply = () => {
    if (pixelLength <= 0 || knownLength <= 0) {
      notify('กรุณาระบุความยาวจริงที่มากกว่า 0', 'error');
      return;
    }
    const pxPerPaperMm = calibrationPxPerPaperMm(pixelLength, knownLength, unit, scale.ratio);
    setScale({ pxPerPaperMm, calibrated: true });
    cancelDraft();
    closeModal();
    setTool('select');
    notify('ปรับเทียบมาตราส่วนสำเร็จ', 'success');
  };

  return (
    <Modal
      open={open}
      title="ปรับเทียบมาตราส่วน (Calibrate)"
      onClose={close}
      footer={
        <>
          <Button onClick={close}>ยกเลิก</Button>
          <Button variant="primary" icon="check" onClick={apply}>
            ใช้ค่านี้
          </Button>
        </>
      }
    >
      <p className="mt-modal__lead">
        ระยะอ้างอิงที่วัดได้ <strong>{formatNumber(pixelLength, 1)} พิกเซล</strong> — กรอกความยาวจริง
        ของระยะนี้ เพื่อให้โปรแกรมคำนวณมาตราส่วนของแบบ
      </p>

      <div className="mt-grid-2">
        <Field label="ความยาวจริง">
          <NumberInput value={knownLength} min={0.0001} step={0.1} onValueChange={setKnownLength} />
        </Field>
        <Field label="หน่วย">
          <Select value={unit} options={UNIT_OPTIONS} onValueChange={setUnit} />
        </Field>
      </div>

      <div className="mt-callout">
        <div>
          <span>มาตราส่วนที่ใช้อยู่</span>
          <strong>1 : {formatNumber(scale.ratio, 0)}</strong>
        </div>
        <div>
          <span>ค่าเดิม 1 พิกเซล เท่ากับ</span>
          <strong>{formatLength(pxToRealMm(1, scale), scale.unit)}</strong>
        </div>
        <div>
          <span>ค่าใหม่ 1 พิกเซล จะเท่ากับ</span>
          <strong>
            {pixelLength > 0 && knownLength > 0
              ? formatLength(
                  pxToRealMm(1, {
                    ...scale,
                    pxPerPaperMm: calibrationPxPerPaperMm(
                      pixelLength,
                      knownLength,
                      unit,
                      scale.ratio,
                    ),
                  }),
                  scale.unit,
                )
              : '—'}
          </strong>
        </div>
      </div>
    </Modal>
  );
}
