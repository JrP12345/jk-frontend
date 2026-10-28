import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import LivingAppointment from "@/app/home/LivingAppointment";
import PatientDiscovery from "@/app/home/PatientDiscovery";
import ClinicExperience from "@/app/home/ClinicExperience";
import Communications from "@/app/home/Communications";

describe("Appointment concept and actual product evidence", () => {
  it("explains the appointment stages without promising automatic confirmation", () => {
    render(<LivingAppointment />);
    const controls = screen.getByRole("group", { name: "Explore an example appointment" });
    expect(screen.getByText("Choose an available appointment.")).toBeInTheDocument();
    expect(screen.getByText(/Some bookings require payment before confirmation/)).toBeInTheDocument();
    fireEvent.click(within(controls).getByRole("button", { name: /Discover/ }));
    expect(screen.getByText("Explore a doctor and their clinic.")).toBeInTheDocument();
    fireEvent.click(within(controls).getByRole("button", { name: /Arrive/ }));
    expect(screen.getByText("Reception records the arrival.")).toBeInTheDocument();
    fireEvent.click(within(controls).getByRole("button", { name: /Consult/ }));
    expect(screen.getByText("The doctor opens the consultation.")).toBeInTheDocument();
    expect(screen.getByText(/Concept illustration with example people and visits/)).toBeInTheDocument();
    expect(within(controls).getAllByRole("button").filter(button => button.getAttribute("aria-pressed") === "true")).toHaveLength(1);
  });

  it("changes the real patient screenshot and explanation, rather than offering a fake booking", () => {
    render(<PatientDiscovery />);
    const controls = screen.getByRole("group", { name: "Explore patient screens" });
    expect(screen.getByRole("img")).toHaveAttribute("src", "/landing/product/discovery-desktop.webp");
    expect(screen.getByRole("img")).toHaveAttribute("loading", "lazy");
    fireEvent.click(within(controls).getByRole("button", { name: "View booking options" }));
    expect(screen.getByRole("img")).toHaveAttribute("src", "/landing/product/booking-desktop.webp");
    expect(screen.getByText("A doctor, a location and a time to visit.")).toBeInTheDocument();
    expect(screen.getByText(/Captured from Ekavyu with isolated synthetic records/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /book appointment|confirm|check-in/i })).not.toBeInTheDocument();
    expect(screen.getByRole("img").closest("picture")?.querySelector("source")).toHaveAttribute("srcset", "/landing/product/booking-mobile.webp");
  });

  it("shows distinct actual workspaces for reception, doctors and owners", () => {
    render(<ClinicExperience />);
    const controls = screen.getByRole("group", { name: "Explore clinic screens" });
    expect(screen.getByRole("img")).toHaveAttribute("src", "/landing/product/reception-desktop.webp");
    fireEvent.click(within(controls).getByRole("button", { name: "Doctor" }));
    expect(screen.getByRole("img")).toHaveAttribute("src", "/landing/product/doctor-desktop.webp");
    expect(screen.getByText("The visit opens into the doctor’s workspace.")).toBeInTheDocument();
    fireEvent.click(within(controls).getByRole("button", { name: "Live queue" }));
    expect(screen.getByRole("img")).toHaveAttribute("src", "/landing/product/queue-desktop.webp");
    expect(screen.getByText(/Anaya’s token 13/)).toBeInTheDocument();
    fireEvent.click(within(controls).getByRole("button", { name: "Visit billing" }));
    expect(screen.getByRole("img")).toHaveAttribute("src", "/landing/product/billing-desktop.webp");
    fireEvent.click(within(controls).getByRole("button", { name: "Practice owner" }));
    expect(screen.getByRole("img")).toHaveAttribute("src", "/landing/product/overview-desktop.webp");
    expect(screen.getByText(/Displayed totals are synthetic examples/)).toBeInTheDocument();
  });

  it("connects WhatsApp delivery evidence and the team inbox without pretending to send messages", () => {
    render(<Communications />);
    const controls = screen.getByRole("group", { name: "Explore communications screens" });
    expect(screen.getByRole("img")).toHaveAttribute("src", "/landing/product/whatsapp-desktop.webp");
    expect(screen.getByText(/another message is accepted and one has failed/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /send|book|pay/i })).not.toBeInTheDocument();
    fireEvent.click(within(controls).getByRole("button", { name: "Team notifications" }));
    expect(screen.getByRole("img")).toHaveAttribute("src", "/landing/product/notifications-desktop.webp");
    expect(screen.getByText(/Anaya’s arrival and recorded payment/)).toBeInTheDocument();
    fireEvent.error(screen.getByRole("img"));
    expect(screen.getByRole("link", { name: /Ask about clinic setup/ })).toHaveAttribute("href", "/onboarding?mode=new_org");
  });

  it("keeps a relevant action available when a screenshot fails and lets another image load", () => {
    render(<PatientDiscovery />);
    fireEvent.error(screen.getByRole("img"));
    expect(screen.getByText("The product image couldn’t be loaded.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Explore doctors and clinics" })).toHaveAttribute("href", "/browse");
    fireEvent.click(screen.getByRole("button", { name: "View booking options" }));
    expect(screen.getByRole("img")).toHaveAttribute("src", "/landing/product/booking-desktop.webp");
  });
});
