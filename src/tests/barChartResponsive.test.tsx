import { act, fireEvent, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { BarChart } from "@/components/ui/charts/BarChart";

afterEach(() => vi.restoreAllMocks());
const points = Array.from({ length: 30 }, (_, index) => ({ label: `${index + 1} Oct`, count: index + 1 }));
const series = [{ key: "count", name: "Bookings" }];

it("uses a stable initial width before container measurement", () => {
  const { container } = render(<BarChart data={points} series={series} height={220} />);
  expect(container.querySelector("svg")).toHaveAttribute("viewBox", "0 0 600 220");
  expect(container.querySelector("svg")?.style.height).toBe("220px");
});

it("keeps a fixed height, readable labels, and fewer ticks on narrow containers", () => {
  let width = 760;
  vi.spyOn(SVGElement.prototype, "getBoundingClientRect").mockImplementation(() => ({ width } as DOMRect));
  const { container } = render(<BarChart data={points} series={series} height={220} />);
  const svg = container.querySelector("svg")!;
  expect(svg).toHaveAttribute("viewBox", "0 0 760 220");
  expect(svg.style.height).toBe("220px");
  const wideTicks = container.querySelectorAll(".x-axis-labels text").length;
  width = 320;
  act(() => fireEvent.resize(window));
  expect(svg).toHaveAttribute("viewBox", "0 0 320 220");
  expect(container.querySelectorAll(".x-axis-labels text").length).toBeLessThan(wideTicks);
  expect(container.querySelector(".x-axis-labels text")?.getAttribute("style")).toContain("font-size: 11px");
  expect(svg.style.height).toBe("220px");
});

it("starts measuring after an empty chart receives data", () => {
  vi.spyOn(SVGElement.prototype, "getBoundingClientRect").mockImplementation(() => ({ width: 400 } as DOMRect));
  const { container, rerender } = render(<BarChart data={[]} series={series} />);
  expect(container.querySelector("svg")).toBeNull();
  rerender(<BarChart data={points} series={series} />);
  expect(container.querySelector("svg")).toHaveAttribute("viewBox", "0 0 400 220");
});
