import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import Link from "next/link";
import Modal from "@/components/ui/Modal";
import Select from "@/components/ui/Select";
import Dropdown from "@/components/ui/Dropdown";
import Tabs from "@/components/ui/Tabs";
import Table from "@/components/ui/Table";
import DatePicker from "@/components/ui/DatePicker";
import Card from "@/components/ui/Card";
import { MobileBottomNav } from "@/components/dashboard/MobileBottomNav";
import { popoverPosition } from "@/lib/popoverPosition";

beforeEach(() => {
  vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false }));
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("responsive controls", () => {
  it("uses compact, standard, and wide dialog widths according to the task", async () => {
    const { rerender } = render(<Modal open title="Confirm" size="sm" onClose={vi.fn()}>Confirm action</Modal>);
    expect(await screen.findByRole("dialog", { name: "Confirm" })).toHaveClass("max-w-sm");

    rerender(<Modal open title="Form" size="lg" onClose={vi.fn()}>Form fields</Modal>);
    expect(await screen.findByRole("dialog", { name: "Form" })).toHaveClass("max-w-2xl");

    rerender(<Modal open title="Workspace" size="2xl" onClose={vi.fn()}>Workspace</Modal>);
    expect(await screen.findByRole("dialog", { name: "Workspace" })).toHaveClass("max-w-6xl");
  });

  it("does not turn a card containing a link into a second interactive control", () => {
    const open = vi.fn();
    render(<Card onClick={open} role="group"><Link href="/browse/clinic">Clinic details</Link></Card>);
    expect(screen.getByRole("group")).not.toHaveAttribute("tabindex");
    fireEvent.keyDown(screen.getByRole("link"), { key: "Enter" });
    expect(open).not.toHaveBeenCalled();
  });
  it("keeps required select validation and focuses its named visible control", async () => {
    const { container } = render(<form><Select label="Clinic" name="clinic" required options={[{ value: "central", label: "Central" }]} /></form>);
    const trigger = screen.getByRole("combobox", { name: "Clinic" });
    fireEvent.invalid(container.querySelector("select")!);
    expect(trigger).toHaveFocus();
    expect(screen.getByRole("alert")).toHaveTextContent("Please choose an option.");
    expect(container.querySelector("form")!.checkValidity()).toBe(false);
    fireEvent.click(trigger);
    fireEvent.click(await screen.findByRole("option", { name: "Central" }));
    expect(new FormData(container.querySelector("form")!).get("clinic")).toBe("central");
    expect(container.querySelector("form")!.checkValidity()).toBe(true);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("skips disabled options during keyboard selection", async () => {
    const change = vi.fn();
    render(<Select label="Location" value="a" options={[{ value: "a", label: "A" }, { value: "b", label: "B", disabled: true }, { value: "c", label: "C" }]} onChange={change} />);
    const trigger = screen.getByRole("combobox", { name: "Location" });
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    await screen.findByRole("listbox");
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    fireEvent.keyDown(trigger, { key: "Enter" });
    expect(change).toHaveBeenCalledWith({ target: { name: undefined, value: "c" } });
  });

  it("handles window resize and scroll events while a selector is open", async () => {
    render(<Select label="Clinic selector" options={[{ value: "central", label: "Central" }]} />);
    fireEvent.click(screen.getByRole("combobox", { name: "Clinic selector" }));
    await screen.findByRole("listbox");
    fireEvent.resize(window);
    fireEvent.scroll(window);
    expect(screen.getByRole("combobox", { name: "Clinic selector" })).toHaveAttribute("aria-expanded", "true");
  });

  it("moves actual menu focus and restores it to the trigger", async () => {
    const action = vi.fn();
    render(<Dropdown trigger={<button>Actions</button>} items={[{ label: "First", onClick: action }, { label: "Disabled", disabled: true }, { label: "Last" }]} />);
    const trigger = screen.getByRole("button", { name: "Actions" });
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    await waitFor(() => expect(screen.getByRole("menuitem", { name: "First" })).toHaveFocus());
    fireEvent.keyDown(document.activeElement!, { key: "ArrowDown" });
    await waitFor(() => expect(screen.getByRole("menuitem", { name: "Last" })).toHaveFocus());
    fireEvent.keyDown(document.activeElement!, { key: "Home" });
    await waitFor(() => expect(screen.getByRole("menuitem", { name: "First" })).toHaveFocus());
    fireEvent.keyDown(document.activeElement!, { key: "Enter" });
    expect(action).toHaveBeenCalledTimes(1);
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("only closes the top dialog and restores nested focus", async () => {
    function Nested() {
      const [open, setOpen] = useState(false);
      const [child, setChild] = useState(false);
      return <><button onClick={() => setOpen(true)}>Open parent</button><Modal open={open} title="Parent" onClose={() => setOpen(false)}><button onClick={() => setChild(true)}>Open child</button><Modal open={child} title="Child" onClose={() => setChild(false)}>Details</Modal></Modal></>;
    }
    render(<Nested />);
    const trigger = screen.getByRole("button", { name: "Open parent" });
    trigger.focus(); fireEvent.click(trigger);
    const parent = await screen.findByRole("dialog", { name: "Parent" });
    const childTrigger = within(parent).getByRole("button", { name: "Open child" });
    childTrigger.focus(); fireEvent.click(childTrigger);
    const child = await screen.findByRole("dialog", { name: "Child" });
    expect(parent.getAttribute("aria-labelledby")).not.toBe(child.getAttribute("aria-labelledby"));
    fireEvent.keyDown(child, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Child" })).not.toBeInTheDocument());
    expect(parent).toBeInTheDocument(); expect(childTrigger).toHaveFocus();
    fireEvent.keyDown(parent, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Parent" })).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

  it("lets a portaled selector consume Escape before its parent dialog", async () => {
    const close = vi.fn();
    render(<Modal open title="Booking" onClose={close}><Select label="Doctor" options={[{ value: "one", label: "Doctor One" }]} /></Modal>);
    const trigger = await screen.findByRole("combobox", { name: "Doctor" });
    fireEvent.click(trigger); await screen.findByRole("listbox");
    fireEvent.keyDown(trigger, { key: "Escape" });
    expect(close).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
    fireEvent.keyDown(trigger, { key: "Escape" });
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("does not dismiss a dialog during a critical submission", async () => {
    const close = vi.fn();
    render(<Modal open title="Saving" loading onClose={close}>Form</Modal>);
    fireEvent.keyDown(await screen.findByRole("dialog", { name: "Saving" }), { key: "Escape" });
    expect(close).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Close modal" })).toBeDisabled();
  });

  it("contains focus when an outside control tries to take it", async () => {
    render(<><button>Outside</button><Modal open title="Focused dialog" onClose={vi.fn()}><button>Inside</button></Modal></>);
    const dialog = await screen.findByRole("dialog", { name: "Focused dialog" });
    screen.getByRole("button", { name: "Outside" }).focus();
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it("names date controls and restores focus after closing the calendar", async () => {
    render(<DatePicker label="Visit date" value="2026-09-27" />);
    const trigger = screen.getByRole("button", { name: "Visit date" });
    trigger.focus(); fireEvent.click(trigger);
    const popup = await screen.findByRole("dialog", { name: "Choose Visit date" });
    fireEvent.keyDown(popup, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

  it("moves tab focus, skips disabled tabs, and gives instances unique IDs", () => {
    const tabs = [{ id: "one", label: "One", content: "First" }, { id: "disabled", label: "Disabled", disabled: true }, { id: "two", label: "Two", content: "Second" }];
    render(<><Tabs tabs={tabs} /><Tabs tabs={tabs} /></>);
    const lists = screen.getAllByRole("tablist");
    const first = within(lists[0]).getByRole("tab", { name: "One" });
    expect(first.id).not.toBe(within(lists[1]).getByRole("tab", { name: "One" }).id);
    first.focus(); fireEvent.keyDown(first, { key: "ArrowRight" });
    expect(within(lists[0]).getByRole("tab", { name: "Two" })).toHaveFocus();
    expect(within(lists[0]).getByRole("tab", { name: "Two" })).toHaveAttribute("aria-selected", "true");
  });

  it("clamps pagination when a refreshed dataset loses a page", () => {
    const props = { columns: [{ key: "name", header: "Name" }], searchable: false };
    const { rerender } = render(<Table {...props} data={Array.from({ length: 25 }, (_, i) => ({ id: i, name: `Patient ${i}` }))} />);
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getByText("Showing 11 to 20 of 25")).toBeInTheDocument();
    rerender(<Table {...props} data={[{ id: 0, name: "Patient 0" }]} />);
    expect(screen.getByText("Showing 1 to 1 of 1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
  });

  it("supports selection in custom mobile cards", () => {
    const selection = vi.fn();
    render(<Table columns={[{ key: "name", header: "Name" }]} data={[{ id: "one", name: "Patient" }]} selectable onSelectionChange={selection} renderMobileCard={(row) => <article>{row.name}</article>} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Select page" }));
    expect(selection).toHaveBeenLastCalledWith([{ id: "one", name: "Patient" }]);
    expect(screen.getAllByRole("checkbox", { name: "Select row one" }).every((input) => (input as HTMLInputElement).checked)).toBe(true);
  });

  it("offers mobile column filtering, sorting, and secondary row details", async () => {
    render(<Table columns={[{ key: "name", header: "Name", filterable: true, sortable: true }, { key: "notes", header: "Notes", mobileVisible: false }]} data={[{ id: "a", name: "Alpha", notes: "Follow up" }, { id: "z", name: "Zeta", notes: "Review" }]} />);
    fireEvent.click(screen.getByRole("button", { name: "Show column filters" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Name" }), { target: { value: "Alpha" } });
    expect(screen.getByText("Showing 1 to 1 of 1")).toBeInTheDocument();
    expect(screen.getByText("More details")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("combobox", { name: "Sort table" }));
    fireEvent.click(await screen.findByRole("option", { name: "Name" }));
    expect(screen.getByRole("button", { name: "Reverse sort order" })).toBeInTheDocument();
  });

  it("distinguishes a request failure from an empty dataset and retries", () => {
    const retry = vi.fn();
    render(<Table columns={[{ key: "name", header: "Name" }]} data={[]} error="Patients could not be loaded." onRetry={retry} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Patients could not be loaded.");
    expect(screen.queryByText("No entries available at the moment.")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" })); expect(retry).toHaveBeenCalledOnce();
  });

  it("filters mobile links using the available navigation and marks the current page", () => {
    render(<MobileBottomNav user={{ role: "doctor" }} pathname="/dashboard/patients" onOpenMenu={vi.fn()} isMenuOpen={false} availableItems={[{ href: "/dashboard", label: "Overview" }, { href: "/dashboard/patients", label: "Patients" }]} />);
    expect(screen.queryByRole("link", { name: "Queue" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Patients" })).toHaveAttribute("aria-current", "page");
  });

  it("shows root console destinations on mobile", () => {
    render(<MobileBottomNav user={{ role: "root" }} pathname="/dashboard" onOpenMenu={vi.fn()} isMenuOpen={false} />);
    expect(screen.getByRole("link", { name: "Tenants" })).toHaveAttribute("href", "/dashboard/organizations");
    expect(screen.queryByRole("link", { name: "Schedule" })).not.toBeInTheDocument();
  });

  it.each([
    ["patient", "Home", "/dashboard"],
    ["doctor", "Queue", "/dashboard/queue"],
    ["receptionist", "Bookings", "/dashboard/appointments"],
    ["admin", "Schedule", "/dashboard/appointments"],
  ])("keeps the %s mobile destination available", (role, label, href) => {
    render(<MobileBottomNav user={{ role }} pathname="/dashboard" onOpenMenu={vi.fn()} isMenuOpen={false} />);
    expect(screen.getByRole("link", { name: label })).toHaveAttribute("href", href);
    expect(screen.getByRole("button", { name: "Open Full Navigation Menu" })).toBeInTheDocument();
  });

  it("bounds a wide popup at 320px and opens above when there is more space", () => {
    vi.stubGlobal("innerWidth", 320); vi.stubGlobal("innerHeight", 812);
    const rect = { left: 250, right: 294, top: 690, bottom: 734 } as DOMRect;
    const position = popoverPosition(rect, 384, 400, "right");
    expect(position.left).toBe(8); expect(position.width).toBe(304);
    expect(position.upward).toBe(true); expect(position.maxHeight).toBe(674);
  });
});
