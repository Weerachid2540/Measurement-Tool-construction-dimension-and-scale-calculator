import type { MaterialKind, Measurement, TakeoffGroupId } from '@/types';
import {
  MATERIAL_PRESETS,
  REBAR_SIZES,
  TAKEOFF_CATEGORIES,
  takeoffGroup,
  takeoffGroupsOf,
} from '@/types';
import { useMeasurementStore } from '@/store';
import type { SelectOption } from '@/components/common';
import { Checkbox, Field, Icon, NumberInput, Select, TextArea, TextInput } from '@/components/common';
import { PALETTE } from '@/utils/colors';
import { computeMeasurement, isAreaType, isLengthType, TYPE_LABELS } from '@/utils/measurement';
import { computeMaterial, defaultMaterialSpec, presetFor } from '@/utils/materials';
import { formatCurrency, formatNumber, formatQuantity } from '@/utils/format';

const MATERIAL_OPTIONS = [
  { value: 'none' as const, label: '— ไม่กำหนดวัสดุ —' },
  ...MATERIAL_PRESETS.map((preset) => ({ value: preset.kind, label: preset.label })),
];

const WORK_OPTIONS: SelectOption<TakeoffGroupId>[] = [
  { value: 'none', label: '— ไม่กำหนดหมวดงาน —' },
  ...TAKEOFF_CATEGORIES.flatMap((category) =>
    takeoffGroupsOf(category.id).map((group) => ({
      value: group.id,
      label: `${group.no}. ${group.label}`,
      group: `${category.no}. ${category.label}`,
    })),
  ),
];

export function PropertiesPanel() {
  const measurements = useMeasurementStore((s) => s.measurements);
  const selectedIds = useMeasurementStore((s) => s.selectedIds);
  const scale = useMeasurementStore((s) => s.scale);
  const updateMeasurement = useMeasurementStore((s) => s.updateMeasurement);

  const measurement = measurements.find((m) => m.id === selectedIds[0]);

  if (!measurement) {
    return (
      <div className="mt-empty">
        <Icon name="settings" size={32} strokeWidth={1.2} />
        <p>ยังไม่ได้เลือกรายการ</p>
        <span>คลิกรูปบนแบบ หรือเลือกจากรายการวัด เพื่อกำหนดวัสดุและราคา</span>
      </div>
    );
  }

  const result = computeMeasurement(measurement, scale);
  const material = computeMaterial(measurement, result);
  const spec = measurement.material;

  const patchMaterial = (patch: Partial<NonNullable<Measurement['material']>>) => {
    if (!spec) return;
    updateMeasurement(measurement.id, { material: { ...spec, ...patch } });
  };

  const changeKind = (value: MaterialKind | 'none') => {
    updateMeasurement(measurement.id, {
      material:
        value === 'none' ? undefined : { ...defaultMaterialSpec(value), workGroup: spec?.workGroup },
    });
  };

  /**
   * เลือกหมวดงานแล้วตั้งวัสดุให้อัตโนมัติเฉพาะตอนที่ยังไม่ได้กำหนด
   * ถ้ากำหนดวัสดุไว้แล้วจะเก็บค่าที่ผู้ใช้กรอกไว้ทั้งหมด เปลี่ยนแค่หมวดงาน
   */
  const changeWorkGroup = (value: TakeoffGroupId) => {
    if (value === 'none') {
      if (spec) updateMeasurement(measurement.id, { material: { ...spec, workGroup: undefined } });
      return;
    }
    const group = takeoffGroup(value);
    const base = spec ?? defaultMaterialSpec(group?.materialKind ?? 'custom');
    updateMeasurement(measurement.id, { material: { ...base, workGroup: value } });
  };

  const workGroupOfSpec = spec?.workGroup ? takeoffGroup(spec.workGroup) : undefined;

  return (
    <div className="mt-panel-body mt-props">
      <section className="mt-props__section">
        <h3>ข้อมูลรายการ</h3>
        <Field label="ชื่อ / รหัส">
          <TextInput
            value={measurement.label}
            onChange={(e) => updateMeasurement(measurement.id, { label: e.target.value })}
          />
        </Field>
        <div className="mt-props__meta">
          <span>{TYPE_LABELS[measurement.type]}</span>
          <span>หน้า {measurement.page}</span>
        </div>

        <Field label="สี">
          <div className="mt-swatches mt-swatches--inline">
            {PALETTE.map((color) => (
              <button
                key={color}
                type="button"
                className={`mt-swatch ${measurement.color === color ? 'is-active' : ''}`}
                style={{ backgroundColor: color }}
                onClick={() => updateMeasurement(measurement.id, { color })}
              />
            ))}
          </div>
        </Field>

        <div className="mt-props__toggles">
          <Checkbox
            label="แสดงบนแบบ"
            checked={measurement.visible}
            onCheckedChange={(visible) => updateMeasurement(measurement.id, { visible })}
          />
          <Checkbox
            label="ล็อก"
            checked={measurement.locked}
            onCheckedChange={(locked) => updateMeasurement(measurement.id, { locked })}
          />
        </div>

        <Field label="หมายเหตุ">
          <TextArea
            value={measurement.notes ?? ''}
            onChange={(e) => updateMeasurement(measurement.id, { notes: e.target.value })}
            placeholder="เช่น พื้น ค.ส.ล. ชั้น 2 โซน A"
          />
        </Field>
      </section>

      <section className="mt-props__section">
        <h3>ผลการวัด</h3>
        <div className="mt-readout">
          <div className="mt-readout__primary">
            <span>{result.primary.label}</span>
            <strong>{formatQuantity(result.primary)}</strong>
          </div>
          <dl>
            {result.secondary.map((item) => (
              <div key={item.label}>
                <dt>{item.label}</dt>
                <dd>{formatQuantity(item)}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="mt-props__section">
        <h3>วัสดุ &amp; ปริมาณ</h3>
        <Field
          label="หมวดงาน (BOQ)"
          hint={workGroupOfSpec ? 'ใช้จัดกลุ่มรายการใน BOQ และไฟล์ส่งออก' : undefined}
        >
          <Select
            value={spec?.workGroup ?? 'none'}
            options={WORK_OPTIONS}
            onValueChange={changeWorkGroup}
          />
        </Field>

        <Field label="ประเภทวัสดุ" hint={spec ? presetFor(spec.kind).hint : undefined}>
          <Select
            value={spec?.kind ?? 'none'}
            options={MATERIAL_OPTIONS}
            onValueChange={changeKind}
          />
        </Field>

        {spec && (
          <>
            <Field label="ชื่อรายการใน BOQ (ไม่กรอกจะสร้างให้อัตโนมัติ)">
              <TextInput
                value={spec.name ?? ''}
                onChange={(e) => patchMaterial({ name: e.target.value })}
                placeholder="เช่น พื้น ค.ส.ล. หนา 0.12 ม."
              />
            </Field>

            <div className="mt-grid-2">
              {isAreaType(measurement.type) && (
                <Field label="ความหนา / ความลึก" inline>
                  <NumberInput
                    value={spec.thicknessMm}
                    min={0}
                    step={10}
                    suffix="มม."
                    onValueChange={(thicknessMm) => patchMaterial({ thicknessMm })}
                  />
                </Field>
              )}

              {isLengthType(measurement.type) && spec.kind === 'concrete' && (
                <>
                  <Field label="ความกว้างหน้าตัด" inline>
                    <NumberInput
                      value={spec.widthMm}
                      min={0}
                      step={10}
                      suffix="มม."
                      onValueChange={(widthMm) => patchMaterial({ widthMm })}
                    />
                  </Field>
                  <Field label="ความลึกหน้าตัด" inline>
                    <NumberInput
                      value={spec.depthMm}
                      min={0}
                      step={10}
                      suffix="มม."
                      onValueChange={(depthMm) => patchMaterial({ depthMm })}
                    />
                  </Field>
                </>
              )}

              {spec.kind === 'steel' && (
                <>
                  <Field label="ขนาดเหล็ก" inline>
                    <Select
                      value={String(spec.rebarDiameterMm ?? 12)}
                      options={REBAR_SIZES.map((size) => ({
                        value: String(size.diameterMm),
                        label: `${size.id} (Ø${size.diameterMm})`,
                      }))}
                      onValueChange={(value) =>
                        patchMaterial({ rebarDiameterMm: Number.parseFloat(value) })
                      }
                    />
                  </Field>
                  <Field label="จำนวนเส้น" inline>
                    <NumberInput
                      value={spec.barsPerMember}
                      min={1}
                      step={1}
                      onValueChange={(barsPerMember) => patchMaterial({ barsPerMember })}
                    />
                  </Field>
                </>
              )}

              {spec.kind === 'formwork' && (
                <>
                  <Field label="ความสูงแบบ" inline>
                    <NumberInput
                      value={spec.depthMm}
                      min={0}
                      step={10}
                      suffix="มม."
                      onValueChange={(depthMm) => patchMaterial({ depthMm })}
                    />
                  </Field>
                  <Field label="จำนวนด้าน" inline>
                    <NumberInput
                      value={spec.formworkSides}
                      min={1}
                      max={4}
                      step={1}
                      onValueChange={(formworkSides) => patchMaterial({ formworkSides })}
                    />
                  </Field>
                </>
              )}

              <Field label="เผื่อเสียหาย" inline>
                <NumberInput
                  value={spec.wastePercent}
                  min={0}
                  max={50}
                  step={1}
                  suffix="%"
                  onValueChange={(wastePercent) => patchMaterial({ wastePercent })}
                />
              </Field>

              <Field label="ราคาต่อหน่วย" inline>
                <NumberInput
                  value={spec.unitPrice}
                  min={0}
                  step={10}
                  suffix="บาท"
                  onValueChange={(unitPrice) => patchMaterial({ unitPrice })}
                />
              </Field>
            </div>
          </>
        )}

        {material && (
          <div className="mt-material-result">
            <p>{material.description}</p>
            <div className="mt-material-result__figures">
              <span>
                ปริมาณ <strong>{formatNumber(material.quantity, 3)} {material.unit}</strong>
              </span>
              {material.volumeM3 !== undefined && (
                <span>
                  ปริมาตร <strong>{formatNumber(material.volumeM3, 3)} m³</strong>
                </span>
              )}
              {material.weightKg !== undefined && (
                <span>
                  น้ำหนัก <strong>{formatNumber(material.weightKg, 2)} kg</strong>
                </span>
              )}
              {material.amount !== undefined && (
                <span>
                  รวมเงิน <strong>{formatCurrency(material.amount)}</strong>
                </span>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
