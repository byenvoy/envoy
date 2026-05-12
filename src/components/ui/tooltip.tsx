"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface TooltipProps {
  label: string;
  children: ReactNode;
  className?: string;
}

/**
 * Tooltip that renders into document.body via a portal, so it escapes any
 * `overflow: hidden / auto` ancestor that would otherwise clip it.
 * Positions itself above the wrapped child on hover.
 */
export function Tooltip({ label, children, className = "" }: TooltipProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!open || !wrapperRef.current) return;
    const rect = wrapperRef.current.getBoundingClientRect();
    setCoords({
      top: rect.top + window.scrollY - 8, // 8px above the wrapped element
      left: rect.left + window.scrollX + rect.width / 2,
    });
  }, [open]);

  return (
    <div
      ref={wrapperRef}
      className={`relative ${className}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      {open && coords && typeof document !== "undefined" &&
        createPortal(
          <span
            role="tooltip"
            style={{
              position: "absolute",
              top: coords.top,
              left: coords.left,
              transform: "translate(-50%, -100%)",
              backgroundColor: "#1A1A1A",
              color: "#FFFFFF",
              zIndex: 9999,
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            }}
            className="pointer-events-none whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-medium"
          >
            {label}
          </span>,
          document.body
        )}
    </div>
  );
}
