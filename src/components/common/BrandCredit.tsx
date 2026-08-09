/**
 * เครดิตผู้พัฒนา — โลโก้ Crystal Engineering
 *
 * มีสองไฟล์เพราะโลโก้ต้นฉบับพื้นทึบ ไม่ใช่พื้นโปร่ง ใช้ไฟล์เดียวข้ามธีมแล้วจะเป็นกล่องสีทับพื้นหลัง
 * CSS สลับให้ตามธีมที่ `document.documentElement.dataset.theme`
 */
export function BrandCredit({ compact = false }: { compact?: boolean }) {
  const base = import.meta.env.BASE_URL;
  return (
    <div className={`mt-brand-credit ${compact ? 'mt-brand-credit--compact' : ''}`}>
      <span>พัฒนาโดย</span>
      <img
        className="mt-brand-credit__logo mt-brand-credit__logo--dark"
        src={`${base}logo-crystal.jpg`}
        alt="Crystal Engineering Corporation"
      />
      <img
        className="mt-brand-credit__logo mt-brand-credit__logo--light"
        src={`${base}logo-crystal-light.jpg`}
        alt="Crystal Engineering Corporation"
      />
    </div>
  );
}
