import * as THREE from 'three';
// Vite ใส่ hash ให้ไฟล์ wasm และ emit เป็น asset แยก (ไม่ดึง JS ของ web-ifc ตามมา)
// ใช้ URL นี้ส่งให้ locateFile จะได้ไม่ต้องก๊อปไฟล์ไป public/ เอง ซึ่งจะค้างเวอร์ชันเก่า
// เวลาอัปเดต package และไม่ต้องกังวล BASE_URL ตอน deploy ขึ้น Pages
import wasmUrl from 'web-ifc/web-ifc.wasm?url';

/**
 * อ่านไฟล์ IFC ด้วย web-ifc (WASM parser ล้วน ไม่ผูกกับ three) แล้วประกอบเป็น mesh ให้ Viewer3D
 *
 * เหตุผลที่ไม่ใช้ `web-ifc-three`: ตัวนั้นตรึง three รุ่นเก่าไว้ (โปรเจกต์นี้ใช้ 0.169)
 * และผู้พัฒนาเลิกดูแลแล้ว การแปลง geometry เองแลกกับการไม่ต้องตามแก้ปัญหาเวอร์ชันในอนาคต
 */

/** IFC ที่ส่งออกจาก Revit/ArchiCAD มักมีหลักหมื่นชิ้น — รวมเป็น mesh เดียวไม่งั้น draw call ระเบิด */
interface Batch {
  positions: number[];
  normals: number[];
  colors: number[];
  indices: number[];
  vertexCount: number;
}

const newBatch = (): Batch => ({
  positions: [],
  normals: [],
  colors: [],
  indices: [],
  vertexCount: 0,
});

export interface IfcLoadResult {
  object: THREE.Group;
  /** เมตรต่อ 1 หน่วยในโมเดล อ่านจาก IFCUNITASSIGNMENT ในไฟล์ */
  metresPerUnit: number;
  /** ชื่อหน่วยไว้แสดงให้ผู้ใช้ตรวจสอบ เช่น "มิลลิเมตร" */
  unitLabel: string;
  elementCount: number;
}

export async function loadIfc(buffer: ArrayBuffer): Promise<IfcLoadResult> {
  // โหลดแบบ dynamic เพื่อไม่ให้ API ก้อนใหญ่ติดไปในบันเดิลแรก
  const webIfc = await import('web-ifc');

  const api = new webIfc.IfcAPI();
  await api.Init((path: string) => (path.endsWith('.wasm') ? wasmUrl : path));

  // โมเดลที่มีพิกัดภูมิศาสตร์จริงอยู่ห่างจากจุดกำเนิดเป็นแสนเมตร ทำให้ float หมดความละเอียด
  // จนผิวสั่น — COORDINATE_TO_ORIGIN ย้ายมาที่จุดกำเนิดให้ก่อน
  const modelID = api.OpenModel(new Uint8Array(buffer), { COORDINATE_TO_ORIGIN: true });

  try {
    const { metresPerUnit, unitLabel } = readLengthUnit(api, modelID, webIfc);

    // space คือปริมาตรห้องที่มองไม่เห็น ส่วน opening คือช่องเจาะ — ทั้งคู่ไม่ใช่ของจริงบนแบบ
    // ถ้าปล่อยไว้จะบังการ raycast ตอนวัดระยะ
    const skipTypes = new Set<number>([webIfc.IFCSPACE, webIfc.IFCOPENINGELEMENT]);

    const opaque = newBatch();
    const transparent = newBatch();
    let elementCount = 0;

    const matrix = new THREE.Matrix4();
    const normalMatrix = new THREE.Matrix3();
    const vertex = new THREE.Vector3();
    const normal = new THREE.Vector3();

    api.StreamAllMeshes(modelID, (flatMesh: FlatMeshLike) => {
      if (skipTypes.has(api.GetLineType(modelID, flatMesh.expressID))) return;
      elementCount += 1;

      const placed = flatMesh.geometries;
      for (let i = 0; i < placed.size(); i += 1) {
        const item = placed.get(i);
        const geometry = api.GetGeometry(modelID, item.geometryExpressID);
        const verts = api.GetVertexArray(
          geometry.GetVertexData(),
          geometry.GetVertexDataSize(),
        );
        const indices = api.GetIndexArray(geometry.GetIndexData(), geometry.GetIndexDataSize());

        matrix.fromArray(item.flatTransformation);
        normalMatrix.getNormalMatrix(matrix);

        const { x: r, y: g, z: b, w: a } = item.color;
        const batch = a < 1 ? transparent : opaque;
        const base = batch.vertexCount;

        // web-ifc คืน vertex แบบสลับกัน 6 ค่าต่อจุด: ตำแหน่ง 3 + เวกเตอร์ตั้งฉาก 3
        for (let v = 0; v < verts.length; v += 6) {
          vertex.set(verts[v], verts[v + 1], verts[v + 2]).applyMatrix4(matrix);
          normal.set(verts[v + 3], verts[v + 4], verts[v + 5]).applyMatrix3(normalMatrix).normalize();
          batch.positions.push(vertex.x, vertex.y, vertex.z);
          batch.normals.push(normal.x, normal.y, normal.z);
          batch.colors.push(r, g, b);
          batch.vertexCount += 1;
        }
        for (let n = 0; n < indices.length; n += 1) batch.indices.push(base + indices[n]);

        // WASM ไม่มี GC — ไม่คืนหน่วยความจำเองแล้วโมเดลใหญ่จะกินจนแท็บตาย
        geometry.delete();
      }
    });

    const group = new THREE.Group();
    group.name = 'IFC';
    const opaqueMesh = buildMesh(opaque, false);
    if (opaqueMesh) group.add(opaqueMesh);
    const transparentMesh = buildMesh(transparent, true);
    if (transparentMesh) group.add(transparentMesh);

    if (group.children.length === 0) {
      throw new Error('ไฟล์ IFC นี้ไม่มีรูปทรงที่แสดงผลได้ (อาจมีแต่ข้อมูลไม่มี geometry)');
    }

    // IFC ใช้ Z ขึ้น ส่วน three ใช้ Y ขึ้น ไม่หมุนแล้วอาคารจะนอนตะแคง
    group.rotation.x = -Math.PI / 2;

    return { object: group, metresPerUnit, unitLabel, elementCount };
  } finally {
    api.CloseModel(modelID);
  }
}

function buildMesh(batch: Batch, transparent: boolean): THREE.Mesh | null {
  if (batch.vertexCount === 0) return null;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(batch.positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(batch.normals, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(batch.colors, 3));
  geometry.setIndex(batch.indices);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  return new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      metalness: 0.05,
      roughness: 0.85,
      side: THREE.DoubleSide,
      transparent,
      opacity: transparent ? 0.45 : 1,
      depthWrite: !transparent,
    }),
  );
}

/* --------------------------------- หน่วยความยาว --------------------------------- */

const SI_PREFIX: Record<string, number> = {
  EXA: 1e18,
  PETA: 1e15,
  TERA: 1e12,
  GIGA: 1e9,
  MEGA: 1e6,
  KILO: 1e3,
  HECTO: 1e2,
  DECA: 1e1,
  DECI: 1e-1,
  CENTI: 1e-2,
  MILLI: 1e-3,
  MICRO: 1e-6,
  NANO: 1e-9,
};

const UNIT_LABEL_TH: Record<string, string> = {
  '0.001': 'มิลลิเมตร',
  '0.01': 'เซนติเมตร',
  '1': 'เมตร',
  '0.3048': 'ฟุต',
  '0.0254': 'นิ้ว',
};

/**
 * หน่วยความยาวอยู่ใน IFCUNITASSIGNMENT — ถ้าอ่านไม่ได้ให้ถือว่าเป็นเมตรตามค่าปริยายของมาตรฐาน
 * เรื่องนี้สำคัญกับเครื่องมือวัด เพราะไฟล์จาก Revit ส่วนใหญ่เป็นมิลลิเมตร วัดผิดหน่วยคือผิด 1000 เท่า
 */
function readLengthUnit(
  api: IfcApiLike,
  modelID: number,
  webIfc: { IFCUNITASSIGNMENT: number },
): { metresPerUnit: number; unitLabel: string } {
  const fallback = { metresPerUnit: 1, unitLabel: 'เมตร (ไม่พบหน่วยในไฟล์)' };
  try {
    const ids = api.GetLineIDsWithType(modelID, webIfc.IFCUNITASSIGNMENT);
    for (let i = 0; i < ids.size(); i += 1) {
      const assignment = api.GetLine(modelID, ids.get(i), true) as UnitAssignmentLike;
      for (const unit of assignment.Units ?? []) {
        if (unit?.UnitType?.value !== 'LENGTHUNIT') continue;

        // IFCSIUNIT — เมตรพร้อมคำนำหน้า เช่น MILLI
        if (unit.Name?.value === 'METRE') {
          const factor = unit.Prefix?.value ? (SI_PREFIX[unit.Prefix.value] ?? 1) : 1;
          return { metresPerUnit: factor, unitLabel: labelFor(factor) };
        }

        // IFCCONVERSIONBASEDUNIT — ฟุต/นิ้ว เก็บตัวคูณกลับไปเป็นหน่วย SI ไว้ในตัวเอง
        const converted = unit.ConversionFactor?.ValueComponent?.value;
        if (typeof converted === 'number' && converted > 0) {
          return { metresPerUnit: converted, unitLabel: labelFor(converted) };
        }
      }
    }
  } catch {
    return fallback;
  }
  return fallback;
}

const labelFor = (factor: number): string =>
  UNIT_LABEL_TH[String(factor)] ?? `${factor} เมตรต่อหน่วย`;

/* ------------------------- โครงร่างเท่าที่ใช้จาก web-ifc ------------------------- */
/* ประกาศเองเพราะ type ของ web-ifc ผูกกับ Emscripten vector ที่ import ตรงมาใช้ยาก */

interface WasmVector<T> {
  size(): number;
  get(index: number): T;
}

interface PlacedGeometryLike {
  geometryExpressID: number;
  flatTransformation: number[];
  color: { x: number; y: number; z: number; w: number };
}

interface FlatMeshLike {
  expressID: number;
  geometries: WasmVector<PlacedGeometryLike>;
}

interface UnitAssignmentLike {
  Units?: {
    UnitType?: { value?: string };
    Name?: { value?: string };
    Prefix?: { value?: string } | null;
    ConversionFactor?: { ValueComponent?: { value?: number } };
  }[];
}

interface IfcApiLike {
  GetLineIDsWithType(modelID: number, type: number): WasmVector<number>;
  GetLine(modelID: number, expressID: number, flatten?: boolean): unknown;
}
