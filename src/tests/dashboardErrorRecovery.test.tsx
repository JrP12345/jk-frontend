import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import DashboardError from "@/app/(dashboard)/error";
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it("keeps technical exceptions out of the visible recovery message", () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const reset = vi.fn();
  render(<DashboardError error={new Error("MongoServerError E11000 patient_id in C:\\internal\\records.ts")} reset={reset} />);
  expect(screen.getByRole("heading", { level: 1, name: "Something went wrong" })).toBeInTheDocument();
  expect(screen.getByText("This page could not be displayed. Please try again.")).toBeInTheDocument();
  expect(screen.queryByText(/MongoServerError/)).not.toBeInTheDocument();
  expect(log.mock.calls).toEqual([["Dashboard error:"]]);
  fireEvent.click(screen.getByRole("button", { name: "Reload Section" }));
  expect(reset).toHaveBeenCalledOnce();
});
