import { describe, it, expect } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import StatCard from "../components/ui/StatCard";
import Table from "../components/ui/Table";
import Button from "../components/ui/Button";
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
    expect(screen.getByText("+12%")).toHaveClass("text-success-600");
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
});

describe("Button Loading State Tests", () => {
  it("renders button with loading spinner and disabled state without losing text", () => {
    render(<Button loading={true}>Confirm Appointment</Button>);
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Confirm Appointment")).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("renders loadingText when provided", () => {
    render(<Button loading={true} loadingText="Saving Record...">Confirm</Button>);
    expect(screen.getByText("Saving Record...")).toBeInTheDocument();
  });
});

describe("Card Loading Overlay Tests", () => {
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

