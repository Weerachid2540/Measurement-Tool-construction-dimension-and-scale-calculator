import { Suspense, lazy, useCallback } from 'react';
import { useMeasurementStore, useUiStore } from '@/store';
import { useDocumentLoader, useKeyboardShortcuts, useSessionPersistence } from '@/hooks';
import { Toasts } from '@/components/common';
import { Header } from '@/components/Layout/Header';
import { StatusBar } from '@/components/Layout/StatusBar';
import { ToolBar } from '@/components/Toolbar/ToolBar';
import { CanvasToolbar } from '@/components/Toolbar/CanvasToolbar';
import { MeasureCanvas } from '@/components/Canvas/MeasureCanvas';
import { FileDropzone } from '@/components/FileUpload/FileDropzone';
import { SidePanel } from '@/components/Panels/SidePanel';
import { CalibrateModal } from '@/components/Modals/CalibrateModal';
import { ShortcutsModal } from '@/components/Modals/ShortcutsModal';
import { SaveSymbolModal } from '@/components/Modals/SaveSymbolModal';

// three.js is a large dependency — keep it out of the initial bundle.
const Viewer3D = lazy(() =>
  import('@/components/Viewer3D/Viewer3D').then((module) => ({ default: module.Viewer3D })),
);

export default function App() {
  const page = useMeasurementStore((s) => s.page);
  const resetView = useMeasurementStore((s) => s.resetView);
  const mode = useUiStore((s) => s.mode);
  const { open } = useDocumentLoader();
  const { save } = useSessionPersistence();

  const fitToScreen = useCallback(() => {
    const element = document.querySelector<HTMLElement>('.mt-canvas');
    if (element) resetView({ width: element.clientWidth, height: element.clientHeight });
  }, [resetView]);

  useKeyboardShortcuts({ onSave: () => void save(), onFitToScreen: fitToScreen });

  return (
    <div className="mt-app">
      <Header />

      <div className="mt-body">
        <ToolBar />

        <main className="mt-workspace">
          <CanvasToolbar />

          <div className="mt-workspace__stage">
            {mode === '3d' ? (
              <Suspense fallback={<div className="mt-loading">กำลังโหลดโปรแกรมดูโมเดล 3D…</div>}>
                <Viewer3D />
              </Suspense>
            ) : page ? (
              <MeasureCanvas />
            ) : (
              <FileDropzone onFile={(file) => void open(file)} />
            )}
          </div>

          <StatusBar />
        </main>

        <SidePanel />
      </div>

      <CalibrateModal />
      <ShortcutsModal />
      <SaveSymbolModal />
      <Toasts />
    </div>
  );
}
