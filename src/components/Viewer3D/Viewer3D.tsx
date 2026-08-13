import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Button, Checkbox, Field, NumberInput } from '@/components/common';
import { FileDropzone } from '@/components/FileUpload/FileDropzone';
import { ACCEPTED_3D_TYPES } from '@/utils/fileLoader';
import { loadIfc } from '@/utils/ifc';
import { formatNumber } from '@/utils/format';
import { useUiStore } from '@/store';

interface SceneRefs {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  model: THREE.Object3D | null;
  clipPlane: THREE.Plane;
  markers: THREE.Group;
  raycaster: THREE.Raycaster;
  frameId: number;
}

/**
 * Optional 3D workspace: loads OBJ/GLB/GLTF, measures point-to-point distances by
 * raycasting onto the model, and cuts a section with a clipping plane.
 */
export function Viewer3D() {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SceneRefs | null>(null);
  const pointsRef = useRef<THREE.Vector3[]>([]);

  const notify = useUiStore((s) => s.notify);
  const setBusy = useUiStore((s) => s.setBusy);

  const [hasModel, setHasModel] = useState(false);
  const [measuring, setMeasuring] = useState(false);
  const [distance, setDistance] = useState<number | null>(null);
  const [unitScale, setUnitScale] = useState(1);
  const [sectionEnabled, setSectionEnabled] = useState(false);
  const [sectionHeight, setSectionHeight] = useState(0);
  const [modelSize, setModelSize] = useState<THREE.Vector3 | null>(null);
  /** ข้อมูลหน่วยที่อ่านได้จากไฟล์ IFC — ไฟล์อื่นไม่ประกาศหน่วยจึงเป็น null */
  const [ifcNote, setIfcNote] = useState<string | null>(null);

  /* ------------------------------- scene setup ------------------------------- */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.localClippingEnabled = true;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b1220);

    const camera = new THREE.PerspectiveCamera(
      50,
      container.clientWidth / container.clientHeight,
      0.01,
      5000,
    );
    camera.position.set(6, 5, 8);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    scene.add(new THREE.AmbientLight(0xffffff, 0.65));
    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(8, 14, 10);
    scene.add(key);
    scene.add(new THREE.GridHelper(40, 40, 0x334155, 0x1e293b));

    const markers = new THREE.Group();
    scene.add(markers);

    const refs: SceneRefs = {
      renderer,
      scene,
      camera,
      controls,
      model: null,
      clipPlane: new THREE.Plane(new THREE.Vector3(0, -1, 0), 0),
      markers,
      raycaster: new THREE.Raycaster(),
      frameId: 0,
    };
    sceneRef.current = refs;

    const animate = () => {
      refs.frameId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const resizeObserver = new ResizeObserver(() => {
      const { clientWidth, clientHeight } = container;
      if (clientWidth === 0 || clientHeight === 0) return;
      camera.aspect = clientWidth / clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(clientWidth, clientHeight);
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      cancelAnimationFrame(refs.frameId);
      controls.dispose();
      renderer.dispose();
      container.removeChild(renderer.domElement);
      sceneRef.current = null;
    };
  }, []);

  /* -------------------------------- model load ------------------------------- */
  const loadModel = useCallback(
    async (file: File) => {
      const refs = sceneRef.current;
      if (!refs) return;
      const name = file.name.toLowerCase();
      const isIfc = name.endsWith('.ifc');
      // IFC อ่านจาก ArrayBuffer ตรง ๆ ไม่ต้องผ่าน object URL เหมือน loader ของ three
      const url = isIfc ? null : URL.createObjectURL(file);
      try {
        setBusy(`กำลังโหลด ${file.name}…`);

        let object: THREE.Object3D;
        if (isIfc) {
          const result = await loadIfc(await file.arrayBuffer());
          object = result.object;
          // ไฟล์จาก Revit ส่วนใหญ่เป็นมิลลิเมตร ตั้งตัวคูณให้อัตโนมัติ ไม่งั้นวัดผิด 1000 เท่า
          setUnitScale(result.metresPerUnit);
          setIfcNote(`IFC · ${result.elementCount} ชิ้นส่วน · หน่วยในไฟล์ ${result.unitLabel}`);
        } else {
          object = name.endsWith('.obj')
            ? await new OBJLoader().loadAsync(url!)
            : (await new GLTFLoader().loadAsync(url!)).scene;
          setIfcNote(null);
        }

        if (refs.model) {
          refs.scene.remove(refs.model);
          disposeObject(refs.model);
        }

        // Centre the model on the origin and frame it in the viewport.
        const box = new THREE.Box3().setFromObject(object);
        const size = box.getSize(new THREE.Vector3());
        const centre = box.getCenter(new THREE.Vector3());
        object.position.sub(new THREE.Vector3(centre.x, box.min.y, centre.z));

        object.traverse((child) => {
          if (child instanceof THREE.Mesh && !(child.material instanceof THREE.MeshStandardMaterial)) {
            child.material = new THREE.MeshStandardMaterial({
              color: 0x94a3b8,
              metalness: 0.1,
              roughness: 0.85,
              side: THREE.DoubleSide,
            });
          }
        });

        refs.scene.add(object);
        refs.model = object;
        setModelSize(size);
        setSectionHeight(size.y);

        const radius = Math.max(size.x, size.y, size.z) || 1;
        refs.camera.position.set(radius * 1.4, radius * 1.1, radius * 1.6);
        refs.controls.target.set(0, size.y / 2, 0);
        refs.controls.update();

        setHasModel(true);
        notify(`โหลดโมเดล ${file.name} สำเร็จ`, 'success');
      } catch (error) {
        notify(error instanceof Error ? error.message : 'โหลดโมเดลไม่สำเร็จ', 'error');
      } finally {
        if (url) URL.revokeObjectURL(url);
        setBusy(null);
      }
    },
    [notify, setBusy],
  );

  /* -------------------------------- section cut ------------------------------- */
  useEffect(() => {
    const refs = sceneRef.current;
    if (!refs?.model) return;
    refs.clipPlane.constant = sectionHeight;
    const planes = sectionEnabled ? [refs.clipPlane] : [];
    refs.model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        for (const material of materials) {
          material.clippingPlanes = planes;
          material.clipShadows = true;
          material.needsUpdate = true;
        }
      }
    });
  }, [sectionEnabled, sectionHeight, hasModel]);

  /* ------------------------------- measuring --------------------------------- */
  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const refs = sceneRef.current;
      if (!refs || !measuring || !refs.model) return;

      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
      const pointer = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      );
      refs.raycaster.setFromCamera(pointer, refs.camera);
      const hit = refs.raycaster.intersectObject(refs.model, true)[0];
      if (!hit) return;

      const points = [...pointsRef.current, hit.point.clone()];
      if (points.length > 2) points.splice(0, points.length - 1);
      pointsRef.current = points;

      clearMarkers(refs.markers);
      const markerSize = Math.max(modelSize?.length() ?? 1, 1) * 0.01;
      for (const point of points) {
        const marker = new THREE.Mesh(
          new THREE.SphereGeometry(markerSize, 16, 16),
          new THREE.MeshBasicMaterial({ color: 0x38bdf8 }),
        );
        marker.position.copy(point);
        refs.markers.add(marker);
      }

      if (points.length === 2) {
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        refs.markers.add(
          new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: 0x38bdf8 })),
        );
        setDistance(points[0].distanceTo(points[1]));
      } else {
        setDistance(null);
      }
    },
    [measuring, modelSize],
  );

  const clearMeasurement = () => {
    const refs = sceneRef.current;
    if (refs) clearMarkers(refs.markers);
    pointsRef.current = [];
    setDistance(null);
  };

  return (
    <div className="mt-viewer3d">
      <div className="mt-viewer3d__stage" ref={containerRef} onPointerDown={handlePointerDown} />

      {!hasModel && (
        <div className="mt-viewer3d__overlay">
          <FileDropzone onFile={(file) => void loadModel(file)} accept={ACCEPTED_3D_TYPES} />
        </div>
      )}

      <div className="mt-viewer3d__controls">
        <div className="mt-viewer3d__row">
          <FileDropzone
            onFile={(file) => void loadModel(file)}
            variant="compact"
            accept={ACCEPTED_3D_TYPES}
          />
          <Button
            size="sm"
            active={measuring}
            icon="line"
            onClick={() => setMeasuring((value) => !value)}
            disabled={!hasModel}
          >
            วัดระยะ 3D
          </Button>
          <Button size="sm" icon="trash" onClick={clearMeasurement} disabled={!hasModel}>
            ล้างจุด
          </Button>
        </div>

        <div className="mt-viewer3d__row">
          <Field label="1 หน่วยโมเดล = (เมตร)" inline>
            <NumberInput value={unitScale} min={0.0001} step={0.1} onValueChange={setUnitScale} />
          </Field>
          <Checkbox
            label="ตัดหน้าตัด (Section)"
            checked={sectionEnabled}
            onCheckedChange={setSectionEnabled}
            disabled={!hasModel}
          />
          {sectionEnabled && modelSize && (
            <input
              type="range"
              className="mt-range"
              min={0}
              max={modelSize.y || 1}
              step={(modelSize.y || 1) / 200}
              value={sectionHeight}
              onChange={(e) => setSectionHeight(Number.parseFloat(e.target.value))}
              aria-label="ระดับหน้าตัด"
            />
          )}
        </div>

        <div className="mt-viewer3d__readout">
          {distance !== null ? (
            <>
              ระยะที่วัดได้ <strong>{formatNumber(distance * unitScale, 3)} m</strong>
              <span className="mt-muted"> ({formatNumber(distance, 3)} หน่วยโมเดล)</span>
            </>
          ) : (
            <span className="mt-muted">
              {measuring ? 'คลิก 2 จุดบนโมเดลเพื่อวัดระยะ' : 'เปิด "วัดระยะ 3D" เพื่อเริ่มวัด'}
            </span>
          )}
          {modelSize && (
            <span className="mt-muted">
              {' '}
              · ขนาดโมเดล {formatNumber(modelSize.x * unitScale, 2)} ×{' '}
              {formatNumber(modelSize.y * unitScale, 2)} × {formatNumber(modelSize.z * unitScale, 2)} m
              {/* หน่วยโมเดลไม่ใช่เมตรค่อยกางเลขดิบให้ดู ไม่งั้นวงเล็บจะซ้ำกับตัวหน้าเป๊ะ ๆ */}
              {unitScale !== 1 && (
                <>
                  {' '}
                  ({formatNumber(modelSize.x, 2)} × {formatNumber(modelSize.y, 2)} ×{' '}
                  {formatNumber(modelSize.z, 2)} หน่วยโมเดล)
                </>
              )}
            </span>
          )}
          {/* ให้เห็นหน่วยที่ระบบอ่านได้ทันที ถ้าตัวเลขเมตรดูผิดจะได้แก้ตัวคูณก่อนวัด */}
          {ifcNote && <span className="mt-muted"> · {ifcNote}</span>}
        </div>
      </div>
    </div>
  );
}

function clearMarkers(group: THREE.Group): void {
  while (group.children.length > 0) {
    const child = group.children[0];
    group.remove(child);
    disposeObject(child);
  }
}

function disposeObject(object: THREE.Object3D): void {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
      child.geometry?.dispose();
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      for (const material of materials) material?.dispose();
    }
  });
}
