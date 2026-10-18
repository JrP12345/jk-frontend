import { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import QueueDialog from "@/components/queue/QueueDialog";
import { NurseVitalsModal } from "@/components/clinical/NurseVitalsModal";
import { ToastProvider } from "@/components/ui/Toast";

const api = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock("@/lib/api", () => ({ default: api }));

afterEach(cleanup);

it("submits a form from its pinned action and returns focus after dismissal", async () => {
  const submit = vi.fn();
  function Example() {
    const [open, setOpen] = useState(false);
    return <><button onClick={() => setOpen(true)}>Open vitals</button>
      <QueueDialog open={open} onClose={() => setOpen(false)} title="Vitals"
        footer={<button type="submit" form="test-vitals">Save vitals</button>}>
        <form id="test-vitals" onSubmit={event => { event.preventDefault(); submit(); }}>
          <label>Pulse<input name="pulse" defaultValue="76" /></label>
        </form>
      </QueueDialog></>;
  }
  render(<Example />);
  const trigger = screen.getByRole("button", { name: "Open vitals" });
  trigger.focus();
  fireEvent.click(trigger);
  await screen.findByRole("dialog", { name: "Vitals" });
  fireEvent.click(screen.getByRole("button", { name: "Save vitals" }));
  expect(submit).toHaveBeenCalledTimes(1);
  fireEvent.keyDown(document, { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(trigger).toHaveFocus();
});

it("keeps a busy dialog open when Escape or Close is pressed", async () => {
  const close = vi.fn();
  render(<QueueDialog open busy onClose={close} title="Saving vitals"><p>Saving</p></QueueDialog>);
  await screen.findByRole("dialog", { name: "Saving vitals" });
  fireEvent.keyDown(document, { key: "Escape" });
  const dismiss = screen.getByRole("button", { name: "Close modal" });
  expect(dismiss).toBeDisabled();
  fireEvent.click(dismiss);
  expect(close).not.toHaveBeenCalled();
});

it("saves the entered nursing measurements through the pinned form action", async () => {
  api.post.mockReset().mockResolvedValue({ data: { data: {} } });
  const saved = vi.fn();
  const close = vi.fn();
  render(<ToastProvider><NurseVitalsModal open onClose={close} appointmentId="visit-a"
    patientId="patient-a" patientName="Ananya Shah" onSaved={saved} /></ToastProvider>);
  await screen.findByRole("dialog", { name: "Vitals & triage" });
  for (const [placeholder, value] of [["120", "128"], ["80", "82"], ["72", "76"], ["98", "98"], ["98.6", "98.6"]]) {
    fireEvent.change(screen.getByPlaceholderText(placeholder), { target: { value } });
  }
  fireEvent.click(screen.getByRole("button", { name: "Save Triage Vitals" }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith("/queue/visit-a/vitals", expect.objectContaining({
    bpSystolic: 128, bpDiastolic: 82, pulse: 76, spO2: 98, temperature: 98.6, temperatureUnit: "F",
  })));
  expect(api.post).toHaveBeenCalledTimes(1);
  await waitFor(() => expect(saved).toHaveBeenCalledTimes(1));
  expect(close).toHaveBeenCalledTimes(1);
});
