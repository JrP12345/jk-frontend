"use client";

import { useEffect, useState, useMemo, useRef, startTransition } from "react";
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
import {
  AlertCircle,
  MapPin,
  Phone,
  Clock,
  ShieldCheck,
  Building2,
  Calendar,
  ExternalLink,
  Printer,
  ChevronRight,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Copy,
  Users,
  CreditCard,
  Star,
  UserCheck,
  User,
  Smartphone,
  Share2,
  Mail,
  FileText,
  CalendarOff,
  Camera,
  X,
  ChevronLeft,
} from "lucide-react";

interface Doctor {
  id: string;
  name: string;
  specialization: string;
  qualification: string;
  experience_years: number;
  fees: number;
  feeType?: "fixed" | "post_consultation" | "free";
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
  isAvailable?: boolean;
  overrideStatus?: string;
  overrideReason?: string | null;
  isOnlineBookingClosed?: boolean;
  onlineBookingClosedReason?: string | null;
  upcomingHolidays?: Array<{ date: string; reason: string; status?: string }>;
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
  logo_url?: string;
  images?: string[];
  organization?: {
    id: string;
    name: string;
    logo_url?: string;
    image_url?: string;
    images?: string[];
  } | null;
  timings: string;
  facilities?: string[];
  doctors: Doctor[];
}

interface SlotItem {
  time: string;
  available: boolean;
  isLocked?: boolean;
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
          <div className="flex justify-between items-center text-xs bg-surface-alt p-2.5 rounded-xl border border-border">
            <span className="font-semibold text-text-secondary">Mon – Sat</span>
            <span className="text-text bg-surface py-0.5 px-2.5 rounded-lg text-[11px] font-semibold border border-border">
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
        const slotsStr = slots.map((s: any) => `${format12Hour(s.start)} – ${format12Hour(s.end)}`).join(", ");
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
            daysLabel = `${daysArr[0]} – ${daysArr[daysArr.length - 1]}`;
          }
        }

        return { daysLabel, slotsStr };
      });

      return (
        <div className={`flex flex-col gap-1.5 ${compact ? "mt-2" : "mt-1"}`}>
          {groups.map((g, idx) => (
            <div
              key={idx}
              className="flex justify-between items-center text-xs bg-surface-alt p-2 rounded-xl border border-border"
            >
              <span className="font-semibold text-text-secondary">{g.daysLabel}</span>
              <span className="text-text bg-surface py-0.5 px-2 rounded-lg text-[11px] font-semibold border border-border">
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

  const getHeaderTimingSummary = (timingsStr: string | null | undefined): string => {
    if (!timingsStr) return "Mon–Sat: 9:00 AM – 5:00 PM";
    try {
      const trimmed = timingsStr.trim();
      if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
        const parts = trimmed.split(/[-–—to]/i).map((s) => s.trim()).filter(Boolean);
        if (parts.length >= 2) {
          return `Mon–Sat: ${format12Hour(parts[0])} – ${format12Hour(parts[1])}`;
        }
        return timingsStr;
      }
      const data = JSON.parse(trimmed);
      const days = Object.keys(data);
      if (days.length === 0) return "Mon–Sat: 9:00 AM – 5:00 PM";

      for (const d of ["monday", "all", "daily"]) {
        const lowerKey = days.find((k) => k.toLowerCase() === d);
        if (lowerKey && Array.isArray(data[lowerKey]) && data[lowerKey].length > 0) {
          const slot = data[lowerKey][0];
          return `Mon–Sat: ${format12Hour(slot.start)} – ${format12Hour(slot.end)}`;
        }
      }
      const firstSlots = data[days[0]];
      if (Array.isArray(firstSlots) && firstSlots.length > 0) {
        return `${format12Hour(firstSlots[0].start)} – ${format12Hour(firstSlots[firstSlots.length - 1].end)}`;
      }
      return "Mon–Sat: 9:00 AM – 5:00 PM";
    } catch {
      return "Mon–Sat: 9:00 AM – 5:00 PM";
    }
  };

  const [clinic, setClinic] = useState<ClinicDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const { user, isAuthenticated, login } = useAuthStore();
  const router = useRouter();
  const { toast } = useToast();
  const searchParams = useSearchParams();

  // Booking Modal State (2-Step Flow)
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [bookingStep, setBookingStep] = useState<1 | 2>(1);
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
  const [paymentMode, setPaymentMode] = useState<"pay_at_clinic" | "online">("pay_at_clinic");
  const slotsCache = useRef<Record<string, any>>({});
  const selectedDateRef = useRef<string>("");

  const resetBookingForm = () => {
    setBookingStep(1);
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

  // Handle deep-link / auto-open booking (from single-doctor browse card or follow-up)
  useEffect(() => {
    if (!clinic) return;

    const doctorId = searchParams.get("doctorId");
    const followUp = searchParams.get("followUp");
    const prevApptId = searchParams.get("prevAppointmentId");
    const openBooking = searchParams.get("openBooking");

    if (doctorId && (followUp === "true" || openBooking === "true")) {
      const doc = clinic.doctors.find((d) => d.id === doctorId);
      if (doc) {
        handleOpenBooking(doc);
        if (followUp === "true") {
          setBookingNotes("Follow-up appointment for clinical recommendation.");
          if (prevApptId) {
            setFollowUpForAppointmentId(prevApptId);
          }
        }
      }
    }
  }, [clinic, searchParams, isAuthenticated, user]);

  // Generate next 7 upcoming working days
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

        const holidayMatch = selectedDoctor?.upcomingHolidays?.find((h) => h.date === dateString);
        const isHoliday = !!holidayMatch;
        const holidayReason = holidayMatch ? (holidayMatch.reason || "Doctor Holiday / Leave") : null;

        list.push({
          dateString,
          label: isToday ? "Today" : isTomorrow ? "Tomorrow" : `${dayShort}, ${dateNum}`,
          dayShort,
          dateNum,
          dayName,
          isToday,
          isTomorrow,
          schedule,
          isHoliday,
          holidayReason,
        });

        if (list.length >= 6) break;
      }
    }

    return list;
  }, [selectedDoctor]);

  // Synchronous client-side slot generator for instant 0ms date switching
  const generateLocalSlotsForDate = (doc: Doctor, dateStr: string) => {
    const holidayMatch = doc.upcomingHolidays?.find((h) => h.date === dateStr);
    if (holidayMatch) {
      return {
        bookingMode: doc.bookingMode || "sequential_queue",
        nextToken: null,
        tokensToday: 0,
        slots: [],
        isWorkingDay: false,
        isHoliday: true,
        holidayReason: holidayMatch.reason || "Doctor Holiday / Leave",
      };
    }

    if (doc.bookingMode === "sequential_queue") {
      return {
        bookingMode: "sequential_queue",
        nextToken: 1,
        tokensToday: 0,
        maxDailyTokens: doc.maxDailyTokens,
        isWorkingDay: true,
      };
    }

    const daysOfWeek = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const targetDate = new Date(dateStr + "T12:00:00");
    const dayName = daysOfWeek[targetDate.getDay()];
    const schedule = parseDoctorWorkingSchedule(doc.workingHours || doc.timings, dayName);

    if (!schedule.isWorkingDay || schedule.intervals.length === 0) {
      return {
        isWorkingDay: false,
        slots: [],
        appointmentDuration: 15,
        bookingMode: "time_slot",
      };
    }

    const now = new Date();
    const isToday = dateStr === now.toISOString().split("T")[0];
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const duration = 15;
    const slots: Array<{ time: string; available: boolean }> = [];

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

    return {
      isWorkingDay: true,
      bookingMode: "time_slot",
      appointmentDuration: duration,
      slots,
    };
  };

  const loadSlotsForDate = (dateStr: string, doc: Doctor) => {
    startTransition(() => {
      setSelectedDate(dateStr);
      setSelectedTime("");
    });
    selectedDateRef.current = dateStr;

    const cacheKey = `${doc.id}_${dateStr}`;
    let slotInfo = slotsCache.current[cacheKey];
    if (!slotInfo) {
      slotInfo = generateLocalSlotsForDate(doc, dateStr);
      slotsCache.current[cacheKey] = slotInfo;
    }

    startTransition(() => {
      setDoctorSlotInfo(slotInfo);
    });

    // Quiet background fetch for server-authoritative booked slot statuses (zero UI freeze or flicker)
    if (!slotInfo._serverLoaded) {
      api.get(`/public/doctors/${doc.id}/slots?clinicId=${id}&date=${dateStr}`)
        .then((res) => {
          const serverData = res.data?.data;
          if (serverData) {
            serverData._serverLoaded = true;
            slotsCache.current[cacheKey] = serverData;
            if (selectedDateRef.current === dateStr) {
              startTransition(() => {
                setDoctorSlotInfo(serverData);
              });
            }
          }
        })
        .catch(() => {});
    }
  };

  const handleOpenBooking = async (doc: Doctor) => {
    setSelectedDoctor(doc);
    setBookingStep(1);
    setIsBookingOpen(true);
    setIsGuest(!isAuthenticated || user?.role !== "patient");
    resetBookingForm();

    const timingsStr = doc.workingHours || doc.timings;
    const daysOfWeek = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const now = new Date();
    let initialDate = now.toISOString().split("T")[0];

    // Find the first valid upcoming day (skipping holidays)
    for (let i = 0; i <= 14; i++) {
      const testDate = new Date();
      testDate.setDate(now.getDate() + i);
      const testDateStr = testDate.toISOString().split("T")[0];
      const isHoliday = doc.upcomingHolidays?.some(h => h.date === testDateStr);
      if (isHoliday) {
        continue;
      }

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
        initialDate = testDateStr;
        break;
      }
    }

    setSelectedDate(initialDate);
    selectedDateRef.current = initialDate;

    // Instant local slots for immediate 0ms interactive display
    const initialSlotInfo = slotsCache.current[`${doc.id}_${initialDate}`] || generateLocalSlotsForDate(doc, initialDate);
    slotsCache.current[`${doc.id}_${initialDate}`] = initialSlotInfo;
    setDoctorSlotInfo(initialSlotInfo);

    // Pre-populate upcoming days in cache for instant tab switching
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(now.getDate() + i);
      const dStr = d.toISOString().split("T")[0];
      const cKey = `${doc.id}_${dStr}`;
      if (!slotsCache.current[cKey]) {
        slotsCache.current[cKey] = generateLocalSlotsForDate(doc, dStr);
      }
    }

    // Silent background fetch for server confirmation
    try {
      const res = await api.get(`/public/doctors/${doc.id}/slots?clinicId=${id}&date=${initialDate}`);
      const data = res.data?.data;
      if (data) {
        data._serverLoaded = true;
        slotsCache.current[`${doc.id}_${initialDate}`] = data;
        if (selectedDateRef.current === initialDate) {
          startTransition(() => {
            setDoctorSlotInfo(data);
          });
        }
      }
    } catch {
      // Retain instant local slots
    }
  };

  // Generate slots locally or from API response
  const activeSlotsList = useMemo<SlotItem[]>(() => {
    if (!selectedDoctor || !selectedDate) return [];

    if (doctorSlotInfo && doctorSlotInfo.isWorkingDay === false) {
      return [];
    }

    if (doctorSlotInfo?.slots && Array.isArray(doctorSlotInfo.slots) && doctorSlotInfo.slots.length > 0) {
      const now = new Date();
      const isToday = selectedDate === now.toISOString().split("T")[0];
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      return doctorSlotInfo.slots
        .filter((s: any) => {
          if (!isToday) return true;
          const [h, m] = s.time.split(":").map(Number);
          return (h || 0) * 60 + (m || 0) > currentMinutes;
        })
        .map((s: any) => ({
          time: s.time,
          available: s.available ?? true,
          isLocked: s.isLocked,
        }));
    }

    const local = generateLocalSlotsForDate(selectedDoctor, selectedDate);
    if (!local.isWorkingDay || !local.slots) return [];
    return local.slots;
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
    const todayStr = new Date().toISOString().slice(0, 10);
    if (selectedDate === todayStr && selectedDoctor?.isOnlineBookingClosed) {
      toast({
        title: "Same-Day Online Booking Closed",
        description: selectedDoctor.onlineBookingClosedReason || "Queue backlog safety cutoff reached. Please book for tomorrow or register as a walk-in at clinic reception.",
        variant: "error",
      });
      return;
    }

    if (!selectedDate || (!selectedTime && doctorSlotInfo?.bookingMode !== "sequential_queue")) {
      toast({ title: "Validation Error", description: "Please select a consultation date and time slot.", variant: "error" });
      setBookingStep(1);
      return;
    }

    setBookingLoading(true);
    const timeToUse =
      selectedTime ||
      doctorSlotInfo?.dayStartTime ||
      selectedDaySchedule?.intervals?.[0]?.start ||
      "09:00";
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

      const isPostConsultation = selectedDoctor?.feeType === "post_consultation";
      const isFree = selectedDoctor?.feeType === "free";

      if (isPostConsultation) {
        // Post-consultation billing: fee decided at clinic post-consultation
        try {
          await api.post("/appointment-payments/pay-at-clinic", { appointmentId: appt._id || appt.id });
        } catch {
          // fallback
        }
      } else if (!isFree && selectedDoctor?.fees && selectedDoctor.fees > 0 && paymentMode === "online") {
        try {
          const orderRes = await api.post("/appointment-payments/create-order", { appointmentId: appt._id || appt.id });
          const orderData = orderRes.data?.data;
          toast({
            title: "Online Payment Order Created",
            description: `Order #${orderData?.razorpayOrderId || "Created"}. Fee: ₹${selectedDoctor.fees}`,
            variant: "success",
          });
        } catch {
          // Pay online order fallback
        }
      } else if (!isFree && selectedDoctor?.fees && selectedDoctor.fees > 0) {
        try {
          await api.post("/appointment-payments/pay-at-clinic", { appointmentId: appt._id || appt.id });
        } catch {
          // Pay at clinic fallback
        }
      }

      setCreatedTicket({
        appointmentId: appt._id || appt.id,
        tokenNumber: token,
        patientName: isGuest ? guestForm.name : user?.name || "Patient",
        patientPhone: isGuest ? guestForm.phone : (user as any)?.phone || "",
        appointmentTime: mergedBookingTime,
        selectedDate,
        selectedTime: timeToUse,
        doctorName: selectedDoctor?.name,
        specialization: selectedDoctor?.specialization,
        clinicName: clinic?.name,
        clinicAddress: clinic?.address && clinic.address.trim() !== "." ? clinic.address : clinic?.city,
        fees: isPostConsultation ? "Decided post-consultation" : isFree ? "Free (₹0)" : selectedDoctor?.fees,
        paymentMode: isPostConsultation ? "pay_at_clinic" : isFree ? "free" : paymentMode,
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
            .ticket { background: white; border: 1px solid #cbd5e1; border-radius: 16px; padding: 32px; width: 400px; text-align: left; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
            .header { text-align: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 16px; margin-bottom: 16px; }
            .clinic-title { font-size: 18px; font-weight: 800; color: #0f172a; margin: 0 0 4px 0; }
            .clinic-sub { font-size: 12px; color: #64748b; margin: 0; }
            .token-box { background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 12px; padding: 14px; text-align: center; margin-bottom: 20px; }
            .token-label { font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; }
            .token-num { font-size: 40px; font-weight: 900; color: #0f172a; margin: 2px 0; line-height: 1; }
            .details-row { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 8px; border-bottom: 1px solid #f8fafc; padding-bottom: 6px; }
            .label { color: #64748b; font-weight: 500; }
            .value { color: #0f172a; font-weight: 700; text-align: right; }
            .footer { text-align: center; font-size: 11px; color: #94a3b8; margin-top: 20px; padding-top: 14px; border-top: 1px solid #f1f5f9; }
          </style>
        </head>
        <body>
          <div class="ticket">
            <div class="header">
              <h1 class="clinic-title">${clinic?.name}</h1>
              <p class="clinic-sub">${clinic?.address || clinic?.city}</p>
            </div>
            <div class="token-box">
              <div class="token-label">Appointment Token</div>
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
              <span class="label">Time / Mode:</span>
              <span class="value">${doctorSlotInfo?.bookingMode === "sequential_queue" ? "Clinic Queue Token" : format12Hour(createdTicket.selectedTime)}</span>
            </div>
            <div class="details-row">
              <span class="label">Consultation Fee:</span>
              <span class="value">${typeof createdTicket.fees === "string" ? createdTicket.fees : `₹${createdTicket.fees || 0}`} (${createdTicket.paymentMode === "online" ? "Online Paid" : createdTicket.paymentMode === "free" ? "Complimentary" : "Pay at Reception"})</span>
            </div>
            <div class="footer">
              ${createdTicket.appointmentId ? `
              <p style="margin: 0 0 4px 0; font-weight: 700; color: #0f172a;">Live Appointment Tracker:</p>
              <p style="margin: 0 0 8px 0; word-break: break-all; font-family: monospace; font-size: 11px; color: #2563eb;">
                ${window.location.origin}/track/${createdTicket.appointmentId}
              </p>` : ""}
              Please arrive 10 minutes prior to your consultation time. Present this token at reception.
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
      <div className="min-h-screen bg-surface-alt font-sans text-text antialiased">
        <MarketplaceNavbar />
        {/* Navigation Breadcrumbs Skeleton */}
        <div className="bg-surface border-b border-border/40 px-4 sm:px-6 py-3 pt-20">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="h-4 w-40 bg-surface-alt rounded-lg animate-pulse" />
            <div className="h-4 w-24 bg-surface-alt rounded-lg animate-pulse" />
          </div>
        </div>

        {/* Clinic Header Banner Skeleton */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-4 sm:pt-6">
          <div className="bg-surface border border-border rounded-2xl sm:rounded-3xl overflow-hidden shadow-xs animate-pulse">
            <div className="h-36 sm:h-52 w-full bg-surface-alt" />
            <div className="p-4 sm:p-6 space-y-3">
              <div className="h-7 w-64 bg-surface-alt rounded-lg" />
              <div className="h-4 w-48 bg-surface-alt rounded-lg" />
            </div>
          </div>
        </div>

        {/* Content Skeleton */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col lg:grid lg:grid-cols-3 gap-6">
          <div className="order-1 lg:order-2 lg:col-span-2 space-y-4">
            <div className="h-6 w-40 bg-surface rounded-lg animate-pulse" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="h-64 bg-surface rounded-2xl border border-border animate-pulse p-4" />
              <div className="h-64 bg-surface rounded-2xl border border-border animate-pulse p-4" />
            </div>
          </div>
          <div className="order-2 lg:order-1 lg:col-span-1">
            <div className="h-72 bg-surface rounded-2xl border border-border animate-pulse p-4" />
          </div>
        </div>
      </div>
    );
  }

  if (!clinic) return null;

  const mapsQuery = encodeURIComponent(`${clinic.name}, ${clinic.address || clinic.city}`);
  const hasSingleDoctor = clinic.doctors.length === 1;
  const singleDoctor = hasSingleDoctor ? clinic.doctors[0] : null;

  return (
    <div className="min-h-screen bg-surface-alt pt-16 pb-24 font-sans text-text antialiased">
      <MarketplaceNavbar />

      {/* Navigation Breadcrumbs Bar */}
      <div className="bg-surface border-b border-border/40 px-4 sm:px-6 py-2.5 sm:py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-2">
          <Breadcrumbs
            items={[
              { label: "Browse Clinics", href: "/browse" },
              { label: clinic.name },
            ]}
          />
          <Link
            href="/browse"
            className="text-xs font-semibold text-text-muted hover:text-primary-600 transition-colors inline-flex items-center gap-1 shrink-0 py-1 px-2 rounded-lg hover:bg-surface-alt min-h-[36px]"
          >
            <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.75} />
            <span className="hidden xs:inline">Back to Clinics</span>
          </Link>
        </div>
      </div>

      {/* Clinic Header Showcase Banner - Clean Healthcare Design Standard */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-4 sm:pt-6">
        <div className="bg-surface border border-border rounded-2xl sm:rounded-3xl overflow-hidden shadow-xs">
          {/* Visual Cover Header */}
          <div className="h-32 xs:h-40 sm:h-56 w-full relative bg-surface-alt overflow-hidden">
            {clinic.image_url ? (
              <img src={clinic.image_url} alt={clinic.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-surface via-surface-alt to-surface-hover p-4 text-center border-b border-border/40">
                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-surface border border-border flex items-center justify-center mb-1.5 sm:mb-2.5 shadow-2xs">
                  <Building2 className="w-6 h-6 sm:w-8 sm:h-8 text-text-muted" strokeWidth={1.75} />
                </div>
                <span className="text-sm sm:text-base font-bold text-text">{clinic.name}</span>
                <span className="text-[11px] sm:text-xs text-text-muted mt-0.5">Accredited Healthcare Facility</span>
              </div>
            )}
            <div className="absolute top-3 left-3 sm:top-4 sm:left-4 flex flex-wrap gap-1.5 sm:gap-2">
              <span className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-semibold text-text bg-surface/90 backdrop-blur-md border border-border px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full shadow-xs">
                <MapPin className="w-3 h-3 text-text-muted" strokeWidth={1.75} />
                <span>{clinic.city}</span>
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-text-secondary bg-surface/90 backdrop-blur-md border border-border px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full shadow-xs">
                <ShieldCheck className="w-3.5 h-3.5 text-primary-600" strokeWidth={1.75} />
                <span>Verified Facility</span>
              </span>
            </div>

            {/* View Photos Button if images available */}
            {clinic.images && clinic.images.length > 0 && (
              <button
                type="button"
                onClick={() => setLightboxIndex(0)}
                className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-black/60 hover:bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/20 shadow-sm transition-colors cursor-pointer z-10"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>View {clinic.images.length} Photos</span>
              </button>
            )}
          </div>

          {/* Title & Clinical Contact Bar */}
          <div className="p-4 sm:p-6 border-t border-border/40 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3.5">
                {(clinic.logo_url || clinic.organization?.logo_url) && (
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-surface border-2 border-surface shadow-md overflow-hidden shrink-0 -mt-8 sm:-mt-12 z-10 relative">
                    <img
                      src={clinic.logo_url || clinic.organization?.logo_url}
                      alt={clinic.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-xl sm:text-3xl font-extrabold text-text tracking-tight truncate">{clinic.name}</h1>
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-surface-alt border border-border px-2.5 py-0.5 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                      <span>Open today</span>
                    </span>
                  </div>
                  {clinic.organization?.name && clinic.organization.name !== clinic.name && (
                    <p className="text-xs text-text-muted font-medium">
                      Branch of {clinic.organization.name}
                    </p>
                  )}
                </div>
              </div>

              {/* Quick Action Buttons Bar */}
              <div className="flex items-center gap-2 pt-1 sm:pt-0">
                <button
                  type="button"
                  onClick={() => {
                    if (typeof navigator !== "undefined" && navigator.share) {
                      navigator.share({
                        title: clinic.name,
                        text: `Check out ${clinic.name} on JK Healthcare`,
                        url: window.location.href,
                      }).catch(() => {});
                    } else if (typeof navigator !== "undefined" && navigator.clipboard) {
                      navigator.clipboard.writeText(window.location.href);
                      toast({
                        title: "Link Copied",
                        description: "Clinic profile link copied to clipboard",
                        variant: "success",
                        duration: 2500,
                      });
                    }
                  }}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-surface hover:bg-surface-hover text-text text-xs font-semibold shadow-2xs min-h-[44px] sm:min-h-[36px] cursor-pointer"
                  title="Share Clinic Profile"
                  aria-label="Share Clinic Profile"
                >
                  <Share2 className="w-3.5 h-3.5 text-text-muted" strokeWidth={1.75} />
                  <span className="hidden sm:inline">Share</span>
                </button>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${mapsQuery}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border border-border bg-surface hover:bg-surface-hover text-text text-xs font-semibold shadow-2xs min-h-[44px] sm:min-h-[36px]"
                >
                  <MapPin className="w-3.5 h-3.5 text-text-muted" strokeWidth={1.75} />
                  <span>Directions</span>
                  <ExternalLink className="w-3 h-3 text-text-muted" strokeWidth={1.75} />
                </a>
                {clinic.phone && (
                  <a
                    href={`tel:${clinic.phone.replace(/\s+/g, "")}`}
                    className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold shadow-2xs min-h-[44px] sm:min-h-[36px]"
                  >
                    <Phone className="w-3.5 h-3.5" strokeWidth={1.75} />
                    <span>Call Clinic</span>
                  </a>
                )}
              </div>
            </div>

            {/* Address & Timings Row */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-secondary">
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-text-muted shrink-0" strokeWidth={1.75} />
                <span className="truncate">{clinic.address && clinic.address.trim() !== "." ? clinic.address : clinic.city}</span>
              </div>
              <span className="hidden sm:inline text-border">•</span>
              <div className="flex items-center gap-1.5 text-text-muted">
                <Clock className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} />
                <span>{getHeaderTimingSummary(clinic.timings)}</span>
              </div>
            </div>

            {/* Facilities Tags */}
            {clinic.facilities && clinic.facilities.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {clinic.facilities.map((fac, idx) => (
                  <span key={idx} className="text-[10px] font-medium bg-surface-alt text-text-secondary px-2 py-0.5 rounded-md border border-border">
                    {fac}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Layout - Specialists First on Mobile for Rapid Access */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-24 lg:pb-12 flex flex-col lg:grid lg:grid-cols-3 gap-6">
        {/* Right Column: Specialists Practitioner Cards (Renders First on Mobile) */}
        <div className="order-1 lg:order-2 lg:col-span-2 space-y-4 sm:space-y-5">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h2 className="text-lg sm:text-xl font-bold text-text flex items-center gap-2">
                <span>Available Doctors</span>
                <Badge variant="neutral" className="text-xs font-semibold">
                  {clinic.doctors.length}
                </Badge>
              </h2>
              <p className="text-xs text-text-muted">Select a doctor to book your consultation or clinic token</p>
            </div>
          </div>

          {clinic.doctors.length === 0 ? (
            <Card className="p-8 text-center text-text-muted text-xs border-dashed rounded-2xl bg-surface">
              No specialists registered at this healthcare location currently.
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
              {clinic.doctors.map((doc) => (
                <Card
                  key={doc.id}
                  className="group hover:shadow-md hover:border-primary-500/40 transition-all duration-150 p-4 sm:p-5 rounded-2xl border border-border bg-surface flex flex-col justify-between"
                >
                  <div className="space-y-3.5">
                    {/* Header Avatar & Details */}
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-surface-alt border border-border flex items-center justify-center shrink-0 shadow-2xs overflow-hidden">
                        {doc.image_url ? (
                          <img src={doc.image_url} alt={doc.name} className="w-full h-full object-cover rounded-xl" />
                        ) : (
                          <span className="text-xs sm:text-sm font-bold text-text-muted">DR</span>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <h3 className="text-sm sm:text-base font-bold text-text group-hover:text-primary-600 transition-colors truncate">
                            Dr. {doc.name.replace(/^Dr\.?\s*/i, "")}
                          </h3>
                          <span className="text-xs font-semibold text-text-secondary flex items-center gap-1 shrink-0">
                            <Star className="w-3 h-3 text-amber-500 fill-amber-500" strokeWidth={1.75} />
                            <span>{doc.rating || 5.0}</span>
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-primary-600 dark:text-primary-400 mt-0.5 truncate">{doc.specialization}</p>
                        <p className="text-[11px] text-text-muted truncate mt-0.5">{doc.qualification || "Consulting Specialist"}</p>
                      </div>
                    </div>

                    {/* Experience & Fees Row */}
                    <div className="grid grid-cols-2 gap-2 bg-surface-alt p-2.5 rounded-xl border border-border text-xs">
                      <div>
                        <span className="text-[10px] text-text-muted block font-medium uppercase tracking-wider">Experience</span>
                        <span className="font-semibold text-text">{doc.experience_years ? `${doc.experience_years}+ Years` : "Experienced"}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-text-muted block font-medium uppercase tracking-wider">Consultation Fee</span>
                        {doc.feeType === "post_consultation" ? (
                          <span className="font-semibold text-amber-600 dark:text-amber-400">Post-Consultation</span>
                        ) : doc.feeType === "free" ? (
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">Free / ₹0</span>
                        ) : (
                          <span className="font-semibold text-emerald-700 dark:text-emerald-400">₹{doc.fees}</span>
                        )}
                      </div>
                    </div>

                    {/* Queue or Slot Mode Indicator & Status Badges */}
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-text-secondary">
                      <span className="inline-flex items-center gap-1 bg-surface-alt px-2 py-0.5 rounded-md border border-border font-medium">
                        {doc.bookingMode === "sequential_queue" ? (
                          <>
                            <Users className="w-3 h-3 text-text-muted" strokeWidth={1.75} />
                            <span>Queue Token System</span>
                          </>
                        ) : (
                          <>
                            <Clock className="w-3 h-3 text-text-muted" strokeWidth={1.75} />
                            <span>Scheduled Time Slot</span>
                          </>
                        )}
                      </span>
                      {doc.isOnlineBookingClosed && (
                        <Badge variant="warning" size="sm" className="font-semibold text-[10px]">
                          Online Closed Today
                        </Badge>
                      )}
                      {doc.isAvailable === false && (
                        <Badge variant="danger" size="sm" className="font-semibold text-[10px]">
                          Unavailable Today
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Book Button */}
                  <div className="pt-3 border-t border-border/50 mt-3.5">
                    <Button
                      variant="primary"
                      size="sm"
                      className="w-full font-bold rounded-xl shadow-xs min-h-[44px] flex items-center justify-center gap-1.5 group/btn cursor-pointer"
                      onClick={() => handleOpenBooking(doc)}
                    >
                      <span>
                        {doc.isAvailable === false
                          ? "Schedule Upcoming Date"
                          : doc.isOnlineBookingClosed
                          ? "Schedule Next Available Date"
                          : "Book Consultation"}
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 group-hover/btn:translate-x-0.5 transition-transform" strokeWidth={2} />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Left Column: About & Operating Hours */}
        <div className="order-2 lg:order-1 lg:col-span-1 space-y-6">
          <Card className="rounded-2xl border border-border bg-surface">
            <CardHeader className="pb-3 border-b border-border/40">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Building2 className="w-4 h-4 text-text-muted" strokeWidth={1.75} />
                <span>About Facility</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <p className="text-xs text-text-secondary leading-relaxed">
                {clinic.description || "A premier healthcare facility offering specialized medical services, diagnostics, and doctor consultations."}
              </p>

              <div>
                <h4 className="text-xs font-semibold text-text mb-2 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-text-muted" strokeWidth={1.75} />
                  <span>Clinic Operating Hours</span>
                </h4>
                {renderTimings(clinic.timings)}
              </div>

              {/* Direct Help & Reception Contact */}
              <div className="pt-3 border-t border-border/40 space-y-2">
                <h4 className="text-xs font-semibold text-text uppercase tracking-wider">Reception & Inquiries</h4>
                <div className="space-y-1.5 text-xs text-text-secondary">
                  {clinic.phone && (
                    <a
                      href={`tel:${clinic.phone.replace(/\s+/g, "")}`}
                      className="flex items-center gap-2 text-primary-600 hover:underline font-semibold min-h-[36px]"
                    >
                      <Phone className="w-3.5 h-3.5" strokeWidth={1.75} />
                      <span>{clinic.phone}</span>
                    </a>
                  )}
                  {clinic.email && (
                    <p className="flex items-center gap-2 text-text-muted">
                      <span>Email:</span>
                      <span>{clinic.email}</span>
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Facility Photo Gallery Showcase */}
          {clinic.images && clinic.images.length > 0 && (
            <Card className="rounded-2xl border border-border bg-surface overflow-hidden shadow-xs">
              <CardHeader className="pb-3 border-b border-border/40 flex flex-row items-center justify-between">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Camera className="w-4 h-4 text-primary-500" strokeWidth={1.75} />
                  <span>Facility Showcase</span>
                </CardTitle>
                <span className="text-xs text-text-muted font-semibold">{clinic.images.length} Photos</span>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  {clinic.images.slice(0, 6).map((img, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setLightboxIndex(idx)}
                      className="relative aspect-square rounded-xl overflow-hidden border border-border/60 group hover:opacity-90 transition-opacity cursor-pointer bg-surface-alt"
                    >
                      <img
                        src={img}
                        alt={`Facility photo ${idx + 1}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      />
                      {idx === 5 && clinic.images!.length > 6 && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white text-xs font-bold">
                          +{clinic.images!.length - 6}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full rounded-xl text-xs font-semibold cursor-pointer"
                  onClick={() => setLightboxIndex(0)}
                >
                  Browse Campus Gallery
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Sticky Mobile Bottom Booking Bar (For single-doctor clinics) */}
      {hasSingleDoctor && singleDoctor && (
        <div className="fixed bottom-0 left-0 right-0 pt-3 pl-16 pr-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-surface/95 backdrop-blur-md border-t border-border z-40 lg:hidden shadow-lg flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-text truncate">Dr. {singleDoctor.name.replace(/^Dr\.?\s*/i, "")}</p>
            <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold">₹{singleDoctor.fees} Consultation Fee</p>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => handleOpenBooking(singleDoctor)}
            className="font-bold px-5 rounded-xl shadow-xs min-h-[44px] shrink-0"
          >
            Book Now →
          </Button>
        </div>
      )}

      {/* Refined 2-Step Progressive Booking Modal */}
      <Modal
        open={isBookingOpen}
        onClose={() => setIsBookingOpen(false)}
        title={
          bookingStep === 1
            ? "Select Date & Time"
            : "Patient Details"
        }
        size="lg"
      >
        {/* Step Progress Bar */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex-1 space-y-1">
            <div className="flex items-center justify-between text-[11px] font-semibold">
              <span className={bookingStep >= 1 ? "text-primary-600 font-bold" : "text-text-muted"}>1. Date & Time</span>
              <span className={bookingStep >= 2 ? "text-primary-600 font-bold" : "text-text-muted"}>2. Patient Details</span>
            </div>
            <div className="flex items-center gap-1.5 h-1">
              <div className={`flex-1 h-full rounded-full transition-colors ${bookingStep >= 1 ? "bg-primary-600" : "bg-border"}`} />
              <div className={`flex-1 h-full rounded-full transition-colors ${bookingStep >= 2 ? "bg-primary-600" : "bg-border"}`} />
            </div>
          </div>
        </div>

        <form onSubmit={handleBookAppointment} className="space-y-3 sm:space-y-4">
          {/* STEP 1: Date & Time Slot / Queue Selection */}
          {bookingStep === 1 && (
            <div className="space-y-3">
              {/* Doctor Compact Header Bar */}
              <div className="p-2.5 bg-surface-alt rounded-xl border border-border flex items-center justify-between gap-2.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-surface border border-border flex items-center justify-center font-bold text-text-secondary text-[11px] shrink-0 overflow-hidden shadow-2xs">
                    {selectedDoctor?.image_url ? (
                      <img src={selectedDoctor.image_url} alt={selectedDoctor.name} className="w-full h-full object-cover" />
                    ) : (
                      "DR"
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-text text-xs sm:text-sm truncate">Dr. {selectedDoctor?.name.replace(/^Dr\.?\s*/i, "")}</p>
                    <p className="text-[11px] text-primary-600 dark:text-primary-400 font-semibold truncate">{selectedDoctor?.specialization}</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xs sm:text-sm font-black text-emerald-700 dark:text-emerald-400 bg-surface px-2 py-0.5 rounded-lg border border-border">
                    ₹{selectedDoctor?.fees || 0}
                  </span>
                </div>
              </div>

              {/* Online Booking Backlog Buffer Banner */}
              {selectedDate === new Date().toISOString().slice(0, 10) && selectedDoctor?.isOnlineBookingClosed && (
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-2">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" strokeWidth={1.75} />
                  <div className="space-y-0.5 text-[11px]">
                    <p className="font-bold">Same-Day Online Booking Closed</p>
                    <p className="opacity-90 leading-tight">
                      {selectedDoctor.onlineBookingClosedReason || "Queue cutoff reached for today. Please select tomorrow or an upcoming date below."}
                    </p>
                  </div>
                </div>
              )}

              {/* Date Selection Ribbon */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold uppercase tracking-wider text-text text-[11px]">
                    1. Choose Date
                  </span>
                  {selectedDaySchedule?.isWorkingDay && (
                    <span className="text-[11px] text-text-muted font-medium">
                      Shift: {selectedDaySchedule.workingHoursLabel}
                    </span>
                  )}
                </div>

                {upcomingDays.length === 0 ? (
                  <p className="text-xs text-danger-500 p-2.5 bg-danger-500/10 rounded-xl border border-danger-500/20">
                    No active schedules configured for this doctor currently.
                  </p>
                ) : (
                  <div className="flex sm:grid sm:grid-cols-6 gap-2 overflow-x-auto no-scrollbar py-0.5 touch-scroll">
                    {upcomingDays.map((d) => (
                      <button
                        key={d.dateString}
                        type="button"
                        onClick={() => {
                          if (selectedDoctor) {
                            loadSlotsForDate(d.dateString, selectedDoctor);
                          }
                        }}
                        className={`shrink-0 w-[58px] sm:w-auto py-1.5 px-1 rounded-xl border text-center transition-all duration-150 cursor-pointer min-h-[48px] flex flex-col items-center justify-center ${
                          selectedDate === d.dateString
                            ? "bg-primary-600 text-white border-primary-600 shadow-xs font-bold"
                            : "bg-surface hover:border-border hover:bg-surface-alt text-text border border-border"
                        }`}
                      >
                        <span className="text-[10px] font-semibold uppercase tracking-wider block opacity-85">{d.dayShort}</span>
                        <span className="text-xs sm:text-sm font-bold block mt-0.5">{d.dateNum}</span>
                        {d.isHoliday ? (
                          <span className={`text-[8px] font-bold px-1 rounded-full mt-0.5 ${selectedDate === d.dateString ? "bg-white/20 text-white" : "bg-amber-500/20 text-amber-600 dark:text-amber-400"}`}>
                            Holiday
                          </span>
                        ) : d.isToday ? (
                          <span className={`text-[8px] font-bold px-1 rounded-full mt-0.5 ${selectedDate === d.dateString ? "bg-white/20 text-white" : "bg-primary-500/10 text-primary-600"}`}>
                            Today
                          </span>
                        ) : d.isTomorrow ? (
                          <span className={`text-[8px] font-bold px-1 rounded-full mt-0.5 ${selectedDate === d.dateString ? "bg-white/20 text-white" : "bg-surface-alt text-text-muted"}`}>
                            Tmrw
                          </span>
                        ) : null}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Time Slots OR Queue Mode — Rock-steady container with zero flicker */}
              <div className="relative min-h-[200px] sm:min-h-[220px] flex flex-col justify-start">
                {(() => {
                  const isCurrentDateHoliday = doctorSlotInfo?.isHoliday || upcomingDays.find((d) => d.dateString === selectedDate)?.isHoliday;
                  const holidayReasonText = doctorSlotInfo?.holidayReason || upcomingDays.find((d) => d.dateString === selectedDate)?.holidayReason || "Doctor Holiday / Scheduled Leave";

                  if (isCurrentDateHoliday) {
                    const nextWorkingDay = upcomingDays.find((d) => !d.isHoliday && d.schedule?.isWorkingDay && d.dateString > selectedDate) || upcomingDays.find((d) => !d.isHoliday && d.schedule?.isWorkingDay);

                    return (
                      <div key={`holiday-${selectedDate}`} className="p-6 text-center bg-amber-500/5 rounded-2xl border border-amber-500/20 flex flex-col items-center justify-center space-y-3 min-h-[200px] animate-fade-in">
                        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
                          <CalendarOff className="w-6 h-6" />
                        </div>
                        <div className="space-y-1.5 max-w-sm">
                          <div className="flex items-center justify-center gap-1.5">
                            <Badge variant="warning" size="sm" className="font-bold uppercase tracking-wider text-[10px]">
                              Scheduled Leave
                            </Badge>
                          </div>
                          <h4 className="text-sm font-bold text-text">Doctor on Holiday / Leave</h4>
                          <p className="text-xs text-text-muted">
                            Dr. {selectedDoctor?.name} is not available on this date ({holidayReasonText}).
                          </p>
                          <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                            Please select another date from the schedule ribbon above to reserve your consultation.
                          </p>
                        </div>
                        {nextWorkingDay && (
                          <div className="pt-1">
                            <Button
                              variant="secondary"
                              size="sm"
                              type="button"
                              onClick={() => {
                                if (selectedDoctor) {
                                  loadSlotsForDate(nextWorkingDay.dateString, selectedDoctor);
                                }
                              }}
                              className="text-xs font-bold gap-1.5 shadow-xs border-amber-500/30 text-text hover:border-primary-500 cursor-pointer"
                            >
                              <span>Book Next Available: {nextWorkingDay.label || nextWorkingDay.dateString}</span>
                              <ArrowRight className="w-3.5 h-3.5 text-primary-600" />
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  }

                  if (doctorSlotInfo?.bookingMode === "sequential_queue") {
                    return (
                      <div key={`queue-${selectedDate}`} className="p-3 bg-surface-alt rounded-2xl border border-border space-y-2.5 animate-fade-in">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs sm:text-sm text-text flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-text-muted" strokeWidth={1.75} />
                        <span>Clinic Queue Token</span>
                      </span>
                      <Badge variant="neutral" className="text-[10px] font-semibold">
                        {selectedDate ? upcomingDays.find((d) => d.dateString === selectedDate)?.label || selectedDate : "Today"}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-surface p-2.5 rounded-xl border border-border text-center">
                        <span className="text-[9px] text-text-muted uppercase font-semibold block">Your Token Number</span>
                        <span className="text-xl font-black text-text">#{doctorSlotInfo.nextToken || 1}</span>
                      </div>
                      <div className="bg-surface p-2.5 rounded-xl border border-border text-center">
                        <span className="text-[9px] text-text-muted uppercase font-semibold block">Estimated Wait</span>
                        <span className="text-xl font-black text-text-secondary">
                          ~{Math.max(0, ((doctorSlotInfo.nextToken || 1) - 1) * (doctorSlotInfo.appointmentDuration || 15))} mins
                        </span>
                      </div>
                    </div>

                    <div className="p-2.5 bg-surface rounded-xl border border-border text-[11px] text-text-secondary leading-relaxed">
                      Doctor's consultation starts at <strong>{selectedDaySchedule?.startFormatted || "09:00 AM"}</strong>.
                      Please arrive 15 minutes prior to confirm your token at reception.
                    </div>
                  </div>
                );
              }

              return selectedDate ? (
                <div key={`slots-${selectedDate}`} className="space-y-1.5 pt-0.5 animate-fade-in flex-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold uppercase tracking-wider text-text text-[11px]">2. Select Time Slot</span>
                    {selectedTime && (
                      <span className="text-primary-600 font-bold text-xs">
                        Selected: {format12Hour(selectedTime)}
                      </span>
                    )}
                  </div>

                      {activeSlotsList.length === 0 ? (
                        <div className="p-4 text-center bg-surface-alt rounded-2xl border border-border text-xs text-text-muted flex items-center justify-center min-h-[160px]">
                          No available consultation slots on this date. Please pick another day above.
                        </div>
                      ) : (
                        <div className="space-y-2 bg-surface-alt p-2.5 rounded-2xl border border-border min-h-[160px] max-h-52 sm:max-h-64 overflow-y-auto touch-scroll">
                          {/* Morning Slots */}
                          {categorizedSlots.morning.length > 0 && (
                            <div className="space-y-1">
                              <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
                                Morning (Before 12:00 PM)
                              </div>
                              <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                                {categorizedSlots.morning.map((s) => {
                                  const isAvailable = s.available ?? true;
                                  const isSelected = selectedTime === s.time;
                                  return (
                                    <button
                                      key={s.time}
                                      type="button"
                                      disabled={!isAvailable}
                                      onClick={() => isAvailable && setSelectedTime(s.time)}
                                      className={`py-2 px-1 rounded-xl text-xs font-semibold text-center transition-all min-h-[40px] flex items-center justify-center ${
                                        !isAvailable
                                          ? "bg-surface-alt/60 text-text-muted/50 border border-dashed border-border/70 line-through cursor-not-allowed"
                                          : isSelected
                                          ? "bg-primary-600 text-white border-primary-600 shadow-xs font-bold cursor-pointer"
                                          : "bg-surface hover:border-border text-text border border-border cursor-pointer"
                                      }`}
                                    >
                                      {format12Hour(s.time)}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Afternoon Slots */}
                          {categorizedSlots.afternoon.length > 0 && (
                            <div className="space-y-1 pt-0.5">
                              <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
                                Afternoon (12:00 PM – 4:00 PM)
                              </div>
                              <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                                {categorizedSlots.afternoon.map((s) => {
                                  const isAvailable = s.available ?? true;
                                  const isSelected = selectedTime === s.time;
                                  return (
                                    <button
                                      key={s.time}
                                      type="button"
                                      disabled={!isAvailable}
                                      onClick={() => isAvailable && setSelectedTime(s.time)}
                                      className={`py-2 px-1 rounded-xl text-xs font-semibold text-center transition-all min-h-[40px] flex items-center justify-center ${
                                        !isAvailable
                                          ? "bg-surface-alt/60 text-text-muted/50 border border-dashed border-border/70 line-through cursor-not-allowed"
                                          : isSelected
                                          ? "bg-primary-600 text-white border-primary-600 shadow-xs font-bold cursor-pointer"
                                          : "bg-surface hover:border-border text-text border border-border cursor-pointer"
                                      }`}
                                    >
                                      {format12Hour(s.time)}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Evening Slots */}
                          {categorizedSlots.evening.length > 0 && (
                            <div className="space-y-1 pt-0.5">
                              <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
                                Evening (After 4:00 PM)
                              </div>
                              <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                                {categorizedSlots.evening.map((s) => {
                                  const isAvailable = s.available ?? true;
                                  const isSelected = selectedTime === s.time;
                                  return (
                                    <button
                                      key={s.time}
                                      type="button"
                                      disabled={!isAvailable}
                                      onClick={() => isAvailable && setSelectedTime(s.time)}
                                      className={`py-2 px-1 rounded-xl text-xs font-semibold text-center transition-all min-h-[40px] flex items-center justify-center ${
                                        !isAvailable
                                          ? "bg-surface-alt/60 text-text-muted/50 border border-dashed border-border/70 line-through cursor-not-allowed"
                                          : isSelected
                                          ? "bg-primary-600 text-white border-primary-600 shadow-xs font-bold cursor-pointer"
                                          : "bg-surface hover:border-border text-text border border-border cursor-pointer"
                                      }`}
                                    >
                                      {format12Hour(s.time)}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : null;
                })()}
              </div>

              {/* Step 1 Actions Footer */}
              <div className="sticky bottom-0 -mx-4 -mb-3 sm:-mx-5 sm:-mb-5 px-4 sm:px-5 py-2.5 bg-surface/95 backdrop-blur-md border-t border-border/50 flex items-center justify-between gap-2 z-10">
                <Button variant="ghost" size="sm" onClick={() => setIsBookingOpen(false)} className="text-xs font-semibold text-text-muted min-h-[42px] px-3">
                  Cancel
                </Button>
                {(() => {
                  const isCurrentDateHoliday = doctorSlotInfo?.isHoliday || upcomingDays.find((d) => d.dateString === selectedDate)?.isHoliday;
                  return (
                    <Button
                      variant="primary"
                      size="sm"
                      type="button"
                      disabled={isCurrentDateHoliday || !selectedDate || (!selectedTime && doctorSlotInfo?.bookingMode !== "sequential_queue")}
                      onClick={() => setBookingStep(2)}
                      className="font-bold px-4 py-2 rounded-xl shadow-xs min-h-[42px] flex-1 sm:flex-initial flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span>{isCurrentDateHoliday ? "Doctor on Holiday" : "Continue to Details"}</span>
                      {!isCurrentDateHoliday && <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />}
                    </Button>
                  );
                })()}
              </div>
            </div>
          )}

          {/* STEP 2: Patient Info & Confirmation */}
          {bookingStep === 2 && (
            <div className="space-y-4">
              {/* Selected Slot Summary Bar */}
              <div className="p-3 bg-surface-alt rounded-2xl border border-border flex items-center justify-between gap-3 text-xs">
                <div className="space-y-0.5 min-w-0">
                  <span className="text-[10px] uppercase font-bold text-text-muted tracking-wider block">Selected Consultation</span>
                  <p className="font-bold text-text truncate">
                    {upcomingDays.find((d) => d.dateString === selectedDate)?.label || selectedDate} •{" "}
                    {doctorSlotInfo?.bookingMode === "sequential_queue" ? "Clinic Queue Token" : format12Hour(selectedTime)}
                  </p>
                  <p className="text-[11px] text-primary-600 truncate">
                    Dr. {selectedDoctor?.name.replace(/^Dr\.?\s*/i, "")} •{" "}
                    {selectedDoctor?.feeType === "post_consultation"
                      ? "Fee decided post-consultation"
                      : selectedDoctor?.feeType === "free"
                      ? "Free consultation"
                      : `₹${selectedDoctor?.fees || 0} consultation fee`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setBookingStep(1)}
                  className="shrink-0 text-xs font-semibold text-primary-600 hover:text-primary-700 bg-surface px-2.5 py-1.5 rounded-xl border border-border shadow-xs cursor-pointer min-h-[36px]"
                >
                  Change Slot
                </button>
              </div>

              {/* Patient Details Input */}
              <div className="space-y-2.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-text block">
                  Patient Information
                </label>

                {isGuest ? (
                  <div className="bg-surface-alt p-4 rounded-2xl border border-border space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-text">
                        Quick Booking
                      </p>
                      <span className="text-[10px] font-semibold text-text-secondary bg-surface px-2 py-0.5 rounded-full border border-border">
                        No Account Needed
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Input
                        label="Patient Full Name *"
                        placeholder="e.g. Ramesh Patel"
                        icon={<User className="w-3.5 h-3.5" strokeWidth={1.75} />}
                        value={guestForm.name}
                        onChange={(e) => setGuestForm({ ...guestForm, name: e.target.value })}
                        required
                        autoComplete="name"
                      />
                      <Input
                        label="Mobile Phone Number *"
                        type="tel"
                        inputMode="tel"
                        placeholder="9876543210"
                        icon={<Smartphone className="w-3.5 h-3.5" strokeWidth={1.75} />}
                        prefix="+91"
                        value={guestForm.phone}
                        onChange={(e) => setGuestForm({ ...guestForm, phone: e.target.value })}
                        required
                        autoComplete="tel"
                      />
                    </div>
                    <div>
                      <Input
                        label="Email Address (Optional)"
                        type="email"
                        inputMode="email"
                        placeholder="patient@example.com"
                        icon={<Mail className="w-3.5 h-3.5" strokeWidth={1.75} />}
                        value={guestForm.email}
                        onChange={(e) => setGuestForm({ ...guestForm, email: e.target.value })}
                        autoComplete="email"
                      />
                      <p className="text-[11px] text-text-muted mt-1">We'll send your visit confirmation and appointment details here.</p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-surface-alt border border-border p-3.5 rounded-2xl flex items-center justify-between">
                    <div>
                      <p className="text-xs text-text font-semibold flex items-center gap-1.5">
                        <UserCheck className="w-4 h-4 text-primary-600" strokeWidth={1.75} />
                        <span>Booking as: <strong className="text-text">{user?.name}</strong></span>
                      </p>
                      <p className="text-[11px] text-text-secondary mt-0.5">
                        {(user as any)?.phone || user?.email || "Authenticated Account"}
                      </p>
                    </div>
                    <Badge variant="neutral" className="text-[10px] font-semibold">Logged In</Badge>
                  </div>
                )}
              </div>

              {/* Payment Preference */}
              {selectedDoctor?.feeType === "post_consultation" ? (
                <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl space-y-1">
                  <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-bold text-xs">
                    <Building2 className="w-4 h-4 shrink-0" strokeWidth={1.75} />
                    <span>Post-Consultation Billing</span>
                  </div>
                  <p className="text-[11px] text-text-secondary leading-relaxed">
                    No upfront payment is required today. Dr. {selectedDoctor?.name.replace(/^Dr\.?\s*/i, "")} will determine the consultation fee after your visit, which will be billed at the clinic reception.
                  </p>
                </div>
              ) : selectedDoctor?.feeType === "free" ? (
                <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl space-y-1">
                  <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-bold text-xs">
                    <span>✨ Complimentary Consultation</span>
                  </div>
                  <p className="text-[11px] text-text-secondary leading-relaxed">
                    This consultation is free of charge (₹0). No payment is required.
                  </p>
                </div>
              ) : selectedDoctor?.fees && selectedDoctor.fees > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold uppercase tracking-wider text-text block">
                      Payment Preference
                    </label>
                    <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                      Total: ₹{selectedDoctor.fees}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setPaymentMode("pay_at_clinic")}
                      className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer min-h-[56px] ${
                        paymentMode === "pay_at_clinic"
                          ? "bg-primary-600/10 border-primary-600 text-primary-600 font-bold shadow-xs ring-1 ring-primary-500/20"
                          : "bg-surface border-border text-text hover:border-border"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-text-muted shrink-0" strokeWidth={1.75} />
                        <span className="text-xs font-bold">Pay at Clinic Reception</span>
                      </div>
                      <span className="text-[10px] text-text-muted block mt-1 pl-6">Pay ₹{selectedDoctor.fees} at the desk upon arrival</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMode("online")}
                      className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer min-h-[56px] ${
                        paymentMode === "online"
                          ? "bg-primary-600/10 border-primary-600 text-primary-600 font-bold shadow-xs ring-1 ring-primary-500/20"
                          : "bg-surface border-border text-text hover:border-border"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-text-muted shrink-0" strokeWidth={1.75} />
                        <span className="text-xs font-bold">Pay Online Now</span>
                      </div>
                      <span className="text-[10px] text-text-muted block mt-1 pl-6">Pay ₹{selectedDoctor.fees} via UPI / Card</span>
                    </button>
                  </div>
                </div>
              ) : null}

              {/* Optional Reason for Visit */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-text">Reason for Visit / Symptoms (Optional)</label>
                <Input
                  placeholder="e.g. Fever, routine follow-up, pediatric checkup"
                  icon={<FileText className="w-3.5 h-3.5" strokeWidth={1.75} />}
                  value={bookingNotes}
                  onChange={(e) => setBookingNotes(e.target.value)}
                />
              </div>

              {/* Step 2 Actions Footer */}
              <div className="sticky bottom-0 -mx-4 -mb-3 sm:-mx-5 sm:-mb-5 px-4 sm:px-5 py-2.5 bg-surface/95 backdrop-blur-md border-t border-border/50 flex items-center justify-between gap-2 z-10">
                <Button variant="outline" size="sm" type="button" onClick={() => setBookingStep(1)} className="min-h-[42px] px-3.5 flex items-center justify-center gap-1 text-xs">
                  <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.75} />
                  <span>Back</span>
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  type="submit"
                  loading={bookingLoading}
                  className="font-bold px-4 py-2 rounded-xl shadow-xs min-h-[42px] flex-1 sm:flex-initial flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>Confirm Appointment</span>
                  <CheckCircle2 className="w-4 h-4" strokeWidth={2} />
                </Button>
              </div>
            </div>
          )}
        </form>
      </Modal>

      {/* Ticket Slip Confirmation Modal */}
      <Modal
        open={ticketModalOpen}
        onClose={() => setTicketModalOpen(false)}
        title="Appointment Confirmed"
        size="sm"
      >
        <div className="text-center space-y-4 py-1">
          <div className="p-5 bg-surface-alt border border-border rounded-2xl space-y-3">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-surface border border-border text-emerald-600 flex items-center justify-center shadow-xs">
              <CheckCircle2 className="w-6 h-6 text-emerald-600" strokeWidth={2} />
            </div>
            <div>
              <span className="text-3xl font-black text-text block">
                #{createdTicket?.tokenNumber}
              </span>
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mt-0.5">Appointment Token</p>
            </div>

            {createdTicket && (
              <div className="pt-3 border-t border-border text-xs text-text-secondary space-y-1.5 text-left">
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
                  <span>Time / Mode:</span>
                  <strong className="text-text">
                    {doctorSlotInfo?.bookingMode === "sequential_queue" ? "Clinic Queue Token" : format12Hour(createdTicket.selectedTime)}
                  </strong>
                </div>
                {createdTicket.fees !== undefined && (
                  <div className="flex justify-between">
                    <span>Fee:</span>
                    <strong className="text-emerald-700 dark:text-emerald-400">
                      {typeof createdTicket.fees === "string" ? createdTicket.fees : `₹${createdTicket.fees}`} ({createdTicket.paymentMode === "online" ? "Online Paid" : createdTicket.paymentMode === "free" ? "Free" : "Pay at Reception"})
                    </strong>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="p-3 bg-surface-alt rounded-xl border border-border text-xs text-left space-y-1">
            <p className="font-semibold text-text flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-text-muted" strokeWidth={1.75} />
              <span>Next Steps:</span>
            </p>
            <p className="text-text-secondary text-[11px] leading-relaxed">
              Please arrive at the clinic 10-15 minutes prior to your consultation time. Present this token at the reception desk upon arrival.
            </p>
          </div>

          {/* Live Mobile Tracker Hub */}
          {createdTicket?.appointmentId && (
            <div className="p-3.5 bg-surface-alt rounded-2xl border border-border text-left space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-text flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-primary-600" strokeWidth={1.75} />
                  <span>Live Visit Status & Tracker</span>
                </span>
                <span className="text-[10px] bg-surface text-text-secondary font-semibold px-2 py-0.5 rounded-full border border-border">
                  Zero Login Required
                </span>
              </div>
              <p className="text-[11px] text-text-muted leading-relaxed">
                Track live waiting time, see when your turn is coming, or self check-in upon arrival directly from your phone.
              </p>
              <div className="flex gap-2 pt-1">
                <Link href={`/track/${createdTicket.appointmentId}`} target="_blank" className="w-full">
                  <Button size="sm" className="w-full text-xs font-bold rounded-xl shadow-xs min-h-[44px] flex items-center justify-center gap-1">
                    <span>Open Live Tracker</span>
                    <ExternalLink className="w-3 h-3" strokeWidth={1.75} />
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 text-xs rounded-xl min-h-[44px] flex items-center justify-center gap-1 px-3"
                  onClick={() => {
                    const trackingUrl = `${window.location.origin}/track/${createdTicket.appointmentId}`;
                    navigator.clipboard.writeText(trackingUrl);
                    toast({ title: "Link Copied", description: "Mobile tracking URL copied to clipboard", variant: "success" });
                  }}
                  title="Copy Tracking Link"
                >
                  <Copy className="w-3.5 h-3.5" strokeWidth={1.75} />
                  <span className="hidden xs:inline">Copy Link</span>
                </Button>
              </div>
            </div>
          )}

          {/* Action Buttons Hub */}
          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full min-h-[44px] flex items-center justify-center gap-1.5"
                onClick={handlePrintSlip}
              >
                <Printer className="w-3.5 h-3.5" strokeWidth={1.75} />
                <span>Print Slip</span>
              </Button>
              <Button
                variant="primary"
                size="sm"
                className="w-full font-bold min-h-[44px] flex items-center justify-center gap-1.5"
                onClick={() => {
                  setTicketModalOpen(false);
                  router.push("/dashboard/appointments");
                }}
              >
                <Calendar className="w-3.5 h-3.5" strokeWidth={1.75} />
                <span>My Appointments</span>
              </Button>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs text-text-muted min-h-[40px] flex items-center justify-center"
              onClick={() => setTicketModalOpen(false)}
            >
              Done
            </Button>
          </div>
        </div>
      </Modal>

      {/* Photo Gallery Lightbox Modal */}
      {lightboxIndex !== null && clinic.images && clinic.images.length > 0 && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-4 backdrop-blur-md animate-fade-in"
          onClick={() => setLightboxIndex(null)}
        >
          <button
            type="button"
            className="absolute top-4 right-4 text-white/80 hover:text-white p-2.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors cursor-pointer z-20"
            onClick={() => setLightboxIndex(null)}
            aria-label="Close photo viewer"
          >
            <X className="w-6 h-6" />
          </button>

          <div
            className="relative max-w-4xl max-h-[80vh] w-full flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={clinic.images[lightboxIndex]}
              alt={`Facility showcase ${lightboxIndex + 1}`}
              className="max-w-full max-h-[75vh] object-contain rounded-2xl shadow-2xl border border-white/10"
            />

            {clinic.images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => setLightboxIndex((lightboxIndex - 1 + clinic.images!.length) % clinic.images!.length)}
                  className="absolute left-2 sm:-left-14 p-2.5 rounded-full bg-white/10 hover:bg-white/30 text-white transition-colors cursor-pointer"
                  aria-label="Previous photo"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                  type="button"
                  onClick={() => setLightboxIndex((lightboxIndex + 1) % clinic.images!.length)}
                  className="absolute right-2 sm:-right-14 p-2.5 rounded-full bg-white/10 hover:bg-white/30 text-white transition-colors cursor-pointer"
                  aria-label="Next photo"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </>
            )}
          </div>

          <p className="text-white/80 text-xs font-semibold mt-4">
            Photo {lightboxIndex + 1} of {clinic.images.length} — {clinic.name}
          </p>
        </div>
      )}
    </div>
  );
}
