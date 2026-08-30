import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import Spinner, { PageSpinner } from "../components/ui/Spinner";

describe("Spinner Component Tests", () => {
  it("renders default orbital spinner with status role", () => {
    render(<Spinner />);
    const status = screen.getByRole("status");
    expect(status).toBeInTheDocument();
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("renders with a custom label and secondary description", () => {
    render(
      <Spinner
        label="Analyzing medical records..."
        secondaryText="Checking ICD-10 diagnostic codes"
      />
    );
    expect(screen.getByText("Analyzing medical records...")).toBeInTheDocument();
    expect(screen.getByText("Checking ICD-10 diagnostic codes")).toBeInTheDocument();
  });

  it("renders all sizes without crashing", () => {
    const sizes = ["xs", "sm", "md", "lg", "xl", "2xl"] as const;
    sizes.forEach((size) => {
      const { unmount } = render(<Spinner size={size} label={`Loading ${size}`} />);
      expect(screen.getByText(`Loading ${size}`)).toBeInTheDocument();
      unmount();
    });
  });

  it("renders all variants without crashing", () => {
    const variants = ["ring", "dots", "bars", "pulse", "orbital", "minimal"] as const;
    variants.forEach((variant) => {
      const { unmount } = render(<Spinner variant={variant} label={`Variant ${variant}`} />);
      expect(screen.getByText(`Variant ${variant}`)).toBeInTheDocument();
      unmount();
    });
  });

  it("renders with custom color class", () => {
    const { container } = render(<Spinner color="text-cyan-400" label="Custom Color" />);
    expect(container.querySelector(".text-cyan-400")).toBeInTheDocument();
  });
});

describe("PageSpinner Component Tests", () => {
  it("renders page spinner with dialog role and backdrop blur", () => {
    render(
      <PageSpinner
        label="Connecting to secure consultation..."
        description="Establishing WebRTC peer connection"
      />
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText("Connecting to secure consultation...")).toBeInTheDocument();
    expect(screen.getByText("Establishing WebRTC peer connection")).toBeInTheDocument();
  });
});
