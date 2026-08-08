import { useUiStore } from '@/store';
import { Icon, type IconName } from './Icon';

const TONE_ICON: Record<'info' | 'success' | 'error', IconName> = {
  info: 'info',
  success: 'check',
  error: 'warning',
};

export function Toasts() {
  const toasts = useUiStore((s) => s.toasts);
  const dismiss = useUiStore((s) => s.dismissToast);

  if (toasts.length === 0) return null;

  return (
    <div className="mt-toasts" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <button
          key={toast.id}
          type="button"
          className={`mt-toast mt-toast--${toast.tone}`}
          onClick={() => dismiss(toast.id)}
        >
          <Icon name={TONE_ICON[toast.tone]} size={16} />
          <span>{toast.message}</span>
        </button>
      ))}
    </div>
  );
}
