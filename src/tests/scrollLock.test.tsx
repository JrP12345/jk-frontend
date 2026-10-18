import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { lockScroll, unlockScroll, forceResetScrollLock, getActiveScrollLocks } from "@/lib/scrollLock";

describe("scrollLock manager", () => {
  beforeEach(() => {
    forceResetScrollLock();
    document.body.style.overflow = "";
    document.body.style.paddingRight = "";
  });
  afterEach(() => { forceResetScrollLock(); vi.restoreAllMocks(); });

  it("preserves the rendered width with a stable root gutter through nested dialogs", () => {
    const originalWidth = document.body.style.width;
    const originalGutter = document.documentElement.style.scrollbarGutter;
    document.documentElement.style.scrollbarGutter = "stable";
    document.body.style.paddingRight = "8px";
    vi.spyOn(document.documentElement, "getBoundingClientRect").mockReturnValue({ width: window.innerWidth - 10 } as DOMRect);
    lockScroll();
    expect(document.body.style.width).toBe("calc(100% - 10px)");
    expect(document.body.style.paddingRight).toBe("8px");
    lockScroll();
    unlockScroll();
    expect(document.body.style.width).toBe("calc(100% - 10px)");
    unlockScroll();
    expect(document.body.style.width).toBe(originalWidth);
    expect(document.documentElement.style.scrollbarGutter).toBe("stable");
    expect(document.body.style.paddingRight).toBe("8px");
    document.documentElement.style.scrollbarGutter = originalGutter;
  });

  it("locks and unlocks scroll cleanly", () => {
    expect(getActiveScrollLocks()).toBe(0);
    expect(document.body.style.overflow).toBe("");

    lockScroll();
    expect(getActiveScrollLocks()).toBe(1);
    expect(document.body.style.overflow).toBe("hidden");

    unlockScroll();
    expect(getActiveScrollLocks()).toBe(0);
    expect(document.body.style.overflow).toBe("");
  });

  it("handles nested modal locks without premature unlocking or trapped hidden overflow", () => {
    // Modal 1 opens
    lockScroll();
    expect(getActiveScrollLocks()).toBe(1);
    expect(document.body.style.overflow).toBe("hidden");

    // Modal 2 opens before Modal 1 is unmounted
    lockScroll();
    expect(getActiveScrollLocks()).toBe(2);
    expect(document.body.style.overflow).toBe("hidden");

    // Modal 1 closes
    unlockScroll();
    expect(getActiveScrollLocks()).toBe(1);
    expect(document.body.style.overflow).toBe("hidden"); // MUST STILL BE HIDDEN

    // Modal 2 closes
    unlockScroll();
    expect(getActiveScrollLocks()).toBe(0);
    expect(document.body.style.overflow).toBe(""); // RESTORED
  });

  it("locks the dashboard scroll region until the last dialog closes", () => {
    const main = document.createElement("main");
    main.dataset.appScroll = "";
    main.style.overflowY = "auto";
    document.body.append(main);
    try {
      lockScroll();
      lockScroll();
      expect(main.style.overflowY).toBe("hidden");
      expect(document.body.style.boxSizing).toBe("border-box");
      unlockScroll();
      expect(main.style.overflowY).toBe("hidden");
      unlockScroll();
      expect(main.style.overflowY).toBe("auto");
    } finally {
      forceResetScrollLock();
      main.remove();
    }
  });

  it("forceResetScrollLock clears any stuck lock on route transitions", () => {
    lockScroll();
    lockScroll();
    expect(getActiveScrollLocks()).toBe(2);
    expect(document.body.style.overflow).toBe("hidden");

    forceResetScrollLock();
    expect(getActiveScrollLocks()).toBe(0);
    expect(document.body.style.overflow).toBe("");
  });
});
