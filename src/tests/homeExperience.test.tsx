import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PatientDiscovery from "@/app/home/PatientDiscovery";
import ClinicExperience from "@/app/home/ClinicExperience";
import PharmacyExperience from "@/app/home/PharmacyExperience";

// Check visitor decisions and failure recovery; screenshots never execute real commands.
describe("Homepage product evidence", () => {
  it("switches discovery and booking evidence without offering a simulated booking", () => {
    render(<PatientDiscovery />);
    const controls = screen.getByRole("group", { name: "Explore patient screens" });
    expect(screen.getByRole("img")).toHaveAttribute("src", "/landing/product/discovery-desktop.webp");
    expect(screen.getByRole("img")).toHaveAttribute("loading", "lazy");
    fireEvent.click(within(controls).getByRole("button", { name: "Plan a visit" }));
    expect(screen.getByRole("img")).toHaveAttribute("src", "/landing/product/booking-desktop.webp");
    expect(screen.getByText(/Confirmation follows the provider/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /book appointment|confirm|check-in/i })).not.toBeInTheDocument();
    expect(screen.getByRole("img").closest("picture")?.querySelector("source")).toHaveAttribute("srcset", "/landing/product/booking-mobile.webp");
    expect(within(controls).getAllByRole("button").filter(button => button.getAttribute("aria-pressed") === "true")).toHaveLength(1);
  });

  it("connects reception, queue, consultation, billing and messaging without claiming live sends", () => {
    render(<ClinicExperience />);
    const controls = screen.getByRole("group", { name: "Explore clinic screens" });
    for (const [label, id] of [["Reception", "reception"], ["Live queue", "queue"], ["Consultation", "doctor"], ["Billing", "billing"], ["Patient updates", "whatsapp"]]) {
      fireEvent.click(within(controls).getByRole("button", { name: label }));
      expect(screen.getByRole("img")).toHaveAttribute("src", `/landing/product/${id}-desktop.webp`);
    }
    expect(screen.getByText(/Follow accepted, delivered, read and failed messages/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^send|^pay|^confirm/i })).not.toBeInTheDocument();
    fireEvent.error(screen.getByRole("img"));
    expect(screen.getByRole("link", { name: /Ask about clinic setup/ })).toHaveAttribute("href", "/onboarding?mode=new_org");
  });

  it("shows real pharmacy evidence and keeps its own entry point on image failure", () => {
    render(<PharmacyExperience />);
    expect(screen.getByRole("img")).toHaveAttribute("src", "/landing/product/pharmacy-desktop.webp");
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
    fireEvent.error(screen.getByRole("img"));
    expect(screen.getByRole("link", { name: /Explore pharmacy onboarding/ })).toHaveAttribute("href", "/pharmacy-start");
  });

  it("recovers from a failed image by selecting another real screen", () => {
    render(<PatientDiscovery />);
    fireEvent.error(screen.getByRole("img"));
    expect(screen.getByRole("link", { name: "Explore doctors and clinics" })).toHaveAttribute("href", "/browse");
    fireEvent.click(screen.getByRole("button", { name: "Plan a visit" }));
    expect(screen.getByRole("img")).toHaveAttribute("src", "/landing/product/booking-desktop.webp");
    expect(screen.getByRole("link", { name: "View full screen" })).toHaveAttribute("href", "/landing/product/booking-desktop.webp");
  });

  it("retries a failed screenshot without leaving the selected product view", () => {
    render(<PatientDiscovery />);
    fireEvent.click(screen.getByRole("button", { name: "Plan a visit" }));
    const failedImage = screen.getByRole("img");
    fireEvent.error(failedImage);
    expect(screen.getByRole("status")).toHaveTextContent("The product image couldn’t be loaded.");
    fireEvent.click(screen.getByRole("button", { name: "Retry image" }));
    expect(screen.getByRole("img")).not.toBe(failedImage);
    expect(screen.getByRole("img")).toHaveAttribute("src", "/landing/product/booking-desktop.webp");
    expect(screen.getByRole("button", { name: "Plan a visit" })).toHaveAttribute("aria-pressed", "true");
  });
});
