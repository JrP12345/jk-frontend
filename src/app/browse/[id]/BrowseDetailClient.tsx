"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { Card, CardContent, Spinner, Button, Modal, Input, useToast, Badge } from "@/components/ui";
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
    if (!timingsStr) return <span className="text-sm text-text-secondary">Not specified</span>;
    try {
      const data = JSON.parse(timingsStr);
      const days = Object.keys(data);
      if (days.length === 0) return <span className="text-sm text-text-secondary">{timingsStr}</span>;
      
      const grouped: Record<string, string[]> = {};
      for (const day of days) {
        const slots = data[day];
        if (!slots || slots.length === 0) continue;
        const slotsStr = slots.map((s: any) => `${s.start} - ${s.end}`).join(", ");
        if (!grouped[slotsStr]) grouped[slotsStr] = [];
        grouped[slotsStr].push(day.substring(0, 3));
      }

      const allDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
      const groups = Object.keys(grouped).map(slotsStr => {
        const daysArr = grouped[slotsStr];
        let daysLabel = daysArr.join(", ");
        
        if (daysArr.length > 2) {
          const firstIdx = allDays.indexOf(daysArr[0]);
          const lastIdx = allDays.indexOf(daysArr[daysArr.length - 1]);
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
        <div className={`flex flex-col gap-1.5 ${compact ? 'mt-2' : 'mt-1'}`}>
          {groups.map((g, idx) => (
            <div key={idx} className="flex justify-between items-start text-xs bg-surface-hover/50 p-1.5 px-2 rounded-md border border-border/50">
              <span className="font-semibold text-text-secondary pt-0.5">{g.daysLabel}</span>
              <span className="text-text-muted bg-surface py-0.5 px-1.5 rounded text-[11px] shadow-sm font-medium border border-border/40 whitespace-nowrap">
                {g.slotsStr}
              </span>
            </div>
          ))}
        </div>
      );
    } catch (e) {
      return <span className="text-sm text-text-secondary">{timingsStr}</span>;
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

  // Printable Slip State
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
      } catch (err) {
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
      // If guest, register them first
      if (isGuest) {
        const regRes = await api.post("/auth/register", {
          name: guestForm.name,
          email: guestForm.email,
          password: guestForm.password,
          phone: guestForm.phone
        });
        login(regRes.data.data.user);
        toast({ title: "Account Created", description: "You are now logged in as a patient.", variant: "success", duration: 4000 });
      }

      // Book the appointment
      const res = await api.post("/appointments", {
        clinicId: id,
        doctorId: selectedDoctor!.id,
        appointmentTime: mergedBookingTime,
        appointmentType: "online",
        notes: bookingNotes,
        followUpForAppointmentId: followUpForAppointmentId || undefined
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
        duration: 4000
      });
    } finally {
      setBookingLoading(false);
    }
  };

  // Helper to generate the next 5 working days for the doctor
  const generateUpcomingDays = (timingsStr: string | null | undefined) => {
    if (!timingsStr) return [];
    try {
      const schedule = JSON.parse(timingsStr);
      const activeDays = Object.keys(schedule).map(d => d.toLowerCase());
      if (activeDays.length === 0) return [];

      const daysOfWeek = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
      const list = [];
      let current = new Date();
      // Start checking from tomorrow
      for (let i = 1; i <= 30; i++) {
        const testDate = new Date();
        testDate.setDate(current.getDate() + i);
        const dayName = daysOfWeek[testDate.getDay()];
        if (activeDays.includes(dayName)) {
          list.push({
            dateString: testDate.toISOString().split("T")[0], // YYYY-MM-DD
            label: testDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
            dayName
          });
          if (list.length >= 5) break;
        }
      }
      return list;
    } catch (e) {
      return [];
    }
  };

  // Helper to generate time slots for a specific day
  const generateTimeSlots = (timingsStr: string | null | undefined, dayName: string) => {
    if (!timingsStr || !dayName) return [];
    try {
      const schedule = JSON.parse(timingsStr);
      const key = Object.keys(schedule).find(k => k.toLowerCase() === dayName.toLowerCase());
      if (!key) return [];
      const intervals = schedule[key];
      
      const slots: string[] = [];
      intervals.forEach((interval: { start: string; end: string }) => {
        const [startH, startM] = interval.start.split(":").map(Number);
        const [endH, endM] = interval.end.split(":").map(Number);
        
        let currMinutes = startH * 60 + startM;
        const endMinutes = endH * 60 + endM;
        
        while (currMinutes + 30 <= endMinutes) {
          const h = Math.floor(currMinutes / 60);
          const m = currMinutes % 60;
          const timeStr = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
          slots.push(timeStr);
          currMinutes += 30;
        }
      });
      return slots;
    } catch (e) {
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
          <title>Appointment Token Slip - #${createdTicket.tokenNumber}</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f3f4f6; padding: 20px; }
            .ticket { background: white; border: 1px solid #e5e7eb; border-radius: 16px; padding: 32px; width: 380px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); text-align: left; }
            .header { text-align: center; border-bottom: 2px dashed #e5e7eb; padding-bottom: 20px; margin-bottom: 20px; }
            .brand { font-size: 12px; font-weight: 800; color: #2563eb; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 4px; }
            .clinic-name { font-size: 18px; font-weight: 700; color: #1f2937; margin: 0; }
            .token-box { text-align: center; margin: 16px 0; }
            .token-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; font-weight: 600; }
            .token-num { font-size: 48px; font-weight: 800; color: #2563eb; margin: 4px 0; line-height: 1; }
            .details { font-size: 13px; color: #4b5563; }
            .row { display: flex; justify-content: space-between; margin-bottom: 8px; }
            .label { font-weight: 500; color: #6b7280; }
            .val { font-weight: 600; color: #1f2937; text-align: right; }
            .footer { border-top: 1px solid #f3f4f6; margin-top: 24px; padding-top: 16px; text-align: center; font-size: 11px; color: #9ca3af; }
            @media print {
              body { background: white; padding: 0; }
              .ticket { box-shadow: none; border: 1px solid #000; }
            }
          </style>
        </head>
        <body>
          <div class="ticket">
            <div class="header">
              <div class="brand">MedLife HealthOS</div>
              <h1 class="clinic-name">${clinic?.name}</h1>
              <p style="margin: 4px 0 0; font-size: 12px; color: #6b7280;">${clinic?.address}</p>
            </div>
            <div class="token-box">
              <span class="token-label">Queue Token Number</span>
              <div class="token-num">#${createdTicket.tokenNumber}</div>
              <span style="font-size: 12px; color: #10b981; font-weight: 700;">✓ Booked Successfully</span>
            </div>
            <div class="details">
              <div class="row">
                <span class="label">Patient Name:</span>
                <span class="val">${createdTicket.patientName}</span>
              </div>
              <div class="row">
                <span class="label">Practitioner:</span>
                <span class="val">Dr. ${selectedDoctor?.name}</span>
              </div>
              <div class="row">
                <span class="label">Specialty:</span>
                <span class="val">${selectedDoctor?.specialization}</span>
              </div>
              <div class="row">
                <span class="label">Appt Time:</span>
                <span class="val">${new Date(createdTicket.appointmentTime).toLocaleString()}</span>
              </div>
            </div>
            <div class="footer">
              Please present this slip at the front desk upon arrival.<br>
              Powered by HealthOS Security Queue Systems.
            </div>
          </div>
          <script>
            window.onload = () => { window.print(); window.close(); };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  if (loading) return <div className="min-h-screen flex justify-center items-center bg-surface-alt"><Spinner size="lg" /></div>;
  if (!clinic) return null;

  const upcomingDays = generateUpcomingDays(selectedDoctor?.timings);

  return (
    <div className="min-h-screen bg-surface-alt pt-16 pb-20">
      <MarketplaceNavbar />

      {/* Breadcrumbs */}
      <div className="bg-surface border-b border-border/40 px-6 py-3 shrink-0">
        <div className="max-w-6xl mx-auto flex items-center gap-2 text-xs font-semibold text-text-secondary">
          <Link href="/browse" className="hover:text-primary-600 transition-colors">Browse Clinics</Link>
          <span className="text-text-muted">&gt;</span>
          <span className="text-text truncate">{clinic.name}</span>
        </div>
      </div>

      {/* Clinic Banner */}
      <div className="bg-surface border-b border-border">
        <div className="max-w-6xl mx-auto">
          <div className="h-64 md:h-80 w-full relative bg-surface-hover overflow-hidden">
            {clinic.image_url ? (
              <img src={clinic.image_url} alt={clinic.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-r from-primary-600 to-indigo-600 text-white">
                <svg className="w-24 h-24 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
            )}
            <div className="absolute top-4 left-4">
              <span className="bg-white/95 dark:bg-surface/95 backdrop-blur-sm text-primary-800 dark:text-primary-300 text-xs font-bold px-3.5 py-1.5 rounded-full shadow-md">
                {clinic.city}
              </span>
            </div>
          </div>

          {/* Title Area */}
          <div className="p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="space-y-2">
              <h1 className="text-3xl font-extrabold text-text tracking-tight">{clinic.name}</h1>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-text-secondary">
                <div className="flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-text-muted shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  <span>{clinic.address}</span>
                </div>
                <span className="hidden sm:inline text-text-muted">•</span>
                <div className="flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-text-muted shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.988-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                  <span>{clinic.phone || "No phone listed"}</span>
                </div>
              </div>
              
              {/* Facilities Badges */}
              {clinic.facilities && clinic.facilities.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-2">
                  {clinic.facilities.map((fac, idx) => (
                    <Badge key={idx} variant="primary" className="font-semibold text-xs px-2.5">
                      {fac}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6 md:p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* About & Timing Info */}
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardContent className="p-6 space-y-6">
              <div>
                <h3 className="text-base font-bold text-text mb-2 border-b border-border pb-1">About Clinic</h3>
                <p className="text-sm text-text-secondary leading-relaxed">
                  {clinic.description || "A premier HealthOS clinic offering comprehensive medical services and specialized practitioner care."}
                </p>
              </div>

              <div>
                <h3 className="text-base font-bold text-text mb-2 border-b border-border pb-1">Operating Hours</h3>
                <div className="mt-2">
                  {renderTimings(clinic.timings)}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Doctor Practitioner Directory */}
        <div className="lg:col-span-2 space-y-6">
          <h2 className="text-2xl font-bold text-text">Our Specialists</h2>
          
          {clinic.doctors.length === 0 ? (
            <Card className="text-center py-12 text-text-secondary text-sm">
              No medical specialists registered at this location currently.
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {clinic.doctors.map((doc) => (
                <Card key={doc.id} className="overflow-hidden hover:shadow-md transition-shadow flex flex-col border border-border">
                  <div className="p-5 flex-1 flex flex-col">
                    <div className="flex items-start gap-4">
                      {doc.image_url ? (
                        <img src={doc.image_url} alt={doc.name} className="w-12 h-12 rounded-full object-cover shadow-sm mt-1" />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-950 text-primary-700 dark:text-primary-300 flex items-center justify-center font-bold shadow-sm shrink-0 text-sm mt-1">
                          Dr
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 text-xs text-warning-500 font-bold">
                          <span>★</span>
                          <span>{doc.rating || 5.0}</span>
                          <span className="text-text-muted font-normal">({doc.reviewsCount || 0})</span>
                        </div>
                        <h3 className="text-base font-bold text-text line-clamp-1 mt-0.5">Dr. {doc.name}</h3>
                        <p className="text-primary-600 dark:text-primary-400 font-semibold text-xs mt-0.5">{doc.specialization}</p>
                        <p className="text-[11px] text-text-secondary truncate mt-0.5">{doc.qualification}</p>
                      </div>
                    </div>

                    <p className="text-xs text-text-secondary mt-4 line-clamp-3 leading-relaxed flex-1">
                      {doc.description || "Dedicated medical professional providing customized clinical diagnostics and treatments."}
                    </p>

                    <div className="grid grid-cols-2 gap-y-3 gap-x-2 mt-6 pt-4 border-t border-border/50 text-xs">
                      <div>
                        <span className="text-[10px] text-text-muted block mb-0.5">Experience</span>
                        <span className="font-semibold text-text">{doc.experience_years ? `${doc.experience_years}+ Years` : "N/A"}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-text-muted block mb-0.5">Consultation Fee</span>
                        <span className="font-bold text-success-600 dark:text-success-400">₹{doc.fees}</span>
                      </div>
                      {doc.languages && doc.languages.length > 0 && (
                        <div className="col-span-2">
                          <span className="text-[10px] text-text-muted block mb-0.5">Languages</span>
                          <span className="font-semibold text-text">{doc.languages.join(", ")}</span>
                        </div>
                      )}
                      <div className="col-span-2">
                        <span className="text-[10px] text-text-muted block mb-0.5">Weekly Schedule</span>
                        <div className="mt-1">
                          {renderTimings(doc.timings, true)}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-4 bg-surface-alt border-t border-border">
                    <Button className="w-full font-semibold" onClick={() => handleOpenBooking(doc)}>
                      Book Appointment
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Booking / Registration Modal */}
      <Modal
        open={isBookingOpen}
        onClose={() => setIsBookingOpen(false)}
        title={`Book Appointment with Dr. ${selectedDoctor?.name}`}
        size="md"
      >
        <form onSubmit={handleBookAppointment} className="space-y-4">
          <div className="p-4 bg-surface-alt rounded-lg border border-border flex items-center justify-between mb-2">
            <div>
              <p className="font-semibold text-text text-sm">{selectedDoctor?.specialization}</p>
              <p className="text-xs text-text-secondary mt-0.5">Consultation Fee: <span className="font-bold text-success-600 dark:text-success-400">₹{selectedDoctor?.fees}</span></p>
            </div>
            <div className="text-right">
              <span className="bg-success-50 dark:bg-success-950/40 text-success-700 dark:text-success-400 text-xs font-bold px-2.5 py-1 rounded-full border border-success-200 dark:border-success-900/30">Available</span>
            </div>
          </div>

          {/* Account fields for Guest */}
          {isGuest && (
            <div className="space-y-3 animate-fade-in border-l-2 border-primary-500 pl-4 py-1">
              <p className="text-xs font-bold text-primary-700 dark:text-primary-400 uppercase tracking-wider mb-2">Create Patient Account:</p>
              <Input label="Full Name *" value={guestForm.name} onChange={(e) => setGuestForm({ ...guestForm, name: e.target.value })} required />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input label="Email Address *" type="email" value={guestForm.email} onChange={(e) => setGuestForm({ ...guestForm, email: e.target.value })} required />
                <Input label="Password *" type="password" placeholder="Create password" value={guestForm.password} onChange={(e) => setGuestForm({ ...guestForm, password: e.target.value })} required />
              </div>
              <Input label="Phone Number" placeholder="e.g. +1 555-0199" value={guestForm.phone} onChange={(e) => setGuestForm({ ...guestForm, phone: e.target.value })} />
            </div>
          )}

          {!isGuest && (
            <div className="animate-fade-in bg-primary-500/10 border border-primary-500/20 p-3 rounded-lg">
              <p className="text-xs text-text-secondary">
                Booking as patient: <strong className="text-text">{user?.name}</strong> ({user?.email})
              </p>
            </div>
          )}

          {/* Date & Time Slot Picker */}
          <div className="space-y-4 pt-4 border-t border-border/50">
            {/* Visual Date Selector */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-text block">Select Available Date *</label>
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
                        setSelectedTime(""); // Reset time on date change
                      }}
                      className={`p-2.5 rounded-lg border text-center cursor-pointer transition-all duration-200 ${
                        selectedDate === d.dateString
                          ? "bg-primary-600 text-white border-primary-600 shadow-sm font-semibold"
                          : "bg-surface text-text-secondary border-border hover:bg-surface-hover hover:border-text-muted"
                      }`}
                    >
                      <span className="text-[10px] block font-normal capitalize mb-0.5">{d.dayName.substring(0, 3)}</span>
                      <span className="text-xs font-bold">{d.label.split(",").slice(1).join("").trim()}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Time Slot Picker */}
            {selectedDate && (
              <div className="space-y-3 animate-fade-in border-t border-border/40 pt-4">
                <label className="text-sm font-semibold text-text block">Select Consultation Slot *</label>
                {(() => {
                  const dayName = upcomingDays.find(d => d.dateString === selectedDate)?.dayName || "";
                  const slots = generateTimeSlots(selectedDoctor?.timings, dayName);
                  
                  if (slots.length === 0) {
                    return <p className="text-xs text-text-muted">No specific timeslots configured for this day.</p>;
                  }

                  // Group slots
                  const morningSlots = slots.filter(s => {
                    const h = parseInt(s.split(":")[0]);
                    return h < 12;
                  });
                  const afternoonSlots = slots.filter(s => {
                    const h = parseInt(s.split(":")[0]);
                    return h >= 12 && h < 16;
                  });
                  const eveningSlots = slots.filter(s => {
                    const h = parseInt(s.split(":")[0]);
                    return h >= 16;
                  });

                  return (
                    <div className="space-y-4 max-h-60 overflow-y-auto pr-1">
                      {morningSlots.length > 0 && (
                        <div>
                          <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block mb-1.5">🌅 Morning</span>
                          <div className="grid grid-cols-4 gap-1.5">
                            {morningSlots.map(s => (
                              <button
                                key={s}
                                type="button"
                                onClick={() => setSelectedTime(s)}
                                className={`py-1.5 px-2 rounded-lg border text-center text-xs cursor-pointer transition-all duration-150 ${
                                  selectedTime === s
                                    ? "bg-primary-600 text-white border-primary-600 font-semibold"
                                    : "bg-surface text-text-secondary border-border hover:bg-surface-hover hover:border-text-muted"
                                }`}
                              >
                                {s}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {afternoonSlots.length > 0 && (
                        <div>
                          <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block mb-1.5">☀️ Afternoon</span>
                          <div className="grid grid-cols-4 gap-1.5">
                            {afternoonSlots.map(s => (
                              <button
                                key={s}
                                type="button"
                                onClick={() => setSelectedTime(s)}
                                className={`py-1.5 px-2 rounded-lg border text-center text-xs cursor-pointer transition-all duration-150 ${
                                  selectedTime === s
                                    ? "bg-primary-600 text-white border-primary-600 font-semibold"
                                    : "bg-surface text-text-secondary border-border hover:bg-surface-hover hover:border-text-muted"
                                }`}
                              >
                                {s}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {eveningSlots.length > 0 && (
                        <div>
                          <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block mb-1.5">🌙 Evening</span>
                          <div className="grid grid-cols-4 gap-1.5">
                            {eveningSlots.map(s => (
                              <button
                                key={s}
                                type="button"
                                onClick={() => setSelectedTime(s)}
                                className={`py-1.5 px-2 rounded-lg border text-center text-xs cursor-pointer transition-all duration-150 ${
                                  selectedTime === s
                                    ? "bg-primary-600 text-white border-primary-600 font-semibold"
                                    : "bg-surface text-text-secondary border-border hover:bg-surface-hover hover:border-text-muted"
                                }`}
                              >
                                {s}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Notes / Reason */}
            <div className="border-t border-border/40 pt-4">
              <Input
                label="Notes / Reason for visit"
                placeholder="e.g. routine checkup, persistent cough..."
                value={bookingNotes}
                onChange={(e) => setBookingNotes(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border mt-6">
            <Button variant="outline" type="button" onClick={() => setIsBookingOpen(false)}>Cancel</Button>
            <Button type="submit" loading={bookingLoading} disabled={!selectedDate || !selectedTime}>
              {isGuest ? "Register & Book" : "Confirm Booking"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Appointment Ticket Slip Modal */}
      <Modal
        open={ticketModalOpen}
        onClose={() => setTicketModalOpen(false)}
        title="Appointment Booked Successfully!"
        size="sm"
      >
        {createdTicket && (
          <div className="space-y-6 py-2">
            <div className="border border-border rounded-xl p-5 bg-surface-alt relative overflow-hidden shadow-sm">
              <div className="text-center border-b border-border/80 border-dashed pb-4 mb-4">
                <span className="text-[10px] font-extrabold text-primary-600 tracking-wider uppercase block">JK Healthcare System</span>
                <h3 className="text-base font-bold text-text mt-0.5">{clinic.name}</h3>
                <p className="text-[10px] text-text-muted mt-0.5">{clinic.address}</p>
              </div>

              <div className="text-center my-4">
                <span className="text-[10px] text-text-muted uppercase tracking-wider block font-semibold">Queue Token Number</span>
                <div className="text-4xl font-extrabold text-primary-600 tracking-tight my-1">#{createdTicket.tokenNumber}</div>
                <span className="inline-block bg-success-50 text-success-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-success-200 mt-1">
                  ✓ Confirmed & Checked-In
                </span>
              </div>

              <div className="space-y-2 text-xs text-text-secondary border-t border-border/40 pt-4">
                <div className="flex justify-between">
                  <span className="text-text-muted">Patient Name:</span>
                  <span className="font-semibold text-text">{createdTicket.patientName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Specialist Doctor:</span>
                  <span className="font-semibold text-text">Dr. {selectedDoctor?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Specialization:</span>
                  <span className="font-semibold text-text">{selectedDoctor?.specialization}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Schedule Slot:</span>
                  <span className="font-semibold text-text">
                    {new Date(createdTicket.appointmentTime).toLocaleDateString("en-US", { month: "short", day: "numeric" })} @ {selectedTime}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <Button variant="outline" className="w-full text-center" onClick={handlePrintSlip}>
                Print Token Slip
              </Button>
              <Button variant="primary" className="w-full text-center" onClick={() => setTicketModalOpen(false)}>
                Done
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
