import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import StatCard from "../components/ui/StatCard";
import Table from "../components/ui/Table";

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
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Specialty")).toBeInTheDocument();
    expect(screen.getByText("Dr. Sandeep")).toBeInTheDocument();
    expect(screen.getByText("Physician")).toBeInTheDocument();
  });
});
