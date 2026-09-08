"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Badge,
  Spinner,
  useToast,
  cn,
} from "@/components/ui";
import {
  Stethoscope,
  MapPin,
  Users,
  Clock,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Phone,
  ShieldCheck,
  ChevronRight,
  ArrowRight,
  UserCheck,
  RefreshCw,
  Building2,
} from "lucide-react";

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
          setError(res.data?.message || "Clinic facility could not be found.");
        }
      } catch (err: any) {
        console.error("Failed to load clinic details:", err);
        if (isMounted) {
          setError(
            err.response?.data?.message ||
              "Unable to load clinic details. Please scan the QR poster again or contact the front desk."
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

    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length < 10) {
      toast({
        title: "Valid Mobile Required",
        description: "Please enter a valid 10-digit mobile number.",
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
        phone: cleanPhone,
        gender,
        notes: notes.trim() || undefined,
      });

      if (res.data?.success && res.data.data) {
        const data = res.data.data;
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
      const message =
        err.response?.data?.message ||
        err.message ||
        "Failed to join queue. Please check with the front desk.";
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
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-indigo-600/10 flex items-center justify-center animate-pulse">
            <Building2 className="w-8 h-8 text-indigo-600" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              Connecting to Clinic Queue...
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Retrieving live doctor availability and wait times.
            </p>
          </div>
          <Spinner className="w-6 h-6 text-indigo-600" />
        </div>
      </div>
    );
  }

  // 2. Error State
  if (error || !clinic) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
        <Card className="w-full max-w-md border-red-200 dark:border-red-900 shadow-xl">
          <CardContent className="pt-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-950/60 text-red-600 mx-auto flex items-center justify-center">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                Queue Registration Unavailable
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-300">
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
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-sky-50 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950 flex flex-col items-center justify-center p-4">
        <Card className="w-full max-w-md border-emerald-300 dark:border-emerald-800 shadow-2xl overflow-hidden bg-white/95 dark:bg-slate-900/95 backdrop-blur">
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-6 text-white text-center">
            <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3 backdrop-blur shadow-inner">
              <CheckCircle2 className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-black tracking-tight">
              {successResult.isExisting ? "Token Retrieved!" : "You're in the Queue!"}
            </h2>
            <p className="text-emerald-100 text-xs font-medium mt-1">
              {clinic.name}
            </p>
          </div>

          <CardContent className="p-6 text-center space-y-6">
            <div className="bg-slate-50 dark:bg-slate-800/80 rounded-2xl p-5 border border-slate-200 dark:border-slate-700">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Your Assigned Live Token
              </span>
              <div className="text-5xl font-black text-indigo-600 dark:text-indigo-400 mt-1 mb-2 tracking-tight">
                #{successResult.tokenNumber}
              </div>
              <div className="flex items-center justify-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                <Users className="w-4 h-4 text-indigo-500" />
                <span>Estimated Position in Queue: #{successResult.queuePosition}</span>
              </div>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Redirecting you to the live mobile tracker with real-time audio announcements & doctor status...
            </p>

            <Button
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-6 text-base shadow-lg shadow-indigo-600/20"
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-12">
      {/* Sticky Top Facility Banner */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200 dark:border-slate-800 shadow-sm px-4 py-3">
        <div className="max-w-md mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow">
              <Building2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                {clinic.name}
              </h1>
              {formattedAddress && (
                <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  <MapPin className="w-3 h-3 shrink-0" />
                  <span className="truncate">{formattedAddress}</span>
                </div>
              )}
            </div>
          </div>
          <Badge variant="outline" className="text-[11px] border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 shrink-0 font-semibold px-2 py-0.5">
            <Sparkles className="w-3 h-3 mr-1" />
            Instant Token
          </Badge>
        </div>
      </header>

      {/* Main Content Form */}
      <main className="max-w-md mx-auto px-4 pt-5">
        {/* Step Visual Indicator */}
        <div className="mb-5 bg-gradient-to-r from-indigo-600 to-sky-600 rounded-2xl p-4 text-white shadow-lg shadow-indigo-500/10">
          <div className="flex items-center justify-between text-xs font-semibold mb-1 opacity-90">
            <span>Fast Walk-In Registration</span>
            <span className="bg-white/20 px-2 py-0.5 rounded-full text-[10px]">Zero Login</span>
          </div>
          <h2 className="text-lg font-extrabold tracking-tight">
            Join the Live Doctor Queue
          </h2>
          <p className="text-xs text-indigo-100 mt-0.5">
            Fill your name & number below to instantly receive your token and live mobile tracking link.
          </p>

          <div className="mt-3 pt-3 border-t border-white/20 flex items-center justify-between text-[11px] font-medium">
            <div className="flex items-center gap-1">
              <span className="w-4 h-4 rounded-full bg-white text-indigo-600 text-[10px] font-bold flex items-center justify-center">1</span>
              <span>Your Details</span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 opacity-60" />
            <div className="flex items-center gap-1">
              <span className="w-4 h-4 rounded-full bg-white/30 text-white text-[10px] font-bold flex items-center justify-center">2</span>
              <span>Doctor</span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 opacity-60" />
            <div className="flex items-center gap-1">
              <span className="w-4 h-4 rounded-full bg-white/30 text-white text-[10px] font-bold flex items-center justify-center">3</span>
              <span>Live Token</span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Card 1: Patient Information */}
          <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-indigo-600" />
                Step 1: Patient Information
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3.5">
              {/* Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Patel"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                />
              </div>

              {/* Mobile Phone */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Mobile Number <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Phone className="w-4 h-4" />
                  </div>
                  <input
                    type="tel"
                    required
                    placeholder="10-digit mobile number"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    maxLength={14}
                    className="w-full pl-9 pr-3.5 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                  />
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  We use this to recover your existing token or send queue updates.
                </p>
              </div>

              {/* Gender Radio Quick Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Gender
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["male", "female", "other"] as const).map((g) => (
                    <button
                      type="button"
                      key={g}
                      onClick={() => setGender(g)}
                      className={cn(
                        "py-2 text-xs font-semibold rounded-lg capitalize border transition text-center",
                        gender === g
                          ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                          : "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100"
                      )}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              {/* Reason / Notes (Optional) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Reason for Visit / Symptoms <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Fever, routine checkup, cough"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                />
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Select Doctor */}
          <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
            <CardHeader className="pb-2 pt-4 px-4 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <Stethoscope className="w-4 h-4 text-indigo-600" />
                Step 2: Select Doctor
              </CardTitle>
              <span className="text-[11px] text-slate-500 font-medium">
                {clinic.doctors.length} available
              </span>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-1">
              {clinic.doctors.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-500">
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
                      <div
                        key={doc.doctorId}
                        onClick={() => {
                          if (!isUnavailable) setSelectedDoctorId(doc.doctorId);
                        }}
                        className={cn(
                          "relative rounded-xl border p-3.5 transition-all text-left",
                          isUnavailable
                            ? "bg-slate-100/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 opacity-60 cursor-not-allowed"
                            : isSelected
                            ? "bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-600 ring-2 ring-indigo-500/20 shadow-sm cursor-pointer"
                            : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:border-indigo-300 cursor-pointer"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                                {doc.name}
                              </h3>
                              {isSelected && !isUnavailable && (
                                <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
                              )}
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-400">
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
                                    ? "border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40"
                                    : "border-amber-500/30 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40"
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
                          <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                            <div className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-indigo-500" />
                              <span>
                                Est. Wait:{" "}
                                <strong className="text-slate-700 dark:text-slate-200">
                                  {doc.estimatedWaitMinutes || 0} mins
                                </strong>
                              </span>
                            </div>
                            <span>Avg. {doc.consultationDuration || 15}m / consult</span>
                          </div>
                        )}
                      </div>
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
              disabled={submitting || clinic.doctors.length === 0}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-6 text-base rounded-xl shadow-lg shadow-indigo-600/25 transition-all flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Spinner className="w-5 h-5 text-white" />
                  <span>Assigning Your Token...</span>
                </>
              ) : (
                <>
                  <span>Join Queue & Get Token</span>
                  <Sparkles className="w-5 h-5" />
                </>
              )}
            </Button>

            <div className="flex items-center justify-center gap-2 text-center text-xs text-slate-500 dark:text-slate-400">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>Free instant check-in. No app download required.</span>
            </div>
          </div>
        </form>

        {/* Existing Token / Help Footer */}
        <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800 text-center space-y-2 text-xs text-slate-500">
          <p>
            Already hold an appointment token?{" "}
            <Link
              href="/track"
              className="font-semibold text-indigo-600 dark:text-indigo-400 underline underline-offset-2"
            >
              Track Your Live Queue
            </Link>
          </p>
          {clinic.phone && (
            <p className="text-[11px] text-slate-400">
              Need assistance? Call reception at{" "}
              <a href={`tel:${clinic.phone}`} className="font-medium text-slate-600 dark:text-slate-300">
                {clinic.phone}
              </a>
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
