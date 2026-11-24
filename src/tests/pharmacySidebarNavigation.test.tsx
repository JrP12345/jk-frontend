import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import Sidebar from "@/components/ui/Sidebar";
import { PharmacyNavigation } from "@/components/pharmacy/PharmacyNavigation";
import { WorkspacePageNavigationProvider, useWorkspacePageNavigation } from "@/components/dashboard/WorkspacePageNavigation";
import { useState } from "react";

vi.mock("@/components/ui/RouteProgress", () => ({ NavigationPending: () => null }));

function Workspace() {
  const navigation = useWorkspacePageNavigation();
  const [active, setActive] = useState("counter");
  return <>
    <Sidebar items={[{ label: "Pharmacy", href: "/dashboard/pharmacy", active: true, children: navigation?.pages?.items.map(page => ({ label: page.label, href: `#${page.id}`, active: navigation.pages?.active === page.id, onSelect: () => navigation.pages?.select(page.id) })) }]} />
    <PharmacyNavigation compact activeTab={active} onChange={setActive} toolbarContext={<span>Selected branch</span>} tabs={[
      { id: "counter", label: "Counter sale", content: <p>Counter content</p> },
      { id: "sales", label: "Sales & collections", content: <p>Sales content</p> },
    ]} />
  </>;
}

it("uses the existing expandable sidebar to switch and highlight permitted pharmacy pages without a second tab row", async () => {
  render(<WorkspacePageNavigationProvider><Workspace /></WorkspacePageNavigationProvider>);
  const counter = await screen.findByRole("link", { name: "Counter sale" });
  expect(counter).toHaveAttribute("aria-current", "page");
  expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Inventory" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("link", { name: "Sales & collections" }));
  await waitFor(() => expect(screen.getByRole("link", { name: "Sales & collections" })).toHaveAttribute("aria-current", "page"));
  expect(screen.getByText("Sales content")).toBeVisible();
  expect(screen.queryByText("Counter content")).not.toBeInTheDocument();
  expect(screen.getByText("Selected branch")).toBeVisible();
});
