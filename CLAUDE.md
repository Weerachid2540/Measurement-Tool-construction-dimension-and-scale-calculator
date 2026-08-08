# Measurement Tool — บริบทสำหรับผู้ช่วย AI

เครื่องมือวัดขนาดจากแบบก่อสร้าง ทำงานทั้งหมดในเบราว์เซอร์ ไม่มี backend
ผู้ใช้เป็นวิศวกร/สถาปนิกชาวไทย — **ตอบเป็นภาษาไทย** UI ทั้งหมดเป็นภาษาไทย

- **โฟลเดอร์:** `D:\Mai Mai\งาน\AI\measurement-tool` (path มีช่องว่างและอักษรไทย — ต้องใส่เครื่องหมายคำพูดเสมอ)
- **repo:** https://github.com/Weerachid2540/Measurement-Tool-construction-dimension-and-scale-calculator
- **เว็บที่ใช้งานจริง:** https://weerachid2540.github.io/Measurement-Tool-construction-dimension-and-scale-calculator/

## คำสั่งที่ใช้บ่อย

```bash
cd "D:\Mai Mai\งาน\AI\measurement-tool"; npm run dev
```

`npm run build` รัน `tsc -b` ก่อนเสมอ จึงเป็นการตรวจ type จริง — **`npm run dev` ข้าม type check**
ดังนั้นต้อง build ทุกครั้งก่อน push

## Deploy

push ขึ้น `main` แล้ว GitHub Actions build + deploy เอง (~2 นาที) ดูที่แท็บ Actions
`.github/workflows/deploy.yml` ตั้ง `BASE_PATH=/<repo>/` ให้ Vite เพราะ Pages ไม่ได้อยู่ที่ root

**ห้ามใช้ path แบบ absolute ในโค้ด** (`/icon.svg`, `/fonts/...`) ต้องใช้ `import.meta.env.BASE_URL`
ไม่งั้นจะพังบน Pages

## การออกเวอร์ชัน

`package.json` เป็นแหล่งเดียว → Vite ฉีดเป็น `__APP_VERSION__` / `__BUILD_DATE__`

```bash
npm version minor --no-git-tag-version
```

แล้วต้องอัปเดต **2 ที่**: `CHANGELOG.md` และ `RELEASES` ใน `src/components/Modals/AboutModal.tsx`

## สถาปัตยกรรม

React 18 + TS strict · Vite 5 · Konva (2D canvas) · Zustand · pdf.js · Three.js (lazy) ·
ExcelJS + jsPDF · idb · vite-plugin-pwa

- `src/utils/` — ตรรกะทั้งหมดเป็น pure function ทดสอบได้โดยไม่ต้องมี React
- `src/store/` — 4 store แยกหน้าที่: measurement (+undo/redo) / session / symbolLibrary / ui
- `src/types/` — เพิ่มเครื่องมือใหม่เริ่มที่นี่ แล้ว TS จะชี้จุดที่ต้องแก้ทั้งหมด
- `src/styles/tokens.css` — สี ระยะ ฟอนต์ ทั้งแอปอยู่ไฟล์เดียว มีธีมสว่าง/มืด

**แกนคำนวณ:** `realMm = px / pxPerPaperMm × ratio` ผลลัพธ์คำนวณสดทุกครั้ง ไม่ cache
เปลี่ยนมาตราส่วนแล้วทั้งแบบอัปเดตทันที

## ⚠️ Auto-count — อ่านก่อนแตะ

ฟีเจอร์นับสัญลักษณ์อัตโนมัติ (`src/utils/symbolMatch/`) ผ่านการลองผิด 3 รอบกว่าจะใช้ได้
**อย่าเปลี่ยนวิธีให้คะแนนโดยไม่มีเหตุผลหนักแน่น** — ที่เคยลองแล้วพัง:

| วิธี | ผลลัพธ์ |
|---|---|
| NCC (cross-correlation) | พัง — invariant ต่อ contrast พื้นที่ที่มีสัดส่วนดำ/ขาวคล้ายกันได้คะแนนสูงหมด |
| IoU สองทาง | พัง — ลงโทษสัญลักษณ์ที่มีผนัง/บานประตูปนในกรอบ ทำให้ตัวจริงหายไป |
| แยกสัญลักษณ์ด้วย connected components (mask) | **พังหนักสุด** — กรอบที่ลากแนบทำให้เส้นรอบนอกแตะขอบแล้วถูกตัดทิ้ง เหลือแต่ตัวอักษรข้างใน → เจอ 1538 จุด |
| **F₂ บนพิกเซลหมึก + auto-threshold** | ✅ ใช้ได้ — 8/8 ไม่มี false positive |

**บั๊กที่แก้ไปแล้วและห้ามทำซ้ำ:** ต้อง crop template จาก**ภาพที่ย่อขนาดแล้ว** ไม่ใช่ย่อแยกจาก
ต้นฉบับ การ resample สองครั้งตกคนละ subpixel phase ทำให้ระบบจับแม้แต่ต้นแบบของตัวเองไม่ได้
(`prepare.ts` → `cropGray`)

**ตัวตรวจสอบตัวเอง:** หลังค้นหา คะแนนสูงสุดต้องเป็น **~100%** เสมอ เพราะต้นแบบต้องเจอตัวเอง
ถ้าต่ำกว่านั้นแปลว่าท่อข้อมูลเพี้ยน ไม่ใช่เรื่อง threshold — UI มีแถบเตือนให้แล้ว

**auto-threshold** (`suggestThreshold`) หาช่องว่างที่กว้างที่สุดในการกระจายคะแนน แล้วตัดตรงกลาง
จำกัดในช่วง 70–97% นี่คือสิ่งที่ทำให้ใช้งานได้จริงโดยผู้ใช้ไม่ต้องจูนเอง

## Gotchas

- **ExcelJS** ต้อง alias ไป browser bundle ใน `vite.config.ts` ไม่งั้นดึง node polyfill เข้ามา
- **pdf.js** worker import ด้วย `?url` และ `optimizeDeps.exclude` ห้าม pre-bundle
- **ฟอนต์ไทยใน PDF** — jsPDF ไม่มีมาให้ ต้องวาง `public/fonts/Sarabun-Regular.ttf` เอง
  ถ้าไม่มีจะ fallback เป็น Helvetica แล้วภาษาไทยเพี้ยน (Excel ไม่มีปัญหานี้)
- **PowerShell 5.1** ไม่มี `&&` ใช้ `;` แทน
- ข้อมูลผู้ใช้อยู่ใน IndexedDB ของแต่ละเครื่อง ไม่แชร์กัน — แชร์ได้ผ่าน export/import JSON

## ที่ยังไม่ได้ทำ

- bundle หลัก ~1.35 MB (405 kB gzip) ใหญ่กว่าที่ควร น่าจะมี ExcelJS ติดมาในก้อนแรกทั้งที่เขียน
  dynamic import ไว้ — ยังไม่ได้ไล่ดู
- ยังไม่มีปุ่ม export/import คลังสัญลักษณ์ (ประวัติการวัดมีแล้ว)
- ยังไม่ได้ทดสอบว่าใช้สัญลักษณ์จากคลังข้ามหน้า/ข้ามไฟล์แล้วคะแนนตกแค่ไหน
  (คาดว่า 85–95% เพราะภาพถูก resample คนละครั้ง)
- ยังไม่มีเทสต์อัตโนมัติเลย
