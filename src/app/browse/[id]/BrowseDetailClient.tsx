"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Spinner,
  Button,
  Modal,
  Input,
  useToast,
  Badge,
  Breadcrumbs,
} from "@/components/ui";
import MarketplaceNavbar from "@/components/MarketplaceNavbar";

interface Doctor {
  id: string;
  name: string;
  specialization: string;
  qualification: string;
  experience_years: number;
  fees: number;
  timings: string;
  working_days: string;
  description: string;
  image_url: string;
  rating?: number;
  reviewsCount?: number;
  languages?: string[];
  bookingMode?: string;
  maxDailyTokens?: number | null;
  workingHours?: string;
}

interface ClinicDetail {
  id: string;
  name: string;
  city: string;
  address: string;
  phone: string;
  email: string;
  description: string;
  image_url: string;
  timings: string;
  facilities?: string[];
  doctors: Doctor[];
}

// ─── Helper: Format 24-hour time to 12-hour AM/PM ─────────────────
function format12Hour(time24: string): string {
  if (!time24) return "";
  const [hStr, mStr] = time24.split(":");
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr || "0", 10);
  if (isNaN(h)) return time24;
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
}

// ─── Helper: Parse Doctor Working Schedule for any day ─────────────
interface ParsedDoctorDay {
  isWorkingDay: boolean;
  intervals: { start: string; end: string }[];
  workingHoursLabel: string;
  startFormatted: string;
  endFormatted: string;
}

function parseDoctorWorkingSchedule(timingsStr: string | null | undefined, dayName: string): ParsedDoctorDay {
  const defaultSchedule: ParsedDoctorDay = {
    isWorkingDay: dayName.toLowerCase() !== "sunday",
    intervals: [{ start: "09:00", end: "17:00" }],
    workingHoursLabel: "09:00 AM – 05:00 PM",
    startFormatted: "09:00 AM",
    endFormatted: "05:00 PM",
  };

  if (!timingsStr) return defaultSchedule;

  try {
    let parsed: any = timingsStr;
    const trimmed = typeof timingsStr === "string" ? timingsStr.trim() : "";

    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      parsed = JSON.parse(trimmed);
    } else if (typeof timingsStr === "string") {
      const parts = trimmed.split(/[-–—to]/i).map((s) => s.trim()).filter(Boolean);
      if (parts.length >= 2) {
        const start = parts[0];
        const end = parts[1];
        return {
          isWorkingDay: dayName.toLowerCase() !== "sunday",
          intervals: [{ start, end }],
          workingHoursLabel: `${format12Hour(start)} – ${format12Hour(end)}`,
          startFormatted: format12Hour(start),
          endFormatted: format12Hour(end),
        };
      }
      return defaultSchedule;
    }

    if (Array.isArray(parsed)) {
      if (parsed.length === 0) return defaultSchedule;
      const intervals = parsed.map((item: any) => ({
        start: item.start || "09:00",
        end: item.end || "17:00",
      }));
      return {
        isWorkingDay: dayName.toLowerCase() !== "sunday",
        intervals,
        workingHoursLabel: intervals.map((i) => `${format12Hour(i.start)} – ${format12Hour(i.end)}`).join(", "),
        startFormatted: format12Hour(intervals[0].start),
        endFormatted: format12Hour(intervals[intervals.length - 1].end),
      };
    }

    if (typeof parsed === "object" && parsed !== null) {
      const lowerKey = Object.keys(parsed).find((k) => k.toLowerCase() === dayName.toLowerCase());
      const dayData = lowerKey ? parsed[lowerKey] : (parsed.all || parsed.daily || null);

      if (!dayData) {
        return {
          isWorkingDay: false,
          intervals: [],
          workingHoursLabel: "Closed / Off",
          startFormatted: "09:00 AM",
          endFormatted: "05:00 PM",
        };
      }

      if (Array.isArray(dayData)) {
        if (dayData.length === 0) {
          return {
            isWorkingDay: false,
            intervals: [],
            workingHoursLabel: "Closed / Off",
            startFormatted: "09:00 AM",
            endFormatted: "05:00 PM",
          };
        }
        const intervals = dayData.map((item: any) => ({
          start: item.start || "09:00",
          end: item.end || "17:00",
        }));
        return {
          isWorkingDay: true,
          intervals,
          workingHoursLabel: intervals.map((i) => `${format12Hour(i.start)} – ${format12Hour(i.end)}`).join(", "),
          startFormatted: format12Hour(intervals[0].start),
          endFormatted: format12Hour(intervals[intervals.length - 1].end),
        };
      }

      if (typeof dayData === "object" && dayData.start && dayData.end) {
        return {
          isWorkingDay: true,
          intervals: [{ start: dayData.start, end: dayData.end }],
          workingHoursLabel: `${format12Hour(dayData.start)} – ${format12Hour(dayData.end)}`,
          startFormatted: format12Hour(dayData.start),
          endFormatted: format12Hour(dayData.end),
        };
      }
    }

    return defaultSchedule;
  } catch {
    return defaultSchedule;
  }
}

export default function BrowseDetailClient({ id }: { id: string }) {
  const renderTimings = (timingsStr: string | null | undefined, compact = false) => {
    if (!timingsStr) return <span className="text-xs text-text-secondary">Mon–Sat: 9:00 AM – 5:00 PM</span>;
    try {
      const trimmed = timingsStr.trim();
      if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
        return (
          <div className="flex justify-between items-center text-xs bg-surface-alt p-2.5 rounded-xl border border-border/50">
            <span className="font-semibold text-text-secondary">Mon – Sat</span>
            <span className="text-primary-600 dark:text-primary-400 bg-surface py-0.5 px-2.5 rounded-lg text-[11px] font-bold border border-border/40">
              {timingsStr}
            </span>
          </div>
        );
      }

      const data = JSON.parse(timingsStr);
      const days = Object.keys(data);
      if (days.length === 0) return <span className="text-xs text-text-secondary">{timingsStr}</span>;

      const grouped: Record<string, string[]> = {};
      for (const day of days) {
        const slots = data[day];
        if (!slots || slots.length === 0) continue;
        const slotsStr = slots.map((s: any) => `${format12Hour(s.start)} - ${format12Hour(s.end)}`).join(", ");
        if (!grouped[slotsStr]) grouped[slotsStr] = [];
        grouped[slotsStr].push(day.substring(0, 3));
      }

      const allDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
      const groups = Object.keys(grouped).map((slotsStr) => {
        const daysArr = grouped[slotsStr];
        let daysLabel = daysArr.join(", ");

        if (daysArr.length > 2) {
          const firstIdx = allDays.indexOf(daysArr[0]);
          let isConsecutive = true;
          for (let i = 0; i < daysArr.length; i++) {
            if (allDays.indexOf(daysArr[i]) !== firstIdx + i) isConsecutive = false;
          }
          if (isConsecutive) {
            daysLabel = `${daysArr[0]} - ${daysArr[daysArr.length - 1]}`;
          }
        }

        return { daysLabel, slotsStr };
      });

      return (
        <div className={`flex flex-col gap-1.5 ${compact ? "mt-2" : "mt-1"}`}>
          {groups.map((g, idx) => (
            <div
              key={idx}
              className="flex justify-between items-center text-xs bg-surface-alt p-2 rounded-xl border border-border/50"
            >
              <span className="font-semibold text-text-secondary">{g.daysLabel}</span>
              <span className="text-primary-600 dark:text-primary-400 bg-surface py-0.5 px-2 rounded-lg text-[11px] font-bold border border-border/40">
                {g.slotsStr}
              </span>
            </div>
          ))}
        </div>
      );
    } catch {
      return <span className="text-xs text-text-secondary">{timingsStr}</span>;
    }
  };

  const [clinic, setClinic] = useState<ClinicDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const { user, isAuthenticated, login } = useAuthStore();
  const router = useRouter();
  const { toast } = useToast();
  const searchParams = useSearchParams();

  // Booking Modal State
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [bookingLoading, setBookingLoading] = useState(false);

  // Time & Notes inputs
  const [bookingNotes, setBookingNotes] = useState("");
  const [followUpForAppointmentId, setFollowUpForAppointmentId] = useState<string | null>(null);

  // Guest Registration State (No OTP required!)
  const [isGuest, setIsGuest] = useState(false);
  const [guestForm, setGuestForm] = useState({ name: "", phone: "", email: "" });

  // Visual Slots Picker State
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");

  // Printable Ticket Modal State
  const [ticketModalOpen, setTicketModalOpen] = useState(false);
  const [createdTicket, setCreatedTicket] = useState<any>(null);

  // Slot & Booking Mode Info
  const [doctorSlotInfo, setDoctorSlotInfo] = useState<any | null>(null);
  const [fetchingDoctorSlots, setFetchingDoctorSlots] = useState(false);
  const [paymentMode, setPaymentMode] = useState<"pay_at_clinic" | "online">("pay_at_clinic");

  const resetBookingForm = () => {
    setBookingNotes("");
    setGuestForm({ name: "", phone: "", email: "" });
    setSelectedDate("");
    setSelectedTime("");
    setFollowUpForAppointmentId(null);
    setDoctorSlotInfo(null);
    setPaymentMode("pay_at_clinic");
  };

  useEffect(() => {
    const fetchClinic = async () => {
      try {
        const res = await api.get(`/public/clinics/${id}`);
        setClinic(res.data.data);
      } catch {
        toast({ title: "Error", description: "Failed to load clinic details", variant: "error", duration: 3000 });
        router.push("/browse");
      } finally {
        setLoading(false);
      }
    };
    fetchClinic();
  }, [id, router, toast]);

  useEffect(() => {
    if (!clinic) return;

    const doctorId = searchParams.get("doctorId");
    const followUp = searchParams.get("followUp");
    const prevApptId = searchParams.get("prevAppointmentId");

    if (doctorId && followUp === "true") {
      const doc = clinic.doctors.find((d) => d.id === doctorId);
      if (doc) {
        setSelectedDoctor(doc);
        setIsBookingOpen(true);
        setIsGuest(!isAuthenticated || user?.role !== "patient");
        setBookingNotes("Follow-up appointment for clinical recommendation.");
        if (prevApptId) {
          setFollowUpForAppointmentId(prevApptId);
        }
      }
    }
  }, [clinic, searchParams, isAuthenticated, user]);

  // Generate next 7 upcoming days
  const upcomingDays = useMemo(() => {
    const timingsStr = selectedDoctor?.workingHours || selectedDoctor?.timings;
    const daysOfWeek = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const list = [];
    const current = new Date();

    for (let i = 0; i <= 14; i++) {
      const testDate = new Date();
      testDate.setDate(current.getDate() + i);
      const dayIndex = testDate.getDay();
      const dayName = daysOfWeek[dayIndex];

      const schedule = parseDoctorWorkingSchedule(timingsStr, dayName);
      const isToday = i === 0;
      const isTomorrow = i === 1;

      // If today, check if shift end time has already passed
      if (isToday && schedule.intervals.length > 0) {
        const currentMinutes = current.getHours() * 60 + current.getMinutes();
        const lastInterval = schedule.intervals[schedule.intervals.length - 1];
        const [endH, endM] = lastInterval.end.split(":").map(Number);
        const endMinutes = (endH || 0) * 60 + (endM || 0);

        if (currentMinutes >= endMinutes) {
          // Today's shift is over, skip today from list
          continue;
        }
      }

      if (schedule.isWorkingDay) {
        const dateString = testDate.toISOString().split("T")[0];
        const dayShort = testDate.toLocaleDateString("en-US", { weekday: "short" });
        const dateNum = testDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });

        list.push({
          dateString,
          label: isToday ? "Today" : isTomorrow ? "Tomorrow" : `${dayShort}, ${dateNum}`,
          dayShort,
          dateNum,
          dayName,
          isToday,
          isTomorrow,
          schedule,
        });

        if (list.length >= 6) break;
      }
    }

    return list;
  }, [selectedDoctor]);

  const loadSlotsForDate = async (dateStr: string, doc: Doctor) => {
    setSelectedDate(dateStr);
    setSelectedTime("");
    try {
      setFetchingDoctorSlots(true);
      const res = await api.get(`/public/doctors/${doc.id}/slots?clinicId=${id}&date=${dateStr}`);
      const data = res.data?.data;
      if (data) {
        setDoctorSlotInfo(data);
      }
    } catch {
      // Fallback
    } finally {
      setFetchingDoctorSlots(false);
    }
  };

  const handleOpenBooking = async (doc: Doctor) => {
    setSelectedDoctor(doc);
    setIsBookingOpen(true);
    setIsGuest(!isAuthenticated || user?.role !== "patient");
    resetBookingForm();

    const timingsStr = doc.workingHours || doc.timings;
    const daysOfWeek = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const now = new Date();
    let initialDate = now.toISOString().split("T")[0];

    // Find the first valid upcoming day
    for (let i = 0; i <= 14; i++) {
      const testDate = new Date();
      testDate.setDate(now.getDate() + i);
      const dayName = daysOfWeek[testDate.getDay()];
      const schedule = parseDoctorWorkingSchedule(timingsStr, dayName);
      if (schedule.isWorkingDay) {
        if (i === 0 && schedule.intervals.length > 0) {
          const currentMinutes = now.getHours() * 60 + now.getMinutes();
          const [endH, endM] = schedule.intervals[schedule.intervals.length - 1].end.split(":").map(Number);
          if (currentMinutes >= (endH * 60 + (endM || 0))) {
            continue;
          }
        }
        initialDate = testDate.toISOString().split("T")[0];
        break;
      }
    }

    setSelectedDate(initialDate);

    if (doc.bookingMode === "sequential_queue") {
      setDoctorSlotInfo({ bookingMode: "sequential_queue", nextToken: 1, tokensToday: 0, maxDailyTokens: doc.maxDailyTokens });
    }

    try {
      setFetchingDoctorSlots(true);
      const res = await api.get(`/public/doctors/${doc.id}/slots?clinicId=${id}&date=${initialDate}`);
      const data = res.data?.data;
      if (data) {
        setDoctorSlotInfo(data);
      }
    } catch {
      // Fallback
    } finally {
      setFetchingDoctorSlots(false);
    }
  };

interface SlotItem {
  time: string;
  available: boolean;
  isLocked?: boolean;
}

  // Generate slots locally or from API response
  const activeSlotsList = useMemo<SlotItem[]>(() => {
    if (!selectedDoctor || !selectedDate) return [];

    // If API returned structured slots, use them
    if (doctorSlotInfo?.slots && Array.isArray(doctorSlotInfo.slots) && doctorSlotInfo.slots.length > 0) {
      const now = new Date();
      const isToday = selectedDate === now.toISOString().split("T")[0];
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      return doctorSlotInfo.slots
        .filter((s: any) => {
          if (!isToday) return true;
          const [h, m] = s.time.split(":").map(Number);
          return h * 60 + (m || 0) > currentMinutes;
        })
        .map((s: any) => ({
          time: s.time,
          available: s.available ?? true,
          isLocked: s.isLocked,
        }));
    }

    // Local generation fallback
    const targetDate = new Date(selectedDate);
    const daysOfWeek = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const dayName = daysOfWeek[targetDate.getDay()];
    const schedule = parseDoctorWorkingSchedule(selectedDoctor.workingHours || selectedDoctor.timings, dayName);

    if (!schedule.isWorkingDay || schedule.intervals.length === 0) return [];

    const now = new Date();
    const isToday = selectedDate === now.toISOString().split("T")[0];
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const duration = doctorSlotInfo?.appointmentDuration || 15;

    const slots: SlotItem[] = [];

    for (const interval of schedule.intervals) {
      const [startH, startM] = interval.start.split(":").map(Number);
      const [endH, endM] = interval.end.split(":").map(Number);

      let currMinutes = (startH || 0) * 60 + (startM || 0);
      const endMinutesTotal = (endH || 0) * 60 + (endM || 0);

      while (currMinutes + duration <= endMinutesTotal) {
        if (!isToday || currMinutes > currentMinutes) {
          const h = Math.floor(currMinutes / 60);
          const m = currMinutes % 60;
          const timeStr = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
          slots.push({ time: timeStr, available: true });
        }
        currMinutes += duration;
      }
    }

    return slots;
  }, [selectedDoctor, selectedDate, doctorSlotInfo]);

  // Categorize slots into Morning, Afternoon, Evening
  const categorizedSlots = useMemo<{ morning: SlotItem[]; afternoon: SlotItem[]; evening: SlotItem[] }>(() => {
    const morning: SlotItem[] = [];
    const afternoon: SlotItem[] = [];
    const evening: SlotItem[] = [];

    for (const slot of activeSlotsList) {
      const [h] = slot.time.split(":").map(Number);
      if (h < 12) {
        morning.push(slot);
      } else if (h < 16) {
        afternoon.push(slot);
      } else {
        evening.push(slot);
      }
    }

    return { morning, afternoon, evening };
  }, [activeSlotsList]);

  // Information about the doctor's working schedule on the selected date
  const selectedDaySchedule = useMemo(() => {
    if (!selectedDate || !selectedDoctor) return null;
    const targetDate = new Date(selectedDate);
    const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const dayName = daysOfWeek[targetDate.getDay()];
    return {
      dayName,
      ...parseDoctorWorkingSchedule(selectedDoctor.workingHours || selectedDoctor.timings, dayName),
    };
  }, [selectedDate, selectedDoctor]);

  const handleBookAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDate || (!selectedTime && doctorSlotInfo?.bookingMode !== "sequential_queue")) {
      toast({ title: "Validation Error", description: "Please select a consultation date and time slot.", variant: "error" });
      return;
    }

    setBookingLoading(true);
    const timeToUse = selectedTime || "09:00";
    const mergedBookingTime = `${selectedDate}T${timeToUse}`;

    try {
      // Seamless guest authentication without OTP
      if (isGuest) {
        if (!guestForm.name || !guestForm.phone) {
          toast({ title: "Validation Error", description: "Patient name and 10-digit mobile phone number are required.", variant: "error" });
          setBookingLoading(false);
          return;
        }

        const phoneDigits = guestForm.phone.replace(/\D/g, "");
        if (phoneDigits.length < 10) {
          toast({ title: "Validation Error", description: "Please enter a valid 10-digit mobile number.", variant: "error" });
          setBookingLoading(false);
          return;
        }

        const regRes = await api.post("/auth/guest-login", {
          phone: guestForm.phone,
          name: guestForm.name,
          email: guestForm.email || undefined,
        });

        login(regRes.data.data.user);
      }

      const res = await api.post("/appointments", {
        clinicId: id,
        doctorId: selectedDoctor!.id,
        appointmentTime: mergedBookingTime,
        appointmentType: "online",
        notes: bookingNotes,
        followUpForAppointmentId: followUpForAppointmentId || undefined,
      });
      const appt = res.data.data;
      const token = appt.tokenNumber;

      if (selectedDoctor?.fees && selectedDoctor.fees > 0 && paymentMode === "online") {
        try {
          const orderRes = await api.post("/appointment-payments/create-order", { appointmentId: appt._id || appt.id });
          const orderData = orderRes.data?.data;
          toast({
            title: "Online Payment Order Created 💳",
            description: `Razorpay Order #${orderData?.razorpayOrderId || "Created"}. Fee: ₹${selectedDoctor.fees}`,
            variant: "success",
          });
        } catch {
          // Pay online order fallback
        }
      } else if (selectedDoctor?.fees && selectedDoctor.fees > 0) {
        try {
          await api.post("/appointment-payments/pay-at-clinic", { appointmentId: appt._id || appt.id });
        } catch {
          // Pay at clinic fallback
        }
      }

      setCreatedTicket({
        tokenNumber: token,
        patientName: isGuest ? guestForm.name : user?.name || "Patient",
        appointmentTime: mergedBookingTime,
        selectedDate,
        selectedTime: timeToUse,
        doctorName: selectedDoctor?.name,
        specialization: selectedDoctor?.specialization,
        clinicName: clinic?.name,
        clinicAddress: clinic?.address,
        fees: selectedDoctor?.fees,
        paymentMode,
      });

      setIsBookingOpen(false);
      resetBookingForm();
      setTicketModalOpen(true);
    } catch (err: any) {
      toast({
        title: "Booking Failed",
        description: err.response?.data?.message || "An error occurred while booking.",
        variant: "error",
        duration: 4000,
      });
    } finally {
      setBookingLoading(false);
    }
  };

  const handlePrintSlip = () => {
    if (!createdTicket) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>Appointment Token Slip - #${createdTicket.tokenNumber}</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f8fafc; padding: 24px; color: #0f172a; }
            .ticket { background: white; border: 2px dashed #cbd5e1; border-radius: 20px; padding: 32px; width: 400px; text-align: left; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05); }
            .header { text-align: center; border-bottom: 2px dashed #e2e8f0; padding-bottom: 20px; margin-bottom: 20px; }
            .clinic-title { font-size: 20px; font-weight: 800; color: #0f172a; margin: 0 0 4px 0; }
            .clinic-sub { font-size: 12px; color: #64748b; margin: 0; }
            .token-box { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 14px; padding: 16px; text-align: center; margin-bottom: 20px; }
            .token-label { font-size: 11px; font-weight: 700; color: #2563eb; text-transform: uppercase; letter-spacing: 1px; }
            .token-num { font-size: 44px; font-weight: 900; color: #1d4ed8; margin: 2px 0; line-height: 1; }
            .details-row { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 10px; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px; }
            .label { color: #64748b; font-weight: 500; }
            .value { color: #0f172a; font-weight: 700; text-align: right; }
            .footer { text-align: center; font-size: 11px; color: #94a3b8; margin-top: 24px; padding-top: 16px; border-top: 1px solid #f1f5f9; }
          </style>
        </head>
        <body>
          <div class="ticket">
            <div class="header">
              <h1 class="clinic-title">${clinic?.name}</h1>
              <p class="clinic-sub">${clinic?.address || clinic?.city}</p>
            </div>
            <div class="token-box">
              <div class="token-label">OPD Queue Token</div>
              <div class="token-num">#${createdTicket.tokenNumber}</div>
            </div>
            <div class="details-row">
              <span class="label">Patient Name:</span>
              <span class="value">${createdTicket.patientName}</span>
            </div>
            <div class="details-row">
              <span class="label">Consulting Doctor:</span>
              <span class="value">Dr. ${createdTicket.doctorName} (${createdTicket.specialization || "Specialist"})</span>
            </div>
            <div class="details-row">
              <span class="label">Appointment Date:</span>
              <span class="value">${createdTicket.selectedDate}</span>
            </div>
            <div class="details-row">
              <span class="label">Time Slot:</span>
              <span class="value">${format12Hour(createdTicket.selectedTime)}</span>
            </div>
            <div class="details-row">
              <span class="label">Consultation Fee:</span>
              <span class="value">₹${createdTicket.fees || 0} (${createdTicket.paymentMode === "online" ? "Online Paid" : "Pay at Reception"})</span>
            </div>
            <div class="footer">
              Please arrive 10 minutes prior to your scheduled time. Present this token at the reception desk.
            </div>
          </div>
          <script>window.onload = () => { window.print(); window.close(); };</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex justify-center items-center bg-surface-alt">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!clinic) return null;

  return (
    <div className="min-h-screen bg-surface-alt pt-16 pb-20 font-sans text-text">
      <MarketplaceNavbar />

      {/* Navigation Breadcrumbs */}
      <div className="bg-surface border-b border-border/40 px-4 sm:px-6 py-3">
        <div className="max-w-6xl mx-auto">
          <Breadcrumbs
            items={[
              { label: "Browse Clinics", href: "/browse" },
              { label: clinic.name },
            ]}
          />
        </div>
      </div>

      {/* Clinic Header Banner */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6">
        <div className="bg-surface border border-border rounded-2xl overflow-hidden shadow-xs">
          <div className="h-56 sm:h-72 w-full relative bg-surface-alt overflow-hidden">
            {clinic.image_url ? (
              <img src={clinic.image_url} alt={clinic.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-primary-600/15 via-primary-500/5 to-blue-600/10 p-6 text-center">
                <div className="w-16 h-16 rounded-2xl bg-primary-600/10 border border-primary-500/20 flex items-center justify-center mb-3 shadow-xs">
                  <span className="text-3xl">🏥</span>
                </div>
                <span className="text-base font-bold text-text">{clinic.name}</span>
                <span className="text-xs text-text-muted mt-0.5">Accredited Healthcare Facility</span>
              </div>
            )}
            <div className="absolute top-4 left-4">
              <Badge variant="neutral" className="shadow-xs backdrop-blur-md bg-surface/90 font-bold px-3 py-1 text-xs">
                📍 {clinic.city}
              </Badge>
            </div>
          </div>

          {/* Title & Info Bar */}
          <div className="p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-t border-border/40">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-black text-text tracking-tight">{clinic.name}</h1>
                <span className="text-primary-600 text-sm font-bold" title="Verified Facility">✓</span>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-xs text-text-secondary">
                <div className="flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-text-muted shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>{clinic.address}</span>
                </div>
                <span>•</span>
                <div className="flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-text-muted shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.988-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  <span>{clinic.phone || "Direct Desk Available"}</span>
                </div>
              </div>

              {/* Facilities Badges */}
              {clinic.facilities && clinic.facilities.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-2">
                  {clinic.facilities.map((fac, idx) => (
                    <Badge key={idx} variant="primary" className="font-bold text-[10px] uppercase tracking-wider">
                      {fac}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Layout Grid */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: About & Operating Hours */}
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-bold">About Facility</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <p className="text-xs text-text-secondary leading-relaxed">
                {clinic.description || "A premier healthcare facility offering specialized medical services, diagnostics, and doctor consultations."}
              </p>

              <div>
                <h4 className="text-xs font-bold text-text mb-2 uppercase tracking-wider">Clinic Operating Hours</h4>
                {renderTimings(clinic.timings)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Specialists Practitioner Cards */}
        <div className="lg:col-span-2 space-y-5">
          <h2 className="text-xl font-bold text-text flex items-center gap-2">
            Available Specialists
            <Badge variant="neutral" className="text-xs">
              {clinic.doctors.length}
            </Badge>
          </h2>

          {clinic.doctors.length === 0 ? (
            <Card className="p-8 text-center text-text-muted text-xs border-dashed">
              No specialists registered at this location currently.
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {clinic.doctors.map((doc) => (
                <Card key={doc.id} className="group hover:shadow-lg hover:border-primary-500/40 transition-all duration-200 p-5 rounded-2xl border border-border bg-surface flex flex-col justify-between">
                  <div className="space-y-4">
                    {/* Header Avatar & Details */}
                    <div className="flex items-start gap-3.5">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-600/15 via-primary-500/10 to-blue-600/15 border border-primary-500/20 flex items-center justify-center shrink-0 shadow-2xs">
                        {doc.image_url ? (
                          <img src={doc.image_url} alt={doc.name} className="w-full h-full object-cover rounded-2xl" />
                        ) : (
                          <span className="text-2xl font-bold text-primary-600">Dr</span>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <h3 className="text-base font-bold text-text group-hover:text-primary-600 transition-colors truncate">
                            Dr. {doc.name}
                          </h3>
                          <span className="text-xs font-bold text-amber-500 shrink-0">
                            ★ {doc.rating || 5.0}
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-primary-600 dark:text-primary-400 mt-0.5">{doc.specialization}</p>
                        <p className="text-[11px] text-text-muted truncate mt-0.5">{doc.qualification}</p>
                      </div>
                    </div>

                    {/* Experience & Fees Badge Row */}
                    <div className="grid grid-cols-2 gap-2 bg-surface-alt p-2.5 rounded-xl border border-border/50 text-xs">
                      <div>
                        <span className="text-[10px] text-text-muted block">Experience</span>
                        <span className="font-bold text-text">{doc.experience_years ? `${doc.experience_years}+ Years` : "Experienced"}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-text-muted block">Consultation Fee</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">₹{doc.fees}</span>
                      </div>
                    </div>
                  </div>

                  {/* Book Button */}
                  <div className="pt-4 border-t border-border/40 mt-4">
                    <Button variant="primary" size="sm" className="w-full font-bold rounded-xl shadow-xs" onClick={() => handleOpenBooking(doc)}>
                      Book Appointment
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Refined Booking Modal */}
      <Modal
        open={isBookingOpen}
        onClose={() => setIsBookingOpen(false)}
        title={`Book Consultation — Dr. ${selectedDoctor?.name}`}
        size="lg"
      >
        <form onSubmit={handleBookAppointment} className="space-y-5 pt-1">
          {/* Doctor Info Card */}
          <div className="p-4 bg-gradient-to-r from-primary-600/10 via-primary-500/5 to-surface rounded-2xl border border-primary-500/20 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-primary-600/15 border border-primary-500/30 flex items-center justify-center font-black text-primary-600 text-lg shrink-0">
                {selectedDoctor?.image_url ? (
                  <img src={selectedDoctor.image_url} alt={selectedDoctor.name} className="w-full h-full object-cover rounded-xl" />
                ) : (
                  "Dr"
                )}
              </div>
              <div>
                <p className="font-bold text-text text-sm">Dr. {selectedDoctor?.name}</p>
                <p className="text-xs text-primary-600 dark:text-primary-400 font-semibold">{selectedDoctor?.specialization}</p>
                <p className="text-[11px] text-text-muted">{clinic.name} • {clinic.city}</p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <span className="text-[10px] uppercase font-bold text-text-muted block">Fee</span>
              <span className="text-base font-black text-emerald-600 dark:text-emerald-400">
                ₹{selectedDoctor?.fees || 0}
              </span>
            </div>
          </div>

          {/* Doctor Working Hours & Shift Start Time Banner for Selected Date */}
          {selectedDaySchedule && (
            <div className="bg-surface-alt rounded-2xl p-4 border border-border/80 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-primary-600/10 text-primary-600 flex items-center justify-center font-bold text-sm shrink-0">
                    🕒
                  </div>
                  <div>
                    <span className="text-xs font-bold text-text block">
                      Doctor's Shift ({selectedDaySchedule.dayName})
                    </span>
                    <span className="text-xs font-bold text-primary-600 dark:text-primary-400">
                      {selectedDaySchedule.isWorkingDay ? selectedDaySchedule.workingHoursLabel : "Not Available on this day"}
                    </span>
                  </div>
                </div>

                {selectedDaySchedule.isWorkingDay && (
                  <div className="flex items-center gap-2">
                    <Badge variant="primary" className="text-[11px] font-bold py-1 px-2.5">
                      Starts at {selectedDaySchedule.startFormatted}
                    </Badge>
                    <span className="text-[11px] text-text-muted font-medium">⏱️ 15 min slots</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 1: Date Selection */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold uppercase tracking-wider text-text flex items-center justify-between">
              <span>1. Select Consultation Date *</span>
              {selectedDate && (
                <span className="text-primary-600 font-semibold lowercase tracking-normal">
                  {upcomingDays.find((d) => d.dateString === selectedDate)?.label || selectedDate}
                </span>
              )}
            </label>

            {upcomingDays.length === 0 ? (
              <p className="text-xs text-danger-500 p-3 bg-danger-500/10 rounded-xl border border-danger-500/20">
                No active schedules configured for this doctor currently.
              </p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {upcomingDays.map((d) => (
                  <button
                    key={d.dateString}
                    type="button"
                    onClick={() => {
                      if (selectedDoctor) {
                        loadSlotsForDate(d.dateString, selectedDoctor);
                      }
                    }}
                    className={`p-2.5 rounded-xl border text-center transition-all duration-150 ${
                      selectedDate === d.dateString
                        ? "bg-primary-600 text-white border-primary-600 shadow-md ring-2 ring-primary-500/20 font-bold"
                        : "bg-surface hover:border-primary-500/50 hover:bg-surface-alt text-text border-border"
                    }`}
                  >
                    <span className="text-[10px] font-bold uppercase tracking-wider block opacity-75">{d.dayShort}</span>
                    <span className="text-xs font-black block mt-0.5">{d.dateNum}</span>
                    {d.isToday && (
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full inline-block mt-1 ${selectedDate === d.dateString ? "bg-white/20 text-white" : "bg-primary-500/10 text-primary-600"}`}>
                        Today
                      </span>
                    )}
                    {d.isTomorrow && (
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full inline-block mt-1 ${selectedDate === d.dateString ? "bg-white/20 text-white" : "bg-surface-alt text-text-muted"}`}>
                        Tmrw
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Step 2: Time Slots Picker OR Sequential Queue Card */}
          {fetchingDoctorSlots ? (
            <div className="py-8 text-center bg-surface-alt rounded-2xl border border-border/60">
              <Spinner size="sm" label="Loading available slots & doctor shift..." />
            </div>
          ) : doctorSlotInfo?.bookingMode === "sequential_queue" ? (
            <div className="p-4 bg-gradient-to-r from-primary-600/10 via-primary-500/5 to-surface rounded-2xl border border-primary-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-text flex items-center gap-1.5">
                  <span>🎟</span> Live OPD Token Queue
                </span>
                <Badge variant="primary" className="font-bold">
                  {selectedDate ? upcomingDays.find((d) => d.dateString === selectedDate)?.label || selectedDate : "Today"}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="bg-surface p-3 rounded-xl border border-border text-center">
                  <span className="text-[10px] text-text-muted uppercase font-semibold block">Your Queue Token</span>
                  <span className="text-2xl font-black text-primary-600">#{doctorSlotInfo.nextToken || 1}</span>
                </div>
                <div className="bg-surface p-3 rounded-xl border border-border text-center">
                  <span className="text-[10px] text-text-muted uppercase font-semibold block">Est. Wait / Turn Time</span>
                  <span className="text-2xl font-black text-amber-600 dark:text-amber-400">
                    ~{Math.max(0, ((doctorSlotInfo.nextToken || 1) - 1) * (doctorSlotInfo.appointmentDuration || 15))} mins
                  </span>
                </div>
              </div>
              {doctorSlotInfo.maxDailyTokens && (
                <p className="text-[11px] text-text-muted text-center">
                  Daily Limit: {doctorSlotInfo.maxDailyTokens} Patients Maximum
                </p>
              )}
            </div>
          ) : (
            selectedDate && (
              <div className="space-y-3 pt-1">
                <label className="text-xs font-bold uppercase tracking-wider text-text flex items-center justify-between">
                  <span>2. Select Time Slot *</span>
                  {selectedTime && (
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                      Selected: {format12Hour(selectedTime)}
                    </span>
                  )}
                </label>

                {activeSlotsList.length === 0 ? (
                  <div className="p-4 text-center bg-surface-alt rounded-2xl border border-border text-xs text-text-muted">
                    No available time slots for this date. Please choose another day above.
                  </div>
                ) : (
                  <div className="space-y-3 bg-surface-alt p-4 rounded-2xl border border-border/80 max-h-56 overflow-y-auto">
                    {/* Morning Slots */}
                    {categorizedSlots.morning.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-text-secondary">
                          <span>🌅</span> Morning ({categorizedSlots.morning.length} slots)
                        </div>
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                          {categorizedSlots.morning.map((s) => (
                            <button
                              key={s.time}
                              type="button"
                              onClick={() => setSelectedTime(s.time)}
                              className={`p-2 rounded-xl text-xs font-bold text-center transition-all ${
                                selectedTime === s.time
                                  ? "bg-primary-600 text-white border-primary-600 shadow-xs ring-2 ring-primary-500/20"
                                  : "bg-surface hover:border-primary-500/60 hover:text-primary-600 text-text border border-border"
                              }`}
                            >
                              {format12Hour(s.time)}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Afternoon Slots */}
                    {categorizedSlots.afternoon.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-text-secondary">
                          <span>☀️</span> Afternoon ({categorizedSlots.afternoon.length} slots)
                        </div>
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                          {categorizedSlots.afternoon.map((s) => (
                            <button
                              key={s.time}
                              type="button"
                              onClick={() => setSelectedTime(s.time)}
                              className={`p-2 rounded-xl text-xs font-bold text-center transition-all ${
                                selectedTime === s.time
                                  ? "bg-primary-600 text-white border-primary-600 shadow-xs ring-2 ring-primary-500/20"
                                  : "bg-surface hover:border-primary-500/60 hover:text-primary-600 text-text border border-border"
                              }`}
                            >
                              {format12Hour(s.time)}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Evening Slots */}
                    {categorizedSlots.evening.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-text-secondary">
                          <span>🌆</span> Evening ({categorizedSlots.evening.length} slots)
                        </div>
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                          {categorizedSlots.evening.map((s) => (
                            <button
                              key={s.time}
                              type="button"
                              onClick={() => setSelectedTime(s.time)}
                              className={`p-2 rounded-xl text-xs font-bold text-center transition-all ${
                                selectedTime === s.time
                                  ? "bg-primary-600 text-white border-primary-600 shadow-xs ring-2 ring-primary-500/20"
                                  : "bg-surface hover:border-primary-500/60 hover:text-primary-600 text-text border border-border"
                              }`}
                            >
                              {format12Hour(s.time)}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          )}

          {/* Step 3: Patient Information (NO OTP REQUIRED!) */}
          <div className="space-y-3 pt-1">
            <label className="text-xs font-bold uppercase tracking-wider text-text block">
              3. Patient Details *
            </label>

            {isGuest ? (
              <div className="bg-surface-alt p-4 rounded-2xl border border-border/80 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-text flex items-center gap-1.5">
                    <span>👤</span> Guest Patient Booking
                  </p>
                  <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    ⚡ Instant Booking (No OTP required)
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label="Patient Full Name *"
                    placeholder="e.g. Ramesh Lad"
                    value={guestForm.name}
                    onChange={(e) => setGuestForm({ ...guestForm, name: e.target.value })}
                    required
                  />
                  <Input
                    label="Mobile Phone Number *"
                    type="tel"
                    placeholder="e.g. 9876543210"
                    value={guestForm.phone}
                    onChange={(e) => setGuestForm({ ...guestForm, phone: e.target.value })}
                    required
                  />
                </div>
                <Input
                  label="Email Address (Optional)"
                  type="email"
                  placeholder="patient@example.com (for booking receipt)"
                  value={guestForm.email}
                  onChange={(e) => setGuestForm({ ...guestForm, email: e.target.value })}
                />
              </div>
            ) : (
              <div className="bg-primary-500/10 border border-primary-500/20 p-3.5 rounded-2xl flex items-center justify-between">
                <div>
                  <p className="text-xs text-text font-bold">
                    Booking as: <span className="text-primary-600">{user?.name}</span>
                  </p>
                  <p className="text-[11px] text-text-secondary mt-0.5">
                    {(user as any)?.phone || user?.email || "Authenticated Account"}
                  </p>
                </div>
                <Badge variant="success" className="text-[10px] font-bold">Logged In</Badge>
              </div>
            )}
          </div>

          {/* Step 4: Payment Method */}
          {selectedDoctor?.fees && selectedDoctor.fees > 0 ? (
            <div className="space-y-2.5 pt-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-text block">
                  4. Payment Preference
                </label>
                <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                  Total: ₹{selectedDoctor.fees}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setPaymentMode("pay_at_clinic")}
                  className={`p-3.5 rounded-2xl border text-left transition-all ${
                    paymentMode === "pay_at_clinic"
                      ? "bg-primary-600/10 border-primary-600 text-primary-600 font-bold shadow-xs ring-1 ring-primary-500/20"
                      : "bg-surface border-border text-text hover:border-primary-500/50"
                  }`}
                >
                  <span className="text-xs block font-bold">💵 Pay at Clinic Reception</span>
                  <span className="text-[10px] text-text-muted block mt-0.5">Pay ₹{selectedDoctor.fees} upon arrival</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMode("online")}
                  className={`p-3.5 rounded-2xl border text-left transition-all ${
                    paymentMode === "online"
                      ? "bg-primary-600/10 border-primary-600 text-primary-600 font-bold shadow-xs ring-1 ring-primary-500/20"
                      : "bg-surface border-border text-text hover:border-primary-500/50"
                  }`}
                >
                  <span className="text-xs block font-bold">💳 Pay Online Now</span>
                  <span className="text-[10px] text-text-muted block mt-0.5">Pay ₹{selectedDoctor.fees} via UPI / Card</span>
                </button>
              </div>
            </div>
          ) : null}

          {/* Reason for Visit (Optional) */}
          <div className="space-y-1.5 pt-1">
            <label className="text-xs font-medium text-text">Reason for Visit / Symptoms (Optional)</label>
            <Input
              placeholder="e.g. Fever, routine checkup, follow-up"
              value={bookingNotes}
              onChange={(e) => setBookingNotes(e.target.value)}
            />
          </div>

          {/* Summary & Confirm Actions */}
          <div className="pt-4 border-t border-border/50 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-text-secondary">
              {selectedDate && (selectedTime || doctorSlotInfo?.bookingMode === "sequential_queue") ? (
                <span>
                  📅 <strong>{selectedDate}</strong> at{" "}
                  <strong>
                    {doctorSlotInfo?.bookingMode === "sequential_queue" ? "OPD Queue" : format12Hour(selectedTime)}
                  </strong>
                </span>
              ) : (
                <span>Please select a date & slot above</span>
              )}
            </div>

            <div className="flex gap-2 w-full sm:w-auto justify-end">
              <Button variant="ghost" size="sm" onClick={() => setIsBookingOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                type="submit"
                loading={bookingLoading}
                disabled={!selectedDate || (!selectedTime && doctorSlotInfo?.bookingMode !== "sequential_queue")}
                className="font-bold px-5 rounded-xl shadow-xs"
              >
                Confirm Appointment
              </Button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Ticket Slip Confirmation Modal */}
      <Modal
        open={ticketModalOpen}
        onClose={() => setTicketModalOpen(false)}
        title="Appointment Confirmed"
        size="sm"
      >
        <div className="text-center space-y-4 py-2">
          <div className="p-5 bg-gradient-to-b from-emerald-500/15 via-emerald-500/5 to-surface border border-emerald-500/30 rounded-2xl space-y-3">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-500/20 text-emerald-600 flex items-center justify-center text-2xl">
              ✓
            </div>
            <div>
              <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400 block">
                #{createdTicket?.tokenNumber}
              </span>
              <p className="text-xs font-bold text-text uppercase tracking-wider mt-0.5">Queue Token Slip</p>
            </div>

            {createdTicket && (
              <div className="pt-3 border-t border-emerald-500/20 text-xs text-text-secondary space-y-1.5 text-left">
                <div className="flex justify-between">
                  <span>Patient:</span>
                  <strong className="text-text">{createdTicket.patientName}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Doctor:</span>
                  <strong className="text-text">Dr. {createdTicket.doctorName}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Date:</span>
                  <strong className="text-text">{createdTicket.selectedDate}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Time:</span>
                  <strong className="text-text">{format12Hour(createdTicket.selectedTime)}</strong>
                </div>
                {createdTicket.fees !== undefined && (
                  <div className="flex justify-between">
                    <span>Fee:</span>
                    <strong className="text-emerald-600 dark:text-emerald-400">
                      ₹{createdTicket.fees} ({createdTicket.paymentMode === "online" ? "Online Paid" : "Pay at Reception"})
                    </strong>
                  </div>
                )}
              </div>
            )}
          </div>

          <p className="text-xs text-text-secondary">
            Your appointment has been confirmed. Please arrive at the clinic 10 minutes prior to your consultation time.
          </p>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="w-full" onClick={() => setTicketModalOpen(false)}>
              Done
            </Button>
            <Button variant="primary" size="sm" className="w-full font-bold" onClick={handlePrintSlip}>
              Print Slip 🖨️
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
