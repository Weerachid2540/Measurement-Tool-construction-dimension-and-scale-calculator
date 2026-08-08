import type { LengthUnit } from '@/types';
import { CUSTOM_SCALE_ID, SCALE_PRESETS } from '@/types';
import { useMeasurementStore, useUiStore } from '@/store';
import { Icon, NumberInput, Select } from '@/components/common';

const UNIT_OPTIONS: { value: LengthUnit; label: string }[] = [
  { value: 'mm', label: 'มม.' },
  { value: 'cm', label: 'ซม.' },
  { value: 'm', label: 'ม.' },
];

const PRESET_OPTIONS = [
  ...SCALE_PRESETS.map((preset) => ({ value: preset.id, label: preset.label })),
  { value: CUSTOM_SCALE_ID, label: 'กำหนดเอง…' },
];

export function ScaleControl() {
  const scale = useMeasurementStore((s) => s.scale);
  const setScale = useMeasurementStore((s) => s.setScale);
  const setScalePreset = useMeasurementStore((s) => s.setScalePreset);
  const setDisplayUnit = useMeasurementStore((s) => s.setDisplayUnit);
  const setTool = useMeasurementStore((s) => s.setTool);
  const hasDocument = useMeasurementStore((s) => s.page !== null);
  const notify = useUiStore((s) => s.notify);

  const isCustom = scale.presetId === CUSTOM_SCALE_ID;

  return (
    <div className="mt-scale">
      <label className="mt-scale__item">
        <span>มาตราส่วน</span>
        <Select
          value={scale.presetId}
          options={PRESET_OPTIONS}
          onValueChange={setScalePreset}
          disabled={!hasDocument}
        />
      </label>

      {isCustom && (
        <label className="mt-scale__item mt-scale__item--narrow">
          <span>1 :</span>
          <NumberInput
            value={scale.ratio}
            min={0.01}
            step={1}
            onValueChange={(ratio) => setScale({ ratio: ratio > 0 ? ratio : 1 })}
          />
        </label>
      )}

      <label className="mt-scale__item mt-scale__item--narrow">
        <span>หน่วย</span>
        <Select value={scale.unit} options={UNIT_OPTIONS} onValueChange={setDisplayUnit} />
      </label>

      <button
        type="button"
        className={`mt-btn mt-btn--secondary mt-btn--sm ${scale.calibrated ? '' : 'mt-btn--warn'}`}
        onClick={() => {
          if (!hasDocument) {
            notify('เปิดไฟล์แบบก่อนจึงจะปรับเทียบได้', 'error');
            return;
          }
          setTool('calibrate');
          notify('คลิก 2 จุดบนระยะที่ทราบค่า แล้วกรอกความยาวจริง', 'info');
        }}
        title="ลากเส้นบนระยะที่ทราบค่า เพื่อให้โปรแกรมคำนวณมาตราส่วนจริง"
      >
        <Icon name="calibrate" size={16} />
        {scale.calibrated ? 'ปรับเทียบแล้ว' : 'ยังไม่ปรับเทียบ'}
      </button>
    </div>
  );
}
