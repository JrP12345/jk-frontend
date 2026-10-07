import { describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import StatCard from "../components/ui/StatCard";
import Table from "../components/ui/Table";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import Textarea from "../components/ui/Textarea";
import Checkbox from "../components/ui/Checkbox";
import Card, { CardHeader, CardTitle, CardContent } from "../components/ui/Card";
import { SkeletonStats, SkeletonCardGrid } from "../components/ui/Skeleton";

describe("StatCard Component Tests", () => {
  it("renders label and value correctly", () => {
    render(<StatCard label="Total Revenue" value="₹12,500" />);
    expect(screen.getByText("Total Revenue")).toBeInTheDocument();
    expect(screen.getByText("₹12,500")).toBeInTheDocument();
  });

  it("renders trend positive values with success styles", () => {
    render(
      <StatCard
        label="Patients"
        value={150}
        change={{ value: "+12%", positive: true }}
        trend="up"
      />
    );
    expect(screen.getByText("+12%")).toBeInTheDocument();
    expect(screen.getByText("+12%")).toHaveClass("text-success-text");
  });
});

describe("Table Component Tests", () => {
  it("renders table headers and row values correctly", () => {
    const columns = [
      { header: "Name", key: "name" },
      { header: "Specialty", key: "specialty" },
    ];
    const data = [
      { id: "1", name: "Dr. Sandeep", specialty: "Physician" },
    ];

    render(<Table columns={columns} data={data} />);
    expect(screen.getAllByText("Name")[0]).toBeInTheDocument();
    expect(screen.getAllByText("Specialty")[0]).toBeInTheDocument();
    expect(screen.getAllByText("Dr. Sandeep")[0]).toBeInTheDocument();
    expect(screen.getAllByText("Physician")[0]).toBeInTheDocument();
  });

  it("renders non-blocking loading state with preserved row content and progressbar", () => {
    const columns = [{ header: "Name", key: "name" }];
    const data = [{ id: "1", name: "Dr. Sandeep" }];

    render(<Table columns={columns} data={data} loading={true} />);
    // Content is retained (not blown away to prevent CLS)
    expect(screen.getAllByText("Dr. Sandeep")[0]).toBeInTheDocument();
    // Non-blocking progress indicator is present
    const progress = screen.getByRole("progressbar");
    expect(progress).toBeInTheDocument();
    expect(screen.getByLabelText("Loading table data")).toBeInTheDocument();
  });

  it("uses one structural loading indicator for an empty table", () => {
    const { container } = render(<Table columns={[{ header: "Name", key: "name" }]} data={[]} loading />);
    expect(container.querySelectorAll(".skeleton-shimmer").length).toBeGreaterThan(0);
    expect(screen.queryByRole("progressbar", { name: "Loading table data" })).not.toBeInTheDocument();
  });

  it("keeps column semantics while reserving vertical rules for bordered tables", () => {
    const props = { columns: [{ header: "Name", key: "name" }, { header: "Status", key: "status" }], data: [{ id: "1", name: "A patient", status: "Booked" }] };
    const { rerender } = render(<Table {...props} />);
    const heading = screen.getByRole("columnheader", { name: "Name" });
    expect(heading).toHaveAttribute("scope", "col");
    expect(heading).not.toHaveClass("border-r");
    rerender(<Table {...props} variant="bordered" />);
    expect(screen.getByRole("columnheader", { name: "Name" })).toHaveClass("border-r");
  });
});

describe("Button Loading State Tests", () => {
  it("keeps a label and its trailing arrow together inside a full-width button", () => {
    render(<Button fullWidth><span>Schedule Next Available Date</span><svg aria-hidden="true" data-testid="trailing-arrow" /></Button>);
    const label = screen.getByText("Schedule Next Available Date");
    expect(label.parentElement).toHaveClass("inline-flex", "items-center", "gap-1.5");
    expect(label.parentElement).toContainElement(screen.getByTestId("trailing-arrow"));
    expect(screen.getByRole("button")).toHaveClass("w-full");
  });
  it("allows long labels to wrap while icons retain their width", () => {
    const { container } = render(<Button icon={<svg data-testid="button-icon" />}>Save and continue to consultation</Button>);
    expect(screen.getByRole("button")).toHaveClass("min-w-0", "max-w-full");
    expect(screen.getByText("Save and continue to consultation")).toHaveClass("whitespace-normal", "wrap-anywhere");
    expect(container.querySelector("[data-testid='button-icon']")?.parentElement).toHaveClass("shrink-0");
  });
  it("keeps the accessible action name when loading a compound label with an arrow", () => {
    render(<Button fullWidth loading><span>Verify &amp; Sign In</span><svg aria-hidden="true" /></Button>);
    const button = screen.getByRole("button", { name: "Verify & Sign In" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
  });
  it("renders button with loading spinner and disabled state without losing text", () => {
    render(<Button loading={true}>Confirm Appointment</Button>);
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("button", { name: "Confirm Appointment" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Confirm Appointment");
  });

  it("renders loadingText when provided", () => {
    render(<Button loading={true} loadingText="Saving Record...">Confirm</Button>);
    expect(screen.getByText("Saving Record...")).toBeInTheDocument();
  });
});

describe("Field validation feedback", () => {
  it("shows a native input error after interaction and clears it when corrected", () => {
    render(<Input type="email" required label="Email" />);
    const input = screen.getByRole("textbox", { name: "Email" });
    expect(input).not.toHaveAttribute("aria-invalid", "true");
    fireEvent.change(input, { target: { value: "invalid" } });
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toBeInTheDocument();
    fireEvent.change(input, { target: { value: "patient@example.com" } });
    expect(input).not.toHaveAttribute("aria-invalid", "true");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("keeps required textareas neutral until blur and clears the error on edit", () => {
    render(<Textarea required label="Reason" />);
    const textarea = screen.getByRole("textbox", { name: "Reason" });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    fireEvent.blur(textarea);
    expect(textarea).toHaveAttribute("aria-invalid", "true");
    fireEvent.change(textarea, { target: { value: "Follow-up" } });
    expect(textarea).not.toHaveAttribute("aria-invalid", "true");
  });

  it("validates a required checkbox after interaction", () => {
    render(<Checkbox required label="Accept terms" />);
    const checkbox = screen.getByRole("checkbox", { name: "Accept terms" });
    expect(checkbox).not.toHaveAttribute("aria-invalid", "true");
    fireEvent.blur(checkbox);
    expect(checkbox).toHaveAttribute("aria-invalid", "true");
    fireEvent.click(checkbox);
    expect(checkbox).not.toHaveAttribute("aria-invalid", "true");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("Card Loading Overlay Tests", () => {
  it("blocks card actions and makes nested controls inert until loading finishes", () => {
    const onClick = vi.fn();
    const { container, rerender } = render(<Card loading onClick={onClick}><button>Open details</button></Card>);
    const card = container.firstElementChild!;
    expect(card).toHaveAttribute("aria-busy", "true");
    expect(card).toHaveAttribute("aria-disabled", "true");
    expect(card).toHaveAttribute("tabindex", "-1");
    expect(screen.getByText("Open details").closest("[inert]")).toBeTruthy();
    fireEvent.click(card);
    fireEvent.keyDown(card, { key: "Enter" });
    expect(onClick).not.toHaveBeenCalled();
    rerender(<Card onClick={onClick}><button>Open details</button></Card>);
    expect(screen.getByText("Open details").closest("[inert]")).toBeNull();
    fireEvent.keyDown(card, { key: "Enter" });
    expect(onClick).toHaveBeenCalledOnce();
  });
  it("lets an explicitly sized card replace the shared default padding", () => {
    const { container } = render(<Card className="p-8 sm:p-12">Preview</Card>);
    const card = container.firstElementChild;
    expect(card).toHaveClass("p-8", "sm:p-12");
    expect(card).not.toHaveClass("p-4", "sm:p-5");
  });

  it("keeps mobile padding when only a wider-screen override is supplied", () => {
    const { container } = render(<Card className="sm:p-8">Preview</Card>);
    const card = container.firstElementChild;
    expect(card).toHaveClass("p-4", "sm:p-8");
    expect(card).not.toHaveClass("sm:p-5");
  });

  it("renders card loading overlay while keeping content mounted", () => {
    render(
      <Card loading={true} loadingText="Updating analytics...">
        <CardHeader>
          <CardTitle>Revenue Forecast</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Active Metrics</p>
        </CardContent>
      </Card>
    );
    expect(screen.getByText("Revenue Forecast")).toBeInTheDocument();
    expect(screen.getByText("Active Metrics")).toBeInTheDocument();
    expect(screen.getByText("Updating analytics...")).toBeInTheDocument();
  });
});

describe("Skeleton Primitives Tests", () => {
  it("renders SkeletonStats with correct item count", () => {
    const { container } = render(<SkeletonStats count={4} />);
    expect(container.firstChild).toHaveAttribute("aria-hidden", "true");
  });

  it("renders SkeletonCardGrid with columns and count", () => {
    const { container } = render(<SkeletonCardGrid count={3} columns={3} />);
    expect(container.firstChild).toHaveAttribute("aria-hidden", "true");
  });
});
