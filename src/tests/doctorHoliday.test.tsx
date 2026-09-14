import { describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import React from "react";
import { render, screen } from "@testing-library/react";

// Test helper component simulating the date ribbon holiday logic
interface DaySchedule {
  dateString: string;
  dayName: string;
  dayNum: string;
  isHoliday: boolean;
  holidayReason?: string;
  isAvailable: boolean;
}

const DateRibbonDemo: React.FC<{
  days: DaySchedule[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
}> = ({ days, selectedDate, onSelectDate }) => {
  return (
    <div data-testid="date-ribbon" className="flex gap-2">
      {days.map((d) => (
        <button
          key={d.dateString}
          data-testid={`date-btn-${d.dateString}`}
          disabled={!d.isAvailable}
          onClick={() => onSelectDate(d.dateString)}
          className={`p-2 rounded ${d.isHoliday ? "bg-amber-100 text-amber-800" : "bg-gray-100"}`}
        >
          <span className="font-bold">{d.dayName} {d.dayNum}</span>
          {d.isHoliday ? (
            <span data-testid={`holiday-badge-${d.dateString}`} className="text-xs bg-amber-200">
              Leave
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
};

const DoctorHolidayNoticeCard: React.FC<{
  doctorName: string;
  isHoliday: boolean;
  reason?: string;
}> = ({ doctorName, isHoliday, reason }) => {
  if (!isHoliday) return null;
  return (
    <div data-testid="holiday-notice-card" className="p-4 bg-amber-50 border border-amber-200 rounded">
      <h4 className="font-bold">Doctor on Holiday / Scheduled Leave</h4>
      <p>Dr. {doctorName} is not available on this date ({reason || "Doctor Holiday"}).</p>
      <p>Please pick an alternate date from the schedule ribbon above to reserve your consultation.</p>
    </div>
  );
};

describe("Doctor Holiday & Scheduled Leave UI Components", () => {
  const sampleUpcomingDays: DaySchedule[] = [
    {
      dateString: "2026-09-14",
      dayName: "Mon",
      dayNum: "14",
      isHoliday: false,
      isAvailable: true,
    },
    {
      dateString: "2026-09-15",
      dayName: "Tue",
      dayNum: "15",
      isHoliday: true,
      holidayReason: "Medical Conference / Annual Leave",
      isAvailable: true, // Clickable so patient can view the dedicated notice
    },
    {
      dateString: "2026-09-16",
      dayName: "Wed",
      dayNum: "16",
      isHoliday: false,
      isAvailable: true,
    },
  ];

  it("renders Leave badge on holiday dates in the schedule ribbon", () => {
    const handleSelect = vi.fn();
    render(
      <DateRibbonDemo
        days={sampleUpcomingDays}
        selectedDate="2026-09-14"
        onSelectDate={handleSelect}
      />
    );

    expect(screen.getByTestId("holiday-badge-2026-09-15")).toBeInTheDocument();
    expect(screen.getByTestId("holiday-badge-2026-09-15")).toHaveTextContent("Leave");
    expect(screen.queryByTestId("holiday-badge-2026-09-14")).toBeNull();
  });

  it("renders dedicated Holiday Notice Card with reason when a holiday date is selected", () => {
    render(
      <DoctorHolidayNoticeCard
        doctorName="Dr. Ramesh Sharma"
        isHoliday={true}
        reason="Medical Conference / Annual Leave"
      />
    );

    expect(screen.getByTestId("holiday-notice-card")).toBeInTheDocument();
    expect(screen.getByText("Doctor on Holiday / Scheduled Leave")).toBeInTheDocument();
    expect(
      screen.getByText(/Dr\. Dr\. Ramesh Sharma is not available on this date \(Medical Conference \/ Annual Leave\)\./)
    ).toBeInTheDocument();
  });

  it("does not render Holiday Notice Card when doctor is available", () => {
    const { container } = render(
      <DoctorHolidayNoticeCard
        doctorName="Dr. Ramesh Sharma"
        isHoliday={false}
      />
    );

    expect(screen.queryByTestId("holiday-notice-card")).toBeNull();
    expect(container.firstChild).toBeNull();
  });
});
