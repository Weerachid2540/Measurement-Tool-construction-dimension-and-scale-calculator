import { useEffect, useState, type RefObject } from 'react';
import type { Size } from '@/types';

/** Tracks an element's content-box size so the Konva stage can fill its container. */
export function useElementSize<T extends HTMLElement>(ref: RefObject<T>): Size {
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setSize((current) =>
        current.width === width && current.height === height ? current : { width, height },
      );
    });

    observer.observe(element);
    setSize({ width: element.clientWidth, height: element.clientHeight });
    return () => observer.disconnect();
  }, [ref]);

  return size;
}
