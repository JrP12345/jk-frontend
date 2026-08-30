"use client";

import { useState } from "react";
import { Button, Input, Card, CardHeader, CardTitle, CardContent, Badge, useToast, cn } from "@/components/ui";
import api from "@/lib/api";
import { Printer, Phone, Hash, CheckCircle2, AlertCircle, ArrowRight, RotateCw, Stethoscope, Clock } from "lucide-react";

export default function PublicSelfCheckInKiosk() {
  const { toast } = useToast();

  const [mode, setMode] = useState<"token" | "phone">("token");
  const [inputToken, setInputToken] = useState("");
  const [inputPhone, setInputPhone] = useState("");
  const [inputClinicId, setInputClinicId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [checkInResult, setCheckInResult] = useState<any | null>(null);

  const handleCheckInByToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputToken.trim()) {
      toast({ title: "Validation Error", description: "Please enter your queue token number", variant: "error" });
      return;
    }

    setSubmitting(true);
    setCheckInResult(null);

    try {
      const res = await api.post("/check-in/qr", {
        tokenNumber: Number(inputToken),
        clinicId: inputClinicId.trim() || undefined,
      });

      const data = res.data?.data;
      setCheckInResult(data);

      speakConfirmation(data?.tokenNumber, data?.patientName);

      toast({
        title: "Self Check-In Complete ✓",
        description: res.data?.message || `Checked in successfully. Your queue token is #${data?.tokenNumber}`,
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
      toast({ title: "Validation Error", description: "Please enter a valid 10-digit mobile phone number", variant: "error" });
      return;
    }

    setSubmitting(true);
    setCheckInResult(null);

    try {
      // Find today's appointments for this phone number
      const apptsRes = await api.get(`/appointments?search=${encodeURIComponent(inputPhone.trim())}`);
      const list = apptsRes.data?.data || apptsRes.data || [];
      const todayAppt = list.find((a: any) => a.status === "confirmed" || a.status === "pending" || a.status === "checked-in");

      if (!todayAppt) {
        toast({
          title: "Appointment Not Found",
          description: "No active appointment found for this phone number today. Please visit the reception desk to register.",
          variant: "warning",
        });
        return;
      }

      // Check-in via appointment id
      const checkInRes = await api.post("/check-in/qr", {
        appointmentId: todayAppt.id,
        tokenNumber: todayAppt.tokenNumber,
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

  const handlePrintSlip = () => {
    if (!checkInResult) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Queue Token Slip - #${checkInResult.tokenNumber}</title>
          <style>
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
            <h2 class="title">HEALTHOS CLINIC RECEPTION</h2>
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
          <script>
            window.onload = () => { window.print(); window.close(); };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="min-h-screen bg-surface-alt flex flex-col items-center justify-center p-4 sm:p-6 animate-fade-in font-sans">
      <div className="w-full max-w-lg space-y-6">
        {/* Kiosk Branding Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary-500/10 border border-primary-500/20 text-xs font-bold text-primary-600 dark:text-primary-400">
            🏥 Clinic Reception Kiosk • Touch Self Check-In
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-text tracking-tight">ANANT Health Desk</h1>
          <p className="text-xs sm:text-sm text-text-muted max-w-md mx-auto leading-relaxed">
            Arrived for your consultation? Check in below to notify the doctor and activate your turn in the waiting queue.
          </p>
        </div>

        <Card className="border-border/80 shadow-2xl rounded-3xl overflow-hidden bg-surface">
          {!checkInResult ? (
            <div>
              {/* Segmented Mode Selector */}
              <div className="p-3 bg-surface-alt/60 border-b border-border/80 flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setMode("token")}
                  className={cn(
                    "flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer",
                    mode === "token"
                      ? "bg-surface text-text shadow-xs border border-border/80"
                      : "text-text-muted hover:text-text"
                  )}
                >
                  <Hash className="w-4 h-4 text-primary-500" />
                  <span>By Token Number</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMode("phone")}
                  className={cn(
                    "flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer",
                    mode === "phone"
                      ? "bg-surface text-text shadow-xs border border-border/80"
                      : "text-text-muted hover:text-text"
                  )}
                >
                  <Phone className="w-4 h-4 text-primary-500" />
                  <span>By Phone Number</span>
                </button>
              </div>

              <CardContent className="p-6 sm:p-8 space-y-6">
                {mode === "token" ? (
                  <form onSubmit={handleCheckInByToken} className="space-y-6">
                    <div className="text-center space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-text-muted">
                        Enter Appointment Token #
                      </label>
                      <Input
                        type="number"
                        placeholder="e.g. 1, 2, 14..."
                        className="text-center text-4xl sm:text-5xl font-black tracking-widest h-20 rounded-2xl border-2 border-primary-500/40 focus:border-primary-500 shadow-inner"
                        value={inputToken}
                        onChange={(e) => setInputToken(e.target.value)}
                        autoFocus
                        required
                      />
                      <p className="text-[11px] text-text-muted">Found on your appointment booking SMS or slip</p>
                    </div>

                    <Button
                      type="submit"
                      size="lg"
                      className="w-full h-14 text-base sm:text-lg font-bold rounded-2xl shadow-lg cursor-pointer"
                      loading={submitting}
                    >
                      <span>Complete Self Check-In</span>
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </Button>
                  </form>
                ) : (
                  <form onSubmit={handleCheckInByPhone} className="space-y-6">
                    <div className="text-center space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-text-muted">
                        Enter Patient Mobile Number
                      </label>
                      <Input
                        type="tel"
                        placeholder="e.g. 9876543210"
                        className="text-center text-3xl font-black tracking-wider h-20 rounded-2xl border-2 border-primary-500/40 focus:border-primary-500 shadow-inner"
                        value={inputPhone}
                        onChange={(e) => setInputPhone(e.target.value)}
                        autoFocus
                        required
                      />
                      <p className="text-[11px] text-text-muted">We will verify your confirmed appointment automatically</p>
                    </div>

                    <Button
                      type="submit"
                      size="lg"
                      className="w-full h-14 text-base sm:text-lg font-bold rounded-2xl shadow-lg cursor-pointer"
                      loading={submitting}
                    >
                      <span>Lookup & Check In</span>
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </Button>
                  </form>
                )}
              </CardContent>
            </div>
          ) : (
            <CardContent className="p-6 sm:p-8 space-y-6 text-center animate-fade-in">
              <div className="p-6 bg-emerald-500/10 border-2 border-emerald-500/40 rounded-3xl space-y-3 relative overflow-hidden shadow-inner">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-black">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>CHECKED IN SUCCESSFULLY</span>
                </div>

                <div className="space-y-1">
                  <p className="text-xs font-bold uppercase tracking-widest text-text-muted">Your Queue Token</p>
                  <div className="text-7xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight leading-none drop-shadow-sm py-2">
                    #{checkInResult.tokenNumber}
                  </div>
                </div>

                <div className="pt-3 border-t border-emerald-500/20 space-y-1 text-xs">
                  <p className="font-bold text-base text-text">{checkInResult.patientName}</p>
                  <p className="text-text-secondary flex items-center justify-center gap-1 font-medium">
                    <Stethoscope className="w-3.5 h-3.5 text-primary-500" />
                    <span>Attending: Dr. {checkInResult.doctorName}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-center gap-2 text-xs text-text-muted">
                <Clock className="w-4 h-4 text-primary-500" />
                <span>Please take a seat. The doctor will call your token on the waiting room TV.</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <Button
                  variant="outline"
                  size="lg"
                  className="rounded-2xl font-bold cursor-pointer gap-2"
                  onClick={handlePrintSlip}
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Token Slip</span>
                </Button>

                <Button
                  variant="primary"
                  size="lg"
                  className="rounded-2xl font-bold cursor-pointer"
                  onClick={() => {
                    setCheckInResult(null);
                    setInputToken("");
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
