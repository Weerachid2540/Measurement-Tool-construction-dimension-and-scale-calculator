import { useMeasurementStore, useUiStore } from '@/store';
import { useDocumentLoader, useSessionPersistence } from '@/hooks';
import { Button, TextInput } from '@/components/common';
import { FileDropzone } from '@/components/FileUpload/FileDropzone';

export function Header() {
  const sessionName = useMeasurementStore((s) => s.sessionName);
  const setSessionMeta = useMeasurementStore((s) => s.setSessionMeta);
  const isDirty = useMeasurementStore((s) => s.isDirty);
  const doc = useMeasurementStore((s) => s.doc);
  const newSession = useMeasurementStore((s) => s.newSession);
  const theme = useUiStore((s) => s.theme);
  const toggleTheme = useUiStore((s) => s.toggleTheme);
  const openModal = useUiStore((s) => s.openModal);
  const { open } = useDocumentLoader();
  const { save } = useSessionPersistence();

  return (
    <header className="mt-header">
      <div className="mt-header__brand">
        <img
          className="mt-header__logo"
          src={`${import.meta.env.BASE_URL}logo-crystal.jpg`}
          alt="Crystal Engineering Corporation"
        />
        <div>
          <strong>
            {/* จอแคบสลับไปใช้ชื่อย่อ ไม่งั้นชื่อเต็มเบียดช่องชื่อการวัดจนใช้ไม่ได้ */}
            <span className="mt-header__name">Cost Estimation and Quantity Takeoff Services</span>
            <span className="mt-header__name--short">Cost &amp; Takeoff</span>
            <button
              type="button"
              className="mt-version"
              onClick={() => openModal('about')}
              title="ดูรายละเอียดเวอร์ชัน"
            >
              v{__APP_VERSION__}
            </button>
          </strong>
          <span>ถอดแบบประมาณราคา · วัดขนาดจากแบบก่อสร้าง</span>
        </div>
      </div>

      <div className="mt-header__session">
        <TextInput
          value={sessionName}
          aria-label="ชื่อการวัด"
          onChange={(e) => setSessionMeta({ sessionName: e.target.value })}
        />
        {doc && <span className="mt-header__file">{doc.name}</span>}
        {isDirty && <span className="mt-badge">ยังไม่บันทึก</span>}
      </div>

      <div className="mt-header__actions">
        <FileDropzone onFile={(file) => void open(file)} variant="compact" />
        <Button icon="save" variant="primary" onClick={() => void save()} title="บันทึก (Ctrl+S)">
          บันทึก
        </Button>
        <Button
          icon="file"
          iconOnly
          title="เริ่มการวัดใหม่ (คงไฟล์แบบเดิม)"
          onClick={() => {
            if (!isDirty || window.confirm('ยังไม่ได้บันทึก — เริ่มการวัดใหม่หรือไม่?')) {
              newSession();
            }
          }}
        />
        <Button
          icon="info"
          iconOnly
          title="คีย์ลัด (?)"
          onClick={() => openModal('shortcuts')}
          aria-label="คีย์ลัด"
        />
        <Button
          icon={theme === 'dark' ? 'sun' : 'moon'}
          iconOnly
          onClick={toggleTheme}
          title="สลับธีมสว่าง/มืด"
        />
      </div>
    </header>
  );
}
