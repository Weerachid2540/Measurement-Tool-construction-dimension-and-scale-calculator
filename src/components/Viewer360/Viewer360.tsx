import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Button } from '@/components/common';
import { FileDropzone } from '@/components/FileUpload/FileDropzone';
import { ACCEPTED_360_TYPES } from '@/utils/fileLoader';
import { useUiStore } from '@/store';

/**
 * ดูภาพและวิดีโอ 360 องศาจากกล้องพาโนรามา
 *
 * วิธีทำงาน: แปะภาพ equirectangular ลงผิว "ใน" ของทรงกลม แล้ววางกล้องไว้ตรงกลาง
 * ผู้ใช้จึงมองออกไปรอบตัวได้เหมือนยืนอยู่ในจุดที่ถ่าย
 *
 * แยกจากหน้า 3D เพราะคนละเรื่องกัน — 3D คือดูโมเดลจากภายนอกและวัดระยะได้
 * ส่วน 360 คือยืนดูสภาพหน้างานจริง ไม่มีข้อมูลเชิงเรขาคณิตให้วัด
 */

/** รัศมีทรงกลม ใหญ่พอให้ไม่รู้สึกว่าภาพอยู่ใกล้ตัว แต่ยังอยู่ในระยะ far ของกล้อง */
const SPHERE_RADIUS = 500;
const MIN_FOV = 25;
const MAX_FOV = 100;

interface SceneRefs {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  mesh: THREE.Mesh;
  frameId: number;
}

type MediaKind = 'image' | 'video';

export function Viewer360() {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SceneRefs | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const notify = useUiStore((s) => s.notify);
  const setBusy = useUiStore((s) => s.setBusy);

  const [mediaKind, setMediaKind] = useState<MediaKind | null>(null);
  const [fileName, setFileName] = useState('');
  const [fov, setFov] = useState(75);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [warning, setWarning] = useState<string | null>(null);

  /* ------------------------------- scene setup ------------------------------- */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b1220);

    const camera = new THREE.PerspectiveCamera(
      75,
      container.clientWidth / container.clientHeight,
      0.1,
      1100,
    );
    // กล้องต้องอยู่กลางทรงกลม แต่ OrbitControls ต้องการระยะห่างจากเป้าหมายมากกว่าศูนย์
    camera.position.set(0, 0, 0.1);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    // ซูมด้วยการขยับกล้องไม่ได้เพราะอยู่กลางทรงกลมอยู่แล้ว ใช้การปรับมุมมองแทน
    controls.enableZoom = false;
    controls.enablePan = false;
    // ค่าติดลบทำให้ลากแล้วภาพเลื่อนตามนิ้ว เหมือนจับโลกหมุน ไม่ใช่หมุนกล้อง
    controls.rotateSpeed = -0.3;
    controls.target.set(0, 0, 0);

    // พลิกทรงกลมกลับด้านเพื่อให้เห็นภาพจากข้างใน
    const geometry = new THREE.SphereGeometry(SPHERE_RADIUS, 60, 40);
    geometry.scale(-1, 1, 1);
    const mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({ color: 0x1e293b }),
    );
    scene.add(mesh);

    const refs: SceneRefs = { renderer, scene, camera, controls, mesh, frameId: 0 };
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
      disposeMaterial(mesh.material);
      geometry.dispose();
      renderer.dispose();
      container.removeChild(renderer.domElement);
      sceneRef.current = null;
    };
  }, []);

  /* --------------------------- เปลี่ยนมุมมอง (ซูม) --------------------------- */
  useEffect(() => {
    const refs = sceneRef.current;
    if (!refs) return;
    refs.camera.fov = fov;
    refs.camera.updateProjectionMatrix();
  }, [fov]);

  const zoomBy = (delta: number) =>
    setFov((current) => Math.min(MAX_FOV, Math.max(MIN_FOV, current + delta)));

  /* -------------------------------- โหลดไฟล์ -------------------------------- */
  const releaseMedia = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.removeAttribute('src');
      video.load();
      videoRef.current = null;
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setPlaying(false);
    setDuration(0);
    setCurrentTime(0);
  }, []);

  const applyTexture = useCallback((texture: THREE.Texture, width: number, height: number) => {
    const refs = sceneRef.current;
    if (!refs) return;
    texture.colorSpace = THREE.SRGBColorSpace;
    disposeMaterial(refs.mesh.material);
    refs.mesh.material = new THREE.MeshBasicMaterial({ map: texture });

    // ภาพ equirectangular ต้องกว้างเป็นสองเท่าของสูงพอดี ถ้าไม่ใช่แสดงว่าไฟล์
    // ไม่ได้ต่อภาพมา (ยังเป็นภาพฟิชอายสองตา) หรือเป็นพาโนรามาบางส่วน
    const ratio = height > 0 ? width / height : 0;
    setWarning(
      Math.abs(ratio - 2) > 0.05
        ? `สัดส่วนภาพ ${ratio.toFixed(2)}:1 ไม่ใช่ 2:1 — ภาพ 360 เต็มวงต้องเป็น 2:1 ` +
            'ถ้าเป็นไฟล์ดิบจากกล้องให้ต่อภาพ (stitch) ในแอปของกล้องแล้วส่งออกใหม่ก่อน'
        : null,
    );
  }, []);

  const loadMedia = useCallback(
    async (file: File) => {
      if (!sceneRef.current) return;
      releaseMedia();

      const url = URL.createObjectURL(file);
      objectUrlRef.current = url;
      const isVideo = file.type.startsWith('video/') || /\.(mp4|webm|mov|m4v)$/i.test(file.name);

      try {
        setBusy(`กำลังเปิด ${file.name}…`);
        if (isVideo) {
          const video = document.createElement('video');
          video.src = url;
          video.loop = true;
          video.playsInline = true;
          video.muted = false;
          videoRef.current = video;

          await new Promise<void>((resolve, reject) => {
            video.onloadedmetadata = () => resolve();
            video.onerror = () =>
              reject(
                new Error(
                  'เบราว์เซอร์เปิดวิดีโอนี้ไม่ได้ — รองรับ MP4 (H.264) และ WebM ' +
                    'ไฟล์ .insv จากกล้อง Insta360 ต้องส่งออกเป็น MP4 ก่อน',
                ),
              );
          });

          const texture = new THREE.VideoTexture(video);
          applyTexture(texture, video.videoWidth, video.videoHeight);
          setDuration(video.duration);
          setMediaKind('video');

          // การเลือกไฟล์นับเป็นการกดของผู้ใช้ วิดีโอจึงเล่นได้เลยในกรณีปกติ
          // แต่บางเบราว์เซอร์ยังบล็อกเสียง ปล่อยให้ผู้ใช้กดปุ่มเล่นเองถ้าโดนปฏิเสธ
          try {
            await video.play();
            setPlaying(true);
          } catch {
            setPlaying(false);
          }
        } else {
          const texture = await new THREE.TextureLoader().loadAsync(url);
          applyTexture(texture, texture.image.width, texture.image.height);
          setMediaKind('image');
        }

        setFileName(file.name);
        notify(`เปิด ${file.name} สำเร็จ`, 'success');
      } catch (error) {
        releaseMedia();
        notify(error instanceof Error ? error.message : 'เปิดไฟล์ไม่สำเร็จ', 'error');
      } finally {
        setBusy(null);
      }
    },
    [applyTexture, notify, releaseMedia, setBusy],
  );

  // ปล่อยหน่วยความจำและหยุดวิดีโอเมื่อออกจากหน้านี้ ไม่งั้นเสียงยังดังต่อ
  useEffect(() => releaseMedia, [releaseMedia]);

  /** เอาไฟล์ออกโดยไม่ต้องเปิดไฟล์ใหม่มาทับ — กลับไปหน้าลากไฟล์มาวาง */
  const clearMedia = useCallback(() => {
    const refs = sceneRef.current;
    releaseMedia();
    if (refs) {
      disposeMaterial(refs.mesh.material);
      refs.mesh.material = new THREE.MeshBasicMaterial({ color: 0x1e293b });
    }
    setMediaKind(null);
    setFileName('');
    setWarning(null);
  }, [releaseMedia]);

  /* ------------------------------ ตัวควบคุมวิดีโอ ------------------------------ */
  useEffect(() => {
    const video = videoRef.current;
    if (!video || mediaKind !== 'video') return;
    const onTime = () => setCurrentTime(video.currentTime);
    video.addEventListener('timeupdate', onTime);
    return () => video.removeEventListener('timeupdate', onTime);
  }, [mediaKind]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play();
      setPlaying(true);
    } else {
      video.pause();
      setPlaying(false);
    }
  };

  const seek = (seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = seconds;
    setCurrentTime(seconds);
  };

  const toggleFullscreen = () => {
    const element = containerRef.current?.parentElement;
    if (!element) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void element.requestFullscreen();
  };

  const hasMedia = mediaKind !== null;

  return (
    <div className="mt-viewer3d">
      <div
        className="mt-viewer3d__stage"
        ref={containerRef}
        onWheel={(e) => zoomBy(e.deltaY > 0 ? 4 : -4)}
      />

      {!hasMedia && (
        <div className="mt-viewer3d__overlay">
          <FileDropzone onFile={(file) => void loadMedia(file)} accept={ACCEPTED_360_TYPES} />
        </div>
      )}

      <div className="mt-viewer3d__controls">
        <div className="mt-viewer3d__row">
          <FileDropzone
            onFile={(file) => void loadMedia(file)}
            variant="compact"
            accept={ACCEPTED_360_TYPES}
            label={hasMedia ? 'เปลี่ยนไฟล์' : 'เปิดไฟล์ 360'}
          />

          {mediaKind === 'video' && (
            <Button size="sm" icon={playing ? 'pause' : 'play'} onClick={togglePlay}>
              {playing ? 'หยุด' : 'เล่น'}
            </Button>
          )}

          <div className="mt-btn-group">
            <Button size="sm" icon="zoomOut" iconOnly onClick={() => zoomBy(8)} title="ถอยออก" />
            <Button size="sm" icon="zoomIn" iconOnly onClick={() => zoomBy(-8)} title="ซูมเข้า" />
          </div>

          <Button size="sm" icon="expand" onClick={toggleFullscreen} disabled={!hasMedia}>
            เต็มจอ
          </Button>

          {hasMedia && (
            <Button size="sm" icon="trash" onClick={clearMedia} title="เอาไฟล์ออกจากหน้านี้">
              ลบไฟล์
            </Button>
          )}
        </div>

        {mediaKind === 'video' && duration > 0 && (
          <div className="mt-viewer3d__row">
            <input
              type="range"
              className="mt-range"
              min={0}
              max={duration}
              step={duration / 500}
              value={currentTime}
              onChange={(e) => seek(Number.parseFloat(e.target.value))}
              aria-label="ตำแหน่งในวิดีโอ"
              style={{ flex: 1 }}
            />
            <span className="mt-viewer3d__readout">
              {clock(currentTime)} / {clock(duration)}
            </span>
          </div>
        )}

        <div className="mt-viewer3d__readout">
          {hasMedia ? (
            <>
              <span>{fileName}</span>
              <span className="mt-muted"> · ลากเพื่อมองรอบตัว · เลื่อนล้อเพื่อซูม</span>
            </>
          ) : (
            <span className="mt-muted">
              เปิดภาพหรือวิดีโอ 360 แบบ equirectangular (สัดส่วน 2:1) จากกล้องพาโนรามา
            </span>
          )}
          {warning && <div className="mt-warning-text">{warning}</div>}
        </div>
      </div>
    </div>
  );
}

const clock = (seconds: number): string => {
  const total = Math.max(0, Math.floor(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

function disposeMaterial(material: THREE.Material | THREE.Material[]): void {
  for (const item of Array.isArray(material) ? material : [material]) {
    const withMap = item as THREE.Material & { map?: THREE.Texture | null };
    withMap.map?.dispose();
    item.dispose();
  }
}
