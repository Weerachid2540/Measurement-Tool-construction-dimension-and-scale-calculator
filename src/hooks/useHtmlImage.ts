import { useEffect, useState } from 'react';

type Status = 'idle' | 'loading' | 'loaded' | 'failed';

/** Loads an `HTMLImageElement` for Konva's `<Image image={…} />`. */
export function useHtmlImage(src: string | undefined): [HTMLImageElement | null, Status] {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [status, setStatus] = useState<Status>('idle');

  useEffect(() => {
    if (!src) {
      setImage(null);
      setStatus('idle');
      return;
    }

    let cancelled = false;
    setStatus('loading');
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (cancelled) return;
      setImage(img);
      setStatus('loaded');
    };
    img.onerror = () => {
      if (cancelled) return;
      setImage(null);
      setStatus('failed');
    };
    img.src = src;

    return () => {
      cancelled = true;
    };
  }, [src]);

  return [image, status];
}
