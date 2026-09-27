"use client";

import { useCallback, useEffect, useRef } from "react";

/** For replaceable reads only: never cancel or automatically replay mutations. */
export function useLatestRead() {
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);
  return useCallback(() => {
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    return {
      signal: controller.signal,
      isCurrent: () => active.current === controller && !controller.signal.aborted,
    };
  }, []);
}
