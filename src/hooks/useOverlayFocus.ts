"use client";

import { useEffect, useRef, type RefObject } from "react";
import { lockScroll, unlockScroll } from "@/lib/scrollLock";

const overlays: HTMLElement[] = [];
const backgroundInert = new Map<HTMLElement, boolean>();
let backgroundObserver: MutationObserver | undefined;

function syncBackground() {
  const top = overlays.at(-1);
  for (const [element, original] of backgroundInert) element.inert = original;
  if (!top) { backgroundInert.clear(); backgroundObserver?.disconnect(); backgroundObserver = undefined; return; }
  for (const element of Array.from(document.body.children)) {
    if (!(element instanceof HTMLElement) || element.contains(top) || element.hasAttribute("data-overlay-live") || element.hasAttribute("data-print-frame") || element.dataset.overlayOwner === top.id) continue;
    if (!backgroundInert.has(element)) backgroundInert.set(element, element.inert);
    element.inert = true;
  }
}
const selector = 'button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Share focus ownership between dialogs, navigation drawers and their portaled controls. */
export function useOverlayFocus(
  open: boolean,
  ref: RefObject<HTMLElement | null>,
  onClose: () => void,
  scrollLock = true,
) {
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);

  useEffect(() => {
    const overlay = ref.current;
    if (!open || !overlay) return;
    const previous = document.activeElement as HTMLElement | null;
    overlays.push(overlay);
    if (scrollLock) lockScroll();
    syncBackground();
    if (!backgroundObserver) {
      backgroundObserver = new MutationObserver(syncBackground);
      backgroundObserver.observe(document.body, { childList: true });
    }

    const ownedPopups = () => Array.from(document.querySelectorAll<HTMLElement>("[data-overlay-owner]"))
      .filter((popup) => popup.dataset.overlayOwner === overlay.id && popup.dataset.exiting !== "true");
    const focusable = () => [overlay, ...ownedPopups()].flatMap((root) =>
      Array.from(root.querySelectorAll<HTMLElement>(selector))).filter((element) => {
        // Check ancestors too: responsive controls may be inside a hidden wrapper.
        for (let node: HTMLElement | null = element; node; node = node.parentElement) {
          const style = getComputedStyle(node);
          if (node.hidden || node.inert || style.display === "none" || style.visibility === "hidden") return false;
        }
        return element.tabIndex >= 0 && !element.closest('[aria-hidden="true"]');
      });
    const timer = window.setTimeout(() => {
      if (overlays.at(-1) === overlay) (focusable()[0] || overlay).focus();
    }, 0);
    const keydown = (event: KeyboardEvent) => {
      if (overlays.at(-1) !== overlay || event.defaultPrevented) return;
      if (event.key === "Escape") {
        // A child selector/menu closes first. Its listener owns this key press.
        if (ownedPopups().length) return;
        event.preventDefault();
        closeRef.current();
      }
      if (event.key !== "Tab") return;
      const elements = focusable();
      const index = elements.indexOf(document.activeElement as HTMLElement);
      if (!elements.length) { event.preventDefault(); overlay.focus(); return; }
      if (index === -1 || (!event.shiftKey && index === elements.length - 1) || (event.shiftKey && index === 0)) {
        event.preventDefault();
        elements[event.shiftKey ? elements.length - 1 : 0].focus();
      }
    };
    const focusin = (event: FocusEvent) => {
      if (overlays.at(-1) !== overlay) return;
      const target = event.target as Node;
      if (overlay.contains(target) || ownedPopups().some((popup) => popup.contains(target))) return;
      (focusable()[0] || overlay).focus();
    };
    document.addEventListener("keydown", keydown);
    document.addEventListener("focusin", focusin);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("keydown", keydown);
      document.removeEventListener("focusin", focusin);
      const index = overlays.indexOf(overlay);
      const wasTop = overlays.at(-1) === overlay;
      if (index >= 0) overlays.splice(index, 1);
      syncBackground();
      if (scrollLock) unlockScroll();
      if (wasTop && previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [open, ref, scrollLock]);
}
