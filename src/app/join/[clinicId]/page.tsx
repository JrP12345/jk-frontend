"use client";

import { rememberTrackerLink } from "@/store/trackerStore";
import { useAuthStore } from "@/store/authStore";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api";
import { detectPatientOtpTarget } from "@/lib/patientLogin";
import { userFacingError } from "@/lib/userFacingError";
import { Card, CardHeader, CardTitle, CardContent, Button, Badge, Spinner, useToast, ModeSwitcher, cn } from "@/components/ui";
import { Stethoscope, MapPin, Users, Clock, CheckCircle2, AlertCircle, Sparkles, Phone, ShieldCheck, ChevronRight, ArrowRight, UserCheck, RefreshCw, Building2 } from "lucide-react";

interface PublicDoctor {
  doctorId: string;
  name: string;
  email?: string;
  specialization?: string;
  consultationDuration?: number;
  isAvailable?: boolean;
  overrideStatus?: string | null;
  availabilityOverrideStatus?: string | null;
  overrideReason?: string | null;
  waitingPatientsCount?: number;
  estimatedWaitMinutes?: number;
}

interface PublicClinic {
  _id: string;
  name: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  } | string;
  phone?: string;
  email?: string;
  image_url?: string | null;
  doctors: PublicDoctor[];
}

export default function JoinClinicQueuePage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const clinicId = params?.clinicId as string;

  const [clinic, setClinic] = useState<PublicClinic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "other">("male");
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Success State
  const [successResult, setSuccessResult] = useState<{
    appointmentId: string;
    tokenNumber: number;
    queuePosition: number;
    isExisting: boolean;
    trackingUrl: string;
    message?: string;
  } | null>(null);

  // Load clinic details and active assigned doctors
  useEffect(() => {
    if (!clinicId) return;

    let isMounted = true;
    const fetchClinic = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await api.get(`/public/clinics/${clinicId}`);
        if (!isMounted) return;

        if (res.data?.success && res.data.data) {
          const clinicData = res.data.data;
          setClinic(clinicData);

          // Pre-select first available doctor if available
          const firstAvailable = clinicData.doctors?.find(
            (d: PublicDoctor) =>
              d.isAvailable !== false &&
              d.overrideStatus !== "unavailable" &&
              d.overrideStatus !== "on_leave" &&
              d.availabilityOverrideStatus !== "unavailable" &&
              d.availabilityOverrideStatus !== "on_leave" &&
              d.availabilityOverrideStatus !== "emergency_unavailable"
          );
          if (firstAvailable) {
            setSelectedDoctorId(firstAvailable.doctorId);
          }
        } else {
          setError(userFacingError(res.data?.message, "This clinic could not be found."));
        }
      } catch (err: any) {
        console.error("Failed to load clinic details:", err);
        if (isMounted) {
          setError(
            userFacingError(err.response?.data?.message, "Clinic details could not be loaded. Scan the QR code again or ask reception for help.")
          );
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchClinic();
    return () => {
      isMounted = false;
    };
  }, [clinicId]);

  // Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast({
        title: "Name Required",
        description: "Please enter your full name to join the queue.",
        variant: "error",
      });
      return;
    }

    const phoneTarget = detectPatientOtpTarget(phone);
    if (!phoneTarget?.phone) {
      toast({
        title: "Valid Mobile Required",
        description: "Enter an Indian 10-digit number or an international number with +country code.",
        variant: "error",
      });
      return;
    }

    if (!selectedDoctorId) {
      toast({
        title: "Select a Doctor",
        description: "Please choose which doctor you would like to consult with.",
        variant: "error",
      });
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.post("/public/join-queue", {
        clinicId,
        doctorId: selectedDoctorId,
        name: name.trim(),
        phone: phone.trim().startsWith("+") ? phone.trim() : phoneTarget.phone,
        gender,
        notes: notes.trim() || undefined,
      });

      if (res.data?.success && res.data.data) {
        const data = res.data.data;
        rememberTrackerLink(data.trackingUrl || `/track/${data.appointmentId}${data.trackerToken ? `?t=${encodeURIComponent(data.trackerToken)}` : ""}`, useAuthStore.getState().user?.id || null);
        setSuccessResult({
          appointmentId: data.appointmentId,
          tokenNumber: data.tokenNumber,
          queuePosition: data.queuePosition,
          isExisting: !!data.isExisting,
          trackingUrl: data.trackingUrl || `/track/${data.appointmentId}`,
          message: res.data.message,
        });

        toast({
          title: data.isExisting ? "Existing Token Retrieved" : "Queue Joined Successfully!",
          description: data.isExisting
            ? `Active Token #${data.tokenNumber} found for today.`
            : `Token #${data.tokenNumber} generated. Redirecting to live tracker...`,
          variant: "success",
        });

        // Auto-redirect to live tracker after a brief celebratory view
        setTimeout(() => {
          router.push(data.trackingUrl || `/track/${data.appointmentId}`);
        }, 1800);
      } else {
        throw new Error(res.data?.message || "Failed to join queue");
      }
    } catch (err: any) {
      console.error("Queue join error:", err);
      const message = userFacingError(err.response?.data?.message || err.message, "Could not join the queue. Please ask reception for help.");
      toast({
        title: "Unable to Join Queue",
        description: message,
        variant: "error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const formattedAddress =
    typeof clinic?.address === "string"
      ? clinic.address
      : clinic?.address
      ? [
          clinic.address.street,
          clinic.address.city,
          clinic.address.state,
          clinic.address.postalCode,
        ]
          .filter(Boolean)
          .join(", ")
      : "";

  // 1. Loading State
  if (loading) {
    return (
      <div className="min-h-screen bg-surface-alt flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-primary-500/10 flex items-center justify-center animate-pulse">
            <Building2 className="w-8 h-8 text-accent dark:text-accent" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-text">
              Connecting to Clinic Queue...
            </h3>
            <p className="text-sm text-text-muted">
              Retrieving live doctor availability and wait times.
            </p>
          </div>
          <Spinner className="w-6 h-6 text-accent" />
        </div>
      </div>
    );
  }

  // 2. Error State
  if (error || !clinic) {
    return (
      <div className="min-h-screen bg-surface dark:bg-background flex flex-col items-center justify-center p-4">
        <Card className="w-full max-w-md border-danger dark:border-danger shadow-xl">
          <CardContent className="pt-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-danger-subtle dark:bg-danger/60 text-danger-text mx-auto flex items-center justify-center">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-text dark:text-text">
                Queue Registration Unavailable
              </h2>
              <p className="text-sm text-text-secondary dark:text-text-secondary">
                {error || "Could not find clinic details for this QR link."}
              </p>
            </div>
            <div className="pt-2">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => window.location.reload()}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 3. Celebratory Success Screen (Immediate token preview with redirect timer)
  if (successResult) {
    return (
      <div className="min-h-screen brand-wash       flex flex-col items-center justify-center p-4">
        <Card className="w-full max-w-md border-success dark:border-success shadow-lg overflow-hidden bg-surface/95 dark:bg-surface/95 ">
          <div className="bg-primary p-6 text-brand-mist text-center">
            <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3  shadow-inner">
              <CheckCircle2 className="w-8 h-8 text-brand-mist" />
            </div>
            <h2 className="text-2xl font-black tracking-tight">
              {successResult.isExisting ? "Token Retrieved!" : "You're in the Queue!"}
            </h2>
            <p className="text-brand-mist text-xs font-medium mt-1">
              {clinic.name}
            </p>
          </div>

          <CardContent className="p-6 text-center space-y-6">
            <div className="bg-surface dark:bg-surface-alt/80 rounded-2xl p-5 border border-border dark:border-border">
              <span className="text-xs font-bold uppercase tracking-wider text-text-muted dark:text-text-muted">
                Your Assigned Live Token
              </span>
              <div className="text-5xl font-black text-accent dark:text-accent mt-1 mb-2 tracking-tight">
                #{successResult.tokenNumber}
              </div>
              <div className="flex items-center justify-center gap-2 text-xs font-medium text-text-secondary dark:text-text-secondary">
                <Users className="w-4 h-4 text-accent" />
                <span>Estimated Position in Queue: #{successResult.queuePosition}</span>
              </div>
            </div>

            <p className="text-xs text-text-muted dark:text-text-muted">
              Redirecting you to the live mobile tracker with real-time audio announcements & doctor status...
            </p>

            <Button
              className="w-full bg-primary hover:bg-primary text-brand-mist font-semibold py-6 text-base shadow-lg "
              onClick={() => router.push(successResult.trackingUrl)}
            >
              Open Live Tracker Now
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 4. Main Mobile Walk-In Self-Registration Flow
  return (
    <div className="min-h-screen bg-surface-alt pb-12 font-sans text-text">
      {/* Sticky Top Facility Banner */}
      <header className="sticky top-0 z-30 bg-surface/90  border-b border-border shadow-xs px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="max-w-md mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-primary-600 text-brand-mist flex items-center justify-center font-bold text-sm shrink-0 shadow-xs">
              <Building2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-text truncate">
                {clinic.name}
              </h1>
              {formattedAddress && (
                <div className="flex items-center gap-1 text-[11px] text-text-muted truncate">
                  <MapPin className="w-3 h-3 shrink-0" />
                  <span className="truncate">{formattedAddress}</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ModeSwitcher variant="icon" />
          </div>
        </div>
      </header>

      {/* Main Content Form */}
      <main className="max-w-md mx-auto px-4 pt-5">
        {/* Step Visual Indicator */}
        <div className="mb-4 border-b border-border pb-4 text-text">
          <div className="flex items-center justify-between text-xs font-semibold mb-1">
            <span>Fast Walk-In Registration</span>
            <span className="text-text-muted text-xs">No login needed</span>
          </div>
          <h2 className="text-lg font-extrabold tracking-tight">
            Join the Live Doctor Queue
          </h2>
          <p className="text-sm text-text-secondary mt-1">
            Fill your name & number below to instantly receive your token and live mobile tracking link.
          </p>

          <div className="mt-3 pt-3 border-t border-white/20 flex items-center justify-between text-[11px] font-medium">
            <div className="flex items-center gap-1">
              <span className="w-4 h-4 rounded-full bg-white text-accent text-[10px] font-bold flex items-center justify-center">1</span>
              <span>Your Details</span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 opacity-60" />
            <div className="flex items-center gap-1">
              <span className="w-4 h-4 rounded-full bg-white/30 text-brand-mist text-[10px] font-bold flex items-center justify-center">2</span>
              <span>Doctor</span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 opacity-60" />
            <div className="flex items-center gap-1">
              <span className="w-4 h-4 rounded-full bg-white/30 text-brand-mist text-[10px] font-bold flex items-center justify-center">3</span>
              <span>Live Token</span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Card 1: Patient Information */}
          <Card className="border-border dark:border-border shadow-sm">
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="text-sm font-bold text-text dark:text-text-secondary flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-accent" />
                Step 1: Patient Information
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3.5">
              {/* Name */}
              <div>
                <label htmlFor="walk-in-name" className="block text-xs font-semibold text-text-secondary dark:text-text-secondary mb-1">
                  Full Name <span className="text-danger-text">*</span>
                </label>
                <input
                  id="walk-in-name"
                  autoComplete="name"
                  type="text"
                  required
                  placeholder="e.g. Ramesh Patel"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-border dark:border-border bg-surface dark:bg-surface text-text dark:text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent transition"
                />
              </div>

              {/* Mobile Phone */}
              <div>
                <label htmlFor="walk-in-phone" className="block text-xs font-semibold text-text-secondary dark:text-text-secondary mb-1">
                  Mobile Number <span className="text-danger-text">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
                    <Phone className="w-4 h-4" />
                  </div>
                  <input
                    id="walk-in-phone"
                    autoComplete="tel"
                    inputMode="tel"
                    aria-describedby="walk-in-phone-hint"
                    type="tel"
                    required
                    placeholder="Phone (+country code outside India)"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    maxLength={24}
                    className="w-full pl-9 pr-3.5 py-2.5 text-sm rounded-xl border border-border dark:border-border bg-surface dark:bg-surface text-text dark:text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent transition"
                  />
                </div>
                <p id="walk-in-phone-hint" className="text-[11px] text-text-muted dark:text-text-muted mt-1">
                  We use this to recover your existing token or send queue updates.
                </p>
              </div>

              {/* Gender Radio Quick Selector */}
              <div>
                <label className="block text-xs font-semibold text-text mb-1.5">
                  Gender
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["male", "female", "other"] as const).map((g) => (
                    <button
                      type="button"
                      key={g}
                      aria-pressed={gender === g}
                      onClick={() => setGender(g)}
                      className={cn(
                        "py-2.5 px-3 text-xs font-semibold rounded-xl capitalize border transition text-center min-h-[44px] flex items-center justify-center cursor-pointer",
                        gender === g
                          ? "bg-primary-600 text-brand-mist border-primary-600 shadow-xs"
                          : "bg-surface text-text border-border hover:bg-surface-hover"
                      )}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              {/* Reason / Notes (Optional) */}
              <div>
                <label htmlFor="walk-in-reason" className="block text-xs font-semibold text-text-secondary dark:text-text-secondary mb-1">
                  Reason for Visit / Symptoms <span className="text-text-muted font-normal">(Optional)</span>
                </label>
                <input
                  id="walk-in-reason"
                  type="text"
                  placeholder="e.g. Fever, routine checkup, cough"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-border dark:border-border bg-surface dark:bg-surface text-text dark:text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent transition"
                />
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Select Doctor */}
          <Card className="border-border dark:border-border shadow-sm">
            <CardHeader className="pb-2 pt-4 px-4 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold text-text dark:text-text-secondary flex items-center gap-2">
                <Stethoscope className="w-4 h-4 text-accent" />
                Step 2: Select Doctor
              </CardTitle>
              <span className="text-[11px] text-text-muted font-medium">
                {clinic.doctors.length} doctors listed
              </span>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-1">
              {clinic.doctors.length === 0 ? (
                <div className="py-6 text-center text-xs text-text-muted">
                  No doctors currently active at this clinic. Please speak with the front desk.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {clinic.doctors.map((doc) => {
                    const isUnavailable =
                      doc.isAvailable === false ||
                      doc.overrideStatus === "unavailable" ||
                      doc.overrideStatus === "on_leave" ||
                      doc.availabilityOverrideStatus === "unavailable" ||
                      doc.availabilityOverrideStatus === "on_leave" ||
                      doc.availabilityOverrideStatus === "emergency_unavailable";
                    const isSelected = selectedDoctorId === doc.doctorId;

                    return (
                      <button
                        type="button"
                        key={doc.doctorId}
                        disabled={isUnavailable}
                        aria-pressed={isSelected}
                        onClick={() => {
                          if (!isUnavailable) setSelectedDoctorId(doc.doctorId);
                        }}
                        className={cn(
                          "w-full relative rounded-xl border p-3.5 transition-all text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                          isUnavailable
                            ? "bg-surface-alt/70 dark:bg-surface-alt/40 border-border dark:border-border opacity-60 cursor-not-allowed"
                            : isSelected
                            ? "bg-accent-subtle/70 dark:bg-primary/40 border-accent ring-2 ring-accent/20 shadow-sm cursor-pointer"
                            : "bg-surface dark:bg-surface border-border dark:border-border hover:border-accent cursor-pointer"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <h3 className="text-sm font-bold text-text dark:text-text truncate">
                                {doc.name}
                              </h3>
                              {isSelected && !isUnavailable && (
                                <CheckCircle2 className="w-4 h-4 text-accent shrink-0" />
                              )}
                            </div>
                            <p className="text-xs text-text-secondary dark:text-text-muted">
                              {doc.specialization || "General Physician"}
                            </p>
                          </div>

                          {/* Availability Badge */}
                          <div>
                            {isUnavailable ? (
                              <Badge variant="danger" className="text-[10px] px-2 py-0.5">
                                {doc.overrideReason ? `On Leave: ${doc.overrideReason}` : "Unavailable Today"}
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px] px-2 py-0.5 font-semibold",
                                  (doc.waitingPatientsCount || 0) === 0
                                    ? "border-success/30 text-success-text dark:text-success-text bg-success-subtle dark:bg-success/40"
                                    : "border-warning/30 text-warning-text dark:text-warning-text bg-warning-subtle dark:bg-warning/40"
                                )}
                              >
                                {(doc.waitingPatientsCount || 0) === 0
                                  ? "Available Now"
                                  : `${doc.waitingPatientsCount} waiting`}
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Wait Time Info if Available */}
                        {!isUnavailable && (
                          <div className="mt-2.5 pt-2 border-t border-border dark:border-border/80 flex items-center justify-between text-[11px] text-text-muted dark:text-text-muted">
                            <div className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-accent" />
                              <span>
                                Est. Wait:{" "}
                                <strong className="text-text-secondary dark:text-text-secondary">
                                  {doc.estimatedWaitMinutes || 0} mins
                                </strong>
                              </span>
                            </div>
                            <span>Avg. {doc.consultationDuration || 15}m / consult</span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Submit Action */}
          <div className="pt-2 space-y-3">
            <Button
              type="submit"
              size="lg"
              disabled={submitting || clinic.doctors.length === 0}
              loading={submitting}
              loadingText="Assigning Your Token..."
              iconRight={<Sparkles className="w-5 h-5" />}
              className="w-full bg-primary hover:bg-primary text-brand-mist font-bold py-6 text-base rounded-xl shadow-lg  transition-all flex items-center justify-center gap-2"
            >
              Join Queue & Get Token
            </Button>

            <div className="flex items-center justify-center gap-2 text-center text-xs text-text-muted dark:text-text-muted">
              <ShieldCheck className="w-4 h-4 text-success-text" />
              <span>Free instant check-in. No app download required.</span>
            </div>
          </div>
        </form>

        {/* Existing Token / Help Footer */}
        <div className="mt-8 pt-6 border-t border-border dark:border-border text-center space-y-2 text-xs text-text-muted">
          <p>
            Already hold an appointment token?{" "}
            <Link
              href="/track"
              className="font-semibold text-accent dark:text-accent underline underline-offset-2"
            >
              Track Your Live Queue
            </Link>
          </p>
          {clinic.phone && (
            <p className="text-[11px] text-text-muted">
              Need assistance? Call reception at{" "}
              <a href={`tel:${clinic.phone}`} className="font-medium text-text-secondary dark:text-text-secondary">
                {clinic.phone}
              </a>
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
