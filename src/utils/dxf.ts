import type { LoadedDocument, RenderedPage, SourceDocument } from '@/types';
import { createId } from './id';

/**
 * อ่าน DXF แล้ว "พิมพ์" ลงเป็นภาพ raster เพื่อส่งเข้าท่อเดิมที่ PDF ใช้อยู่
 *
 * เหตุผลที่ไม่วาดเป็นเวกเตอร์บน Konva โดยตรง: ทำแบบนี้แล้วเครื่องมือวัด BOQ ส่งออก
 * ประวัติการวัด และการนับสัญลักษณ์อัตโนมัติ ใช้โค้ดเดิมได้ทั้งหมดโดยไม่ต้องแก้
 * ความละเอียดที่ raster ไม่กระทบความแม่นของการวัด เพราะมาตราส่วนคำนวณจากพิกัดจริงใน
 * ไฟล์ ไม่ได้เดาจากขนาดกระดาษ
 *
 * DXF คือฟอร์แมตแลกเปลี่ยนแบบเปิดของ Autodesk — DWG เป็นฟอร์แมตปิดที่ไม่มีสเปกสาธารณะ
 * ผู้ใช้จึงต้อง Save As เป็น DXF จาก AutoCAD ก่อน
 */

/** ภาพใหญ่กว่านี้กินหน่วยความจำเกินจำเป็นบนแท็บเล็ต — ค่าเดียวกับฝั่ง PDF */
const MAX_RASTER_DIMENSION = 4000;
/** เผื่อขอบรอบแบบไว้เล็กน้อย ไม่ให้เส้นริมสุดไปแนบขอบภาพ */
const MARGIN_PX = 24;

/** ตัวคูณเป็นมิลลิเมตรต่อ 1 หน่วยในไฟล์ ตามรหัส $INSUNITS ของ DXF */
const MM_PER_UNIT: Record<number, { mm: number; label: string }> = {
  1: { mm: 25.4, label: 'นิ้ว' },
  2: { mm: 304.8, label: 'ฟุต' },
  4: { mm: 1, label: 'มิลลิเมตร' },
  5: { mm: 10, label: 'เซนติเมตร' },
  6: { mm: 1000, label: 'เมตร' },
};

interface Point {
  x: number;
  y: number;
}

/** ทุกอย่างถูกแปลงเป็นเส้นต่อจุดก่อน คำนวณขอบเขตและวาดจึงเหลือทางเดียว */
interface Polyline {
  points: Point[];
  closed: boolean;
}

interface TextItem {
  at: Point;
  text: string;
  height: number;
  rotation: number;
}

interface Flattened {
  polylines: Polyline[];
  texts: TextItem[];
}

export interface DxfLoadResult extends LoadedDocument {
  unitLabel: string;
  /** จริงเมื่อไฟล์ไม่ได้ระบุหน่วย ($INSUNITS = 0) แล้วเราเดาเป็นมิลลิเมตร */
  unitAssumed: boolean;
}

export async function loadDxf(file: File): Promise<DxfLoadResult> {
  // dxf-parser ใหญ่พอควรและใช้เฉพาะตอนเปิดไฟล์ CAD จึงแยกเป็น chunk ต่างหาก
  const { default: DxfParser } = await import('dxf-parser');
  const text = await file.text();

  let dxf: DxfDocument;
  try {
    dxf = new DxfParser().parseSync(text) as unknown as DxfDocument;
  } catch (error) {
    throw new Error(
      `อ่านไฟล์ DXF ไม่สำเร็จ — ${error instanceof Error ? error.message : 'ไฟล์อาจเสียหาย'}`,
    );
  }
  if (!dxf?.entities?.length) throw new Error('ไฟล์ DXF นี้ไม่มีวัตถุที่วาดได้');

  const insUnits = dxf.header?.$INSUNITS ?? 0;
  const unit = MM_PER_UNIT[insUnits];
  // ไฟล์ที่ไม่ระบุหน่วยเจอบ่อยมาก แบบสถาปัตย์ในไทยแทบทั้งหมดเขียนเป็นมิลลิเมตร
  const mmPerUnit = unit?.mm ?? 1;
  const unitLabel = unit?.label ?? 'มิลลิเมตร (ไฟล์ไม่ได้ระบุ — เดาให้)';

  const flat = flatten(dxf);
  const bounds = boundsOf(flat);
  if (!bounds) throw new Error('ไฟล์ DXF นี้ไม่มีวัตถุที่วาดได้');

  const { canvas, pxPerUnit } = rasterise(flat, bounds);
  const src = canvas.toDataURL('image/png');

  const doc: SourceDocument = {
    id: createId('doc'),
    name: file.name,
    kind: 'cad',
    mimeType: file.type || 'image/vnd.dxf',
    sizeBytes: file.size,
    pageCount: 1,
    addedAt: Date.now(),
  };

  const page: RenderedPage = {
    pageNumber: 1,
    src,
    width: canvas.width,
    height: canvas.height,
    // แบบ CAD เก็บพิกัดจริง ไม่ใช่ขนาดบนกระดาษ — จับคู่กับ ratio = 1 แล้วสูตร
    // realMm = px / pxPerPaperMm × ratio จะให้ระยะจริงออกมาตรง ๆ
    pxPerPaperMm: pxPerUnit / mmPerUnit,
  };

  return { doc, page, unitLabel, unitAssumed: !unit };
}

/* ------------------------------ แปลงเป็นเส้น ------------------------------ */

function flatten(dxf: DxfDocument): Flattened {
  const out: Flattened = { polylines: [], texts: [] };
  for (const entity of dxf.entities) addEntity(entity, dxf, out, IDENTITY, 0);
  return out;
}

interface Transform {
  /** สเกล+หมุน เก็บเป็นเมทริกซ์ 2×2 แบน ๆ เพราะไม่ต้องรองรับการเฉือน */
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

const IDENTITY: Transform = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

const apply = (t: Transform, p: Point): Point => ({
  x: t.a * p.x + t.c * p.y + t.e,
  y: t.b * p.x + t.d * p.y + t.f,
});

const combine = (outer: Transform, inner: Transform): Transform => ({
  a: outer.a * inner.a + outer.c * inner.b,
  b: outer.b * inner.a + outer.d * inner.b,
  c: outer.a * inner.c + outer.c * inner.d,
  d: outer.b * inner.c + outer.d * inner.d,
  e: outer.a * inner.e + outer.c * inner.f + outer.e,
  f: outer.b * inner.e + outer.d * inner.f + outer.f,
});

/** บล็อกซ้อนบล็อกได้ แต่ไฟล์เสียอาจอ้างวนกลับมาหาตัวเอง จำกัดความลึกกันแขวน */
const MAX_INSERT_DEPTH = 12;

function addEntity(
  entity: DxfEntity,
  dxf: DxfDocument,
  out: Flattened,
  t: Transform,
  depth: number,
): void {
  const push = (points: Point[], closed = false) => {
    if (points.length < 2) return;
    out.polylines.push({ points: points.map((p) => apply(t, p)), closed });
  };

  switch (entity.type) {
    case 'LINE':
      if (entity.vertices) push(entity.vertices, false);
      break;

    case 'LWPOLYLINE':
    case 'POLYLINE': {
      const vertices = entity.vertices ?? [];
      if (vertices.length < 2) break;
      // bulge คือส่วนโค้งระหว่างสองจุด เจอบ่อยในผนังมุมมนและวงกบ ถ้าไม่กางออก
      // มุมโค้งจะกลายเป็นเส้นตรงแล้ววัดความยาวขาด
      const points: Point[] = [];
      const closed = Boolean(entity.shape ?? entity.closed);
      const last = closed ? vertices.length : vertices.length - 1;
      for (let i = 0; i < last; i += 1) {
        const from = vertices[i];
        const to = vertices[(i + 1) % vertices.length];
        points.push(from);
        if (from.bulge) points.push(...bulgeArc(from, to, from.bulge));
      }
      if (!closed) points.push(vertices[vertices.length - 1]);
      push(points, closed);
      break;
    }

    case 'CIRCLE':
      if (entity.center && entity.radius) {
        push(arcPoints(entity.center, entity.radius, 0, Math.PI * 2), true);
      }
      break;

    case 'ARC':
      if (entity.center && entity.radius) {
        push(
          arcPoints(entity.center, entity.radius, entity.startAngle ?? 0, entity.endAngle ?? 0),
          false,
        );
      }
      break;

    case 'ELLIPSE':
      if (entity.center && entity.majorAxisEndPoint) push(ellipsePoints(entity), false);
      break;

    case 'SPLINE': {
      // ลากผ่านจุดที่กำหนดแทนการคำนวณเส้นโค้งจริง คลาดเล็กน้อยแต่พอสำหรับดูและวัดคร่าว
      const points = entity.fitPoints?.length ? entity.fitPoints : entity.controlPoints;
      if (points?.length) push(points, false);
      break;
    }

    case 'SOLID':
    case '3DFACE':
      if (entity.points?.length) push(entity.points, true);
      break;

    case 'TEXT':
    case 'MTEXT': {
      const at = entity.startPoint ?? entity.position;
      const raw = entity.text;
      if (!at || !raw) break;
      out.texts.push({
        at: apply(t, at),
        // MTEXT ฝังรหัสจัดรูปแบบไว้ในข้อความ เช่น \pxqc; หรือ {\fArial|b0; …}
        text: raw.replace(/\\[A-Za-z][^;\\]*;?/g, '').replace(/[{}]/g, '').trim(),
        height: (entity.textHeight ?? entity.height ?? 2.5) * Math.hypot(t.a, t.b),
        rotation: entity.rotation ?? 0,
      });
      break;
    }

    case 'INSERT': {
      // แบบสถาปัตย์เกือบทั้งหมดเป็นบล็อก (ประตู หน้าต่าง สุขภัณฑ์ เฟอร์นิเจอร์)
      // ไม่กางบล็อกออกแล้วแบบจะว่างเปล่าเกือบหมด
      if (depth >= MAX_INSERT_DEPTH) break;
      const block = dxf.blocks?.[entity.name ?? ''];
      if (!block?.entities) break;

      const angle = ((entity.rotation ?? 0) * Math.PI) / 180;
      const sx = entity.xScale ?? 1;
      const sy = entity.yScale ?? 1;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const base = block.position ?? { x: 0, y: 0 };
      const at = entity.position ?? { x: 0, y: 0 };

      // ย้ายจุดอ้างอิงของบล็อกมาที่ศูนย์ → ย่อขยาย → หมุน → ย้ายไปตำแหน่งที่วาง
      const local: Transform = {
        a: cos * sx,
        b: sin * sx,
        c: -sin * sy,
        d: cos * sy,
        e: at.x - (cos * sx * base.x - sin * sy * base.y),
        f: at.y - (sin * sx * base.x + cos * sy * base.y),
      };
      const next = combine(t, local);
      for (const child of block.entities) addEntity(child, dxf, out, next, depth + 1);
      break;
    }

    case 'DIMENSION': {
      // เส้นบอกระยะถูกวาดไว้ล่วงหน้าเป็นบล็อกนิรนาม วาดบล็อกนั้นก็ได้ภาพครบ
      if (depth >= MAX_INSERT_DEPTH) break;
      const block = dxf.blocks?.[entity.block ?? ''];
      if (!block?.entities) break;
      for (const child of block.entities) addEntity(child, dxf, out, t, depth + 1);
      break;
    }

    default:
      break;
  }
}

/** ส่วนโค้งจาก bulge ตามนิยามของ DXF: bulge = tan(มุมที่รองรับ ÷ 4) */
function bulgeArc(from: VertexLike, to: VertexLike, bulge: number): Point[] {
  const theta = 4 * Math.atan(bulge);
  const chord = Math.hypot(to.x - from.x, to.y - from.y);
  if (chord === 0 || !Number.isFinite(theta) || theta === 0) return [];
  const radius = chord / (2 * Math.sin(Math.abs(theta) / 2));
  const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
  const height = radius * Math.cos(Math.abs(theta) / 2);
  const dir = bulge > 0 ? 1 : -1;
  const nx = -(to.y - from.y) / chord;
  const ny = (to.x - from.x) / chord;
  const centre = {
    x: mid.x + nx * height * dir * (Math.abs(theta) > Math.PI ? -1 : 1),
    y: mid.y + ny * height * dir * (Math.abs(theta) > Math.PI ? -1 : 1),
  };
  const start = Math.atan2(from.y - centre.y, from.x - centre.x);
  const points = arcPoints(centre, radius, start, start + theta);
  // จุดแรกกับจุดสุดท้ายซ้ำกับปลายเส้นที่ผู้เรียกใส่ไว้แล้ว
  return points.slice(1, -1);
}

function arcPoints(centre: Point, radius: number, start: number, end: number): Point[] {
  let sweep = end - start;
  if (sweep === 0) sweep = Math.PI * 2;
  // ยิ่งโค้งกว้างยิ่งต้องซอยถี่ แต่คุมไม่ให้วงกลมเล็ก ๆ กินหน่วยความจำเกินจำเป็น
  const segments = Math.min(180, Math.max(8, Math.ceil(Math.abs(sweep) / (Math.PI / 32))));
  const points: Point[] = [];
  for (let i = 0; i <= segments; i += 1) {
    const angle = start + (sweep * i) / segments;
    points.push({ x: centre.x + radius * Math.cos(angle), y: centre.y + radius * Math.sin(angle) });
  }
  return points;
}

function ellipsePoints(entity: DxfEntity): Point[] {
  const centre = entity.center!;
  const major = entity.majorAxisEndPoint!;
  const ratio = entity.axisRatio ?? 1;
  const majorLength = Math.hypot(major.x, major.y);
  const tilt = Math.atan2(major.y, major.x);
  const start = entity.startAngle ?? 0;
  const end = entity.endAngle ?? Math.PI * 2;
  let sweep = end - start;
  if (sweep <= 0) sweep += Math.PI * 2;

  const segments = Math.min(180, Math.max(16, Math.ceil(sweep / (Math.PI / 32))));
  const points: Point[] = [];
  for (let i = 0; i <= segments; i += 1) {
    const angle = start + (sweep * i) / segments;
    const x = majorLength * Math.cos(angle);
    const y = majorLength * ratio * Math.sin(angle);
    points.push({
      x: centre.x + x * Math.cos(tilt) - y * Math.sin(tilt),
      y: centre.y + x * Math.sin(tilt) + y * Math.cos(tilt),
    });
  }
  return points;
}

/* -------------------------------- วาดเป็นภาพ -------------------------------- */

interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function boundsOf(flat: Flattened): Bounds | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const visit = (p: Point) => {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return;
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  };
  for (const line of flat.polylines) for (const p of line.points) visit(p);
  for (const text of flat.texts) visit(text.at);

  if (minX > maxX || minY > maxY) return null;
  return { minX, minY, maxX, maxY };
}

function rasterise(
  flat: Flattened,
  bounds: Bounds,
): { canvas: HTMLCanvasElement; pxPerUnit: number } {
  const worldWidth = Math.max(bounds.maxX - bounds.minX, 1e-6);
  const worldHeight = Math.max(bounds.maxY - bounds.minY, 1e-6);
  const usable = MAX_RASTER_DIMENSION - MARGIN_PX * 2;
  const pxPerUnit = usable / Math.max(worldWidth, worldHeight);

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(worldWidth * pxPerUnit) + MARGIN_PX * 2);
  canvas.height = Math.max(1, Math.round(worldHeight * pxPerUnit) + MARGIN_PX * 2);

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('เบราว์เซอร์นี้วาดภาพ 2D ไม่ได้');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // แกน Y ของ CAD ชี้ขึ้น ส่วนของ canvas ชี้ลง จึงต้องพลิก ไม่งั้นแบบจะกลับหัว
  const toCanvas = (p: Point): Point => ({
    x: MARGIN_PX + (p.x - bounds.minX) * pxPerUnit,
    y: canvas.height - MARGIN_PX - (p.y - bounds.minY) * pxPerUnit,
  });

  // วาดขาวดำล้วน — แบบ CAD ตั้งสีไว้สำหรับพื้นหลังดำ ถ้าใช้สีจากไฟล์ตรง ๆ
  // เส้นสีขาว/เหลืองอ่อนจะหายไปกับพื้นขาว
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 1;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  ctx.beginPath();
  for (const line of flat.polylines) {
    const first = toCanvas(line.points[0]);
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < line.points.length; i += 1) {
      const p = toCanvas(line.points[i]);
      ctx.lineTo(p.x, p.y);
    }
    if (line.closed) ctx.closePath();
  }
  ctx.stroke();

  ctx.fillStyle = '#334155';
  ctx.textBaseline = 'alphabetic';
  for (const item of flat.texts) {
    if (!item.text) continue;
    const size = item.height * pxPerUnit;
    // ตัวหนังสือที่เล็กกว่า 4px อ่านไม่ออกอยู่ดี ข้ามไปเพื่อไม่ให้แบบเลอะ
    if (size < 4) continue;
    const at = toCanvas(item.at);
    ctx.save();
    ctx.translate(at.x, at.y);
    if (item.rotation) ctx.rotate((-item.rotation * Math.PI) / 180);
    ctx.font = `${size}px sans-serif`;
    ctx.fillText(item.text, 0, 0);
    ctx.restore();
  }

  return { canvas, pxPerUnit };
}

/* --------------------- โครงร่างเท่าที่ใช้จาก dxf-parser --------------------- */

interface VertexLike extends Point {
  bulge?: number;
}

interface DxfEntity {
  type: string;
  vertices?: VertexLike[];
  center?: Point;
  radius?: number;
  startAngle?: number;
  endAngle?: number;
  majorAxisEndPoint?: Point;
  axisRatio?: number;
  controlPoints?: Point[];
  fitPoints?: Point[];
  points?: Point[];
  position?: Point;
  startPoint?: Point;
  text?: string;
  textHeight?: number;
  height?: number;
  rotation?: number;
  xScale?: number;
  yScale?: number;
  name?: string;
  block?: string;
  shape?: boolean;
  closed?: boolean;
}

interface DxfDocument {
  header?: { $INSUNITS?: number };
  entities: DxfEntity[];
  blocks?: Record<string, { position?: Point; entities?: DxfEntity[] }>;
}
