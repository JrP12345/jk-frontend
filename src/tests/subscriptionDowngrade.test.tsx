import { describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";

interface Violation {
  resource: "locations" | "doctors" | "staff";
  current: number;
  allowed: number;
  excess: number;
  message: string;
}

const DowngradeResolutionDemoModal: React.FC<{
  isOpen: boolean;
  violations: Violation[];
  activeLocations: Array<{ id: string; name: string; city: string }>;
  canDowngrade: boolean;
  onDeactivateLocation: (id: string) => void;
  onProceed: () => void;
  onClose: () => void;
}> = ({ isOpen, violations, activeLocations, canDowngrade, onDeactivateLocation, onProceed, onClose }) => {
  if (!isOpen) return null;

  return (
    <div data-testid="downgrade-modal" className="modal">
      <h2>Plan Downgrade Action Required</h2>
      <p>Your active resources exceed target plan limits.</p>

      <div data-testid="violations-list">
        {violations.map((v, i) => (
          <div key={i} data-testid={`violation-${v.resource}`}>
            <span>Active {v.resource}: {v.current} / {v.allowed} Allowed ({v.excess} in excess)</span>
            <p>{v.message}</p>
          </div>
        ))}
      </div>

      <div data-testid="active-locations-list">
        {activeLocations.map((location) => (
          <div key={location.id} data-testid={`clinic-row-${location.id}`}>
            <span>{location.name} ({location.city})</span>
            <button
              data-testid={`deactivate-btn-${location.id}`}
              onClick={() => onDeactivateLocation(location.id)}
            >
              Deactivate Branch
            </button>
          </div>
        ))}
      </div>

      <button data-testid="close-modal-btn" onClick={onClose}>
        Close
      </button>
      <button
        data-testid="proceed-downgrade-btn"
        disabled={!canDowngrade}
        onClick={onProceed}
      >
        {canDowngrade ? "Proceed to Checkout" : "Deactivate Resources to Proceed"}
      </button>
    </div>
  );
};

describe("Subscription Plan Downgrade Resolution Modal", () => {
  const mockViolations: Violation[] = [
    {
      resource: "locations",
      current: 4,
      allowed: 1,
      excess: 3,
      message: "You have 4 active clinic branches, but Starter only allows 1.",
    },
  ];

  const mockActiveLocations = [
    { id: "c1", name: "Indiranagar Branch", city: "Bengaluru" },
    { id: "c2", name: "Koramangala Branch", city: "Bengaluru" },
    { id: "c3", name: "Whitefield Branch", city: "Bengaluru" },
    { id: "c4", name: "Jayanagar Branch", city: "Bengaluru" },
  ];

  it("renders violations and active locations correctly when downgrade is blocked", () => {
    const handleDeactivate = vi.fn();
    const handleProceed = vi.fn();
    const handleClose = vi.fn();

    render(
      <DowngradeResolutionDemoModal
        isOpen={true}
        violations={mockViolations}
        activeLocations={mockActiveLocations}
        canDowngrade={false}
        onDeactivateLocation={handleDeactivate}
        onProceed={handleProceed}
        onClose={handleClose}
      />
    );

    expect(screen.getByTestId("downgrade-modal")).toBeInTheDocument();
    expect(screen.getByTestId("violation-locations")).toHaveTextContent("Active locations: 4 / 1 Allowed (3 in excess)");
    expect(screen.getByTestId("clinic-row-c1")).toBeInTheDocument();
    expect(screen.getByTestId("clinic-row-c2")).toBeInTheDocument();
    expect(screen.getByTestId("clinic-row-c3")).toBeInTheDocument();
    expect(screen.getByTestId("clinic-row-c4")).toBeInTheDocument();

    const proceedBtn = screen.getByTestId("proceed-downgrade-btn");
    expect(proceedBtn).toBeDisabled();
    expect(proceedBtn).toHaveTextContent("Deactivate Resources to Proceed");

    fireEvent.click(screen.getByTestId("deactivate-btn-c2"));
    expect(handleDeactivate).toHaveBeenCalledWith("c2");
  });

  it("enables proceed button once quota is satisfied (canDowngrade: true)", () => {
    const handleDeactivate = vi.fn();
    const handleProceed = vi.fn();
    const handleClose = vi.fn();

    render(
      <DowngradeResolutionDemoModal
        isOpen={true}
        violations={[]}
        activeLocations={[{ id: "c1", name: "Indiranagar Branch", city: "Bengaluru" }]}
        canDowngrade={true}
        onDeactivateLocation={handleDeactivate}
        onProceed={handleProceed}
        onClose={handleClose}
      />
    );

    const proceedBtn = screen.getByTestId("proceed-downgrade-btn");
    expect(proceedBtn).not.toBeDisabled();
    expect(proceedBtn).toHaveTextContent("Proceed to Checkout");

    fireEvent.click(proceedBtn);
    expect(handleProceed).toHaveBeenCalled();
  });
});
