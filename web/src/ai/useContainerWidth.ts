import { useEffect, useRef, useState } from 'react';

/**
 * Custom React hook that monitors the rendered pixel width of a container element.
 * Ensures SVG viewBoxes match physical rendered CSS pixel dimensions 1:1,
 * eliminating font stretching, blurry axes labels, and anisotropic SVG distortions.
 */
export function useContainerWidth(defaultWidth = 960) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(defaultWidth);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const update = () => {
      const rect = el.getBoundingClientRect();
      const w = Math.round(rect.width);
      if (w > 20) {
        setWidth((prev) => (Math.abs(prev - w) > 1 ? w : prev));
      }
    };

    update();
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.round(entry.contentRect.width);
        if (w > 20) {
          setWidth((prev) => (Math.abs(prev - w) > 1 ? w : prev));
        }
      }
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return [ref, width] as const;
}
