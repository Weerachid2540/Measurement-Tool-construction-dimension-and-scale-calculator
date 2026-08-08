import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}

export function Modal({ open, title, onClose, children, footer, width = 480 }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="mt-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="mt-modal"
        style={{ maxWidth: width }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="mt-modal__header">
          <h2>{title}</h2>
          <button type="button" className="mt-icon-btn" onClick={onClose} aria-label="ปิด">
            <Icon name="close" size={18} />
          </button>
        </header>
        <div className="mt-modal__body">{children}</div>
        {footer && <footer className="mt-modal__footer">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}
