import { useState } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import DatePicker from "@/components/ui/DatePicker";
import Modal from "@/components/ui/Modal";
import { datePickerInput } from "./datePickerTestUtils";

beforeEach(() => Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, value: vi.fn() }));

it("preserves required form validation and focuses the shared trigger", async () => {
  const submit = vi.fn();
  render(<form onSubmit={event => { event.preventDefault(); submit(); }}><DatePicker label="Visit date" name="visit" required /><button type="submit">Save</button></form>);
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(submit).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Visit date" })).toHaveFocus();
  expect(await screen.findByRole("alert")).toHaveTextContent("Choose a date.");
});

it("enforces calendar and form date bounds without mutating Date props", async () => {
  const min = new Date(2026, 9, 18, 10, 30);
  const original = min.getTime();
  render(<form><DatePicker label="Visit" value="2026-10-18" minDate={min} maxDate="2026-10-20" /></form>);
  fireEvent.click(screen.getByRole("button", { name: "Visit" }));
  const popup = await screen.findByRole("dialog", { name: "Choose Visit" });
  expect(within(popup).getByRole("button", { name: /17.*October.*2026|October.*17.*2026/ })).toBeDisabled();
  expect(within(popup).getByRole("button", { name: /21.*October.*2026|October.*21.*2026/ })).toBeDisabled();
  expect(min.getTime()).toBe(original);
  const input = datePickerInput(screen.getByRole("button", { name: "Visit" }));
  fireEvent.change(input, { target: { value: "2026-10-17" } });
  let valid = true; act(() => { valid = input.checkValidity(); }); expect(valid).toBe(false);
});

it("keeps exact minutes on opening and cancels an unconfirmed time edit", async () => {
  const change = vi.fn();
  render(<DatePicker label="Time" mode="time" value="23:17" onChange={change} />);
  fireEvent.click(screen.getByRole("button", { name: "Time" }));
  const popup = await screen.findByRole("dialog", { name: "Choose Time" });
  expect(within(popup).getByLabelText("Minute")).toHaveTextContent("17");
  expect(change).not.toHaveBeenCalled();
  fireEvent.click(within(popup).getByLabelText("Minute"));
  fireEvent.click(await screen.findByRole("option", { name: "19", exact: true }));
  expect(change).not.toHaveBeenCalled();
  fireEvent.keyDown(popup, { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(change).not.toHaveBeenCalled();
});

it("saves an exact midnight minute using shared select controls", async () => {
  const change = vi.fn(); render(<DatePicker label="Time" mode="time" value="23:17" onChange={change} />);
  fireEvent.click(screen.getByRole("button", { name: "Time" }));
  const popup = await screen.findByRole("dialog", { name: "Choose Time" });
  for (const [label, option] of [["Hour", "12"], ["Minute", "19"], ["Period", "AM"]]) {
    fireEvent.click(within(popup).getByLabelText(label));
    const choice = await screen.findByRole("option", { name: option, exact: true });
    fireEvent.mouseDown(choice); fireEvent.click(choice);
  }
  fireEvent.click(within(popup).getByRole("button", { name: "Set time" }));
  expect(change).toHaveBeenCalledExactlyOnceWith("00:19");
});

it("preserves local date-time strings and exact minutes without timezone conversion", async () => {
  const change = vi.fn(); render(<DatePicker label="Task due" mode="datetime" value="2026-10-18T11:17" onChange={change} />);
  fireEvent.click(screen.getByRole("button", { name: "Task due" }));
  const popup = await screen.findByRole("dialog", { name: "Choose Task due" });
  fireEvent.click(within(popup).getByRole("button", { name: /Set Time/ }));
  expect(within(popup).getByLabelText("Minute")).toHaveTextContent("17");
  fireEvent.click(within(popup).getByRole("button", { name: "Set date & time" }));
  expect(change).toHaveBeenCalledExactlyOnceWith("2026-10-18T11:17");
});

it("clears a controlled time, preserves form values and stays disabled with its fieldset", () => {
  function Form() {
    const [time, setTime] = useState("10:17");
    return <form aria-label="Time form"><DatePicker name="time" label="Time" mode="time" value={time} onChange={setTime} /><fieldset disabled><DatePicker label="Unavailable date" required /></fieldset></form>;
  }
  render(<Form />); const input = datePickerInput(screen.getByRole("button", { name: "Time" })); expect(input).toHaveValue("10:17");
  fireEvent.click(screen.getByRole("button", { name: "Clear time" })); expect(input).toHaveValue("");
  expect(screen.getByRole("button", { name: "Unavailable date" })).toBeDisabled();
  expect(new FormData(screen.getByRole("form") as HTMLFormElement).get("time")).toBe("");
});

it("keeps the parent modal open when nested date and time popovers close", async () => {
  const close = vi.fn(); render(<Modal open title="Booking" onClose={close}><DatePicker label="Visit time" mode="time" value="09:17" /></Modal>);
  fireEvent.click(screen.getByRole("button", { name: "Visit time" }));
  const picker = await screen.findByRole("dialog", { name: "Choose Visit time" });
  fireEvent.click(within(picker).getByLabelText("Minute"));
  await screen.findByRole("listbox");
  fireEvent.keyDown(screen.getByRole("combobox", { name: "Search Minute" }), { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
  expect(close).not.toHaveBeenCalled(); expect(picker).toBeInTheDocument();
  fireEvent.keyDown(picker, { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Choose Visit time" })).not.toBeInTheDocument());
  expect(screen.getByRole("dialog", { name: "Booking" })).toBeInTheDocument(); expect(close).not.toHaveBeenCalled();
});

it("selects and clears a printed expiry month without inventing a day", async () => {
  const change = vi.fn();
  function Form() {
    const [value, setValue] = useState("2026-10");
    return <form aria-label="Expiry"><DatePicker label="Printed expiry" name="expiry" mode="month" value={value} onChange={value => { change(value); setValue(value); }} /></form>;
  }
  render(<Form />);
  const trigger = screen.getByRole("button", { name: "Printed expiry" });
  expect(trigger).toHaveTextContent("October 2026");
  trigger.focus();
  fireEvent.click(trigger);
  const popup = await screen.findByRole("dialog", { name: "Choose Printed expiry" });
  expect(within(popup).getByRole("button", { name: "October 2026" })).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(within(popup).getByRole("button", { name: "November 2026" }));
  expect(change).toHaveBeenCalledExactlyOnceWith("2026-11");
  const form = screen.getByRole("form", { name: "Expiry" }) as HTMLFormElement;
  expect(new FormData(form).get("expiry")).toBe("2026-11");
  expect(trigger).toHaveFocus();
  fireEvent.click(screen.getByRole("button", { name: "Clear date" }));
  expect(change).toHaveBeenLastCalledWith("");
  expect(new FormData(form).get("expiry")).toBe("");
});

it("bounds month selection with Date/string limits and preserves the bounds", async () => {
  const min = new Date(2026, 9, 18, 10, 30), original = min.getTime();
  render(<DatePicker label="Expiry" mode="month" value="2026-10" minDate={min} maxDate="2026-11" />);
  const trigger = screen.getByRole("button", { name: "Expiry" });
  const input = datePickerInput(trigger);
  expect(input).toHaveAttribute("min", "2026-10");
  expect(input).toHaveAttribute("max", "2026-11");
  fireEvent.click(trigger);
  const popup = await screen.findByRole("dialog", { name: "Choose Expiry" });
  expect(within(popup).getByRole("button", { name: "September 2026" })).toBeDisabled();
  expect(within(popup).getByRole("button", { name: "October 2026" })).toBeEnabled();
  expect(within(popup).getByRole("button", { name: "November 2026" })).toBeEnabled();
  expect(within(popup).getByRole("button", { name: "December 2026" })).toBeDisabled();
  expect(min.getTime()).toBe(original);
  fireEvent.change(input, { target: { value: "2026-09" } });
  let valid = true; act(() => { valid = input.checkValidity(); }); expect(valid).toBe(false);
});

it("navigates expiry years and returns from year selection to months", async () => {
  const change = vi.fn();
  render(<DatePicker label="Expiry" mode="month" value="2026-12" onChange={change} />);
  fireEvent.click(screen.getByRole("button", { name: "Expiry" }));
  const popup = await screen.findByRole("dialog", { name: "Choose Expiry" });
  fireEvent.click(within(popup).getByRole("button", { name: "Next Year" }));
  fireEvent.click(within(popup).getByRole("button", { name: "Previous Year" }));
  fireEvent.click(within(popup).getByRole("button", { name: "2026", exact: true }));
  fireEvent.click(within(popup).getByRole("button", { name: "2027", exact: true }));
  fireEvent.click(within(popup).getByRole("button", { name: "January 2027" }));
  expect(change).toHaveBeenCalledExactlyOnceWith("2027-01");
});

it("validates a required month and retains browser autofill metadata", async () => {
  const submit = vi.fn();
  render(<form onSubmit={event => { event.preventDefault(); submit(); }}><DatePicker label="Expiry" mode="month" required autoComplete="off" /><button type="submit">Save</button></form>);
  const trigger = screen.getByRole("button", { name: "Expiry" });
  expect(datePickerInput(trigger)).toHaveAttribute("autocomplete", "off");
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(submit).not.toHaveBeenCalled();
  expect(await screen.findByRole("alert")).toHaveTextContent("Choose a month.");
  expect(trigger).toHaveFocus();
});

it.each(["date", "month"] as const)("ignores an open %s popup when its original fieldset becomes locked", async mode => {
  const change = vi.fn();
  const view = render(<fieldset><DatePicker label="Source date" mode={mode} value={mode === "month" ? "2026-10" : "2026-10-18"} onChange={change} /></fieldset>);
  fireEvent.click(screen.getByRole("button", { name: "Source date" }));
  const popup = await screen.findByRole("dialog", { name: "Choose Source date" });
  view.rerender(<fieldset disabled><DatePicker label="Source date" mode={mode} value={mode === "month" ? "2026-10" : "2026-10-18"} onChange={change} /></fieldset>);
  fireEvent.click(within(popup).getByRole("button", { name: mode === "month" ? "November 2026" : /19.*October.*2026|October.*19.*2026/ }));
  expect(change).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Source date" })).toBeDisabled();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
