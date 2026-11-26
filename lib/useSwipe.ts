"use client";
// Touch/pointer swipe gestures with axis locking, velocity flicks and a live drag offset
// (so the UI can follow the finger and spring back). Works with mouse, touch and pen.
import { useCallback, useRef, useState } from "react";

export type SwipeDir = "left" | "right" | "up" | "down";

interface Options {
  /** Called when a swipe passes the distance threshold or is flicked fast enough. */
  onSwipe?: (dir: SwipeDir) => void;
  /** Which axis this element reacts to. "x" lets vertical scrolling through untouched. */
  axis?: "x" | "y";
  /** Minimum distance in px (default 64). */
  threshold?: number;
  /** Ignore drags in these directions (e.g. only allow "down" on a sheet). */
  allow?: SwipeDir[];
  disabled?: boolean;
}

export interface SwipeState {
  /** Current drag offset along the axis (px). 0 when idle. */
  offset: number;
  dragging: boolean;
}

export function useSwipe({ onSwipe, axis = "x", threshold = 64, allow, disabled }: Options) {
  const [state, setState] = useState<SwipeState>({ offset: 0, dragging: false });
  const start = useRef<{ x: number; y: number; t: number; id: number } | null>(null);
  const locked = useRef<"x" | "y" | null>(null);
  /** A real drag happened: swallow the click that follows pointerup. */
  const dragged = useRef(false);
  const onSwipeRef = useRef(onSwipe);
  onSwipeRef.current = onSwipe;

  const permitted = useCallback(
    (delta: number) => {
      const dir: SwipeDir = axis === "x" ? (delta < 0 ? "left" : "right") : delta < 0 ? "up" : "down";
      return !allow || allow.includes(dir) ? dir : null;
    },
    [axis, allow],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (disabled || (e.pointerType === "mouse" && e.button !== 0)) return;
      // Don't hijack drags that start on form controls or sliders.
      if ((e.target as HTMLElement).closest("input, textarea, select, [role=slider], [data-no-swipe]")) return;
      start.current = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId };
      locked.current = null;
      dragged.current = false;
    },
    [disabled],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const s = start.current;
      if (!s || s.id !== e.pointerId) return;
      const dx = e.clientX - s.x;
      const dy = e.clientY - s.y;
      if (!locked.current) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        locked.current = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
        if (locked.current !== axis) {
          start.current = null; // the other axis wins (e.g. page scroll)
          return;
        }
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
        dragged.current = true;
      }
      const delta = axis === "x" ? dx : dy;
      // Resist movement in directions that aren't allowed (rubber band).
      const offset = permitted(delta) ? delta : delta / 6;
      setState({ offset, dragging: true });
    },
    [axis, permitted],
  );

  const end = useCallback(
    (e: React.PointerEvent) => {
      const s = start.current;
      start.current = null;
      if (!s || s.id !== e.pointerId || locked.current !== axis) {
        setState((p) => (p.offset || p.dragging ? { offset: 0, dragging: false } : p));
        return;
      }
      const delta = axis === "x" ? e.clientX - s.x : e.clientY - s.y;
      const velocity = Math.abs(delta) / Math.max(1, performance.now() - s.t); // px/ms
      const dir = permitted(delta);
      setState({ offset: 0, dragging: false });
      if (dir && (Math.abs(delta) >= threshold || (velocity > 0.6 && Math.abs(delta) > 24))) onSwipeRef.current?.(dir);
    },
    [axis, threshold, permitted],
  );

  const onClickCapture = useCallback((e: React.MouseEvent) => {
    if (!dragged.current) return;
    dragged.current = false;
    e.preventDefault();
    e.stopPropagation();
  }, []);

  return {
    ...state,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: end,
      onPointerCancel: end,
      onClickCapture,
    },
  };
}
