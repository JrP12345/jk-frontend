/**
 * Reference-counted scroll locking system.
 * Prevents multiple overlapping modals/drawers or route transitions
 * from leaving document.body permanently locked with `overflow: hidden`.
 */

let activeLocks = 0;
let originalOverflow: string | null = null;
let originalPaddingRight: string | null = null;

export function lockScroll(): void {
  if (typeof document === "undefined") return;

  if (activeLocks === 0) {
    originalOverflow = document.body.style.overflow;
    originalPaddingRight = document.body.style.paddingRight;

    // Prevent content jump from disappearing scrollbar on desktop
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    document.body.style.overflow = "hidden";
  }

  activeLocks++;
}

export function unlockScroll(): void {
  if (typeof document === "undefined") return;

  activeLocks = Math.max(0, activeLocks - 1);

  if (activeLocks === 0) {
    document.body.style.overflow = originalOverflow ?? "";
    document.body.style.paddingRight = originalPaddingRight ?? "";
    originalOverflow = null;
    originalPaddingRight = null;
  }
}

export function forceResetScrollLock(): void {
  if (typeof document === "undefined") return;

  activeLocks = 0;
  document.body.style.overflow = "";
  document.body.style.paddingRight = "";
  originalOverflow = null;
  originalPaddingRight = null;
}

export function getActiveScrollLocks(): number {
  return activeLocks;
}
