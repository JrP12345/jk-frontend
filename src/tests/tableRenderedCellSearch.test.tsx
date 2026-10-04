import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import Table from "@/components/ui/Table";
afterEach(cleanup);
it("searches rendered cell text and nested records without traversing React owners or cycles", () => {
  const cycle: { description: string; self?: unknown } = { description: "CT chest" }; cycle.self = cycle;
  function Screen() {
    return <Table columns={[{ key: "name", header: "Patient" }]} data={[
      { id: "one", name: <div>Recorded patient <span>Chest study</span></div>, nested: { city: "Pune" }, cycle },
      { id: "two", name: <div>Other patient</div>, nested: { city: "Delhi" } },
    ]} />;
  }
  render(<Screen />);
  fireEvent.change(screen.getByPlaceholderText("Search results"), { target: { value: "chest" } });
  expect(screen.getAllByText("Chest study").length).toBeGreaterThan(0);
  expect(screen.queryByText("Other patient")).not.toBeInTheDocument();
  fireEvent.change(screen.getByPlaceholderText("Search results"), { target: { value: "Pune" } });
  expect(screen.getAllByText("Chest study").length).toBeGreaterThan(0);
  fireEvent.change(screen.getByPlaceholderText("Search results"), { target: { value: "missing" } });
  expect(screen.getAllByText("No results match your search or filters.").length).toBeGreaterThan(0);
});
