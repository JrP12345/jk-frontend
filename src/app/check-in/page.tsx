"use client";

import PrintButton from "@/components/ui/PrintButton";

import { getPrintBrandStyles, printHtml } from "@/lib/printBrand";

import { useAuthStore } from "@/store/authStore";
import { hasAnyPermission } from "@/lib/permissions";
import { useLocationStore } from "@/store/locationStore";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Button, Input, Card, CardContent, useToast, ModeSwitcher, Select, cn } from "@/components/ui";
import api from "@/lib/api";
import { Phone, Hash, CheckCircle2, ArrowRight, Stethoscope, Clock } from "lucide-react";

export default function PublicSelfCheckInKiosk() {
  const { toast } = useToast();
  const { user } = useAuthStore();
  const { locations, activeLocationId, fetchLocations } = useLocationStore();
  useEffect(() => { if (hasAnyPermission(user, "MANAGE_QUEUE")) void fetchLocations(); }, [user, fetchLocations]);
  const [candidates, setCandidates] = useState<any[]>([]);

  const [mode, setMode] = useState<"token" | "phone">("token");
  const [inputToken, setInputToken] = useState("");
  const [inputAppointmentId, setInputAppointmentId] = useState("");
  const [inputPhone, setInputPhone] = useState("");
  const [inputLocationId, setInputLocationId] = useState(activeLocationId || "");
  const [submitting, setSubmitting] = useState(false);
  const [checkInResult, setCheckInResult] = useState<any | null>(null);

  const handleCheckInByToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputToken.trim() || !inputAppointmentId.trim() || !inputLocationId.trim()) {
      toast({ title: "Check-in details needed", description: "Enter the appointment, location, and queue token to continue.", variant: "error" });
      return;
    }

    setSubmitting(true);
    setCheckInResult(null);

    try {
      const res = await api.post("/check-in/qr", {
        appointmentId: inputAppointmentId.trim(),
        tokenNumber: Number(inputToken),
        locationId: inputLocationId.trim(),
      });

      const data = res.data?.data;
      setCheckInResult(data);

      speakConfirmation(data?.tokenNumber, data?.patientName);

      toast({
        title: "Self Check-In Complete ✓",
        description: `Queue token #${data?.tokenNumber} is ready.`,
        variant: "success",
      });
    } catch (err: any) {
      toast({
        title: "Check-In Unsuccessful",
        description: err.response?.data?.message || "Invalid token number or appointment not found. Please speak to the receptionist.",
        variant: "error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckInByPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputPhone.trim() || inputPhone.trim().length < 8) {
      toast({ title: "Check the phone number", description: "Enter a valid 10-digit mobile number.", variant: "error" });
      return;
    }

    setSubmitting(true);
    setCheckInResult(null);

    try {
      if (!inputLocationId.trim()) throw new Error("Select the location before looking up a patient");
      const now = new Date();
      const date = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
      const query = `search=${encodeURIComponent(inputPhone.trim())}&locationId=${encodeURIComponent(inputLocationId.trim())}&date=${date}&limit=100`;
      const apptsRes = await api.get(`/appointments?${query}`);
      const list = [...(apptsRes.data?.data || [])];
      const pages = Number(apptsRes.headers["x-total-pages"]) || 1;
      for (let page = 2; page <= pages; page++) {
        const res = await api.get(`/appointments?${query}&page=${page}`);
        list.push(...(res.data?.data || []));
      }
      const eligible = list.filter((a: any) => ["pending", "confirmed", "checked-in", "in-consultation"].includes(a.status));
      setCandidates(eligible);
      if (!eligible.length) toast({ title: "No eligible visit today", description: "Check the phone number and location, or register at reception.", variant: "warning" });
      return;
    } catch (err: any) {
      toast({ title: "Appointments unavailable", description: err.response?.data?.message || err.message || "Could not find today's appointments. Please try again.", variant: "error" });
    } finally { setSubmitting(false); }
  };

  const checkInSelectedVisit = async (todayAppt: any) => {
    setSubmitting(true);
    try {
      const appointmentLocationId =
        typeof todayAppt.locationId === "string"
          ? todayAppt.locationId
          : todayAppt.locationId?.id || todayAppt.locationId?._id;
      if (!appointmentLocationId) {
        throw new Error("The appointment is missing its location reference");
      }

      // Check-in via appointment id
      const checkInRes = await api.post("/check-in/qr", {
        appointmentId: todayAppt.id || todayAppt._id,
        tokenNumber: todayAppt.tokenNumber,
        locationId: appointmentLocationId,
      });

      const data = checkInRes.data?.data || {
        tokenNumber: todayAppt.tokenNumber || 1,
        patientName: todayAppt.patientId?.userId?.name || "Patient",
        doctorName: todayAppt.doctorId?.name || "Attending Physician",
      };

      setCheckInResult(data);
      speakConfirmation(data.tokenNumber, data.patientName);

      toast({
        title: "Check-In Verified ✓",
        description: `Welcome, ${data.patientName}. Your token is #${data.tokenNumber}.`,
        variant: "success",
      });
    } catch (err: any) {
      toast({
        title: "Check-In Failed",
        description: err.response?.data?.message || "Unable to check in with phone number.",
        variant: "error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const speakConfirmation = (tokenNum?: number, name?: string) => {
    if (typeof window !== "undefined" && "speechSynthesis" in window && tokenNum) {
      const utterance = new SpeechSynthesisUtterance(
        `Welcome ${name || "Patient"}. You are checked in with token number ${tokenNum}. Please take a seat in the waiting area.`
      );
      utterance.rate = 0.95;
      window.speechSynthesis.speak(utterance);
    }
  };

  const handlePrintSlip = async () => {
    if (!checkInResult) return;
    await printHtml(`
      <html>
        <head>
          <title>Queue Token Slip - #${checkInResult.tokenNumber}</title>
          <style>${getPrintBrandStyles()}
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #fff; }
            .slip { width: 300px; padding: 24px; border: 2px solid #000; text-align: center; border-radius: 8px; }
            .title { font-size: 16px; font-weight: 900; margin: 0; letter-spacing: -0.5px; }
            .subtitle { font-size: 11px; color: #555; margin-top: 2px; }
            .divider { border-bottom: 2px dashed #000; margin: 16px 0; }
            .token-box { margin: 16px 0; }
            .token-label { font-size: 12px; font-weight: bold; text-transform: uppercase; color: #444; letter-spacing: 1px; }
            .token-num { font-size: 64px; font-weight: 900; line-height: 1; margin: 6px 0; }
            .info-row { display: flex; justify-content: space-between; font-size: 12px; margin: 4px 0; text-align: left; }
            .info-label { color: #666; }
            .info-val { font-weight: bold; text-align: right; }
            .footer { font-size: 10px; color: #777; margin-top: 16px; border-top: 1px solid #ccc; padding-top: 8px; }
          </style>
        </head>
        <body>
          <div class="slip">
            <h2 class="title">Ekavyu LOCATION RECEPTION</h2>
            <p class="subtitle">Outpatient Self Check-In Kiosk</p>
            <div class="divider"></div>
            <div class="token-box">
              <div class="token-label">YOUR QUEUE TOKEN</div>
              <div class="token-num">#${checkInResult.tokenNumber}</div>
            </div>
            <div class="divider"></div>
            <div class="info-row"><span class="info-label">Patient:</span><span class="info-val">${checkInResult.patientName}</span></div>
            <div class="info-row"><span class="info-label">Doctor:</span><span class="info-val">Dr. ${checkInResult.doctorName}</span></div>
            <div class="info-row"><span class="info-label">Time:</span><span class="info-val">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div>
            <div class="info-row"><span class="info-label">Date:</span><span class="info-val">${new Date().toLocaleDateString()}</span></div>
            <div class="footer">Please watch the TV Waiting Room display. Your token will be called shortly.</div>
          </div>
        </body>
      </html>
    `);
  };

  if (!hasAnyPermission(user, "MANAGE_QUEUE")) return <main className="p-6 max-w-lg mx-auto"><Card><CardContent><h1 className="text-xl font-bold">Staff reception kiosk</h1><p className="my-4">Sign in with a staff account authorized to manage this location's queue. Patients can check arrival using their private appointment tracker.</p><Link href="/login">Staff sign in</Link></CardContent></Card></main>;

  return (
    <div className="min-h-screen bg-surface-alt flex flex-col items-center justify-center p-3 sm:p-6 py-8 sm:py-12 animate-fade-in font-sans">
      <div className="w-full max-w-lg space-y-5 sm:space-y-6">
        {/* Top bar with back link & theme switch */}
        <div className="flex items-center justify-between">
          <Link
            href="/browse"
            className="text-xs font-semibold text-text-secondary hover:text-text flex items-center gap-1.5 bg-surface/80  px-3.5 py-2 sm:py-1.5 rounded-full border border-border/70 transition-all hover:border-border min-h-[44px] sm:min-h-0"
          >
            ← Browse Locations
          </Link>
          <ModeSwitcher variant="icon" />
        </div>

        {/* Kiosk Branding Header */}
        <div className="text-center space-y-2">
          <p className="text-sm text-text-secondary">Reception check-in</p>
          <h1 className="text-2xl sm:text-3xl font-semibold text-text tracking-tight">Check in an appointment</h1>
          <p className="text-xs sm:text-sm text-text-muted max-w-md mx-auto leading-relaxed">
            Reception staff can check in a confirmed appointment below. Patients should use the private tracker link sent with their booking.
          </p>
        </div>

        <Card className="border-border rounded-xl overflow-hidden bg-surface">
          {!checkInResult ? (
            <div>
              {/* Segmented Mode Selector */}
              <div className="p-3 bg-surface-alt/60 border-b border-border/80 flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setMode("token")}
                  aria-pressed={mode === "token"}
                  className={cn(
                    "flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer min-h-[44px]",
                    mode === "token"
                      ? "bg-surface text-text shadow-xs border border-border/80"
                      : "text-text-muted hover:text-text"
                  )}
                >
                  <Hash className="w-4 h-4 text-accent" />
                  <span>By Appointment</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMode("phone")}
                  aria-pressed={mode === "phone"}
                  className={cn(
                    "flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer min-h-[44px]",
                    mode === "phone"
                      ? "bg-surface text-text shadow-xs border border-border/80"
                      : "text-text-muted hover:text-text"
                  )}
                >
                  <Phone className="w-4 h-4 text-accent" />
                  <span>By Phone Number</span>
                </button>
              </div>

              <CardContent className="p-4 sm:p-6 space-y-5">
                {mode === "token" ? (
                  <form onSubmit={handleCheckInByToken} className="space-y-6">
                    <div className="text-center space-y-2">
                      <label htmlFor="reception-appointment" className="text-sm font-medium text-text-secondary">Appointment ID</label>
                      <Input
                        id="reception-appointment"
                        type="text"
                        placeholder="Appointment reference"
                        className="text-center font-mono text-sm h-12 rounded-xl border border-primary-500/40 focus:border-primary-500"
                        value={inputAppointmentId}
                        onChange={(e) => setInputAppointmentId(e.target.value)}
                        autoFocus
                        required
                      />
                      <label htmlFor="reception-location" className="text-sm font-medium text-text-secondary">Location ID</label>
                      <Input
                        id="reception-location"
                        type="text"
                        placeholder="Location reference"
                        className="text-center font-mono text-sm h-12 rounded-xl border border-primary-500/40 focus:border-primary-500"
                        value={inputLocationId}
                        onChange={(e) => setInputLocationId(e.target.value)}
                        required
                      />
                      <label htmlFor="reception-token" className="text-sm font-medium text-text-secondary">Queue token</label>
                      <Input
                        id="reception-token"
                        type="number"
                        placeholder="e.g. 1, 2, 14..."
                        className="text-center text-4xl sm:text-5xl font-black tracking-widest h-20 rounded-2xl border-2 border-primary-500/40 focus:border-primary-500 shadow-inner"
                        value={inputToken}
                        onChange={(e) => setInputToken(e.target.value)}
                        required
                      />
                      <p className="text-[11px] text-text-muted">Confirm the appointment, location, and token against the patient booking.</p>
                    </div>

                    <Button
                      type="submit"
                      size="lg"
                      className="w-full h-14 text-base sm:text-lg font-bold rounded-2xl shadow-lg cursor-pointer"
                      loading={submitting}
                    >
                      <span>Complete Check-In</span>
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </Button>
                  </form>
                ) : (
                  <form onSubmit={handleCheckInByPhone} className="space-y-6">
                    <Select label="Location" placeholder="Select the appointment location" value={inputLocationId} options={locations.map(c => ({ value: c.id, label: c.name }))} onChange={e => { setInputLocationId(e.target.value); setCandidates([]); }} required />
                    <div className="text-center space-y-2">
                      <label htmlFor="reception-phone" className="text-sm font-medium text-text-secondary">
                        Enter Patient Mobile Number
                      </label>
                      <Input
                        id="reception-phone"
                        autoComplete="tel"
                        inputMode="tel"
                        type="tel"
                        placeholder="e.g. 9876543210"
                        className="text-center text-3xl font-black tracking-wider h-20 rounded-2xl border-2 border-primary-500/40 focus:border-primary-500 shadow-inner"
                        value={inputPhone}
                        onChange={(e) => { setInputPhone(e.target.value); setCandidates([]); }}
                        autoFocus
                        required
                      />
                      <p className="text-[11px] text-text-muted">Select the correct visit from today's appointments for this location.</p>
                    </div>

                    <Button
                      type="submit"
                      size="lg"
                      className="w-full h-14 text-base sm:text-lg font-bold rounded-2xl shadow-lg cursor-pointer"
                      loading={submitting}
                    >
                      <span>Find today's appointments</span>
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </Button>
                    {candidates.map(a => <Button key={a.id || a._id} type="button" variant="outline" disabled={submitting} className="w-full whitespace-normal" onClick={() => checkInSelectedVisit(a)}>Token #{a.tokenNumber} · {a.patientId?.userId?.name || a.patientId?.name || "Patient"} · Dr. {a.doctorId?.name || "Doctor"} · {new Date(a.appointmentTime).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})} · {a.status}</Button>)}
                  </form>
                )}
              </CardContent>
            </div>
          ) : (
            <CardContent className="p-6 sm:p-8 space-y-6 text-center animate-fade-in">
              <div className="p-6 bg-success/10 border-2 border-success/40 rounded-3xl space-y-3 relative overflow-hidden shadow-inner">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-success/20 text-success-text dark:text-success-text text-xs font-black">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>CHECKED IN SUCCESSFULLY</span>
                </div>

                <div className="space-y-1">
                  <p className="text-xs font-bold uppercase tracking-widest text-text-muted">Your Queue Token</p>
                  <div className="text-7xl font-black text-success-text dark:text-success-text tracking-tight leading-none drop-shadow-sm py-2">
                    #{checkInResult.tokenNumber}
                  </div>
                </div>

                <div className="pt-3 border-t border-success/20 space-y-1 text-xs">
                  <p className="font-bold text-base text-text">{checkInResult.patientName}</p>
                  <p className="text-text-secondary flex items-center justify-center gap-1 font-medium">
                    <Stethoscope className="w-3.5 h-3.5 text-accent" />
                    <span>Attending: Dr. {checkInResult.doctorName}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-center gap-2 text-xs text-text-muted">
                <Clock className="w-4 h-4 text-accent" />
                <span>Please take a seat. The doctor will call your token on the waiting room TV.</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <PrintButton
                  variant="outline"
                  size="lg"
                  className="rounded-2xl font-bold cursor-pointer gap-2"
                  onPrint={handlePrintSlip} documentName="token slip"
                >
              </PrintButton>

                <Button
                  variant="primary"
                  size="lg"
                  className="rounded-2xl font-bold cursor-pointer"
                  onClick={() => {
                    setCheckInResult(null);
                    setInputToken("");
                    setInputAppointmentId("");
                    setInputLocationId("");
                    setInputPhone("");
                  }}
                >
                  <span>Next Patient</span>
                </Button>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
