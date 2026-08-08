import { useUiStore } from '@/store';
import { SHORTCUTS } from '@/hooks';
import { Modal } from '@/components/common';

export function ShortcutsModal() {
  const modal = useUiStore((s) => s.modal);
  const closeModal = useUiStore((s) => s.closeModal);

  return (
    <Modal open={modal === 'shortcuts'} title="คีย์ลัด" onClose={closeModal} width={560}>
      <ul className="mt-shortcuts">
        {SHORTCUTS.map((shortcut) => (
          <li key={shortcut.keys}>
            <kbd>{shortcut.keys}</kbd>
            <span>{shortcut.description}</span>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
