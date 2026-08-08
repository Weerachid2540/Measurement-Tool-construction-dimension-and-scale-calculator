import { useEffect, useState } from 'react';
import type { SymbolCategory } from '@/types';
import { categoryPreset, SYMBOL_CATEGORIES } from '@/types';
import { useAutoCountStore, useUiStore } from '@/store';
import { useAutoCount } from '@/hooks';
import { Button, Field, Modal, Select, TextInput } from '@/components/common';

const CATEGORY_OPTIONS = SYMBOL_CATEGORIES.map((c) => ({ value: c.id, label: c.label }));

/** Names a freshly selected symbol and files it in the reusable library. */
export function SaveSymbolModal() {
  const modal = useUiStore((s) => s.modal);
  const closeModal = useUiStore((s) => s.closeModal);
  const preview = useAutoCountStore((s) => s.templatePreview);
  const { saveToLibrary } = useAutoCount();

  const [code, setCode] = useState('');
  const [category, setCategory] = useState<SymbolCategory>('door');
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const open = modal === 'saveSymbol';

  // Suggest a name from the category and code until the user types their own.
  useEffect(() => {
    if (!open) return;
    setName(`${categoryPreset(category).boqPrefix} ${code}`.trim());
  }, [category, code, open]);

  useEffect(() => {
    if (open) {
      setCode('');
      setCategory('door');
      setSaving(false);
    }
  }, [open]);

  const submit = async () => {
    setSaving(true);
    try {
      await saveToLibrary({ name, code, category });
      closeModal();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title="บันทึกสัญลักษณ์เข้าคลัง"
      onClose={closeModal}
      footer={
        <>
          <Button onClick={closeModal}>ยกเลิก</Button>
          <Button variant="primary" icon="save" onClick={() => void submit()} disabled={saving}>
            บันทึก
          </Button>
        </>
      }
    >
      <div className="mt-symbol-save">
        {preview && <img src={preview} alt="สัญลักษณ์ที่เลือก" />}
        <p className="mt-muted">
          เก็บภาพสัญลักษณ์พร้อม<strong>ขนาดจริงบนกระดาษ</strong> จึงนำไปใช้กับแบบที่ความละเอียดต่างกันได้
        </p>
      </div>

      <Field label="หมวดงาน">
        <Select value={category} options={CATEGORY_OPTIONS} onValueChange={setCategory} />
      </Field>

      <Field label="รหัสในสัญลักษณ์" hint="เช่น 1A, D-01, TL-1 — ใช้เป็นรหัสรายการใน BOQ">
        <TextInput value={code} onChange={(e) => setCode(e.target.value)} placeholder="1A" />
      </Field>

      <Field label="ชื่อที่แสดงในคลัง">
        <TextInput value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
    </Modal>
  );
}
