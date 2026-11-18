import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { PharmacyNavigation } from "@/components/pharmacy/PharmacyNavigation";

const tabs = [
  { id: "counter", label: "Counter sale", content: <p>Counter</p> },
  { id: "sales", label: "Sales & collections", content: <p>Sales</p> },
  { id: "till", label: "Cash drawer", content: <p>Existing drawer form</p> },
];
it("shows one drawer action and no redundant desktop More menu for a counter-only operator", async () => {
  render(<PharmacyNavigation compact scrollActiveIntoView={false} activeTab="counter" toolbarContext={<span>Demo branch</span>} tabs={tabs} />);
  const desktop = within(screen.getByRole("group", { name: "Pharmacy tools", exact: true }));
  expect(desktop.getByRole("button", { name: "Open cash drawer" })).toBeEnabled();
  expect(desktop.queryByRole("button", { name: "More" })).not.toBeInTheDocument();
  fireEvent.click(desktop.getByRole("button", { name: "Open cash drawer" }));
  expect(await screen.findByRole("dialog", { name: "Cash drawer" })).toHaveTextContent("Existing drawer form");
});
it("keeps other desktop tools in More without duplicating the drawer", async () => {
  const onChange = vi.fn();
  render(<PharmacyNavigation compact scrollActiveIntoView={false} activeTab="counter" onChange={onChange} toolbarContext={<span>Demo branch</span>} tabs={[...tabs, { id: "inventory", label: "Inventory" }]} />);
  fireEvent.click(within(screen.getByRole("group", { name: "Pharmacy tools", exact: true })).getByRole("button", { name: "More" }));
  const item = await screen.findByRole("menuitem", { name: "Inventory", exact: true });
  expect(screen.queryByRole("menuitem", { name: "Cash drawer", exact: true })).not.toBeInTheDocument();
  fireEvent.click(item); expect(onChange).toHaveBeenCalledWith("inventory");
});
it("keeps the cash drawer accessible from More on mobile", async () => {
  render(<PharmacyNavigation compact scrollActiveIntoView={false} activeTab="counter" toolbarContext={<span>Demo branch</span>} tabs={tabs} />);
  fireEvent.click(within(screen.getByRole("group", { name: "Mobile pharmacy tools" })).getByRole("button", { name: "More" }));
  fireEvent.click(await screen.findByRole("menuitem", { name: "Cash drawer", exact: true }));
  expect(await screen.findByRole("dialog", { name: "Cash drawer" })).toHaveTextContent("Existing drawer form");
});

it("keeps the same toolbar and primary tabs when switching between sales and secondary tools", async () => {
  const allTabs = [...tabs, { id: "inventory", label: "Inventory", content: <p>Stock list</p> }, { id: "pickups", label: "Medicine pickups", content: <p>Pickup queue</p> }];
  const props = { compact: true, scrollActiveIntoView: false, toolbarContext: <span>Demo branch</span>, toolbarActions: <button>Refresh pharmacy</button>, tabs: allTabs };
  const view = render(<PharmacyNavigation {...props} activeTab="counter" />);
  const labels = () => screen.getAllByRole("tab").map(tab => tab.textContent);
  const primary = labels();
  expect(primary).toEqual(["Counter sale", "Sales & collections"]);
  for (const activeTab of ["sales", "inventory", "pickups", "counter"]) {
    view.rerender(<PharmacyNavigation {...props} activeTab={activeTab} />);
    expect(labels()).toEqual(primary);
    expect(screen.getByText("Demo branch")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refresh pharmacy" })).toBeInTheDocument();
    expect(within(screen.getByRole("group", { name: "Pharmacy tools", exact: true })).getByRole("button", { name: "Open cash drawer" })).toBeInTheDocument();
    if (["counter", "sales"].includes(activeTab)) expect(screen.getByRole("tab", { name: activeTab === "counter" ? "Counter sale" : "Sales & collections" })).toHaveAttribute("aria-selected", "true");
  }
  view.rerender(<PharmacyNavigation {...props} activeTab="inventory" />);
  expect(screen.getByRole("region", { name: "Inventory" })).toHaveTextContent("Stock list");
  fireEvent.click(within(screen.getByRole("group", { name: "Pharmacy tools", exact: true })).getByRole("button", { name: "More tools, current: Inventory" }));
  expect(await screen.findByRole("menuitem", { name: "Inventory", exact: true })).toBeInTheDocument();
  expect(screen.queryByRole("menuitem", { name: "Cash drawer", exact: true })).not.toBeInTheDocument();
});

it("does not repeat visible primary tabs in the mobile tools menu", async () => {
  render(<PharmacyNavigation compact scrollActiveIntoView={false} activeTab="counter" toolbarContext={<span>Branch</span>} tabs={tabs} />);
  fireEvent.click(within(screen.getByRole("group", { name: "Mobile pharmacy tools" })).getByRole("button", { name: "More" }));
  expect(await screen.findByRole("menuitem", { name: "Cash drawer" })).toBeInTheDocument();
  expect(screen.queryByRole("menuitem", { name: "Counter sale" })).not.toBeInTheDocument();
  expect(screen.queryByRole("menuitem", { name: "Sales & collections" })).not.toBeInTheDocument();
});
