"use client";

import { useEffect, useState } from "react";
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

export default function BrowseDetailClient({ id }: { id: string }) {
  const renderTimings = (timingsStr: string | null | undefined, compact = false) => {
    if (!timingsStr) return <span className="text-xs text-text-secondary">Mon–Fri: 9:00 AM – 6:00 PM</span>;
    try {
      const data = JSON.parse(timingsStr);
      const days = Object.keys(data);
      if (days.length === 0) return <span className="text-xs text-text-secondary">{timingsStr}</span>;

      const grouped: Record<string, string[]> = {};
      for (const day of days) {
        const slots = data[day];
        if (!slots || slots.length === 0) continue;
        const slotsStr = slots.map((s: any) => `${s.start} - ${s.end}`).join(", ");
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

  // Guest Registration State
  const [isGuest, setIsGuest] = useState(false);
  const [guestForm, setGuestForm] = useState({ name: "", email: "", password: "", phone: "" });

  // Visual Slots Picker State
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");

  // Printable Ticket Modal State
  const [ticketModalOpen, setTicketModalOpen] = useState(false);
  const [createdTicket, setCreatedTicket] = useState<any>(null);

  const resetBookingForm = () => {
    setBookingNotes("");
    setGuestForm({ name: "", email: "", password: "", phone: "" });
    setSelectedDate("");
    setSelectedTime("");
    setFollowUpForAppointmentId(null);
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

  const handleOpenBooking = (doc: Doctor) => {
    setSelectedDoctor(doc);
    setIsBookingOpen(true);
    setIsGuest(!isAuthenticated || user?.role !== "patient");
    resetBookingForm();
  };

  const handleBookAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDate || !selectedTime) {
      toast({ title: "Validation Error", description: "Please choose a date and time slot.", variant: "error" });
      return;
    }

    setBookingLoading(true);
    const mergedBookingTime = `${selectedDate}T${selectedTime}`;

    try {
      if (isGuest) {
        const regRes = await api.post("/auth/register", {
          name: guestForm.name,
          email: guestForm.email,
          password: guestForm.password,
          phone: guestForm.phone,
        });
        login(regRes.data.data.user);
        toast({ title: "Account Created", description: "You are now logged in as a patient.", variant: "success", duration: 4000 });
      }

      const res = await api.post("/appointments", {
        clinicId: id,
        doctorId: selectedDoctor!.id,
        appointmentTime: mergedBookingTime,
        appointmentType: "online",
        notes: bookingNotes,
        followUpForAppointmentId: followUpForAppointmentId || undefined,
      });
      const token = res.data.data.tokenNumber;

      setCreatedTicket({
        tokenNumber: token,
        patientName: isGuest ? guestForm.name : user?.name || "Patient",
        appointmentTime: mergedBookingTime,
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

  // Generate next 5 working days starting from TODAY (i = 0)
  const generateUpcomingDays = (timingsStr: string | null | undefined) => {
    if (!timingsStr) return [];
    try {
      const schedule = JSON.parse(timingsStr);
      const activeDays = Object.keys(schedule).map((d) => d.toLowerCase());
      if (activeDays.length === 0) return [];

      const daysOfWeek = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
      const list = [];
      const current = new Date();

      for (let i = 0; i <= 30; i++) {
        const testDate = new Date();
        testDate.setDate(current.getDate() + i);
        const dayName = daysOfWeek[testDate.getDay()];
        if (activeDays.includes(dayName)) {
          const isToday = i === 0;
          const label = isToday
            ? "Today"
            : testDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

          list.push({
            dateString: testDate.toISOString().split("T")[0],
            label,
            dayName,
            isToday,
          });
          if (list.length >= 5) break;
        }
      }
      return list;
    } catch {
      return [];
    }
  };

  // Generate time slots filtering out past times for today
  const generateTimeSlots = (timingsStr: string | null | undefined, dayName: string, selectedDateStr?: string) => {
    if (!timingsStr || !dayName) return [];
    try {
      const schedule = JSON.parse(timingsStr);
      const key = Object.keys(schedule).find((k) => k.toLowerCase() === dayName.toLowerCase());
      if (!key) return [];
      const intervals = schedule[key];

      const now = new Date();
      const isToday = selectedDateStr === now.toISOString().split("T")[0];
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      const slots: string[] = [];
      intervals.forEach((interval: { start: string; end: string }) => {
        const [startH, startM] = interval.start.split(":").map(Number);
        const [endH, endM] = interval.end.split(":").map(Number);

        let currMinutes = startH * 60 + startM;
        const endMinutes = endH * 60 + endM;

        while (currMinutes + 30 <= endMinutes) {
          if (!isToday || currMinutes > currentMinutes) {
            const h = Math.floor(currMinutes / 60);
            const m = currMinutes % 60;
            const timeStr = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
            slots.push(timeStr);
          }
          currMinutes += 30;
        }
      });
      return slots;
    } catch {
      return [];
    }
  };

  const handlePrintSlip = () => {
    if (!createdTicket) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>Appointment Slip - #${createdTicket.tokenNumber}</title>
          <style>
            body { font-family: sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f3f4f6; padding: 20px; }
            .ticket { background: white; border: 1px solid #e5e7eb; border-radius: 16px; padding: 32px; width: 380px; text-align: left; }
            .header { text-align: center; border-bottom: 2px dashed #e5e7eb; padding-bottom: 20px; margin-bottom: 20px; }
            .token-num { font-size: 48px; font-weight: 800; color: #2563eb; margin: 4px 0; text-align: center; }
          </style>
        </head>
        <body>
          <div class="ticket">
            <div class="header">
              <h1>${clinic?.name}</h1>
              <p>${clinic?.address}</p>
            </div>
            <div class="token-num">#${createdTicket.tokenNumber}</div>
            <p><strong>Patient:</strong> ${createdTicket.patientName}</p>
            <p><strong>Doctor:</strong> Dr. ${selectedDoctor?.name}</p>
            <p><strong>Time:</strong> ${new Date(createdTicket.appointmentTime).toLocaleString()}</p>
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

  const upcomingDays = generateUpcomingDays(selectedDoctor?.timings);

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

      {/* Inset Rounded Clinic Header Banner */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6">
        <div className="bg-surface border border-border rounded-2xl overflow-hidden shadow-sm">
          <div className="h-56 sm:h-72 w-full relative bg-surface-alt overflow-hidden">
            {clinic.image_url ? (
              <img src={clinic.image_url} alt={clinic.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-primary-600/15 via-primary-500/5 to-blue-600/10 p-6 text-center">
                <div className="w-16 h-16 rounded-2xl bg-primary-600/10 border border-primary-500/20 flex items-center justify-center mb-3 shadow-xs">
                  <span className="text-3xl">🏥</span>
                </div>
                <span className="text-base font-bold text-text">{clinic.name}</span>
                <span className="text-xs text-text-muted mt-0.5">Accredited Healthcare Pavilion</span>
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
                <span className="text-primary-600 text-sm" title="Verified Facility">✓</span>
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
                <h4 className="text-xs font-bold text-text mb-2 uppercase tracking-wider">Operating Hours</h4>
                {renderTimings(clinic.timings)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Specialists Practitioner Cards (Zocdoc / Practo Style) */}
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

      {/* Booking Modal */}
      <Modal
        open={isBookingOpen}
        onClose={() => setIsBookingOpen(false)}
        title={`Book Consultation — Dr. ${selectedDoctor?.name}`}
        size="md"
      >
        <form onSubmit={handleBookAppointment} className="space-y-4 pt-1">
          <div className="p-3.5 bg-surface-alt rounded-xl border border-border flex items-center justify-between">
            <div>
              <p className="font-bold text-text text-sm">{selectedDoctor?.specialization}</p>
              <p className="text-xs text-text-secondary mt-0.5">
                Fee: <span className="font-bold text-emerald-600 dark:text-emerald-400">₹{selectedDoctor?.fees}</span>
              </p>
            </div>
            <Badge variant="success" className="text-[10px] font-bold">
              Available
            </Badge>
          </div>

          {isGuest && (
            <div className="space-y-3 border-l-2 border-primary-500 pl-4 py-1">
              <p className="text-xs font-bold text-primary-600 uppercase tracking-wider">Patient Registration Details:</p>
              <Input label="Full Name *" value={guestForm.name} onChange={(e) => setGuestForm({ ...guestForm, name: e.target.value })} required />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input label="Email Address *" type="email" value={guestForm.email} onChange={(e) => setGuestForm({ ...guestForm, email: e.target.value })} required />
                <Input label="Password *" type="password" placeholder="Create password" value={guestForm.password} onChange={(e) => setGuestForm({ ...guestForm, password: e.target.value })} required />
              </div>
              <Input label="Phone Number" placeholder="e.g. +1 555-0199" value={guestForm.phone} onChange={(e) => setGuestForm({ ...guestForm, phone: e.target.value })} />
            </div>
          )}

          {!isGuest && (
            <div className="bg-primary-500/10 border border-primary-500/20 p-3 rounded-xl">
              <p className="text-xs text-text-secondary">
                Patient Account: <strong className="text-text">{user?.name}</strong> ({user?.email})
              </p>
            </div>
          )}

          {/* Schedule Date & Time Picker */}
          <div className="space-y-3 pt-3 border-t border-border/50">
            <label className="text-xs font-bold uppercase tracking-wider text-text block">Select Consultation Date *</label>
            {upcomingDays.length === 0 ? (
              <p className="text-xs text-danger-500">No active schedules configured for this clinic location.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {upcomingDays.map((d) => (
                  <button
                    key={d.dateString}
                    type="button"
                    onClick={() => {
                      setSelectedDate(d.dateString);
                      setSelectedTime("");
                    }}
                    className={`p-2 rounded-xl border text-center cursor-pointer transition-all duration-150 ${
                      selectedDate === d.dateString
                        ? "bg-primary-600 text-white border-primary-600 font-bold shadow-xs"
                        : "bg-surface text-text-secondary border-border hover:bg-surface-hover"
                    }`}
                  >
                    <span className="text-[10px] block capitalize">{d.dayName.substring(0, 3)}</span>
                    <span className="text-xs font-bold">{d.label}</span>
                  </button>
                ))}
              </div>
            )}

            {selectedDate && (
              <div className="space-y-2 border-t border-border/40 pt-3">
                <label className="text-xs font-bold uppercase tracking-wider text-text block">Select Available Time Slot *</label>
                {(() => {
                  const dayName = upcomingDays.find((d) => d.dateString === selectedDate)?.dayName || "";
                  const slots = generateTimeSlots(selectedDoctor?.timings, dayName, selectedDate);

                  if (slots.length === 0) {
                    return <p className="text-xs text-text-muted">No available timeslots left for this date.</p>;
                  }

                  return (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-44 overflow-y-auto pr-1">
                      {slots.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setSelectedTime(s)}
                          className={`py-1.5 px-2 rounded-lg border text-center text-xs font-medium cursor-pointer transition-all ${
                            selectedTime === s
                              ? "bg-primary-600 text-white border-primary-600 font-bold"
                              : "bg-surface text-text-secondary border-border hover:bg-surface-hover"
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-border/40 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setIsBookingOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" loading={bookingLoading} disabled={!selectedDate || !selectedTime}>
              Confirm Booking
            </Button>
          </div>
        </form>
      </Modal>

      {/* Ticket Slip Modal */}
      <Modal
        open={ticketModalOpen}
        onClose={() => setTicketModalOpen(false)}
        title="Appointment Confirmed! 🎉"
        size="sm"
      >
        <div className="text-center space-y-4 py-2">
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
            <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400">
              #{createdTicket?.tokenNumber}
            </span>
            <p className="text-xs font-bold text-text mt-1">Queue Token Number</p>
          </div>

          <p className="text-xs text-text-secondary">
            Your appointment has been registered. Please present this token slip upon arrival at the clinic.
          </p>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="w-full" onClick={() => setTicketModalOpen(false)}>
              Close
            </Button>
            <Button variant="primary" size="sm" className="w-full" onClick={handlePrintSlip}>
              Print Slip 🖨️
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
