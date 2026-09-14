import { describe, it, expect, beforeEach } from "vitest";
import { lockScroll, unlockScroll, forceResetScrollLock, getActiveScrollLocks } from "@/lib/scrollLock";

describe("scrollLock manager", () => {
  beforeEach(() => {
    forceResetScrollLock();
    document.body.style.overflow = "";
    document.body.style.paddingRight = "";
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
