import { useUiStore } from '@/store';
import { Button, Modal } from '@/components/common';
import { formatDateTime } from '@/utils/format';

/** Release notes, newest first. Keep in step with CHANGELOG.md. */
const RELEASES: readonly { version: string; date: string; changes: string[] }[] = [
  {
    version: '1.6.0',
    date: '2026-08-13',
    changes: [
      'หน้า 3D เปิดไฟล์ IFC ได้แล้ว นอกจาก OBJ/GLB/GLTF เดิม',
      'อ่านหน่วยความยาวจากไฟล์ IFC แล้วตั้งตัวคูณเป็นเมตรให้อัตโนมัติ พร้อมแสดงหน่วยและจำนวนชิ้นส่วนไว้ตรวจสอบ',
      'ตัดปริมาตรห้อง (IFCSPACE) และช่องเจาะออกจากภาพ ไม่ให้บังการคลิกวัดระยะ',
    ],
  },
  {
    version: '1.5.0',
    date: '2026-08-12',
    changes: [
      'แท็บ "ถอดแบบ" — คำนวณถอดแบบประมาณราคา 4 หมวดหลัก งานผนัง 13 รายการ และงานโครงสร้าง 5 หมวดพร้อมสูตร',
      'แท็บ "ต้นทุน" — บันทึกค่าวัสดุตามบิลจริงและค่าแรงช่าง (รายวัน/เหมา พร้อมค่าเดินทาง)',
      'ปุ่มพรีวิวก่อนส่งออกทั้งถอดแบบ ต้นทุน และ BOQ พร้อมช่องหมายเหตุรายรายการ',
      'โลโก้ Crystal Engineering Corporation ขึ้นหัวเอกสารที่ส่งออกทุกไฟล์ ทั้งที่พิมพ์ผ่านเบราว์เซอร์และ PDF',
      'ใช้งานบนมือถือและไอแพดได้ ซูมสองนิ้วได้ และ PDF รองรับฟอนต์ไทย Sarabun',
      'เปลี่ยนชื่อแอปเป็น Cost Estimation and Quantity Takeoff Services',
    ],
  },
  {
    version: '1.3.0',
    date: '2026-08-08',
    changes: [
      'แสดงเลขเวอร์ชันและวันที่ build ในแอป พร้อมหน้าต่างประวัติการเปลี่ยนแปลง',
      'ตรวจหาเวอร์ชันใหม่อัตโนมัติทุกชั่วโมงและรีเฟรชให้เอง',
    ],
  },
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
          <strong>Cost Estimation and Quantity Takeoff Services</strong>
          <span className="mt-badge-version">v{__APP_VERSION__}</span>
        </div>
        <p className="mt-muted">
          ถอดแบบประมาณราคา · วัดขนาดจากแบบก่อสร้าง · build เมื่อ{' '}
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
