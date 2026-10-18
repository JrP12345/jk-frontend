import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { EncounterLabTestPicker } from "@/components/clinical/EncounterLabTestPicker";
const fixture = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/lib/api", () => ({ default: { get: fixture.get } }));
const response = (items: unknown[], pages = 1) => ({ data: { data: items }, headers: { "x-total-pages": String(pages) } });
beforeEach(() => { fixture.get.mockReset(); Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, value: vi.fn() }); });
afterEach(cleanup);

it("loads the selected location's catalog and returns the canonical test identifier", async () => {
  fixture.get.mockResolvedValue(response([{ id: "catalog-test", name: "Recorded test", code: "RT" }]));
  const onChange = vi.fn(); render(<EncounterLabTestPicker locationId="clinic" value="" onChange={onChange} />);
  await waitFor(() => expect(screen.getByRole("combobox", { name: "Lab test *" })).toBeEnabled());
  fireEvent.click(screen.getByRole("combobox", { name: "Lab test *" }));
  fireEvent.click(await screen.findByRole("option", { name: "Recorded test (RT)" }));
  expect(onChange).toHaveBeenCalledWith("catalog-test");
  expect(fixture.get).toHaveBeenCalledWith("/lab-tests?locationId=clinic&page=1&limit=100", expect.objectContaining({ signal: expect.any(AbortSignal) }));
});

it("retains earlier tests when loading another catalog page", async () => {
  fixture.get.mockResolvedValueOnce(response([{ id: "first", name: "First test" }], 2)).mockResolvedValueOnce(response([{ id: "second", name: "Second test" }], 2));
  render(<EncounterLabTestPicker locationId="clinic" value="" onChange={vi.fn()} />);
  fireEvent.click(await screen.findByRole("button", { name: "Load more tests" }));
  await waitFor(() => expect(screen.queryByRole("button", { name: "Load more tests" })).not.toBeInTheDocument());
  fireEvent.click(screen.getByRole("combobox", { name: "Lab test *" }));
  expect(await screen.findByRole("option", { name: "First test" })).toBeInTheDocument();
  expect(screen.getByRole("option", { name: "Second test" })).toBeInTheDocument();
});

it("offers a retry after a failed read and distinguishes an empty catalog", async () => {
  fixture.get.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(response([]));
  render(<EncounterLabTestPicker locationId="clinic" value="" onChange={vi.fn()} />);
  expect(await screen.findByText("Test catalog unavailable")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(await screen.findByText(/No tests are configured/)).toBeInTheDocument();
  expect(screen.getByRole("combobox", { name: "Lab test *" })).toBeDisabled();
});
