"use client";

import { useLayoutEffect, useState, type CSSProperties } from "react";

/** Share visible viewport bounds; notification previews also clear the app header. */
export function useToastPosition(active: boolean): CSSProperties {
  const [bounds, setBounds] = useState({ headerBottom: 0, top: 0, bottom: 0 });
  useLayoutEffect(() => {
    if (!active) return;
    let observed: Element[] = [];
    const resize = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : undefined;
    function update() {
      const headers = Array.from(document.querySelectorAll("[data-app-header]"));
      if (headers.length !== observed.length || headers.some((header, index) => header !== observed[index])) {
        resize?.disconnect();
        headers.forEach(header => resize?.observe(header));
        observed = headers;
      }
      const bottom = headers.reduce((value, header) => {
        const rect = header.getBoundingClientRect();
        const visible = rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight / 2;
        return visible ? Math.max(value, rect.bottom) : value;
      }, 0);
      const visible = window.visualViewport;
      const next = { headerBottom: Math.ceil(bottom), top: visible?.offsetTop || 0, bottom: visible ? visible.offsetTop + visible.height : window.innerHeight };
      setBounds(previous => previous.headerBottom === next.headerBottom && previous.top === next.top && previous.bottom === next.bottom ? previous : next);
    }
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    return () => {
      resize?.disconnect(); observer.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
    };
  }, [active]);
  return {
    "--toast-header-offset": `${bounds.headerBottom ? bounds.headerBottom + 12 : 16}px`,
    "--toast-visible-top": `${bounds.top + 16}px`,
    ...(bounds.bottom ? { "--toast-viewport-bottom": `${bounds.bottom}px` } : {}),
  } as CSSProperties;
}
