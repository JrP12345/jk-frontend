"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/store/authStore";
import api from "@/lib/api";
import { apiErrorMessage } from "@/lib/apiError";
import { detectPatientOtpTarget } from "@/lib/patientLogin";
import AuthPageShell from "@/components/auth/AuthPageShell";
import auth from "@/components/auth/AuthPageShell.module.css";
import { NavigationPending } from "@/components/ui/RouteProgress";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, Input, Button, Select, useToast, DatePicker } from "@/components/ui";

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export default function PatientRegistrationForm({ onSignIn }: { onSignIn?: () => void }) {
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
  const [isNavigating, setIsNavigating] = useState(false);
  const actionPending = useRef(false);
  const navigationStarted = useRef(false);

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
    if (formData.email.trim() && !EMAIL_REGEX.test(formData.email.trim())) errs.email = "Invalid email format";

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const triggerShake = () => {
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 450);
  };

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (actionPending.current) return;
    if (!validateDetails()) {
      triggerShake();
      return;
    }

    actionPending.current = true;
    setLoading(true);
    try {
      const res = await api.post("/auth/otp/request", {
        phone: detectPatientOtpTarget(formData.phone)?.phone,
        purpose: "authentication",
      });

      if (res.data?.success === false || res.data?.data?.success === false) throw new Error("Verification code delivery is unavailable. Please try again shortly.");
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
        description: apiErrorMessage(err, "Please try again."),
        variant: "error",
      });
    } finally {
      actionPending.current = false;
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (actionPending.current) return;
    if (!/^\d{6}$/.test(otpCode)) {
      toast({ title: "Enter the verification code", description: "Use the six-digit code sent to your phone.", variant: "error" });
      triggerShake();
      return;
    }

    actionPending.current = true;
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

      const result = res.data?.data;
      if (result?.twoFactorRequired || result?.workspaceRequired) throw new Error("This account needs additional sign-in checks. Use Sign in to continue.");
      if (res.data?.success === false || !result?.user?.id || !result.user.role) throw new Error("Verification did not return a signed-in account. Please try again or sign in.");
      login(result.user);
      if (!useAuthStore.getState().isAuthenticated) throw new Error("Verification did not establish a session. Please sign in to continue.");
      navigationStarted.current = true;
      setIsNavigating(true);
      router.replace("/dashboard");
    } catch (err: any) {
      triggerShake();
      toast({
        title: "Code could not be verified",
        description: apiErrorMessage(err, "The code could not be verified. Please try again."),
        variant: "error",
      });
    } finally {
      if (!navigationStarted.current) {
        actionPending.current = false;
        setLoading(false);
      }
    }
  };

  return (
    <AuthPageShell wide>
        <fieldset disabled={loading || isNavigating} aria-busy={loading || isNavigating} aria-label="Create patient account" className="min-w-0 border-0 p-0">
        <Card padding="none" className={`${auth.card} ${isShaking ? "animate-shake" : ""}`}>
          {!otpSent ? (
            <form onSubmit={handleRequestOtp} noValidate className="space-y-5">
              <CardHeader className={auth.formHeader}>
                <CardTitle as="h1" className="page-title">Create your account</CardTitle>
                <CardDescription className="text-sm text-text-secondary">
                  Create a patient account with your mobile number. No password required.
                </CardDescription>
              </CardHeader>

              <CardContent className="p-0 space-y-4">
                <Input
                  size="lg"
                  label="Full Name *"
                  placeholder="e.g. John Doe"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  error={errors.name}
                  autoComplete="name"
                  required
                />

                <div className={auth.fields}>
                  <Input
                    size="lg"
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
                    size="lg"
                    label="Email Address (Optional)"
                    type="email"
                    placeholder="patient@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    error={errors.email}
                    autoComplete="email"
                  />
                </div>

                <div className={auth.pairedFields}>
                  <div>
                    <Select
                      size="lg"
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

                  <DatePicker
                    size="lg"
                    label="Date of Birth"
                    value={formData.dateOfBirth}
                    onChange={value => setFormData({ ...formData, dateOfBirth: value })}
                    autoComplete="bday"
                  />
                </div>
              </CardContent>

              <CardFooter className={`${auth.formFooter} flex flex-col gap-3`}>
                <Button type="submit" fullWidth loading={loading} size="lg">
                  Send verification code
                </Button>
                <div className="flex flex-wrap items-center justify-center gap-x-1.5 text-center text-sm text-text-secondary">
                  Already have an account?{" "}
                  {onSignIn ? <Button variant="ghost" size="sm" className="text-accent" onClick={onSignIn}>Sign In</Button> : <Link href="/login" prefetch={true} className="inline-flex min-h-11 items-center font-medium text-accent hover:underline">
                    <NavigationPending />Sign In
                  </Link>}
                </div>
              </CardFooter>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-5">
              <CardHeader className={auth.formHeader}>
                <CardTitle as="h1" className="page-title">Verify your mobile number</CardTitle>
                <CardDescription className="text-sm text-text-secondary">
                  Enter 6-digit code sent to <strong className="text-text">{formData.phone}</strong>
                </CardDescription>
              </CardHeader>

              <CardContent className="p-0 space-y-4">
                <Input
                  size="lg"
                  label="6-Digit Verification Code *"
                  placeholder="123456"
                  maxLength={6}
                  inputMode="numeric"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                  autoComplete="one-time-code"
                  required
                />
                <div className="flex items-center justify-end text-xs px-1">
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

              <CardFooter className={`${auth.formFooter} flex flex-col gap-3`}>
                <div className="flex w-full flex-col gap-2 min-[360px]:flex-row">
                  <Button type="button" variant="outline" onClick={() => { setOtpSent(false); setOtpCode(""); setResendTimer(0); }} >
                    Back
                  </Button>
                  <Button type="submit" fullWidth loading={loading} loadingText={isNavigating ? "Opening dashboard…" : "Verifying…"} size="lg" className="flex-1">
                    Complete Registration
                  </Button>
                </div>
                {onSignIn ? <Button variant="ghost" size="sm" className="text-accent" onClick={onSignIn}>Already registered? Sign in</Button> : <Link href="/login" prefetch={true} className="inline-flex min-h-11 items-center text-sm font-medium text-accent hover:underline">Already registered? Sign in</Link>}
              </CardFooter>
            </form>
          )}
        </Card>
        </fieldset>
        <p role="status" aria-live="polite" className="sr-only">{isNavigating ? "Opening your dashboard" : ""}</p>
    </AuthPageShell>
  );
}
