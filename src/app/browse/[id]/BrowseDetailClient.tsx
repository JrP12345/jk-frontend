"use client";

import LoadingImage from "@/components/ui/LoadingImage";
import BrowseDetailSkeleton from "@/components/ui/BrowseDetailSkeleton";
import PrintButton from "@/components/ui/PrintButton";

import { rememberTracker } from "@/store/trackerStore";

import { appointmentPaymentLabel, appointmentBookingLabel } from "@/lib/appointmentPresentation";

import { getPrintBrandStyles, printHtml } from "@/lib/printBrand";

import { useEffect, useState, useMemo, useRef } from "react";
import type { ReactNode } from "react";
import { useOverlayFocus } from "@/hooks/useOverlayFocus";
import { useSwipeGesture } from "@/hooks/useSwipeGesture";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api";
import { vibrateFeedback } from "@/lib/haptics";
import { clinicDateKey, clinicClockMinutes, addCalendarDays, clinicLocalTimeToIso } from "@/lib/clinicTime";
import { getPublicBookingStatus, type PublicBookingStatus } from "@/lib/publicBooking";
import { useAuthStore } from "@/store/authStore";
import { Card, CardContent, CardHeader, CardTitle, Button, Modal, Input, Select, useToast, Badge, Breadcrumbs } from "@/components/ui";
import MarketplaceNavbar from "@/components/MarketplaceNavbar";
import { AlertCircle, MapPin, Phone, Clock, Building2, Calendar, ExternalLink, ChevronRight, ArrowLeft, ArrowRight, CheckCircle2, Copy, Users, CreditCard, Star, UserCheck, User, Smartphone, Share2, Mail, FileText, CalendarOff, Camera, X, ChevronLeft, MessageSquare, Search } from "lucide-react";
import { formatCurrency } from "@/lib/currency";
import { detectPatientOtpTarget } from "@/lib/patientLogin";
import { ClinicStatusBadge } from "@/components/ui/ClinicStatusBadge";

interface Doctor {
  id: string;
  name: string;
  specialization: string;
  qualification: string;
  experience_years: number;
  fees: number;
  appointmentDuration?: number;
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

export interface ClinicDetail {
  id: string;
  name: string;
  city: string;
  address: string;
  latitude?: number | null;
  longitude?: number | null;
  phone: string;
  email: string;
  description: string;
  brandColor?: string;
  image_url: string;
  logo_url?: string;
  currency?: string;
  countryCode?: string;
  timezone?: string;
  onlineBookingAvailable?: boolean;
  bookingStatus?: PublicBookingStatus;
  images?: string[];
  organization?: {
    id: string;
    name: string;
    logo_url?: string;
    image_url?: string;
    images?: string[];
    description?: string;
    currency?: string;
    phone?: string;
    email?: string;
    address?: string;
    city?: string;
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

interface FamilyMember {
  relationship?: string;
  patient?: { id?: string; _id?: string; name?: string };
}

function BookingSurface({ inline, open, onClose, title, subtitle, footer, busy, children }: {
  inline: boolean;
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  footer: ReactNode;
  busy: boolean;
  children: ReactNode;
}) {
  if (inline) return <section aria-labelledby="booking-title" className="rounded-2xl border border-border bg-surface">
    <header className="border-b border-border px-4 py-4 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-accent">Online appointments</p>
      <h2 id="booking-title" className="mt-1 text-xl font-bold text-text">{title}</h2>
      {subtitle && <p className="mt-1 text-sm text-text-secondary">{subtitle}</p>}
    </header>
    <div className="px-4 py-5 sm:px-6">{children}</div>
    <div className="sticky bottom-0 z-10 flex flex-wrap justify-end gap-2 border-t border-border bg-surface px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">{footer}</div>
  </section>;
  return <Modal open={open} onClose={onClose} title={title} size="xl" className="md:max-w-3xl!" presentation="sheet" busy={busy} footerClassName="!flex-row" footer={footer}>{children}</Modal>;
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

function doctorFeeLabel(doc: Doctor, currency: string) {
  if (doc.feeType === "free") return "Free";
  if (doc.feeType === "post_consultation") return doc.fees > 0 ? `From ${formatCurrency(doc.fees, currency)}` : "Set after consultation";
  return Number.isFinite(doc.fees) && doc.fees > 0 ? formatCurrency(doc.fees, currency) : "Ask clinic for fee";
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

export default function BrowseDetailClient({
  id,
  initialClinic = null,
  bookingDoctorId,
  bookingOnly = false,
  bookingName,
}: {
  id: string;
  initialClinic?: ClinicDetail | null;
  bookingDoctorId?: string;
  bookingOnly?: boolean;
  bookingName?: string;
}) {
  const renderTimings = (timingsStr: string | null | undefined, compact = false) => {
    const todayDayIndex = new Date().getDay();
    const dayNamesShort = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const todayShort = dayNamesShort[todayDayIndex];
    const isTodayInLabel = (label: string) => {
      if (label.includes(todayShort)) return true;
      if (label.includes("Mon – Sat") && todayDayIndex >= 1 && todayDayIndex <= 6) return true;
      if (label.includes("Mon–Sat") && todayDayIndex >= 1 && todayDayIndex <= 6) return true;
      if (label.toLowerCase().includes("daily")) return true;
      return false;
    };

    if (!timingsStr) {
      return (
        <div className="space-y-2">
          <p className="text-xs text-text-secondary">Opening hours have not been listed. Contact the clinic to confirm them.</p>
        </div>
      );
    }

    try {
      const trimmed = timingsStr.trim();
      if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
        return (
          <div className="space-y-2">
            {!compact && <ClinicStatusBadge timings={timingsStr} pill showSecondary={false} />}
            <p className="rounded-xl border border-border bg-surface-alt p-2.5 text-xs text-text-secondary">{timingsStr}</p>
          </div>
        );
      }

      const data = JSON.parse(timingsStr);
      const days = Object.keys(data);
      if (days.length === 0) {
        return (
          <div className="space-y-2">
            <span className="text-xs text-text-secondary">Opening hours have not been listed. Contact the clinic to confirm them.</span>
          </div>
        );
      }

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
          {!compact && (
            <div className="mb-1">
              <ClinicStatusBadge timings={timingsStr} pill showSecondary={false} />
            </div>
          )}
          {groups.map((g, idx) => {
            const isToday = isTodayInLabel(g.daysLabel);
            return (
              <div
                key={idx}
                className={`flex justify-between items-center text-xs p-2 rounded-xl border ${
                  isToday
                    ? "bg-success-subtle/60 dark:bg-success/20 border-success dark:border-success shadow-2xs"
                    : "bg-surface-alt border-border"
                }`}
              >
                <span className="font-semibold text-text-secondary flex items-center gap-1.5">
                  <span>{g.daysLabel}</span>
                  {isToday && (
                    <span className="text-[9px] uppercase tracking-wider bg-success-subtle dark:bg-success/60 text-success-text dark:text-success-text font-bold px-1.5 py-0.5 rounded">
                      Today
                    </span>
                  )}
                </span>
                <span className="text-text bg-surface py-0.5 px-2 rounded-lg text-[11px] font-semibold border border-border">
                  {g.slotsStr}
                </span>
              </div>
            );
          })}
        </div>
      );
    } catch {
      return (
        <div className="space-y-2">
          {!compact && <ClinicStatusBadge timings={timingsStr} pill showSecondary={false} />}
          <span className="text-xs text-text-secondary">{timingsStr}</span>
        </div>
      );
    }
  };

  const getHeaderTimingSummary = (timingsStr: string | null | undefined): string => {
    if (!timingsStr) return "Hours not listed";
    try {
      const trimmed = timingsStr.trim();
      if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
        const parts = trimmed.split(/[-–—to]/i).map((s) => s.trim()).filter(Boolean);
        if (parts.length >= 2) {
          return `Hours: ${format12Hour(parts[0])} – ${format12Hour(parts[1])}`;
        }
        return timingsStr;
      }
      const data = JSON.parse(trimmed);
      const days = Object.keys(data);
      if (days.length === 0) return "Hours not listed";

      for (const d of ["monday", "all", "daily"]) {
        const lowerKey = days.find((k) => k.toLowerCase() === d);
        if (lowerKey && Array.isArray(data[lowerKey]) && data[lowerKey].length > 0) {
          const slot = data[lowerKey][0];
          const dayLabel = d === "monday" ? "Mon" : "Daily";
          return `${dayLabel}: ${format12Hour(slot.start)} – ${format12Hour(slot.end)}`;
        }
      }
      const firstSlots = data[days[0]];
      if (Array.isArray(firstSlots) && firstSlots.length > 0) {
        return `${format12Hour(firstSlots[0].start)} – ${format12Hour(firstSlots[firstSlots.length - 1].end)}`;
      }
      return "Hours not listed";
    } catch {
      return "Hours not listed";
    }
  };

  const [clinic, setClinic] = useState<ClinicDetail | null>(initialClinic);
  const [loading, setLoading] = useState(!initialClinic);
  const [clinicError, setClinicError] = useState<"not_found" | "load_failed" | null>(null);
  const [clinicRetry, setClinicRetry] = useState(0);
  const [doctorQuery, setDoctorQuery] = useState("");
  const [clinicSpecialty, setClinicSpecialty] = useState("");
  const [showAllDoctors, setShowAllDoctors] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const galleryGesture = useSwipeGesture({ axis: "x", enabled: lightboxIndex !== null && (clinic?.images?.length || 0) > 1, onSwipe: direction => setLightboxIndex(index => index === null ? null : (index + (direction === "left" ? 1 : -1) + (clinic?.images?.length || 1)) % (clinic?.images?.length || 1)) });
  const lightboxRef = useRef<HTMLDivElement>(null);
  useOverlayFocus(lightboxIndex !== null, lightboxRef, () => setLightboxIndex(null));
  const { user, isAuthenticated, login } = useAuthStore();
  const router = useRouter();
  const { toast } = useToast();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (lightboxIndex === null || !clinic?.images?.length) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setLightboxIndex(null);
      } else if (e.key === "ArrowLeft") {
        setLightboxIndex((prev) => (prev !== null ? (prev - 1 + clinic.images!.length) % clinic.images!.length : null));
      } else if (e.key === "ArrowRight") {
        setLightboxIndex((prev) => (prev !== null ? (prev + 1) % clinic.images!.length : null));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxIndex, clinic?.images]);

  // Booking Modal State (2-Step Flow)
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [bookingStep, setBookingStep] = useState<1 | 2>(1);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingProgressMessage, setBookingProgressMessage] = useState<string>("");
  const bookingSubmitRef = useRef(false);
  const availabilityRequest = useRef<AbortController | null>(null);
  const [availabilityState, setAvailabilityState] = useState<"checking" | "ready" | "error">("checking");
  const [nextSearchState, setNextSearchState] = useState<"idle" | "checking" | "none" | "error">("idle");
  const nextSearchRequest = useRef<AbortController | null>(null);
  useEffect(() => () => availabilityRequest.current?.abort(), []);
  useEffect(() => () => nextSearchRequest.current?.abort(), []);
  const autoOpenedBookingKeyRef = useRef<string | null>(null);

  // Time & Notes inputs
  const [bookingNotes, setBookingNotes] = useState("");
  const [followUpForAppointmentId, setFollowUpForAppointmentId] = useState<string | null>(null);

  // Public booking state for visitors without an active patient session.
  const [isGuest, setIsGuest] = useState(false);
  const [guestForm, setGuestForm] = useState({ name: "", phone: "", email: "" });
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState("");

  // Visual Slots Picker State
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");

  // Printable Ticket Modal State
  const [ticketModalOpen, setTicketModalOpen] = useState(false);
  const [retryingPaymentSetup, setRetryingPaymentSetup] = useState(false);
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
    setSelectedPatientId("");
    setSelectedDate("");
    setSelectedTime("");
    setFollowUpForAppointmentId(null);
    setDoctorSlotInfo(null);
    setNextSearchState("idle");
    setPaymentMode("pay_at_clinic");
  };

  useEffect(() => {
    if (!isAuthenticated || !selectedDoctor || bookingStep !== 2) return;
    const controller = new AbortController();
    api.get("/family", { signal: controller.signal })
      .then((response) => {
        if (!controller.signal.aborted) setFamilyMembers(Array.isArray(response.data?.data) ? response.data.data : []);
      })
      .catch(() => { if (!controller.signal.aborted) setFamilyMembers([]); });
    return () => controller.abort();
  }, [isAuthenticated, selectedDoctor, bookingStep]);

  useEffect(() => {
    if (initialClinic?.id === id && clinicRetry === 0) { setClinic(initialClinic); setLoading(false); return; }
    const controller = new AbortController();
    setLoading(true); setClinicError(null);
    const fetchClinic = async () => {
      try {
        const res = await api.get(`/public/clinics/${encodeURIComponent(id)}${bookingOnly && bookingDoctorId ? `?doctorId=${encodeURIComponent(bookingDoctorId)}` : ""}`, { signal: controller.signal });
        if (!controller.signal.aborted) setClinic(res.data.data);
      } catch (error: any) {
        if (!controller.signal.aborted) setClinicError(error?.response?.status === 404 || error?.response?.status === 400 ? "not_found" : "load_failed");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void fetchClinic();
    return () => controller.abort();
  }, [id, initialClinic, clinicRetry, bookingOnly, bookingDoctorId]);

  // Handle deep-link / auto-open booking (from single-doctor browse card or follow-up)
  useEffect(() => {
    if (!clinic || clinic.id !== id) return;

    const doctorId = bookingDoctorId || searchParams.get("doctorId");
    const followUp = searchParams.get("followUp");
    const prevApptId = searchParams.get("prevAppointmentId");
    const openBooking = searchParams.get("openBooking");

    if (doctorId && (followUp === "true" || openBooking === "true" || bookingOnly)) {
      const bookingKey = `${id}:${doctorId}:${followUp}:${prevApptId || ""}`;
      if (autoOpenedBookingKeyRef.current === bookingKey) return;
      const doc = clinic.doctors.find((d) => d.id === doctorId);
      if (doc) {
        autoOpenedBookingKeyRef.current = bookingKey;
        handleOpenBooking(doc);
        if (followUp === "true") {
          setBookingNotes("Follow-up appointment for clinical recommendation.");
          if (prevApptId) {
            setFollowUpForAppointmentId(prevApptId);
          }
        }
      }
    }
  }, [clinic, searchParams, bookingDoctorId, bookingOnly]);

  // Generate next 7 upcoming working days
  const upcomingDays = useMemo(() => {
    const timingsStr = selectedDoctor?.workingHours || selectedDoctor?.timings;
    const daysOfWeek = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const list = [];
    const current = new Date();
    const clinicTimezone = clinic?.timezone || "Asia/Kolkata";
    const todayKey = clinicDateKey(current, clinicTimezone);

    for (let i = 0; i <= 14; i++) {
      const dateString = addCalendarDays(todayKey, i);
      const testDate = new Date(`${dateString}T12:00:00Z`);
      const dayIndex = testDate.getUTCDay();
      const dayName = daysOfWeek[dayIndex];

      const schedule = parseDoctorWorkingSchedule(timingsStr, dayName);
      const isToday = i === 0;
      const isTomorrow = i === 1;

      // If today, check if shift end time has already passed
      if (isToday && schedule.intervals.length > 0) {
        const currentMinutes = clinicClockMinutes(current, clinicTimezone);
        const lastInterval = schedule.intervals[schedule.intervals.length - 1];
        const [endH, endM] = lastInterval.end.split(":").map(Number);
        const endMinutes = (endH || 0) * 60 + (endM || 0);

        if (currentMinutes >= endMinutes) {
          // Today's shift is over, skip today from list
          continue;
        }
      }

      if (schedule.isWorkingDay) {
        const dayShort = testDate.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
        const dateNum = testDate.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

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
  }, [selectedDoctor, clinic?.timezone]);

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
    const targetDate = new Date(dateStr + "T12:00:00Z");
    const dayName = daysOfWeek[targetDate.getUTCDay()];
    const schedule = parseDoctorWorkingSchedule(doc.workingHours || doc.timings, dayName);

    if (!schedule.isWorkingDay || schedule.intervals.length === 0) {
      return {
        isWorkingDay: false,
        slots: [],
        appointmentDuration: doc.appointmentDuration || 15,
        bookingMode: "time_slot",
      };
    }

    const now = new Date();
    const clinicTimezone = clinic?.timezone || "Asia/Kolkata";
    const isToday = dateStr === clinicDateKey(now, clinicTimezone);
    const currentMinutes = clinicClockMinutes(now, clinicTimezone);
    const duration = doc.appointmentDuration && doc.appointmentDuration > 0 ? doc.appointmentDuration : 15;
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

  const loadSlotsForDate = async (dateStr: string, doc: Doctor) => {
    nextSearchRequest.current?.abort();
    setNextSearchState("idle");
    availabilityRequest.current?.abort();
    const request = new AbortController();
    availabilityRequest.current = request;
    setSelectedDate(dateStr);
    setSelectedTime("");
    selectedDateRef.current = dateStr;
    const cacheKey = doc.id + "_" + dateStr;
    const preview = slotsCache.current[cacheKey] || generateLocalSlotsForDate(doc, dateStr);
    setDoctorSlotInfo(preview);
    setAvailabilityState("checking");
    try {
      const res = await api.get(`/public/doctors/${doc.id}/slots?clinicId=${id}&date=${dateStr}`, { signal: request.signal });
      if (request.signal.aborted) return;
      const data = res.data?.data;
      if (!data || typeof data.isWorkingDay !== "boolean") throw new Error("Invalid availability response");
      if (!Array.isArray(data.slots) || data.slots.some((slot: SlotItem) => !slot || typeof slot.time !== "string" || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(slot.time) || typeof slot.available !== "boolean")) throw new Error("Invalid availability slots");
      data._serverLoaded = true;
      slotsCache.current[cacheKey] = data;
      setDoctorSlotInfo(data);
      setAvailabilityState("ready");
    } catch {
      if (!request.signal.aborted) setAvailabilityState("error");
    }
  };

  const findNextAvailable = async () => {
    if (!selectedDoctor || !selectedDate || nextSearchState === "checking") return;
    nextSearchRequest.current?.abort();
    const request = new AbortController();
    nextSearchRequest.current = request;
    setNextSearchState("checking");
    for (const day of upcomingDays.filter((candidate) => candidate.dateString > selectedDate && !candidate.isHoliday)) {
      try {
        const response = await api.get(`/public/doctors/${selectedDoctor.id}/slots?clinicId=${id}&date=${day.dateString}`, { signal: request.signal });
        if (request.signal.aborted) return;
        const result = response.data?.data;
        if (!result || typeof result.isWorkingDay !== "boolean" || !Array.isArray(result.slots) || result.slots.some((slot: SlotItem) => !slot || typeof slot.time !== "string" || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(slot.time) || typeof slot.available !== "boolean")) throw new Error("Invalid availability response");
        if (!result.isWorkingDay || result.isHoliday) continue;
        const queueAvailable = result.bookingMode === "sequential_queue" && (result.maxDailyTokens == null || result.tokensToday < result.maxDailyTokens);
        const nextSlot = result.bookingMode === "time_slot" ? result.slots.find((slot: SlotItem) => slot.available && !slot.isLocked) : null;
        if (!queueAvailable && !nextSlot) continue;
        result._serverLoaded = true;
        slotsCache.current[`${selectedDoctor.id}_${day.dateString}`] = result;
        selectedDateRef.current = day.dateString;
        setSelectedDate(day.dateString);
        setSelectedTime(nextSlot?.time || "");
        setDoctorSlotInfo(result);
        setAvailabilityState("ready");
        setNextSearchState("idle");
        return;
      } catch {
        if (!request.signal.aborted) setNextSearchState("error");
        return;
      }
    }
    if (!request.signal.aborted) setNextSearchState("none");
  };

  const handleOpenBooking = (doc: Doctor) => {
    if (!clinic || getPublicBookingStatus({ ...clinic, doctorCount: clinic.doctors.length }) !== "check_availability") return;
    setSelectedDoctor(doc);
    setBookingStep(1);
    setIsBookingOpen(true);
    setIsGuest(!isAuthenticated);
    resetBookingForm();

    const timingsStr = doc.workingHours || doc.timings;
    const daysOfWeek = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const now = new Date();
    const clinicTimezone = clinic?.timezone || "Asia/Kolkata";
    const todayKey = clinicDateKey(now, clinicTimezone);
    let initialDate = todayKey;

    // Find the first valid upcoming day (skipping holidays)
    for (let i = 0; i <= 14; i++) {
      const testDateStr = addCalendarDays(todayKey, i);
      const testDate = new Date(`${testDateStr}T12:00:00Z`);
      const isHoliday = doc.upcomingHolidays?.some(h => h.date === testDateStr);
      if (isHoliday) {
        continue;
      }

      const dayName = daysOfWeek[testDate.getUTCDay()];
      const schedule = parseDoctorWorkingSchedule(timingsStr, dayName);
      if (schedule.isWorkingDay) {
        if (i === 0 && schedule.intervals.length > 0) {
          const currentMinutes = clinicClockMinutes(now, clinicTimezone);
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

    // Preview the schedule while the server checks actual availability.
    const initialSlotInfo = slotsCache.current[`${doc.id}_${initialDate}`] || generateLocalSlotsForDate(doc, initialDate);
    slotsCache.current[`${doc.id}_${initialDate}`] = initialSlotInfo;
    setDoctorSlotInfo(initialSlotInfo);

    // Pre-populate upcoming days in cache for instant tab switching
    for (let i = 0; i < 7; i++) {
      const dStr = addCalendarDays(todayKey, i);
      const cKey = `${doc.id}_${dStr}`;
      if (!slotsCache.current[cKey]) {
        slotsCache.current[cKey] = generateLocalSlotsForDate(doc, dStr);
      }
    }

    void loadSlotsForDate(initialDate, doc);
  };

  // Generate slots locally or from API response
  const activeSlotsList = useMemo<SlotItem[]>(() => {
    if (!selectedDoctor || !selectedDate) return [];

    if (doctorSlotInfo && doctorSlotInfo.isWorkingDay === false) {
      return [];
    }

    if (Array.isArray(doctorSlotInfo?.slots)) {
      const now = new Date();
      const clinicTimezone = clinic?.timezone || "Asia/Kolkata";
      const isToday = selectedDate === clinicDateKey(now, clinicTimezone);
      const currentMinutes = clinicClockMinutes(now, clinicTimezone);

      return doctorSlotInfo.slots
        .filter((s: any) => {
          if (!isToday) return true;
          const [h, m] = s.time.split(":").map(Number);
          return (h || 0) * 60 + (m || 0) > currentMinutes;
        })
        .map((s: any) => ({
          time: s.time,
          available: (s.available ?? true) && !s.isLocked,
          isLocked: s.isLocked,
        }));
    }

    const local = generateLocalSlotsForDate(selectedDoctor, selectedDate);
    if (!local.isWorkingDay || !local.slots) return [];
    return local.slots;
  }, [selectedDoctor, selectedDate, doctorSlotInfo, clinic?.timezone]);

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
    const dayName = daysOfWeek[targetDate.getUTCDay()];
    return {
      dayName,
      ...parseDoctorWorkingSchedule(selectedDoctor.workingHours || selectedDoctor.timings, dayName),
    };
  }, [selectedDate, selectedDoctor]);

  const queueIsFull = availabilityState === "ready" && doctorSlotInfo?.bookingMode === "sequential_queue"
    && Number(doctorSlotInfo.maxDailyTokens) > 0
    && Number(doctorSlotInfo.tokensToday) >= Number(doctorSlotInfo.maxDailyTokens);
  const availabilityBlocked = availabilityState !== "ready" || doctorSlotInfo?.isWorkingDay === false || doctorSlotInfo?.isHoliday || queueIsFull;

  const handleBookAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (clinic?.onlineBookingAvailable === false) {
      toast({ title: "Online booking unavailable", description: "Please contact the clinic directly.", variant: "info" });
      return;
    }
    const todayStr = clinicDateKey(new Date(), clinic?.timezone || "Asia/Kolkata");
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

    if (bookingSubmitRef.current || availabilityBlocked) return;
    bookingSubmitRef.current = true;
    setBookingLoading(true);
    setBookingProgressMessage("Confirming appointment…");
    const timeToUse =
      selectedTime ||
      doctorSlotInfo?.dayStartTime ||
      selectedDaySchedule?.intervals?.[0]?.start ||
      "09:00";

    try {
      if (paymentMode === "online" && (clinic?.countryCode && clinic.countryCode !== "IN" || clinic?.currency && clinic.currency !== "INR")) {
        throw new Error("Online checkout is unavailable for this clinic. Choose payment at reception.");
      }
      const mergedBookingTime = clinicLocalTimeToIso(selectedDate, timeToUse, clinic?.timezone || "Asia/Kolkata");
      // Public booking is deliberately OTP-free. The resulting session is
      // limited to creating this appointment and cannot access patient records.
      if (isGuest) {
        if (!guestForm.name || !guestForm.phone) {
          toast({ title: "Validation Error", description: "Patient name and mobile phone number are required.", variant: "error" });
          setBookingLoading(false);
          setBookingProgressMessage("");
          return;
        }

        const guestPhoneTarget = detectPatientOtpTarget(guestForm.phone);
        if (!guestPhoneTarget?.phone || (clinic?.countryCode && clinic.countryCode !== "IN" && !guestForm.phone.trim().startsWith("+"))) {
          toast({ title: "Validation Error", description: "Enter an Indian 10-digit number or an international number with +country code.", variant: "error" });
          setBookingLoading(false);
          setBookingProgressMessage("");
          return;
        }


        await api.post("/public/booking-session", {
          phone: guestPhoneTarget.phone,
          name: guestForm.name,
          email: guestForm.email || undefined,
        });
      }


      const res = await api.post("/appointments", {
        clinicId: id,
        doctorId: selectedDoctor!.id,
        patientId: isGuest ? undefined : selectedPatientId || undefined,
        appointmentTime: mergedBookingTime,
        appointmentType: "online",
        payAtClinic: paymentMode !== "online",
        notes: bookingNotes,
        followUpForAppointmentId: followUpForAppointmentId || undefined,
      });
      const appt = res.data.data;
      const token = appt.tokenNumber;
      rememberTracker(appt._id || appt.id, appt.trackerToken, user?.id || null, mergedBookingTime);

      const isPostConsultation = selectedDoctor?.feeType === "post_consultation";
      const isFree = selectedDoctor?.feeType === "free";



      setCreatedTicket({
        appointmentId: appt._id || appt.id,
        trackerToken: appt.trackerToken,
        status: appt.status,
        paymentStatus: appt.paymentStatus,
        tokenNumber: token,
        patientName: isGuest ? guestForm.name : familyMembers.find((member) => (member.patient?.id || member.patient?._id) === selectedPatientId)?.patient?.name || user?.name || "Patient",
        patientPhone: isGuest ? guestForm.phone : (user as any)?.phone || "",
        appointmentTime: mergedBookingTime,
        selectedDate,
        selectedTime: timeToUse,
        bookingMode: doctorSlotInfo?.bookingMode,
        doctorName: selectedDoctor?.name,
        specialization: selectedDoctor?.specialization,
        clinicName: clinic?.name,
        clinicAddress: clinic?.address && clinic.address.trim() !== "." ? clinic.address : clinic?.city,
        fees: isPostConsultation ? "Decided post-consultation" : isFree ? "Free" : appt.paymentAmount ?? selectedDoctor?.fees,
        paymentMode: isPostConsultation ? "pay_at_clinic" : isFree ? "free" : paymentMode,
      });

      // Clear query params so deep-link cannot re-trigger
      if (typeof window !== "undefined" && window.history) {
        const url = new URL(window.location.href);
        url.searchParams.delete("openBooking");
        url.searchParams.delete("doctorId");
        url.searchParams.delete("followUp");
        url.searchParams.delete("prevAppointmentId");
        window.history.replaceState(null, "", url.pathname + url.search + url.hash);
      }

      // Keep the booking surface mounted as the confirmed ticket replaces the form.
      setIsBookingOpen(false);
      resetBookingForm();
      setTicketModalOpen(true);
      vibrateFeedback("success");

      // Settle background payment preference without delaying user confirmation
      if (isPostConsultation || (!isFree && selectedDoctor?.fees && selectedDoctor.fees > 0 && paymentMode !== "online")) {
        api.post("/appointment-payments/pay-at-clinic", { appointmentId: appt._id || appt.id })
          .then((response) => setCreatedTicket((ticket: any) => ticket?.appointmentId === (appt._id || appt.id) ? { ...ticket, status: response.data.data.status, paymentStatus: response.data.data.paymentStatus } : ticket))
          .catch(() => setCreatedTicket((ticket: any) => ticket?.appointmentId === (appt._id || appt.id) ? { ...ticket, paymentError: "Your appointment was saved, but the payment preference could not be updated. Contact clinic reception for payment instructions; your private tracker retains the visit details." } : ticket));
      } else if (!isFree && selectedDoctor?.fees && selectedDoctor.fees > 0 && paymentMode === "online") {
        api.post("/appointment-payments/create-order", { appointmentId: appt._id || appt.id })
          .then((orderRes) => {
            const orderData = orderRes.data?.data;
            if (orderData) {
              toast({
                title: "Online payment pending",
                description: "Your appointment is saved. Payment is still pending; contact reception for verified payment instructions.",
                variant: "success",
              });
            }
          })
          .catch(() => setCreatedTicket((ticket: any) => ticket?.appointmentId === (appt._id || appt.id) ? { ...ticket, paymentError: "Your appointment was saved, but online payment could not start. Contact clinic reception for payment instructions; your private tracker retains the visit details." } : ticket));
      }
    } catch (err: any) {
      toast({
        title: "Booking Failed",
        description: err.response?.data?.message || "An error occurred while booking.",
        variant: "error",
        duration: 4000,
      });
    } finally {
      bookingSubmitRef.current = false;
      setBookingLoading(false);
      setBookingProgressMessage("");
    }
  };

  const retryTicketPaymentSetup = async () => {
    if (!createdTicket?.appointmentId || retryingPaymentSetup) return;
    const ticket = createdTicket;
    setRetryingPaymentSetup(true);
    try {
      const path = ticket.paymentMode === "online" ? "/appointment-payments/create-order" : "/appointment-payments/pay-at-clinic";
      const res = await api.post(path, { appointmentId: ticket.appointmentId });
      setCreatedTicket((current: any) => current?.appointmentId === ticket.appointmentId ? {
        ...current, paymentError: null,
        ...(ticket.paymentMode !== "online" ? { status: res.data.data.status, paymentStatus: res.data.data.paymentStatus } : {}),
      } : current);
    } catch { setCreatedTicket((current: any) => current?.appointmentId === ticket.appointmentId ? { ...current, paymentError: "Payment setup could not be retried. Contact reception; your appointment is still saved." } : current); }
    finally { setRetryingPaymentSetup(false); }
  };

  const handlePrintSlip = async () => {
    if (!createdTicket) return;
    await printHtml(`
      <html>
        <head>
          <title>Appointment Token Slip - #${createdTicket.tokenNumber}</title>
          <style>${getPrintBrandStyles()}
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: var(--print-background); padding: 24px; color: var(--print-text); }
            .ticket { background: white; border: 1px solid var(--print-input-border); border-radius: 16px; padding: 32px; width: 400px; text-align: left; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
            .header { text-align: center; border-bottom: 1px solid var(--print-border); padding-bottom: 16px; margin-bottom: 16px; }
            .clinic-title { font-size: 18px; font-weight: 800; color: var(--print-text); margin: 0 0 4px 0; }
            .clinic-sub { font-size: 12px; color: var(--print-muted); margin: 0; }
            .token-box { background: var(--print-surface-muted); border: 1px solid var(--print-input-border); border-radius: 12px; padding: 14px; text-align: center; margin-bottom: 20px; }
            .token-label { font-size: 11px; font-weight: 700; color: var(--print-secondary); text-transform: uppercase; letter-spacing: 0.5px; }
            .token-num { font-size: 40px; font-weight: 900; color: var(--print-text); margin: 2px 0; line-height: 1; }
            .details-row { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 8px; border-bottom: 1px solid var(--print-background); padding-bottom: 6px; }
            .label { color: var(--print-muted); font-weight: 500; }
            .value { color: var(--print-text); font-weight: 700; text-align: right; }
            .footer { text-align: center; font-size: 11px; color: var(--print-muted); margin-top: 20px; padding-top: 14px; border-top: 1px solid var(--print-surface-muted); }
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
              <span class="value">${createdTicket.bookingMode === "sequential_queue" ? "Clinic Queue Token" : format12Hour(createdTicket.selectedTime)}</span>
            </div>
            <div class="details-row">
              <span class="label">Consultation Fee:</span>
              <span class="value">${typeof createdTicket.fees === "string" ? createdTicket.fees : formatCurrency(createdTicket.fees, clinic?.currency || "INR")} (${appointmentPaymentLabel(createdTicket.paymentStatus)})</span>
            </div>
            <div class="footer">
              ${createdTicket.appointmentId ? `
              <p style="margin: 0 0 4px 0; font-weight: 700; color: var(--print-text);">Live Appointment Tracker:</p>
              <p style="margin: 0 0 8px 0; word-break: break-all; font-family: monospace; font-size: 11px; color: var(--print-accent);">
                ${window.location.origin}/track/${createdTicket.appointmentId}${createdTicket.trackerToken ? `?t=${encodeURIComponent(createdTicket.trackerToken)}` : ""}
              </p>` : ""}
              Please arrive 10 minutes prior to your consultation time. Present this token at reception.
            </div>
          </div>
        </body>
      </html>
    `);
  };

  if (clinicError) {
    if (bookingOnly) return <div role="alert" className="rounded-2xl border border-border bg-surface p-5 text-sm text-text-secondary">{clinicError === "not_found" ? "This practice location is no longer available." : "We couldn't load booking details."}{clinicError === "load_failed" && <Button className="ml-3" onClick={() => setClinicRetry((value) => value + 1)}>Try again</Button>}</div>;
    return <div className="min-h-screen bg-surface-alt text-text"><MarketplaceNavbar /><main className="max-w-lg mx-auto px-4 pt-28"><Card><CardContent className="p-6 space-y-4"><h1 className="text-lg font-semibold">{clinicError === "not_found" ? "Clinic page unavailable" : "We couldn't load this clinic"}</h1><p className="text-sm text-text-muted">{clinicError === "not_found" ? "This clinic link may have changed or the clinic is no longer listed." : "Check your connection and try again."}</p><div className="flex flex-wrap gap-3">{clinicError === "load_failed" && <Button onClick={() => setClinicRetry((value) => value + 1)}>Try again</Button>}<Link href="/browse" className="text-sm text-accent py-2">Browse clinics</Link></div></CardContent></Card></main></div>;
  }

  if (loading || (clinic && clinic.id !== id)) {
    if (bookingOnly) return <div role="status" className="rounded-2xl border border-border bg-surface p-5 text-sm text-text-secondary">Loading appointments at {bookingName || "this location"}…</div>;
    return <BrowseDetailSkeleton />;
  }

  if (!clinic) return null;

  const hasCoordinates = typeof clinic.latitude === "number" && Number.isFinite(clinic.latitude) && clinic.latitude >= -90 && clinic.latitude <= 90
    && typeof clinic.longitude === "number" && Number.isFinite(clinic.longitude) && clinic.longitude >= -180 && clinic.longitude <= 180;
  const streetAddress = clinic.address?.trim();
  const destination = hasCoordinates
    ? `${clinic.latitude},${clinic.longitude}`
    : streetAddress && streetAddress !== "."
      ? [streetAddress, clinic.city?.trim()].filter(Boolean).join(", ")
      : null;
  const directionsUrl = destination
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`
    : null;
  const hasSingleDoctor = clinic.doctors.length === 1;
  const singleDoctor = hasSingleDoctor ? clinic.doctors[0] : null;
  const bookingDoctor = bookingDoctorId ? clinic.doctors.find((doctor) => doctor.id === bookingDoctorId) : null;
  const bookingStatus = getPublicBookingStatus({ ...clinic, doctorCount: clinic.doctors.length });
  const selectableFamilyMembers = familyMembers.filter((member) => member.relationship !== "self" && (member.patient?.id || member.patient?._id) && member.patient?.name);
  const clinicSpecialties = Array.from(new Set(clinic.doctors.map((doctor) => doctor.specialization?.trim()).filter((specialty): specialty is string => Boolean(specialty)))).sort();
  const matchingDoctors = clinic.doctors.filter((doctor) => (!clinicSpecialty || doctor.specialization?.trim() === clinicSpecialty) && `${doctor.name} ${doctor.specialization}`.toLocaleLowerCase().includes(doctorQuery.trim().toLocaleLowerCase()));
  const visibleDoctors = showAllDoctors || doctorQuery || clinicSpecialty ? matchingDoctors : matchingDoctors.slice(0, 12);
  const hasCoverImage = Boolean(clinic.image_url && clinic.image_url !== clinic.logo_url);

  if (bookingOnly && !bookingDoctor) return <div role="status" className="rounded-2xl border border-border bg-surface p-5 text-sm text-text-secondary">This doctor is no longer listed at {clinic.name}. Choose another practice location or contact the clinic.</div>;
  if (bookingOnly && bookingStatus === "contact_clinic") return <div role="status" className="rounded-2xl border border-border bg-surface p-5 text-sm text-text-secondary"><p className="font-semibold text-text">Online booking is unavailable at {clinic.name}.</p><p className="mt-2">{clinic.phone ? <>Please <a className="font-semibold text-accent underline" href={`tel:${clinic.phone.replace(/\s+/g, "")}`}>call {clinic.phone}</a> for help.</> : "Please contact the clinic for help."}</p></div>;
  if (bookingOnly && !selectedDoctor && !ticketModalOpen) return <div role="status" className="rounded-2xl border border-border bg-surface p-5 text-sm text-text-secondary">Preparing available appointments at {clinic.name}…</div>;

  return (
    <div className={bookingOnly ? "" : "min-h-screen bg-surface-alt pt-16 pb-24 font-sans text-text antialiased"}>
      {!bookingOnly && <>
      <MarketplaceNavbar brand={{ name: clinic.organization?.name || clinic.name, logoUrl: clinic.organization?.logo_url || clinic.logo_url, href: `/browse/${clinic.id}` }} />

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
            aria-label={"Back to clinics"}
            className="text-sm font-medium text-text-muted hover:text-accent inline-flex items-center gap-1 shrink-0 py-1 px-2 rounded-lg hover:bg-surface-alt min-h-11"
          >
            <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.75} />
            <span className="hidden xs:inline">{"Back to Clinics"}</span>
          </Link>
        </div>
      </div>

      {/* Clinic Header Showcase Banner - Clean Healthcare Design Standard */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-4 sm:pt-6">
        <div className="bg-surface border border-border rounded-2xl sm:rounded-3xl overflow-hidden shadow-xs" style={{ borderTop: `4px solid ${clinic.brandColor || "#0F6F66"}` }}>
          {/* Visual Cover Header */}
          {hasCoverImage && <div className="h-24 sm:h-40 w-full relative bg-surface-alt overflow-hidden">
            {clinic.image_url ? (
              <LoadingImage src={clinic.image_url} alt={clinic.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-surface border-b border-border/40">
                <Building2 className="w-8 h-8 text-text-muted" strokeWidth={1.75} aria-hidden="true" />
              </div>
            )}
            <div className="absolute top-3 left-3 sm:top-4 sm:left-4 flex flex-wrap gap-1.5 sm:gap-2">
              <span className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-semibold text-text bg-surface/90  border border-border px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full shadow-xs">
                <MapPin className="w-3 h-3 text-text-muted" strokeWidth={1.75} />
                <span>{clinic.city}</span>
              </span>
            </div>

            {/* View Photos Button if images available */}
            {clinic.images && clinic.images.length > 0 && (
              <button
                type="button"
                onClick={() => setLightboxIndex(0)}
                className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 inline-flex items-center gap-1.5 text-xs font-semibold text-brand-mist bg-black/60 hover:bg-black/80  px-3 py-1.5 rounded-xl border border-white/20 shadow-sm transition-colors cursor-pointer z-10"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>{"View"} {clinic.images.length} {"Photos"}</span>
              </button>
            )}
          </div>}

          {/* Title & Clinical Contact Bar */}
          <div className="p-4 sm:p-6 border-t border-border/40 space-y-3">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex min-w-0 items-center gap-3.5">
                {(clinic.logo_url || clinic.organization?.logo_url) && (
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-surface border-2 border-surface shadow-md overflow-hidden shrink-0 -mt-8 sm:-mt-12 z-10 relative">
                    <LoadingImage
                      src={clinic.logo_url || clinic.organization?.logo_url}
                      alt={clinic.name}
                      fallback={clinic.name.slice(0, 1)}
                      className="w-full h-full object-contain"
                    />
                  </div>
                )}
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-xl sm:text-3xl font-extrabold text-text tracking-tight break-words">{clinic.name}</h1>
                    {clinic.timings && <ClinicStatusBadge timings={clinic.timings} pill showSecondary={false} />}
                  </div>
                  {clinic.organization?.name && clinic.organization.name !== clinic.name && (
                    <p className="text-xs text-text-muted font-medium">
                      {"Branch of"} {clinic.organization.name}
                    </p>
                  )}
                </div>
              </div>

              {/* Quick Action Buttons Bar */}
              <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap xl:shrink-0 xl:flex-nowrap">
                <button
                  type="button"
                  onClick={() => {
                    if (typeof navigator !== "undefined" && navigator.share) {
                      navigator.share({
                        title: clinic.name,
                        text: `Check out ${clinic.name} on Ekavyu`,
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
                  className="inline-flex min-h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-border bg-surface px-3 py-2 text-xs font-semibold text-text shadow-2xs hover:bg-surface-hover cursor-pointer"
                  title="Share Clinic Profile"
                  aria-label="Share Clinic Profile"
                >
                  <Share2 className="w-3.5 h-3.5 text-text-muted" strokeWidth={1.75} />
                  <span>{"Share"}</span>
                </button>
                {directionsUrl && (
                  <a
                    href={directionsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-border bg-surface px-3 py-2 text-xs font-semibold text-text shadow-2xs hover:bg-surface-hover"
                  >
                    <MapPin className="w-3.5 h-3.5 text-text-muted" strokeWidth={1.75} />
                    <span>{"Get Directions"}</span>
                    <ExternalLink className="w-3 h-3 text-text-muted" strokeWidth={1.75} />
                  </a>
                )}
                {clinic.phone && (
                  <>
                    <a
                      href={`https://wa.me/${clinic.phone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(`Hello, I would like to inquire about appointments and doctors at ${clinic.name}.`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-success/30 bg-success/10 px-3 py-2 text-xs font-semibold text-success-text shadow-2xs transition-colors hover:bg-success/20 dark:text-success-text"
                      title="Chat on WhatsApp"
                      aria-label="Chat on WhatsApp"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-success-text" strokeWidth={1.75} />
                      <span>{"WhatsApp"}</span>
                    </a>
                    <a
                      href={`tel:${clinic.phone.replace(/\s+/g, "")}`}
                      className="inline-flex min-h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-primary-600 px-3 py-2 text-xs font-semibold text-brand-mist shadow-2xs hover:bg-primary-700"
                    >
                      <Phone className="w-3.5 h-3.5" strokeWidth={1.75} />
                      <span>{"Call Clinic"}</span>
                    </a>
                  </>
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

            {clinic.description && <details className="border-t border-border pt-2"><summary className="cursor-pointer py-2 text-sm font-medium">About this clinic</summary><p className="max-w-3xl whitespace-pre-line text-sm leading-6 text-text-secondary pb-2">{clinic.description}</p></details>}

            {/* Facilities Tags */}
            {clinic.facilities && clinic.facilities.length > 0 && (
              <details className="border-t border-border pt-2"><summary className="cursor-pointer py-2 text-sm font-medium">Facilities ({clinic.facilities.length})</summary><div className="flex flex-wrap gap-1.5 pb-2">
                {clinic.facilities.map((fac, idx) => (
                  <span key={idx} className="text-[10px] font-medium bg-surface-alt text-text-secondary px-2 py-0.5 rounded-md border border-border">
                    {fac}
                  </span>
                ))}
              </div></details>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Layout - Specialists First on Mobile for Rapid Access */}
      {bookingStatus === "contact_clinic" && <div role="status" className="max-w-6xl mx-auto px-4 sm:px-6 pt-5">
        <div className="rounded-2xl border border-border bg-surface p-4 text-sm text-text-secondary">
          <p className="font-semibold text-text">Online booking is temporarily unavailable.</p>
          <p className="mt-1">Please contact the clinic directly.{clinic.phone && <> <a className="font-medium text-accent underline" href={`tel:${clinic.phone.replace(/\s+/g, "")}`}>Call {clinic.phone}</a></>}</p>
        </div>
      </div>}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-24 lg:pb-12 flex flex-col lg:grid lg:grid-cols-3 gap-6">
        {/* Right Column: Specialists Practitioner Cards (Renders First on Mobile) */}
        <div className="order-1 lg:order-2 lg:col-span-2 space-y-4 sm:space-y-5">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h2 className="text-lg sm:text-xl font-bold text-text flex items-center gap-2">
                <span>Doctors at {clinic.name}</span>
                <Badge variant="neutral" className="text-xs font-semibold">
                  {clinic.doctors.length}
                </Badge>
              </h2>
              <p className="text-xs text-text-muted">{bookingStatus === "check_availability" ? "Select a doctor to check dates and times." : "View doctors and contact the clinic about appointments."}</p>
            </div>
          </div>

          {clinic.doctors.length > 8 && <Input
            icon={<Search className="h-4 w-4" aria-hidden="true" />}
            value={doctorQuery}
            onChange={(event) => { setDoctorQuery(event.target.value); setShowAllDoctors(false); }}
            placeholder="Search doctors or specialties"
            aria-label="Search doctors at this clinic"
          />}
          {clinicSpecialties.length > 1 && <Select
            label="Specialty"
            value={clinicSpecialty}
            onChange={(event) => { setClinicSpecialty(event.target.value); setShowAllDoctors(false); }}
            options={[{ value: "", label: "All specialties" }, ...clinicSpecialties.map((specialty) => ({ value: specialty, label: specialty }))]}
          />}
          {(doctorQuery || clinicSpecialty) && <p role="status" className="text-xs text-text-secondary">Showing {matchingDoctors.length} {matchingDoctors.length === 1 ? "doctor" : "doctors"}</p>}

          {clinic.doctors.length === 0 ? (
            <Card className="p-8 text-center text-text-muted text-xs border-dashed rounded-2xl bg-surface">
              <p>No doctors are listed for online booking at this clinic right now.</p>
              <div className="mt-3 flex flex-wrap justify-center gap-3">
                {clinic.phone && <a href={`tel:${clinic.phone.replace(/\s+/g, "")}`} className="font-semibold text-accent underline min-h-11 inline-flex items-center">Call clinic</a>}
                <Link href="/browse" className="font-semibold text-accent underline min-h-11 inline-flex items-center">Browse other clinics</Link>
              </div>
            </Card>
          ) : (
            <div className="space-y-4">
            {matchingDoctors.length === 0 ? <p role="status" className="rounded-2xl border border-border bg-surface p-5 text-sm text-text-secondary">No doctors match this search. Try a name or specialty.</p> : <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
              {visibleDoctors.map((doc) => (
                <Card
                  key={doc.id}
                  className="group hover:shadow-md hover:border-primary-500/40 transition-all duration-150 p-4 sm:p-5 rounded-2xl border border-border bg-surface flex flex-col justify-between"
                >
                  <div className="space-y-3.5">
                    {/* Header Avatar & Details */}
                    <Link href={`/doctor/${encodeURIComponent(doc.id)}?clinicId=${encodeURIComponent(id)}`} className="flex items-start gap-3 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" aria-label={`View Dr. ${doc.name.replace(/^Dr\.?\s*/i, "")}'s profile`}>
                      <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-surface-alt border border-border flex items-center justify-center shrink-0 shadow-2xs overflow-hidden">
                        {doc.image_url ? (
                          <LoadingImage src={doc.image_url} alt={doc.name} loading="lazy" className="w-full h-full object-cover rounded-xl" />
                        ) : (
                          <span className="text-xs sm:text-sm font-bold text-text-muted">DR</span>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <h3 className="text-sm sm:text-base font-bold text-text group-hover:text-accent transition-colors break-words">
                            Dr. {doc.name.replace(/^Dr\.?\s*/i, "")}
                          </h3>
                          {doc.rating != null && (doc.reviewsCount || 0) > 0 && <span className="text-xs font-semibold text-text-secondary flex items-center gap-1 shrink-0" aria-label={`${doc.rating} out of 5 from ${doc.reviewsCount} reviews`}>
                            <Star className="w-3 h-3 text-warning-text fill-warning" strokeWidth={1.75} />
                            <span>{doc.rating.toFixed(1)}</span>
                          </span>}
                        </div>
                        <p className="text-xs font-semibold text-accent dark:text-accent mt-0.5 break-words">{doc.specialization || "Specialty not listed"}</p>
                        {doc.qualification && <p className="text-[11px] text-text-muted break-words mt-0.5">{doc.qualification}</p>}
                      </div>
                    </Link>

                    {/* Experience & Fees Row */}
                    <div className="grid grid-cols-2 gap-2 bg-surface-alt p-2.5 rounded-xl border border-border text-xs">
                      <div>
                        <span className="text-[10px] text-text-muted block font-medium uppercase tracking-wider">{"Experience"}</span>
                        <span className="font-semibold text-text">{doc.experience_years ? `${doc.experience_years}+ ${"Years"}` : "Not listed"}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-text-muted block font-medium uppercase tracking-wider">{"Consultation Fee"}</span>
                        <span className="font-semibold text-text">{doctorFeeLabel(doc, clinic.currency || "INR")}</span>
                      </div>
                    </div>

                    {/* Queue or Slot Mode Indicator & Status Badges */}
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-text-secondary">
                      <span className="inline-flex items-center gap-1 bg-surface-alt px-2 py-0.5 rounded-md border border-border font-medium">
                        {doc.bookingMode === "sequential_queue" ? (
                          <>
                            <Users className="w-3 h-3 text-text-muted" strokeWidth={1.75} />
                            <span>{"Queue Token System"}</span>
                          </>
                        ) : (
                          <>
                            <Clock className="w-3 h-3 text-text-muted" strokeWidth={1.75} />
                            <span>{"Scheduled Time Slot"}</span>
                          </>
                        )}
                      </span>
                      {doc.isOnlineBookingClosed && (
                        <Badge variant="warning" size="sm" className="font-semibold text-[10px]">
                          {"Online Closed Today"}
                        </Badge>
                      )}
                      {doc.isAvailable === false && (
                        <Badge variant="danger" size="sm" className="font-semibold text-[10px]">
                          {"Unavailable Today"}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Book Button */}
                  <div className="pt-3 border-t border-border/50 mt-3.5">
                    <Button
                      variant="primary"
                      size="sm"
                      style={clinic.brandColor ? { backgroundColor: clinic.brandColor } : undefined}
                      className="w-full font-bold rounded-xl shadow-xs min-h-[44px] flex items-center justify-center gap-1.5 group/btn cursor-pointer"
                      onClick={() => handleOpenBooking(doc)}
                      disabled={bookingStatus !== "check_availability"}
                    >
                      <span>
                        {bookingStatus !== "check_availability"
                          ? "Contact clinic for appointments"
                          : doc.isAvailable === false
                          ? "Schedule Upcoming Date"
                          : doc.isOnlineBookingClosed
                          ? "Schedule Next Available Date"
                          : "Check appointments"}
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 group-hover/btn:translate-x-0.5 transition-transform" strokeWidth={2} />
                    </Button>
                    <Link href={`/doctor/${encodeURIComponent(doc.id)}?clinicId=${encodeURIComponent(id)}`} className="mt-2 inline-flex min-h-11 w-full items-center justify-center text-xs font-semibold text-accent underline-offset-2 hover:underline">
                      View & share doctor profile
                    </Link>
                  </div>
                </Card>
              ))}
            </div>}
            {!showAllDoctors && !doctorQuery && !clinicSpecialty && matchingDoctors.length > visibleDoctors.length && <Button variant="outline" className="w-full min-h-11" onClick={() => setShowAllDoctors(true)}>Show all {matchingDoctors.length} doctors</Button>}
            </div>
          )}
        </div>

        {/* Left Column: About & Operating Hours */}
        <div className="order-2 lg:order-1 lg:col-span-1 space-y-6">
          <Card className="rounded-2xl border border-border bg-surface">
            <CardHeader className="pb-3 border-b border-border/40">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Building2 className="w-4 h-4 text-text-muted" strokeWidth={1.75} />
                <span>Plan your visit</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div>
                <h4 className="text-xs font-semibold text-text mb-2 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-text-muted" strokeWidth={1.75} />
                  <span>{"Clinic Operating Hours"}</span>
                </h4>
                {renderTimings(clinic.timings)}
              </div>

              {/* Direct Help & Reception Contact */}
              <div className="pt-3 border-t border-border/40 space-y-2">
                <h4 className="text-xs font-semibold text-text uppercase tracking-wider">{"Reception & Inquiries"}</h4>
                <div className="space-y-1.5 text-xs text-text-secondary">
                  {clinic.phone && (
                    <a
                      href={`tel:${clinic.phone.replace(/\s+/g, "")}`}
                      className="flex items-center gap-2 text-accent hover:underline font-semibold min-h-[36px]"
                    >
                      <Phone className="w-3.5 h-3.5" strokeWidth={1.75} />
                      <span>{clinic.phone}</span>
                    </a>
                  )}
                  {clinic.email && (
                    <p className="flex items-center gap-2 text-text-muted">
                      <span>{"Email:"}</span>
                      <span>{clinic.email}</span>
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* About Parent Organization & Clinical Governance Card */}
          {clinic.organization && (
            <Card className="rounded-2xl border border-border bg-surface overflow-hidden shadow-xs">
              <CardHeader className="pb-3 border-b border-border/40">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-text">
                  <Building2 className="w-4 h-4 text-accent" strokeWidth={1.75} />
                  <span>{"Part of"} {clinic.organization.name}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-3.5 space-y-3">
                {clinic.organization.logo_url && (
                  <div className="flex items-center gap-3">
                    <LoadingImage
                      src={clinic.organization.logo_url}
                      alt={clinic.organization.name}
                      className="w-10 h-10 rounded-xl object-contain border border-border p-1 bg-surface-alt shadow-2xs"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-text truncate">{clinic.organization.name}</p>
                      <p className="text-[10px] text-text-muted">{"Parent Healthcare System"}</p>
                    </div>
                  </div>
                )}
                {clinic.organization.description && (
                  <p className="text-xs text-text-secondary leading-relaxed line-clamp-3">
                    {clinic.organization.description}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Facility Photo Gallery Showcase */}
          {clinic.images && clinic.images.length > 0 && (
            <Card className="rounded-2xl border border-border bg-surface overflow-hidden shadow-xs">
              <CardHeader className="pb-3 border-b border-border/40 flex flex-row items-center justify-between">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Camera className="w-4 h-4 text-accent" strokeWidth={1.75} />
                  <span>{"Facility Showcase"}</span>
                </CardTitle>
                <span className="text-xs text-text-muted font-semibold">{clinic.images.length} {"Photos"}</span>
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
                      <LoadingImage
                        src={img}
                        alt={`Facility photo ${idx + 1}`}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      />
                      {idx === 5 && clinic.images!.length > 6 && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-brand-mist text-xs font-bold">
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
                  {"Browse Campus Gallery"}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Sticky Mobile Bottom Booking Bar (For single-doctor clinics) */}
      {hasSingleDoctor && singleDoctor && bookingStatus === "check_availability" && !isBookingOpen && !ticketModalOpen && (
        <div className="fixed bottom-0 left-0 right-0 pt-3 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-surface/95 border-t border-border z-40 lg:hidden shadow-lg flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-text truncate">Dr. {singleDoctor.name.replace(/^Dr\.?\s*/i, "")}</p>
            <p className="text-[11px] text-text-secondary font-semibold">{doctorFeeLabel(singleDoctor, clinic.currency || "INR")} · Consultation fee</p>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => handleOpenBooking(singleDoctor)}
            className="font-bold px-5 rounded-xl shadow-xs min-h-[44px] shrink-0"
          >
            {"Check times"} →
          </Button>
        </div>
      )}
      </>}

      {/* The same booking steps render inline for doctor links and in a sheet for clinic visitors. */}
      <BookingSurface
        inline={bookingOnly}
        open={isBookingOpen || ticketModalOpen}
        subtitle={bookingOnly ? `${clinic.name}${clinic.city ? ` · ${clinic.city}` : ""}` : undefined}
        onClose={() => { if (!bookingSubmitRef.current) { setIsBookingOpen(false); setTicketModalOpen(false); availabilityRequest.current?.abort(); } }}
        title={
          ticketModalOpen ? appointmentBookingLabel(createdTicket?.status) : bookingStep === 1
            ? "Select Date & Time"
            : "Patient Details"
        }
        busy={bookingLoading}
        footer={ticketModalOpen ? <div className="flex gap-2 justify-end w-full"><PrintButton documentName="token slip" onPrint={handlePrintSlip} disabled={!createdTicket} /><Button variant="outline" onClick={() => { setTicketModalOpen(false); if (bookingOnly && bookingDoctor) handleOpenBooking(bookingDoctor); }}>{bookingOnly ? "Book another appointment" : "Done"}</Button></div> : bookingStep === 1 ? <>
          {!bookingOnly && <Button variant="ghost" onClick={() => setIsBookingOpen(false)}>Cancel</Button>}
          <Button disabled={availabilityBlocked || !selectedDate || (!selectedTime && doctorSlotInfo?.bookingMode !== "sequential_queue")} onClick={() => setBookingStep(2)} iconRight={<ArrowRight className="w-4 h-4" />}>Continue to Details</Button>
        </> : <>
          <Button variant="outline" disabled={bookingLoading} onClick={() => setBookingStep(1)} icon={<ArrowLeft className="w-4 h-4" />}>Back</Button>
          <Button type="submit" form="public-booking-form" loading={bookingLoading} loadingText={bookingProgressMessage || "Confirming appointment…"} icon={<CheckCircle2 className="w-4 h-4" />}>Confirm Appointment</Button>
        </>}
      >
        {!ticketModalOpen && <>
        {/* Step Progress Bar */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex-1 space-y-1">
            <div className="flex items-center justify-between text-[11px] font-semibold">
              <span className={bookingStep >= 1 ? "text-accent font-bold" : "text-text-muted"}>{"1. Date & Time"}</span>
              <span className={bookingStep >= 2 ? "text-accent font-bold" : "text-text-muted"}>{"2. Patient Details"}</span>
            </div>
            <div className="flex items-center gap-1.5 h-1">
              <div className={`flex-1 h-full rounded-full transition-colors ${bookingStep >= 1 ? "bg-primary-600" : "bg-border"}`} />
              <div className={`flex-1 h-full rounded-full transition-colors ${bookingStep >= 2 ? "bg-primary-600" : "bg-border"}`} />
            </div>
          </div>
        </div>

        <form id="public-booking-form" onSubmit={handleBookAppointment}>
          <fieldset disabled={bookingLoading} className="min-w-0 space-y-3">
          {/* STEP 1: Date & Time Slot / Queue Selection */}
          {bookingStep === 1 && (
            <div className="space-y-3">
              {/* Doctor Compact Header Bar */}
              <div className="p-2.5 bg-surface-alt rounded-xl border border-border flex items-center justify-between gap-2.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-surface border border-border flex items-center justify-center font-bold text-text-secondary text-[11px] shrink-0 overflow-hidden shadow-2xs">
                    {selectedDoctor?.image_url ? (
                      <LoadingImage src={selectedDoctor.image_url} alt={selectedDoctor.name} className="w-full h-full object-cover" />
                    ) : (
                      "DR"
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-text text-xs sm:text-sm break-words">Dr. {selectedDoctor?.name.replace(/^Dr\.?\s*/i, "")}</p>
                    <p className="text-[11px] text-accent dark:text-accent font-semibold break-words">{selectedDoctor?.specialization}</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xs sm:text-sm font-black text-success-text dark:text-success-text bg-surface px-2 py-0.5 rounded-lg border border-border">
                    {selectedDoctor && doctorFeeLabel(selectedDoctor, clinic?.currency || "INR")}
                  </span>
                </div>
              </div>

              {/* Online Booking Backlog Buffer Banner */}
              {selectedDate === clinicDateKey(new Date(), clinic?.timezone || "Asia/Kolkata") && selectedDoctor?.isOnlineBookingClosed && (
                <div className="p-2.5 rounded-xl bg-warning/10 border border-warning/30 text-warning-text dark:text-warning-text text-xs flex items-start gap-2">
                  <AlertCircle className="w-3.5 h-3.5 text-warning-text shrink-0 mt-0.5" strokeWidth={1.75} />
                  <div className="space-y-0.5 text-[11px]">
                    <p className="font-bold">{"Same-Day Online Booking Closed"}</p>
                    <p className="opacity-90 leading-tight">
                      {selectedDoctor.onlineBookingClosedReason || "Queue cutoff reached for today. Please select tomorrow or an upcoming date below."}
                    </p>
                  </div>
                </div>
              )}

              <div role={availabilityState === "error" ? "alert" : "status"} className="min-h-6 text-xs text-text-secondary flex items-center justify-between gap-2">
                <span>{availabilityState === "checking" ? "Checking available appointments…" : availabilityState === "error" ? "Availability could not be checked. Please try again." : "Availability updated"}</span>
                {availabilityState === "error" && <Button variant="outline" size="sm" onClick={() => selectedDoctor && loadSlotsForDate(selectedDate, selectedDoctor)}>Try again</Button>}
              </div>
              {/* Date Selection Ribbon */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold uppercase tracking-wider text-text text-[11px]">
                    {"1. Choose Date"}
                  </span>
                  {selectedDaySchedule?.isWorkingDay && (
                    <span className="text-[11px] text-text-muted font-medium">
                      {"Shift:"} {selectedDaySchedule.workingHoursLabel}
                    </span>
                  )}
                </div>

                {upcomingDays.length === 0 ? (
                  <p className="text-xs text-danger-text p-2.5 bg-danger-500/10 rounded-xl border border-danger-500/20">
                    {"No active schedules configured for this doctor currently."}
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
                            ? "bg-primary-600 text-brand-mist border-primary-600 shadow-xs font-bold"
                            : "bg-surface hover:border-border hover:bg-surface-alt text-text border border-border"
                        }`}
                      >
                        <span className="text-[10px] font-semibold uppercase tracking-wider block opacity-85">{d.dayShort}</span>
                        <span className="text-xs sm:text-sm font-bold block mt-0.5">{d.dateNum}</span>
                        {d.isHoliday ? (
                          <span className={`text-[8px] font-bold px-1 rounded-full mt-0.5 ${selectedDate === d.dateString ? "bg-white/20 text-brand-mist" : "bg-warning/20 text-warning-text dark:text-warning-text"}`}>
                            {"Holiday"}
                          </span>
                        ) : d.isToday ? (
                          <span className={`text-[8px] font-bold px-1 rounded-full mt-0.5 ${selectedDate === d.dateString ? "bg-white/20 text-brand-mist" : "bg-primary-500/10 text-accent"}`}>
                            {"Today"}
                          </span>
                        ) : d.isTomorrow ? (
                          <span className={`text-[8px] font-bold px-1 rounded-full mt-0.5 ${selectedDate === d.dateString ? "bg-white/20 text-brand-mist" : "bg-surface-alt text-text-muted"}`}>
                            {"Tmrw"}
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
                      <div key={`holiday-${selectedDate}`} className="p-6 text-center bg-warning/5 rounded-2xl border border-warning/20 flex flex-col items-center justify-center space-y-3 min-h-[200px] animate-fade-in">
                        <div className="w-12 h-12 rounded-2xl bg-warning/10 border border-warning/20 flex items-center justify-center text-warning-text dark:text-warning-text">
                          <CalendarOff className="w-6 h-6" />
                        </div>
                        <div className="space-y-1.5 max-w-sm">
                          <div className="flex items-center justify-center gap-1.5">
                            <Badge variant="warning" size="sm" className="font-bold uppercase tracking-wider text-[10px]">
                              {"Scheduled Leave"}
                            </Badge>
                          </div>
                          <h4 className="text-sm font-bold text-text">{"Doctor on Holiday / Leave"}</h4>
                          <p className="text-xs text-text-muted">
                            Dr. {selectedDoctor?.name} {"is not available on this date"} ({holidayReasonText}).
                          </p>
                          <p className="text-[11px] text-warning-text dark:text-warning-text font-medium">
                            {"Please select another date from the schedule ribbon above to reserve your consultation."}
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
                              className="text-xs font-bold gap-1.5 shadow-xs border-warning/30 text-text hover:border-primary-500 cursor-pointer"
                            >
                              <span>{"Check next date:"} {nextWorkingDay.label || nextWorkingDay.dateString}</span>
                              <ArrowRight className="w-3.5 h-3.5 text-accent" />
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  }

                  if (doctorSlotInfo?.bookingMode === "sequential_queue") {
                    if (queueIsFull) return <div className="p-6 min-h-[200px] flex flex-col items-center justify-center text-center gap-2 bg-surface-alt border border-border rounded-2xl"><h4 className="text-sm font-bold text-text">All tokens are booked</h4><p className="text-xs text-text-secondary">Please choose another date for your consultation.</p>{upcomingDays.some((day) => day.dateString > selectedDate && !day.isHoliday) && <Button type="button" variant="outline" loading={nextSearchState === "checking"} onClick={findNextAvailable}>Find next available appointment</Button>}{nextSearchState === "none" && <p role="status" className="text-xs text-text-secondary">No available tokens were found in the next listed clinic days.</p>}{nextSearchState === "error" && <p role="alert" className="text-xs text-text-secondary">Could not check later dates. Please try again.</p>}{clinic.phone && <a href={`tel:${clinic.phone.replace(/\s+/g, "")}`} className="text-xs font-semibold text-accent underline">Call clinic for help</a>}</div>;
                    return (
                      <div key={`queue-${selectedDate}`} className="p-3 bg-surface-alt rounded-2xl border border-border space-y-2.5 animate-fade-in">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs sm:text-sm text-text flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-text-muted" strokeWidth={1.75} />
                        <span>{"Clinic Queue Token"}</span>
                      </span>
                      <Badge variant="neutral" className="text-[10px] font-semibold">
                        {selectedDate ? upcomingDays.find((d) => d.dateString === selectedDate)?.label || selectedDate : "Today"}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-surface p-2.5 rounded-xl border border-border text-center">
                        <span className="text-[9px] text-text-muted uppercase font-semibold block">{"Estimated Token"}</span>
                        <span className="text-xl font-black text-text">{availabilityState === "ready" && doctorSlotInfo.nextToken ? `#${doctorSlotInfo.nextToken}` : "—"}</span>
                      </div>
                      <div className="bg-surface p-2.5 rounded-xl border border-border text-center">
                        <span className="text-[9px] text-text-muted uppercase font-semibold block">{"Estimated Wait"}</span>
                        <span className="text-xl font-black text-text-secondary">
                          {availabilityState === "ready" && doctorSlotInfo.nextToken ? `~${Math.max(0, (doctorSlotInfo.nextToken - 1) * (doctorSlotInfo.appointmentDuration || 15))} mins` : "—"}
                        </span>
                      </div>
                    </div>

                    <div className="p-2.5 bg-surface rounded-xl border border-border text-[11px] text-text-secondary leading-relaxed">
                      {"Doctor's consultation starts at"} <strong>{selectedDaySchedule?.startFormatted || "09:00 AM"}</strong>.{" "}
                      {"Please arrive 15 minutes prior to confirm your token at reception."}
                    </div>
                  </div>
                );
              }

              return selectedDate ? (
                <div key={`slots-${selectedDate}`} className="space-y-1.5 pt-0.5 animate-fade-in flex-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold uppercase tracking-wider text-text text-[11px]">{"2. Select Time Slot"}</span>
                    {selectedTime && (
                      <span className="text-accent font-bold text-xs">
                        {"Selected:"} {format12Hour(selectedTime)}
                      </span>
                    )}
                  </div>

                      {activeSlotsList.length === 0 ? (
                        <div className="space-y-2 p-4 text-center bg-surface-alt rounded-2xl border border-border text-xs text-text-muted flex min-h-[160px] flex-col items-center justify-center">
                          <p>No appointments are available on this date. Please choose another day.</p>
                          {clinic.phone && <a href={`tel:${clinic.phone.replace(/\s+/g, "")}`} className="font-semibold text-accent underline">Call clinic for help</a>}
                        </div>
                      ) : (
                        <div className="space-y-2 bg-surface-alt p-2.5 rounded-2xl border border-border min-h-[160px] max-h-52 sm:max-h-64 overflow-y-auto touch-scroll">
                          {availabilityState === "ready" && !activeSlotsList.some((slot) => slot.available && !slot.isLocked) && <p className="p-2 text-center text-xs text-text-secondary">All listed times are unavailable. Choose another day{clinic.phone ? <> or <a href={`tel:${clinic.phone.replace(/\s+/g, "")}`} className="font-semibold text-accent underline">call the clinic</a></> : null}.</p>}
                          {/* Morning Slots */}
                          {categorizedSlots.morning.length > 0 && (
                            <div className="space-y-1">
                              <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
                                {"Morning (Before 12:00 PM)"}
                              </div>
                              <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                                {categorizedSlots.morning.map((s) => {
                                  const isAvailable = s.available ?? true;
                                  const isSelected = selectedTime === s.time;
                                  return (
                                    <button
                                      key={s.time}
                                      type="button"
                                      disabled={!isAvailable || availabilityState !== "ready"}
                                      onClick={() => isAvailable && setSelectedTime(s.time)}
                                      className={`py-2 px-1 rounded-xl text-xs font-semibold text-center transition-all min-h-11 flex items-center justify-center ${
                                        !isAvailable
                                          ? "bg-surface-alt/60 text-text-muted/50 border border-dashed border-border/70 line-through cursor-not-allowed"
                                          : isSelected
                                          ? "bg-primary-600 text-brand-mist border-primary-600 shadow-xs font-bold cursor-pointer"
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
                                {"Afternoon (12:00 PM – 4:00 PM)"}
                              </div>
                              <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                                {categorizedSlots.afternoon.map((s) => {
                                  const isAvailable = s.available ?? true;
                                  const isSelected = selectedTime === s.time;
                                  return (
                                    <button
                                      key={s.time}
                                      type="button"
                                      disabled={!isAvailable || availabilityState !== "ready"}
                                      onClick={() => isAvailable && setSelectedTime(s.time)}
                                      className={`py-2 px-1 rounded-xl text-xs font-semibold text-center transition-all min-h-11 flex items-center justify-center ${
                                        !isAvailable
                                          ? "bg-surface-alt/60 text-text-muted/50 border border-dashed border-border/70 line-through cursor-not-allowed"
                                          : isSelected
                                          ? "bg-primary-600 text-brand-mist border-primary-600 shadow-xs font-bold cursor-pointer"
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
                                {"Evening (After 4:00 PM)"}
                              </div>
                              <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                                {categorizedSlots.evening.map((s) => {
                                  const isAvailable = s.available ?? true;
                                  const isSelected = selectedTime === s.time;
                                  return (
                                    <button
                                      key={s.time}
                                      type="button"
                                      disabled={!isAvailable || availabilityState !== "ready"}
                                      onClick={() => isAvailable && setSelectedTime(s.time)}
                                      className={`py-2 px-1 rounded-xl text-xs font-semibold text-center transition-all min-h-11 flex items-center justify-center ${
                                        !isAvailable
                                          ? "bg-surface-alt/60 text-text-muted/50 border border-dashed border-border/70 line-through cursor-not-allowed"
                                          : isSelected
                                          ? "bg-primary-600 text-brand-mist border-primary-600 shadow-xs font-bold cursor-pointer"
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
                      {availabilityState === "ready" && !activeSlotsList.some((slot) => slot.available) && upcomingDays.some((day) => day.dateString > selectedDate && !day.isHoliday) && <Button type="button" variant="outline" className="w-full min-h-11" loading={nextSearchState === "checking"} onClick={findNextAvailable}>Find next available appointment</Button>}
                      {nextSearchState === "none" && <p role="status" className="text-xs text-text-secondary">No appointments were found in the next listed clinic days.{clinic.phone && <> <a href={`tel:${clinic.phone.replace(/\s+/g, "")}`} className="font-semibold text-accent underline">Call the clinic</a> for help.</>}</p>}
                      {nextSearchState === "error" && <p role="alert" className="text-xs text-text-secondary">We could not check later dates. Please try again or choose a date above.</p>}
                    </div>
                  ) : null;
                })()}
              </div>


            </div>
          )}

          {/* STEP 2: Patient Info & Confirmation */}
          {bookingStep === 2 && (
            <div className="space-y-3">
              {/* Selected Slot Summary Bar */}
              <div className="p-3 bg-surface-alt rounded-2xl border border-border flex items-center justify-between gap-3 text-xs">
                <div className="space-y-0.5 min-w-0">
                  <span className="text-[10px] uppercase font-bold text-text-muted tracking-wider block">{"Selected Consultation"}</span>
                  <p className="font-bold text-text truncate">
                    {upcomingDays.find((d) => d.dateString === selectedDate)?.label || selectedDate} •{" "}
                    {doctorSlotInfo?.bookingMode === "sequential_queue" ? "Clinic Queue Token" : format12Hour(selectedTime)}
                  </p>
                  <p className="text-[11px] text-accent truncate">
                    Dr. {selectedDoctor?.name.replace(/^Dr\.?\s*/i, "")} •{" "}
                    {selectedDoctor?.feeType === "post_consultation"
                      ? (selectedDoctor?.fees && selectedDoctor.fees > 0
                        ? `${"From"} ${formatCurrency(selectedDoctor.fees, clinic?.currency || "INR")} (${"Post-Consultation"})`
                        : "Post-Consultation")
                      : selectedDoctor?.feeType === "free"
                      ? "Free"
                      : selectedDoctor ? doctorFeeLabel(selectedDoctor, clinic?.currency || "INR") : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setBookingStep(1)}
                  className="shrink-0 text-xs font-semibold text-accent hover:text-accent bg-surface px-2.5 py-1.5 rounded-xl border border-border shadow-xs cursor-pointer min-h-[36px]"
                >
                  {"Change Slot"}
                </button>
              </div>

              {/* Patient Details Input */}
              <div className="space-y-2.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-text block">
                  {"Patient Information"}
                </label>

                {isGuest ? (
                  <div className="bg-surface-alt p-3 rounded-2xl border border-border space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-text">
                        {"Quick Booking"}
                      </p>
                      <span className="text-[10px] font-semibold text-text-secondary bg-surface px-2 py-0.5 rounded-full border border-border">
                        {"No Account Needed"}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Input
                        label={"Patient Full Name *"}
                        placeholder={"e.g. Ramesh Patel"}
                        icon={<User className="w-3.5 h-3.5" strokeWidth={1.75} />}
                        value={guestForm.name}
                        onChange={(e) => setGuestForm({ ...guestForm, name: e.target.value })}
                        required
                        autoComplete="name"
                      />
                      <Input
                        label={"Mobile Phone Number *"}
                        type="tel"
                        inputMode="tel"
                        placeholder={clinic?.countryCode && clinic.countryCode !== "IN" ? "+country code and number" : "9876543210 or +country code"}
                        icon={<Smartphone className="w-3.5 h-3.5" strokeWidth={1.75} />}
                        value={guestForm.phone}
                        onChange={(e) => setGuestForm({ ...guestForm, phone: e.target.value })}
                        required
                        autoComplete="tel"
                      />
                    </div>
                    <div>
                      <Input
                        label={"Email Address (Optional)"}
                        type="email"
                        inputMode="email"
                        placeholder="patient@example.com"
                        icon={<Mail className="w-3.5 h-3.5" strokeWidth={1.75} />}
                        value={guestForm.email}
                        onChange={(e) => setGuestForm({ ...guestForm, email: e.target.value })}
                        autoComplete="email"
                      />
                      <p className="text-[11px] text-text-muted mt-1">{"We'll send your visit confirmation and appointment details here."}</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                  {selectableFamilyMembers.length > 0 && <Select
                    label="Who is this appointment for?"
                    value={selectedPatientId}
                    onChange={(event) => setSelectedPatientId(event.target.value)}
                    options={[{ value: "", label: `Myself (${user?.name || "Patient"})` }, ...selectableFamilyMembers.flatMap((member) => {
                      const patientId = member.patient?.id || member.patient?._id;
                      return patientId && member.patient?.name ? [{ value: patientId, label: `${member.patient.name}${member.relationship ? ` (${member.relationship})` : ""}` }] : [];
                    })]}
                  />}
                  <div className="bg-surface-alt border border-border p-3.5 rounded-2xl flex items-center justify-between">
                    <div>
                      <p className="text-xs text-text font-semibold flex items-center gap-1.5">
                        <UserCheck className="w-4 h-4 text-accent" strokeWidth={1.75} />
                        <span>{"Signed in as:"} <strong className="text-text">{user?.name}</strong></span>
                      </p>
                      <p className="text-[11px] text-text-secondary mt-0.5">
                        {(user as any)?.phone || user?.email || "Authenticated Account"}
                      </p>
                    </div>
                    <Badge variant="neutral" className="text-[10px] font-semibold">{"Logged In"}</Badge>
                  </div>
                  </div>
                )}
              </div>

              {/* Payment Preference */}
              {selectedDoctor?.feeType === "post_consultation" ? (
                <div className="p-3.5 bg-warning/10 border border-warning/20 rounded-2xl space-y-1">
                  <div className="flex items-center gap-2 text-warning-text dark:text-warning-text font-bold text-xs">
                    <Building2 className="w-4 h-4 shrink-0" strokeWidth={1.75} />
                    <span>{"Post-Consultation Billing"}{selectedDoctor?.fees && selectedDoctor.fees > 0 ? ` • Min. ${formatCurrency(selectedDoctor.fees, clinic?.currency || "INR")} ${"visit charge"}` : ""}</span>
                  </div>
                  <p className="text-[11px] text-text-secondary leading-relaxed">
                    {selectedDoctor?.fees && selectedDoctor.fees > 0
                      ? `A minimum visit charge of ${formatCurrency(selectedDoctor.fees, clinic?.currency || "INR")} applies. Dr. ${selectedDoctor?.name.replace(/^Dr\.?\s*/i, "")} will determine the final consultation fee after your visit, which will be billed at the clinic reception.`
                      : `No upfront payment is required today. Dr. ${selectedDoctor?.name.replace(/^Dr\.?\s*/i, "")} will determine the consultation fee after your visit, which will be billed at the clinic reception.`}
                  </p>
                </div>
              ) : selectedDoctor?.feeType === "free" ? (
                <div className="p-3.5 bg-success/10 border border-success/20 rounded-2xl space-y-1">
                  <div className="flex items-center gap-2 text-success-text dark:text-success-text font-bold text-xs">
                    <span>✨ {"Complimentary Consultation"}</span>
                  </div>
                  <p className="text-[11px] text-text-secondary leading-relaxed">
                    {"This consultation is free of charge. No payment is required."}
                  </p>
                </div>
              ) : selectedDoctor?.fees && selectedDoctor.fees > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold uppercase tracking-wider text-text block">
                      {"Payment Preference"}
                    </label>
                    <span className="text-xs font-bold text-success-text dark:text-success-text">
                      {formatCurrency(selectedDoctor.fees, clinic?.currency || "INR")}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setPaymentMode("pay_at_clinic")}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer min-h-[56px] ${
                        paymentMode === "pay_at_clinic"
                          ? "bg-primary-600/10 border-primary-600 text-accent font-bold shadow-xs ring-1 ring-focus-ring"
                          : "bg-surface border-border text-text hover:border-border"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-text-muted shrink-0" strokeWidth={1.75} />
                        <span className="text-xs font-bold">{"Pay at Clinic Reception"}</span>
                      </div>
                      <span className="text-[10px] text-text-muted block mt-1 pl-6">{"Pay"} {formatCurrency(selectedDoctor.fees, clinic?.currency || "INR")} {"at the desk upon arrival"}</span>
                    </button>

                    {(!clinic?.countryCode || clinic.countryCode === "IN") && (!clinic?.currency || clinic.currency === "INR") && <button
                      type="button"
                      onClick={() => setPaymentMode("online")}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer min-h-[56px] ${
                        paymentMode === "online"
                          ? "bg-primary-600/10 border-primary-600 text-accent font-bold shadow-xs ring-1 ring-focus-ring"
                          : "bg-surface border-border text-text hover:border-border"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-text-muted shrink-0" strokeWidth={1.75} />
                        <span className="text-xs font-bold">{"Pay Online Now"}</span>
                      </div>
                      <span className="text-[10px] text-text-muted block mt-1 pl-6">{"Pay"} {formatCurrency(selectedDoctor.fees, clinic?.currency || "INR")} {"via UPI / Card"}</span>
                    </button>}
                  </div>
                </div>
              ) : null}

              {/* Optional Reason for Visit */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-text">{"Reason for Visit / Symptoms (Optional)"}</label>
                <Input
                  placeholder={"e.g. Fever, routine follow-up, pediatric checkup"}
                  icon={<FileText className="w-3.5 h-3.5" strokeWidth={1.75} />}
                  value={bookingNotes}
                  onChange={(e) => setBookingNotes(e.target.value)}
                />
              </div>


            </div>
          )}
          </fieldset>
        </form>
        </>}
        {ticketModalOpen &&
        <div className="booking-confirmation text-center space-y-4 py-1">
          <p role="status" className="sr-only">{appointmentBookingLabel(createdTicket?.status)}</p>
          <div className="p-5 bg-surface-alt/70 border border-border/70 rounded-2xl space-y-3">
            <div aria-hidden="true" className={`booking-confirmation-mark w-14 h-14 mx-auto rounded-full flex items-center justify-center ${createdTicket?.status === "confirmed" ? "bg-success-subtle text-success-text" : "bg-surface text-text-secondary border border-border"}`}>
              {createdTicket?.status === "confirmed" ? <CheckCircle2 className="w-7 h-7" strokeWidth={1.75} /> : <Clock className="w-6 h-6" strokeWidth={1.75} />}
            </div>
            <div>
              <h2 className="text-xl font-bold text-text">Appointment booked</h2>
              <p className="text-sm text-text-secondary">{appointmentBookingLabel(createdTicket?.status)}. Keep your private tracker link for updates.</p>
            </div>
            <div>
              <span className="text-3xl font-black text-text block">
                #{createdTicket?.tokenNumber}
              </span>
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mt-0.5">{"Appointment Token"}</p>
            </div>

            {createdTicket?.status === "pending_payment" && <p className="mb-4 text-sm text-text-muted">Payment is required before confirmation. Contact clinic reception for verified payment instructions. Your private tracker shows the visit details.</p>}
            {createdTicket?.paymentError && <div role="alert" className="mb-4 text-sm text-error"><p>{createdTicket.paymentError}</p><Button variant="outline" size="sm" loading={retryingPaymentSetup} onClick={retryTicketPaymentSetup}>Retry payment setup</Button></div>}
            {createdTicket && (
              <div className="booking-confirmation-details pt-4 border-t border-border/70 text-sm text-text-secondary space-y-2.5 text-left [&>div]:gap-4 [&>div>span]:shrink-0 [&_strong]:text-right [&_strong]:break-words [&_strong]:min-w-0">
                <div className="flex justify-between">
                  <span>{"Patient:"}</span>
                  <strong className="text-text">{createdTicket.patientName}</strong>
                </div>
                <div className="flex justify-between">
                  <span>{"Doctor:"}</span>
                  <strong className="text-text">Dr. {createdTicket.doctorName}</strong>
                </div>
                {createdTicket.clinicName && <div className="flex justify-between">
                  <span>{"Clinic:"}</span>
                  <strong className="text-text">{createdTicket.clinicName}</strong>
                </div>}
                <div className="flex justify-between">
                  <span>{"Date:"}</span>
                  <strong className="text-text">{createdTicket.selectedDate}</strong>
                </div>
                <div className="flex justify-between">
                  <span>{"Time / Mode:"}</span>
                  <strong className="text-text">
                    {createdTicket.bookingMode === "sequential_queue" ? "Clinic Queue Token" : format12Hour(createdTicket.selectedTime)}
                  </strong>
                </div>
                {createdTicket.fees !== undefined && (
                  <div className="flex justify-between">
                    <span>{"Fee:"}</span>
                    <strong className="text-success-text dark:text-success-text">
                      {typeof createdTicket.fees === "string" ? createdTicket.fees : formatCurrency(createdTicket.fees, clinic?.currency || "INR")} ({appointmentPaymentLabel(createdTicket.paymentStatus)})
                    </strong>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="p-3 bg-surface-alt rounded-xl border border-border text-xs text-left space-y-1">
            <p className="font-semibold text-text flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-text-muted" strokeWidth={1.75} />
              <span>{"Next Steps:"}</span>
            </p>
            <p className="text-text-secondary text-[11px] leading-relaxed">
              {"Please arrive at the clinic 10-15 minutes prior to your consultation time. Present this token at the reception desk upon arrival."}
            </p>
          </div>

          {/* Live Mobile Tracker Hub */}
          {createdTicket?.appointmentId && (
            <div className="p-3.5 bg-surface-alt rounded-2xl border border-border text-left space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-text flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-accent" strokeWidth={1.75} />
                  <span>{"Live Visit Status & Tracker"}</span>
                </span>
                <span className="text-[10px] bg-surface text-text-secondary font-semibold px-2 py-0.5 rounded-full border border-border">
                  {"Zero Login Required"}
                </span>
              </div>
              <p className="text-[11px] text-text-muted leading-relaxed">
                {"Track live waiting time, see when your turn is coming, or self check-in upon arrival directly from your phone."}
              </p>
              <div className="flex gap-2 pt-1">
                <Link href={`/track/${createdTicket.appointmentId}${createdTicket.trackerToken ? `?t=${encodeURIComponent(createdTicket.trackerToken)}` : ""}`} target="_blank" className="w-full">
                  <Button size="sm" className="w-full text-xs font-bold rounded-xl shadow-xs min-h-[44px] flex items-center justify-center gap-1">
                    <span>{"Open Live Tracker"}</span>
                    <ExternalLink className="w-3 h-3" strokeWidth={1.75} />
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 text-xs rounded-xl min-h-[44px] flex items-center justify-center gap-1 px-3"
                  onClick={() => {
                    const trackingUrl = `${window.location.origin}/track/${createdTicket.appointmentId}${createdTicket.trackerToken ? `?t=${encodeURIComponent(createdTicket.trackerToken)}` : ""}`;
                    navigator.clipboard.writeText(trackingUrl);
                    toast({ title: "Private link copied", description: "Anyone with this link can view this appointment's tracker. Share it only with people you trust.", variant: "success" });
                  }}
                  title={"Copy Link"}
                >
                  <Copy className="w-3.5 h-3.5" strokeWidth={1.75} />
                  <span className="hidden xs:inline">{"Copy Link"}</span>
                </Button>
              </div>
            </div>
          )}

          {/* Action Buttons Hub */}
          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row gap-2">
              {isGuest ? <Button
                variant="outline"
                size="sm"
                className="w-full font-bold min-h-[44px]"
                onClick={() => { setTicketModalOpen(false); router.push("/login"); }}
              >Verify your phone to manage appointments</Button> : <Button
                variant="primary"
                size="sm"
                className="w-full font-bold min-h-[44px] flex items-center justify-center gap-1.5"
                onClick={() => {
                  setTicketModalOpen(false);
                  router.push("/dashboard/appointments");
                }}
              >
                <Calendar className="w-3.5 h-3.5" strokeWidth={1.75} />
                <span>{"My Appointments"}</span>
              </Button>}
            </div>
          </div>
        </div>}
      </BookingSurface>

      {/* Photo Gallery Lightbox Modal */}
      {lightboxIndex !== null && clinic.images && clinic.images.length > 0 && (
        <div
          ref={lightboxRef}
          id="clinic-photo-gallery"
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label="Photo gallery"
          className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-4  animate-fade-in"
          onClick={() => setLightboxIndex(null)}
        >
          <button
            type="button"
            className="absolute top-4 right-4 text-brand-mist/80 hover:text-brand-mist p-2.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors cursor-pointer z-20"
            onClick={() => setLightboxIndex(null)}
            aria-label="Close photo viewer"
          >
            <X className="w-6 h-6" />
          </button>

          <div
            {...galleryGesture.handlers}
            className="relative max-w-4xl max-h-[80vh] w-full flex items-center justify-center [touch-action:pan-y_pinch-zoom]"
            onClick={(e) => e.stopPropagation()}
          >
            <LoadingImage
              src={clinic.images[lightboxIndex]}
              alt={`Facility showcase ${lightboxIndex + 1}`}
              draggable={false}
              className="max-w-full max-h-[75vh] object-contain rounded-2xl shadow-lg border border-white/10"
            />

            {clinic.images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => setLightboxIndex((lightboxIndex - 1 + clinic.images!.length) % clinic.images!.length)}
                  className="absolute left-2 sm:-left-14 p-2.5 rounded-full bg-white/10 hover:bg-white/30 text-brand-mist transition-colors cursor-pointer"
                  aria-label="Previous photo"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                  type="button"
                  onClick={() => setLightboxIndex((lightboxIndex + 1) % clinic.images!.length)}
                  className="absolute right-2 sm:-right-14 p-2.5 rounded-full bg-white/10 hover:bg-white/30 text-brand-mist transition-colors cursor-pointer"
                  aria-label="Next photo"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </>
            )}
          </div>

          <p className="text-brand-mist/80 text-xs font-semibold mt-4">
            Photo {lightboxIndex + 1} of {clinic.images.length} — {clinic.name}
          </p>
        </div>
      )}
    </div>
  );
}
