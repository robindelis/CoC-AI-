import { useEffect, useRef, useState } from 'react';

/**
 * Custom React hook that monitors the rendered pixel width of a container element.
 * Ensures SVG viewBoxes match physical rendered CSS pixel dimensions 1:1,
 * eliminating font stretching, blurry axes labels, and anisotropic SVG distortions.
 */
export function useContainerWidth<T extends HTMLElement = HTMLDivElement>(defaultWidth = 960) {
  const ref = useRef<T | null>(null);
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

/**
 * Custom React hook that monitors both rendered width and height of a container element.
 * Ensures 2D SVG viewBox matches physical rendered CSS pixel dimensions 1:1,
 * adapting naturally to flex/grid stretching without distortions.
 */
export function useContainerSize<T extends HTMLElement = HTMLDivElement>(
  defaultWidth = 800,
  defaultHeight = 500
) {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ width: defaultWidth, height: defaultHeight });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const update = () => {
      const rect = el.getBoundingClientRect();
      const w = Math.round(rect.width);
      const h = Math.round(rect.height);
      if (w > 20 && h > 20) {
        setSize((prev) =>
          Math.abs(prev.width - w) > 1 || Math.abs(prev.height - h) > 1
            ? { width: w, height: h }
            : prev
        );
      }
    };

    update();
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.round(entry.contentRect.width);
        const h = Math.round(entry.contentRect.height);
        if (w > 20 && h > 20) {
          setSize((prev) =>
            Math.abs(prev.width - w) > 1 || Math.abs(prev.height - h) > 1
              ? { width: w, height: h }
              : prev
          );
        }
      }
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return [ref, size.width, size.height] as const;
}
