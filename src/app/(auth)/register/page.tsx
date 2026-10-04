"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/store/authStore";
import api from "@/lib/api";
import { detectPatientOtpTarget } from "@/lib/patientLogin";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, Input, Button, Select, useToast, ModeSwitcher, EkavyuLogo, cn } from "@/components/ui";

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export default function RegisterPage() {
  const router = useRouter();
  const { login } = useAuthStore();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    gender: "male",
    dateOfBirth: "",
  });

  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isShaking, setIsShaking] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  useEffect(() => {
    let interval: any;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  const validateDetails = () => {
    const errs: Record<string, string> = {};
    if (!formData.name.trim()) errs.name = "Full name is required";
    const phoneTarget = detectPatientOtpTarget(formData.phone);
    if (!phoneTarget || !phoneTarget.phone) errs.phone = "Enter an Indian 10-digit number or an international number with +country code";
    if (formData.email && !EMAIL_REGEX.test(formData.email)) errs.email = "Invalid email format";

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const triggerShake = () => {
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 450);
  };

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateDetails()) {
      triggerShake();
      return;
    }

    setLoading(true);
    try {
      const res = await api.post("/auth/otp/request", {
        phone: detectPatientOtpTarget(formData.phone)?.phone,
        purpose: "authentication",
      });

      setOtpSent(true);
      setResendTimer(30);
      toast({
        title: "Verification code sent",
        description: res.data?.data?.devOtp
          ? `Your verification code is ${res.data.data.devOtp}.`
          : `A verification code was sent to ${formData.phone}.`,
        variant: "success",
        duration: 8000,
      });
    } catch (err: any) {
      triggerShake();
      toast({
        title: "Verification code could not be sent",
        description: err.response?.data?.message || "Please try again.",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || otpCode.length < 6) {
      toast({ title: "Enter the verification code", description: "Use the six-digit code sent to your phone.", variant: "error" });
      triggerShake();
      return;
    }

    setLoading(true);
    try {
      const res = await api.post("/auth/otp/verify", {
        phone: detectPatientOtpTarget(formData.phone)?.phone,
        otp: otpCode,
        name: formData.name.trim(),
        gender: formData.gender,
        dateOfBirth: formData.dateOfBirth || undefined,
        email: formData.email.trim().toLowerCase() || undefined,
        purpose: "authentication",
      });

      if (res.data?.success) {
        login(res.data.data.user);
        toast({
          title: "Account created",
          description: `Welcome to Ekavyu Healthcare, ${res.data.data.user.name}!`,
          variant: "success",
        });
        router.push("/dashboard/patient-portal");
      }
    } catch (err: any) {
      triggerShake();
      toast({
        title: "Code could not be verified",
        description: err.response?.data?.message || "Check the code and try again.",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-4 py-20 bg-surface-alt relative font-sans text-text animate-page-enter">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 brand-wash" />
      </div>

      <div className="absolute top-[max(1rem,env(safe-area-inset-top))] left-4 sm:left-6 z-20">
        <Link
          href="/browse"
          className="text-xs font-semibold text-text-secondary hover:text-text flex items-center gap-1.5 bg-surface/90  px-3.5 py-2.5 sm:py-1.5 rounded-full border border-border/60 transition-all hover:border-border min-h-[44px] sm:min-h-0"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Browse Clinics
        </Link>
      </div>

      <div className="absolute top-[max(1rem,env(safe-area-inset-top))] right-4 sm:right-6 z-20">
        <ModeSwitcher variant="icon" />
      </div>

      <div className="w-full max-w-lg relative z-10 animate-fade-up my-8">
        <div className="text-center mb-6 flex flex-col items-center justify-center">
          <EkavyuLogo size="xl" showTagline />
          <p className="text-text-secondary text-xs sm:text-sm mt-2">Quick Patient Registration</p>
        </div>

        <Card
          className={cn(
            "border-border bg-surface p-0 rounded-xl overflow-hidden transition-transform duration-300",
            isShaking && "animate-shake"
          )}
        >
          {!otpSent ? (
            <form onSubmit={handleRequestOtp} noValidate className="p-5 sm:p-6 space-y-4">
              <CardHeader className="p-0 mb-4">
                <CardTitle as="h1" className="text-xl sm:text-2xl font-black text-text">Patient Registration</CardTitle>
                <CardDescription className="text-xs text-text-muted mt-1">
                  Sign up with your mobile number — no password required
                </CardDescription>
              </CardHeader>

              <CardContent className="p-0 space-y-4">
                <Input
                  label="Full Name *"
                  placeholder="e.g. John Doe"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  error={errors.name}
                  autoComplete="name"
                  required
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label="Mobile Phone Number *"
                    placeholder="9876543210"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    error={errors.phone}
                    autoComplete="tel"
                    required
                  />

                  <Input
                    label="Email Address (Optional)"
                    type="email"
                    placeholder="patient@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    error={errors.email}
                    autoComplete="email"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Select
                      label="Gender"
                      value={formData.gender}
                      onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                      options={[
                        { label: "Male", value: "male" },
                        { label: "Female", value: "female" },
                        { label: "Other", value: "other" },
                      ]}
                    />
                  </div>

                  <Input
                    label="Date of Birth"
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                    autoComplete="bday"
                  />
                </div>
              </CardContent>

              <CardFooter className="p-0 pt-2 flex flex-col gap-3">
                <Button type="submit" fullWidth loading={loading} size="lg" className="rounded-xl font-bold">
                  Send Verification OTP
                </Button>
                <div className="text-center text-xs text-text-muted mt-1">
                  Already have an account?{" "}
                  <Link href="/login" className="font-semibold text-accent hover:underline">
                    Sign In
                  </Link>
                </div>
              </CardFooter>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="p-5 sm:p-6 space-y-4">
              <CardHeader className="p-0 mb-4">
                <CardTitle as="h1" className="text-xl sm:text-2xl font-black text-text">Verify OTP</CardTitle>
                <CardDescription className="text-xs text-text-muted mt-1">
                  Enter 6-digit code sent to <strong className="text-text">{formData.phone}</strong>
                </CardDescription>
              </CardHeader>

              <CardContent className="p-0 space-y-4">
                <Input
                  label="6-Digit Verification Code *"
                  placeholder="123456"
                  maxLength={6}
                  inputMode="numeric"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                  autoComplete="one-time-code"
                  required
                />
                <div className="flex items-center justify-between text-xs px-1">
                  <button
                    type="button"
                    onClick={() => setOtpSent(false)}
                    className="text-text-muted hover:text-text cursor-pointer underline"
                  >
                    Change Details
                  </button>
                  {resendTimer > 0 ? (
                    <span className="text-text-muted font-medium">Resend in {resendTimer}s</span>
                  ) : (
                    <Button variant="ghost" size="sm"
                      type="button"
                      onClick={handleRequestOtp}
                      disabled={loading}
                      className="text-accent font-semibold hover:underline cursor-pointer"
                    >
                      Resend OTP
                    </Button>
                  )}
                </div>
              </CardContent>

              <CardFooter className="p-0 pt-2 flex flex-col gap-3">
                <div className="flex gap-2 w-full">
                  <Button type="button" variant="outline" onClick={() => setOtpSent(false)} className="rounded-xl">
                    Back
                  </Button>
                  <Button type="submit" fullWidth loading={loading} size="lg" className="rounded-xl font-bold flex-1">
                    Complete Registration
                  </Button>
                </div>
              </CardFooter>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
