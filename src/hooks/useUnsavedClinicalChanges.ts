"use client";

import { useEffect } from "react";

const unsavedEditors = new Set<symbol>();

export function confirmLeavingClinicalDraft(): boolean {
  return unsavedEditors.size === 0 || window.confirm("This clinical note has unsaved changes. Save Draft before leaving, or choose OK to discard these changes.");
}

/** No clinical text is stored in the browser. */
export function useUnsavedClinicalChanges(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const editor = Symbol("clinical draft");
    unsavedEditors.add(editor);
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const navigate = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      const link = (event.target as Element | null)?.closest("a[href]") as HTMLAnchorElement | null;
      if (!link && (event.target as Element | null)?.closest('[role="tab"]')) {
        if (!confirmLeavingClinicalDraft()) { event.preventDefault(); event.stopPropagation(); }
        return;
      }
      if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
      if (link.href === window.location.href || link.getAttribute("href")?.startsWith("#")) return;
      if (!confirmLeavingClinicalDraft()) { event.preventDefault(); event.stopPropagation(); }
    };
    const navigation = (window as any).navigation;
    const traverse = (event: any) => {
      if (event.navigationType === "traverse" && event.cancelable && !confirmLeavingClinicalDraft()) event.preventDefault();
    };
    navigation?.addEventListener("navigate", traverse);
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", navigate, true);
    return () => {
      unsavedEditors.delete(editor);
      navigation?.removeEventListener("navigate", traverse);
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", navigate, true);
    };
  }, [dirty]);
}
