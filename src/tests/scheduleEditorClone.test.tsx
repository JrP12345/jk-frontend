import { describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import ScheduleEditor from "../components/ui/ScheduleEditor";

describe("ScheduleEditor Clone Feature Tests", () => {
  it("renders Custom Per Day mode and displays Clone button on active days", () => {
    const initialSchedule = JSON.stringify({
      Monday: [
        { start: "09:00", end: "12:00" },
        { start: "13:30", end: "17:00" },
      ],
      Tuesday: [{ start: "09:00", end: "17:00" }],
    });

    render(<ScheduleEditor value={initialSchedule} onChange={vi.fn()} />);

    // Switch to Custom Per Day mode if not already active
    const customButton = screen.getByRole("button", { name: /custom per day/i });
    fireEvent.click(customButton);

    // Verify Clone button is present for active days
    const cloneButtons = screen.getAllByRole("button", { name: /clone/i });
    expect(cloneButtons.length).toBeGreaterThanOrEqual(1);
  });

  it("opens clone drawer when Clone is clicked and copies schedule to weekdays", () => {
    const handleChange = vi.fn();
    const initialSchedule = JSON.stringify({
      Monday: [
        { start: "09:00", end: "12:00" },
        { start: "13:30", end: "17:00" },
      ],
    });

    render(<ScheduleEditor value={initialSchedule} onChange={handleChange} />);

    // Switch to Custom Per Day mode
    fireEvent.click(screen.getByRole("button", { name: /custom per day/i }));

    // Click Clone on Monday
    const cloneButton = screen.getByRole("button", { name: /clone/i });
    fireEvent.click(cloneButton);

    // Verify quick preset buttons appear
    expect(screen.getByRole("button", { name: /mon – fri \(weekdays\)/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /all active days/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /all 7 days \(mon – sun\)/i })).toBeInTheDocument();

    // Click "Mon – Fri (Weekdays)"
    fireEvent.click(screen.getByRole("button", { name: /mon – fri \(weekdays\)/i }));

    // Verify onChange was called with all weekdays having Monday's 2 shifts
    expect(handleChange).toHaveBeenCalled();
    const lastCallArg = JSON.parse(handleChange.mock.calls[handleChange.mock.calls.length - 1][0]);

    expect(lastCallArg.Monday).toEqual([
      { start: "09:00", end: "12:00" },
      { start: "13:30", end: "17:00" },
    ]);
    expect(lastCallArg.Tuesday).toEqual([
      { start: "09:00", end: "12:00" },
      { start: "13:30", end: "17:00" },
    ]);
    expect(lastCallArg.Wednesday).toEqual([
      { start: "09:00", end: "12:00" },
      { start: "13:30", end: "17:00" },
    ]);
    expect(lastCallArg.Thursday).toEqual([
      { start: "09:00", end: "12:00" },
      { start: "13:30", end: "17:00" },
    ]);
    expect(lastCallArg.Friday).toEqual([
      { start: "09:00", end: "12:00" },
      { start: "13:30", end: "17:00" },
    ]);
  });

  it("allows selecting specific target days and applying cloned schedule", () => {
    const handleChange = vi.fn();
    const initialSchedule = JSON.stringify({
      Monday: [{ start: "10:00", end: "14:00" }],
    });

    render(<ScheduleEditor value={initialSchedule} onChange={handleChange} />);

    // Switch to Custom Per Day
    fireEvent.click(screen.getByRole("button", { name: /custom per day/i }));

    // Click Clone
    fireEvent.click(screen.getByRole("button", { name: /clone/i }));

    // Click day chip "Sat"
    const satChip = screen.getByRole("button", { name: "Sat" });
    fireEvent.click(satChip);

    // Click the Apply button
    const applyButton = screen.getByRole("button", { name: /apply to/i });
    fireEvent.click(applyButton);

    expect(handleChange).toHaveBeenCalled();
    const lastCallArg = JSON.parse(handleChange.mock.calls[handleChange.mock.calls.length - 1][0]);
    expect(lastCallArg.Saturday).toEqual([{ start: "10:00", end: "14:00" }]);
  });
});
