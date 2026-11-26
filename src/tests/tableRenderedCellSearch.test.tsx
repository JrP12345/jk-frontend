import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, it } from "vitest";
import Table from "@/components/ui/Table";
afterEach(cleanup);
it("pages across server batches without skipping records or changing the full result count", async () => {
  const rows = Array.from({ length: 120 }, (_, index) => ({ id: index, name: `Item ${index + 1}` }));
  function Screen() {
    const [page, setPage] = useState(10);
    const offset = page > 10 ? 100 : 0;
    return <Table data={rows.slice(offset, offset + 100)} columns={[{ key: "name", header: "Item" }]} searchable={false} showColumnVisibility={false} mobileCardView={false} rowsPerPageOptions={[10]}
      remotePagination={{ page, rowCount: rows.length, rowOffset: offset, onPageChange: setPage }} />;
  }
  render(<Screen />);
  expect(screen.getByText("Item 91")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Next page" }));
  await screen.findByText("Item 101");
  expect(screen.getByText("Item 110")).toBeInTheDocument();
  expect(screen.getByText("Showing 101 to 110 of 120")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Previous page" }));
  await screen.findByText("Item 91");
  expect(screen.getByText("Item 100")).toBeInTheDocument();
});
it("keeps page totals and the mobile action aligned with paginated rows", async () => {
  const rows = Array.from({ length: 12 }, (_, index) => ({ id: index, amount: index + 1 }));
  render(<Table data={rows} columns={[{ key: "amount", header: "Amount" }]} searchable={false} showColumnVisibility={false}
    mobileLayout="list" mobilePaginationAction={<button>New counter sale</button>}
    renderPageSummary={(page, count) => <output aria-label="Page summary">{page.length}/{count}: {page.reduce((sum, row) => sum + row.amount, 0)}</output>} />);
  expect(screen.getByLabelText("Page summary")).toHaveTextContent("10/12: 55");
  expect(screen.getByRole("button", { name: "New counter sale" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Next page" }));
  await waitFor(() => expect(screen.getByLabelText("Page summary")).toHaveTextContent("2/12: 23"));
  fireEvent.click(screen.getByRole("button", { name: "Previous page" }));
  expect(screen.getByLabelText("Page summary")).toHaveTextContent("10/12: 55");
});
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
