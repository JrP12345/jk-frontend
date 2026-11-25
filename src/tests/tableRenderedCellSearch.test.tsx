import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, it } from "vitest";
import Table from "@/components/ui/Table";
afterEach(cleanup);
it("loads a cursor batch before crossing a partially loaded ten-row page without skipping bills", async () => {
  const rows = Array.from({ length: 35 }, (_, index) => ({ id: index, name: `Bill ${index + 1}` }));
  function Screen() {
    const [count, setCount] = useState(25);
    return <Table data={rows.slice(0, count)} columns={[{ key: "name", header: "Bill" }]} searchable={false} showColumnVisibility={false} mobileCardView={false} defaultRowsPerPage={10} rowsPerPageOptions={[10]} hasMore={count < rows.length} onLoadMore={async () => { setCount(rows.length); return true; }} />;
  }
  render(<Screen />);
  fireEvent.click(screen.getByRole("button", { name: "Next page" }));
  await screen.findByText("Bill 11");
  fireEvent.click(screen.getByRole("button", { name: "Next page" }));
  await waitFor(() => expect(screen.getByText("Bill 30")).toBeInTheDocument());
  expect(screen.getByText("Bill 21")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Next page" }));
  await screen.findByText("Bill 31");
  expect(screen.getByText("Bill 35")).toBeInTheDocument();
});
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
