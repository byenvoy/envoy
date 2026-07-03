"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

/**
 * Scales a fixed-size design (designWidth × designHeight) to exactly fill the
 * available width, measuring the container with a ResizeObserver. Used for the
 * mobile marketing mockup, which renders the full desktop app at its native
 * 1080px width and needs to shrink to fit any phone/tablet width without a
 * right-side gap or clipping. Pure JS so it works in every browser (no reliance
 * on container-query units or CSS trig).
 *
 * The scaled content is positioned absolutely so its pre-transform box (which
 * transforms don't shrink) can't stretch the container — the container's height
 * comes from aspect-ratio instead, keeping it flush around the scaled mockup.
 */
export function FluidScale({
  designWidth,
  designHeight,
  className,
  children,
}: {
  designWidth: number;
  designHeight: number;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const width = el.clientWidth;
      // Ignore 0 (e.g. while hidden at ≥lg) so we keep the last good scale.
      if (width > 0) setScale(width / designWidth);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [designWidth]);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        position: "relative",
        overflow: "hidden",
        aspectRatio: `${designWidth} / ${designHeight}`,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: designWidth,
          height: designHeight,
          transformOrigin: "top left",
          transform: `scale(${scale})`,
          // Hidden until measured to avoid a one-frame full-size flash.
          visibility: scale > 0 ? "visible" : "hidden",
        }}
      >
        {children}
      </div>
    </div>
  );
}
