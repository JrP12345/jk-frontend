import { act, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { PharmacyCounterSaveStatus } from "@/components/pharmacy/PharmacyCounterSaveStatus";

afterEach(() => vi.useRealTimers());
it("explains a slow server confirmation without implying success or suggesting another Save", () => {
  vi.useFakeTimers();
  const view = render(<PharmacyCounterSaveStatus phase="saving" paid />);
  expect(screen.getByRole("status", { name: "Save progress" })).toHaveTextContent("Saving bill and payment together");
  act(() => vi.advanceTimersByTime(3000));
  expect(screen.getByRole("status", { name: "Save progress" })).toHaveTextContent("Still confirming");
  expect(screen.getByRole("status", { name: "Save progress" })).toHaveTextContent("no second Save is needed");
  view.unmount(); expect(vi.getTimerCount()).toBe(0);
});
