"use client";
// Bottom sheet (mobile) / centred dialog (desktop). Swipe down on the handle or header to close;
// also closes on Escape, backdrop tap and the Android back button.
import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/Icon";
import { pushBackHandler } from "@/lib/native/back";
import { haptic } from "@/lib/native/haptics";
import { useSwipe } from "@/lib/useSwipe";

export function Sheet({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const swipe = useSwipe({
    axis: "y",
    allow: ["down"],
    threshold: 90,
    onSwipe: () => {
      haptic("soft");
      onCloseRef.current();
    },
  });

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCloseRef.current();
    document.addEventListener("keydown", onKey);
    const unBack = pushBackHandler(() => onCloseRef.current());
    document.documentElement.classList.add("sheet-open");
    return () => {
      document.removeEventListener("keydown", onKey);
      unBack();
      document.documentElement.classList.remove("sheet-open");
      prev?.focus?.();
    };
  }, []);

  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="sheet-layer">
      <div className="sheet-backdrop" onClick={() => onCloseRef.current()} aria-hidden />
      <div
        ref={panelRef}
        className={`sheet${swipe.dragging ? " is-dragging" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        style={swipe.offset ? { transform: `translateY(${Math.max(0, swipe.offset)}px)` } : undefined}
      >
        <div className="sheet-grab" {...swipe.handlers}>
          <span className="sheet-handle" aria-hidden />
          <div className="sheet-head">
            <h2 id={titleId}>{title}</h2>
            <button type="button" className="icon-btn sm" aria-label="Yopish" onClick={() => onCloseRef.current()}>
              <Icon name="close" />
            </button>
          </div>
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
