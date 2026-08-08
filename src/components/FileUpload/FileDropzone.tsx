import { useCallback, useRef, useState, type DragEvent } from 'react';
import { Icon } from '@/components/common';
import { ACCEPTED_2D_TYPES, ACCEPTED_3D_TYPES } from '@/utils/fileLoader';

interface FileDropzoneProps {
  onFile: (file: File) => void;
  /** Rendered as a full-panel drop target rather than a compact button row. */
  variant?: 'full' | 'compact';
  accept?: string;
}

export function FileDropzone({
  onFile,
  variant = 'full',
  accept = `${ACCEPTED_2D_TYPES},${ACCEPTED_3D_TYPES}`,
}: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setDragging(false);
      const file = event.dataTransfer.files?.[0];
      if (file) onFile(file);
    },
    [onFile],
  );

  const openPicker = () => inputRef.current?.click();

  return (
    <div
      className={`mt-dropzone mt-dropzone--${variant} ${dragging ? 'is-dragging' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={variant === 'full' ? openPicker : undefined}
      role={variant === 'full' ? 'button' : undefined}
      tabIndex={variant === 'full' ? 0 : undefined}
      onKeyDown={(e) => {
        if (variant === 'full' && (e.key === 'Enter' || e.key === ' ')) openPicker();
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = '';
        }}
      />

      {variant === 'full' ? (
        <>
          <Icon name="upload" size={44} strokeWidth={1.2} />
          <h2>ลากไฟล์แบบมาวาง หรือคลิกเพื่อเลือกไฟล์</h2>
          <p>รองรับ PDF, JPG, PNG, WEBP สำหรับงาน 2D และ OBJ, GLB, GLTF สำหรับงาน 3D</p>
          <ul className="mt-dropzone__hints">
            <li>ไฟล์ทั้งหมดประมวลผลในเครื่อง ไม่มีการอัปโหลดขึ้นเซิร์ฟเวอร์</li>
            <li>PDF จะได้มาตราส่วนอ้างอิงกระดาษอัตโนมัติ</li>
            <li>ภาพถ่าย/สแกน ควรปรับเทียบด้วยเครื่องมือ Calibrate ก่อนวัด</li>
          </ul>
        </>
      ) : (
        <button type="button" className="mt-btn mt-btn--secondary mt-btn--md" onClick={openPicker}>
          <Icon name="upload" size={18} />
          เปิดไฟล์
        </button>
      )}
    </div>
  );
}
