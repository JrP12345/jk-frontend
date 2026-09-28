/**
 * Reference-counted scroll locking system.
 * Prevents multiple overlapping modals/drawers or route transitions
 * from leaving document.body permanently locked with `overflow: hidden`.
 */

let activeLocks = 0;
let originalOverflow: string | null = null;
let originalPaddingRight: string | null = null;
let originalBody: Pick<CSSStyleDeclaration, "position" | "top" | "left" | "width"> | null = null;
let originalRootOverflow = "";
let savedX = 0;
let savedY = 0;

export function lockScroll(): void {
  if (typeof document === "undefined") return;

  if (activeLocks === 0) {
    originalOverflow = document.body.style.overflow;
    originalPaddingRight = document.body.style.paddingRight;
    originalBody = { position: document.body.style.position, top: document.body.style.top, left: document.body.style.left, width: document.body.style.width };
    originalRootOverflow = document.documentElement.style.overflow;
    savedX = window.scrollX;
    savedY = window.scrollY;

    // Prevent content jump from disappearing scrollbar on desktop
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    // Fixed positioning also stops iOS touch scrolling behind an overlay.
    Object.assign(document.body.style, { position: "fixed", top: `${-savedY}px`, left: `${-savedX}px`, width: "100%" });
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
