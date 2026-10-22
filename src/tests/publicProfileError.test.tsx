import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import LocationError from "@/app/browse/[slug]/error";
import DoctorError from "@/app/doctor/[slug]/error";

it.each([LocationError, DoctorError])("offers segment recovery without exposing server error details", ErrorScreen => {
  const retry = vi.fn();
  const error = Object.assign(new Error("MongoServerError: private backend details"), { digest: "12345678" });
  render(<ErrorScreen error={error} retry={retry} />);
  expect(screen.getByRole("alert")).toHaveTextContent("Profile temporarily unavailable");
  expect(screen.getByText("Error reference: 12345678")).toBeInTheDocument();
  expect(screen.queryByText(/MongoServerError|private backend details/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(retry).toHaveBeenCalledOnce();
  expect(screen.getByRole("link", { name: "Browse locations" })).toHaveAttribute("href", "/browse");
});

it("does not display untrusted error-reference text", () => {
  const error = Object.assign(new Error("Private detail"), { digest: "patient@example.test" });
  render(<LocationError error={error} retry={vi.fn()} />);
  expect(screen.queryByText(/patient@example|Error reference/)).not.toBeInTheDocument();
});
