"use client";

import { useRef, useState, type PointerEvent, type MouseEvent } from "react";

type Direction = "left" | "right" | "up" | "down";
interface SwipeOptions {
  axis: "x" | "y";
  onSwipe: (direction: Direction) => void;
  direction?: Direction;
  enabled?: boolean;
  threshold?: number;
  mediaQuery?: string;
}

/** Opt-in touch gestures; leave scrolling, browser edges, forms and mouse input alone. */
export function useSwipeGesture({ axis, onSwipe, direction, enabled = true, threshold = 72, mediaQuery = "(max-width: 767px)" }: SwipeOptions) {
  const start = useRef<{ id: number; x: number; y: number; claimed: boolean; offset: number } | null>(null);
  const suppressClickUntil = useRef(0);
  const [offset, setOffset] = useState(0);
  const reset = () => { start.current = null; setOffset(0); };
  const allowed = () => enabled && window.matchMedia(mediaQuery).matches;
  const directionFor = (value: number): Direction => axis === "x" ? value < 0 ? "left" : "right" : value < 0 ? "up" : "down";
  const update = (event: PointerEvent<HTMLElement>) => {
    const initial = start.current;
    if (!initial || initial.id !== event.pointerId) return;
    if (!allowed()) { reset(); return; }
    const dx = event.clientX - initial.x, dy = event.clientY - initial.y;
    const distance = axis === "x" ? dx : dy, cross = axis === "x" ? dy : dx;
    if (!initial.claimed) {
      if (Math.abs(cross) > 10 && Math.abs(cross) >= Math.abs(distance)) { reset(); return; }
      if (Math.abs(distance) < 10 || Math.abs(distance) < Math.abs(cross) * 1.3) return;
      if (direction && directionFor(distance) !== direction) { reset(); return; }
      initial.claimed = true;
      event.currentTarget.setPointerCapture?.(event.pointerId);
    }
    initial.offset = direction && directionFor(distance) !== direction ? 0 : distance;
    setOffset(initial.offset);
    event.preventDefault();
  };
  return {
    offset,
    dragging: offset !== 0,
    handlers: {
      onPointerDown(event: PointerEvent<HTMLElement>) {
        if (event.isPrimary === false) { reset(); return; }
        if (!allowed() || event.pointerType !== "touch" || event.clientX < 20 || event.clientX > window.innerWidth - 20) return;
        const target = event.target as HTMLElement;
        if (target.closest('button, input, textarea, select, [role="combobox"], [contenteditable="true"], [data-gesture-ignore]')) return;
        // A nested horizontal scroller owns its swipe, even inside a drawer.
        for (let node: HTMLElement | null = target; node && node !== event.currentTarget; node = node.parentElement) {
          if (node.scrollWidth > node.clientWidth && /auto|scroll/.test(getComputedStyle(node).overflowX)) return;
        }
        start.current = { id: event.pointerId, x: event.clientX, y: event.clientY, claimed: false, offset: 0 };
      },
      onPointerMove: update,
      onPointerUp(event: PointerEvent<HTMLElement>) {
        update(event);
        const initial = start.current;
        if (!initial || initial.id !== event.pointerId) return;
        if (initial.claimed) suppressClickUntil.current = Date.now() + 400;
        if (initial.claimed && Math.abs(initial.offset) >= threshold) onSwipe(directionFor(initial.offset));
        reset();
      },
      onPointerCancel: reset,
      onLostPointerCapture: reset,
      onClickCapture(event: MouseEvent<HTMLElement>) {
        if (event.detail > 0 && Date.now() < suppressClickUntil.current) { event.preventDefault(); event.stopPropagation(); }
      },
    },
  };
}
