"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "./ThemeProvider";
import type { DropdownItem } from "./Dropdown";

/** The same labelled appearance action in account menus and mobile navigation. */
export function useAppearanceMenuItem(): DropdownItem {
  const { resolvedMode, toggleMode } = useTheme();
  return {
    label: resolvedMode === "dark" ? "Switch to light appearance" : "Switch to dark appearance",
    icon: resolvedMode === "dark" ? <Sun /> : <Moon />,
    onClick: toggleMode,
  };
}

export function AppearancePreference() {
  const { resolvedMode, toggleMode } = useTheme();
  const dark = resolvedMode === "dark";
  return <button type="button" onClick={toggleMode} aria-label={dark ? "Switch to light appearance" : "Switch to dark appearance"}
    className="w-full min-h-11 flex items-center justify-between gap-3 p-3 rounded-xl border border-border bg-surface-alt text-left hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring cursor-pointer">
    <span className="flex items-center gap-3 min-w-0">
      {dark ? <Moon aria-hidden className="w-5 h-5 text-text-secondary shrink-0" /> : <Sun aria-hidden className="w-5 h-5 text-text-secondary shrink-0" />}
      <span><span className="block text-sm font-medium text-text">Appearance</span><span className="block text-xs text-text-secondary">{dark ? "Dark mode" : "Light mode"}</span></span>
    </span>
    <span aria-hidden className="shrink-0 text-xs font-medium text-accent">{dark ? "Use light" : "Use dark"}</span>
  </button>;
}
