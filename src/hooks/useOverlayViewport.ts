"use client";

import { useEffect, useState, type CSSProperties } from "react";

/** Keep overlays inside the visible viewport when a phone keyboard opens. */
export function useOverlayViewport(open: boolean): CSSProperties | undefined {
  const [viewport, setViewport] = useState<CSSProperties>();
  useEffect(() => {
    if (!open || !window.visualViewport) return;
    const visible = window.visualViewport;
    const update = () => setViewport({ top: visible.offsetTop, left: visible.offsetLeft, width: visible.width, height: visible.height, bottom: "auto", right: "auto" });
    update();
    visible.addEventListener("resize", update);
    visible.addEventListener("scroll", update);
    return () => {
      visible.removeEventListener("resize", update);
      visible.removeEventListener("scroll", update);
    };
  }, [open]);
  return viewport;
}
