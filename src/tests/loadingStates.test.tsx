import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Card, LoadingState, Modal, Skeleton, SkeletonTable, Table } from "@/components/ui";

describe("Loading regions", () => {
  it("centers unknown content across its region and announces one status", () => {
    render(<LoadingState label="Loading organizations" />);
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByRole("status", { name: "Loading organizations" })).toHaveClass("w-full", "items-center", "justify-center");
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
  });

  it("keeps the viewport fallback centered", () => {
    render(<LoadingState fullPage />);
    expect(screen.getByRole("status")).toHaveClass("min-h-dvh", "w-full", "justify-center");
  });

  it("announces a skeleton once without showing a competing spinner", () => {
    const { container } = render(<LoadingState label="Loading records"><SkeletonTable /></LoadingState>);
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByRole("status", { name: "Loading records" })).toBeInTheDocument();
    expect(container.querySelector("svg")).not.toBeInTheDocument();
  });

  it("announces one loading status for a card overlay", () => {
    const view = render(<Card loading loadingText="Loading totals"><p>Totals</p></Card>);
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByRole("status", { name: "Loading totals" })).toBeInTheDocument();
    view.rerender(<Card loading><p>Totals</p></Card>);
    expect(screen.getByRole("status", { name: "Loading content" })).toBeInTheDocument();
  });

  it("announces one loading status for a dialog body", () => {
    render(<Modal open onClose={() => {}} title="Documents" loading loadingText="Loading documents"><p>Document content</p></Modal>);
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByRole("status", { name: "Loading documents" })).toBeInTheDocument();
  });
});

describe("Skeleton dimensions", () => {
  it("allows utility sizes to define the intended layout", () => {
    const { container } = render(<Skeleton className="h-32 w-72" />);
    const element = container.firstElementChild as HTMLElement;
    expect(element.style.width).toBe("");
    expect(element.style.height).toBe("");
    expect(element).toHaveClass("h-32", "w-72", "max-w-full");
    expect(element).not.toHaveClass("h-4", "w-full");
  });

  it("retains a mobile size while allowing responsive utilities to take over", () => {
    const { container } = render(<Skeleton className="sm:h-32 sm:w-72" />);
    const element = container.firstElementChild as HTMLElement;
    expect(element).toHaveClass("h-4", "w-full", "sm:h-32", "sm:w-72");
    expect(element.style.height).toBe("");
    expect(element.style.width).toBe("");
  });

  it("respects explicit dimensions and caller style overrides", () => {
    const { container } = render(<Skeleton width="65%" height="2rem" style={{ height: "3rem" }} />);
    expect(container.firstElementChild).toHaveStyle({ width: "65%", height: "3rem" });
  });
});

describe("Table loading sequence", () => {
  const columns = [{ header: "Name", accessor: "name" }];
  it("waits for a successful empty response before displaying an empty state", () => {
    const view = render(<Table columns={columns} data={[]} loading emptyMessage="No records found" />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading results");
    expect(screen.queryByText("No records found")).not.toBeInTheDocument();
    view.rerender(<Table columns={columns} data={[]} emptyMessage="No records found" />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getAllByText("No records found").length).toBeGreaterThan(0);
  });

  it("keeps rows visible during refresh and clears feedback when it completes", () => {
    const data = [{ id: "record", name: "Current record" }];
    const view = render(<Table columns={columns} data={data} loading />);
    expect(screen.getByRole("status")).toHaveTextContent("Updating results");
    expect(screen.getAllByText("Current record").length).toBeGreaterThan(0);
    view.rerender(<Table columns={columns} data={data} />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getAllByText("Current record").length).toBeGreaterThan(0);
  });
});
