import React, { useState } from "react";
import { it, expect } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { PharmacyCounterFilters, matchesCounterType } from "../components/pharmacy/PharmacyCounterFilters";
function Filters() {
  const [value, setValue] = useState<string[]>([]);
  return <PharmacyCounterFilters value={value} onChange={setValue} />;
}
it("keeps multi-select open for mouse and keyboard selection and clears back to all", () => {
  render(<Filters />);
  const trigger = screen.getByRole("button", { name: "Product filters" });
  fireEvent.keyDown(trigger, { key: "ArrowDown" });
  const frequent = screen.getByRole("menuitemcheckbox", { name: "Frequent only" });
  fireEvent.keyDown(frequent, { key: " " });
  expect(frequent).toBeChecked();
  fireEvent.click(screen.getByRole("menuitemcheckbox", { name: "Tablets" }));
  fireEvent.click(screen.getByRole("menuitemcheckbox", { name: "Capsules" }));
  expect(trigger).toHaveAttribute("title", "3 active filters");
  expect(screen.getByRole("menuitemcheckbox", { name: "Tablets" })).toBeChecked();
  fireEvent.click(screen.getByRole("menuitem", { name: "Clear filters" }));
  expect(trigger).toHaveAttribute("aria-expanded", "false");
  expect(trigger).toHaveAttribute("title", "Filter products");
});
it("matches selected medicine types as alternatives and leaves Frequent as a separate condition", () => {
  expect(matchesCounterType("tablet", ["tablet", "capsule", "frequent"])).toBe(true);
  expect(matchesCounterType("capsule", ["tablet", "capsule"])).toBe(true);
  expect(matchesCounterType("ml", ["tablet", "capsule"])).toBe(false);
  expect(matchesCounterType("g", ["other"])).toBe(true);
  expect(matchesCounterType("ml", ["frequent"])).toBe(true);
  expect(matchesCounterType("g", [])).toBe(true);
});
