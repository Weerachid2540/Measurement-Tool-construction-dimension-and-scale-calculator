import { useUiStore } from '@/store';
import { Button, Modal } from '@/components/common';
import { formatDateTime } from '@/utils/format';

/** Release notes, newest first. Keep in step with CHANGELOG.md. */
const RELEASES: readonly { version: string; date: string; changes: string[] }[] = [
  {
    version: '1.2.0',
    date: '2026-08-08',
    changes: [
      'คลังสัญลักษณ์ — บันทึกสัญลักษณ์พร้อมหมวดงานและรหัส นำกลับมาใช้ข้ามหน้าและข้ามโครงการ',
      'ปรับกรอบสัญลักษณ์ต้นแบบได้ด้วยการลากมุม',
      'ระบบเลือกเกณฑ์ความคล้ายให้อัตโนมัติจากการกระจายของคะแนน',
      'รายการที่นับได้เข้า BOQ พร้อมชื่อและรหัสอัตโนมัติ',
    ],
  },
  {
    version: '1.1.0',
    date: '2026-08-08',
    changes: [
      'เครื่องมือนับสัญลักษณ์อัตโนมัติ (Auto-count) ด้วยการเทียบรูปทรง',
      'ประมวลผลใน Web Worker พร้อมแถบความคืบหน้าและปุ่มยกเลิก',
      'ตรวจผลก่อนบันทึกได้ คลิกตัดจุดที่ไม่ต้องการออกทีละจุด',
    ],
  },
  {
    version: '1.0.0',
    date: '2026-08-08',
    changes: [
      'วัดความยาว พื้นที่ วงกลม มุมและความลาด พร้อมนับจำนวน',
      'รองรับ PDF หลายหน้า และรูปภาพ พร้อมการปรับเทียบมาตราส่วน',
      'คำนวณปริมาณวัสดุและส่งออก BOQ เป็น Excel / PDF',
      'เก็บประวัติการวัดใน IndexedDB และรองรับ PWA ใช้งานออฟไลน์',
      'โหมด 3D สำหรับไฟล์ OBJ / GLB พร้อมวัดระยะและตัดหน้าตัด',
    ],
  },
] as const;

export function AboutModal() {
  const modal = useUiStore((s) => s.modal);
  const closeModal = useUiStore((s) => s.closeModal);

  return (
    <Modal
      open={modal === 'about'}
      title="เกี่ยวกับโปรแกรม"
      onClose={closeModal}
      width={560}
      footer={<Button onClick={closeModal}>ปิด</Button>}
    >
      <div className="mt-about">
        <div className="mt-about__head">
          <strong>Measurement Tool</strong>
          <span className="mt-badge-version">v{__APP_VERSION__}</span>
        </div>
        <p className="mt-muted">
          Construction Dimension &amp; Scale Calculator · build เมื่อ{' '}
          {formatDateTime(Date.parse(__BUILD_DATE__))}
        </p>
        <p className="mt-muted">
          ไฟล์แบบทั้งหมดประมวลผลในเครื่องของคุณ ไม่มีการอัปโหลดขึ้นเซิร์ฟเวอร์
        </p>
      </div>

      <div className="mt-release-notes">
        {RELEASES.map((release) => (
          <section key={release.version}>
            <h3>
              v{release.version}
              <span className="mt-muted">{release.date}</span>
            </h3>
            <ul>
              {release.changes.map((change) => (
                <li key={change}>{change}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Modal>
  );
}
