/**
 * Reference-counted scroll locking system.
 * Prevents multiple overlapping modals/drawers or route transitions
 * from leaving document.body permanently locked with `overflow: hidden`.
 */

let activeLocks = 0;
let originalOverflow: string | null = null;
let originalPaddingRight: string | null = null;
let originalBody: Pick<CSSStyleDeclaration, "position" | "top" | "left" | "width" | "boxSizing"> | null = null;
let originalRootOverflow = "";
let originalRootScrollbarGutter = "";
const appScrollContainers = new Map<HTMLElement, string>();
let savedX = 0;
let savedY = 0;

export function lockScroll(): void {
  if (typeof document === "undefined") return;

  if (activeLocks === 0) {
    originalOverflow = document.body.style.overflow;
    originalPaddingRight = document.body.style.paddingRight;
    originalBody = { position: document.body.style.position, top: document.body.style.top, left: document.body.style.left, width: document.body.style.width, boxSizing: document.body.style.boxSizing };
    originalRootOverflow = document.documentElement.style.overflow;
    originalRootScrollbarGutter = document.documentElement.style.scrollbarGutter;
    savedX = window.scrollX;
    savedY = window.scrollY;

    // Prevent content jump from disappearing scrollbar on desktop
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    // The global stable gutter otherwise remains visible outside the backdrop,
    // even with scrolling locked. Body padding above preserves the page width.
    document.documentElement.style.scrollbarGutter = "auto";
    // Fixed positioning also stops iOS touch scrolling behind an overlay.
    Object.assign(document.body.style, { position: "fixed", top: `${-savedY}px`, left: `${-savedX}px`, width: "100%", boxSizing: "border-box" });
    // The dashboard has its own scrolling main; locking only body leaves it movable.
    for (const element of document.querySelectorAll<HTMLElement>("[data-app-scroll]")) {
      appScrollContainers.set(element, element.style.overflowY);
      element.style.overflowY = "hidden";
    }
  }

  activeLocks++;
}

export function unlockScroll(): void {
  if (typeof document === "undefined") return;
  if (activeLocks === 0) return;

  activeLocks = Math.max(0, activeLocks - 1);

  if (activeLocks === 0) {
    document.body.style.overflow = originalOverflow ?? "";
    document.body.style.paddingRight = originalPaddingRight ?? "";
    if (originalBody) Object.assign(document.body.style, originalBody);
    document.documentElement.style.overflow = originalRootOverflow;
    document.documentElement.style.scrollbarGutter = originalRootScrollbarGutter;
    for (const [element, overflowY] of appScrollContainers) element.style.overflowY = overflowY;
    appScrollContainers.clear();
    const behavior = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = "auto";
    if (savedX || savedY) window.scrollTo(savedX, savedY);
    document.documentElement.style.scrollBehavior = behavior;
    originalBody = null;
    originalOverflow = null;
    originalPaddingRight = null;
  }
}

export function forceResetScrollLock(): void {
  if (typeof document === "undefined") return;

  if (activeLocks > 0) {
    activeLocks = 1;
    unlockScroll();
  }
}

export function getActiveScrollLocks(): number {
  return activeLocks;
}
