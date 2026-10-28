"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/store/authStore";
import api from "@/lib/api";
import { apiErrorMessage } from "@/lib/apiError";
import { detectPatientOtpTarget } from "@/lib/patientLogin";
import AuthPageShell from "@/components/auth/AuthPageShell";
import { NavigationPending } from "@/components/ui/RouteProgress";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, Input, Button, Select, useToast, DatePicker } from "@/components/ui";

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
        description: apiErrorMessage(err, "The code could not be verified. Please try again."),
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthPageShell>
        <Card padding="none" className={isShaking ? "animate-shake" : undefined}>
          {!otpSent ? (
            <form onSubmit={handleRequestOtp} noValidate className="p-4 sm:p-6 space-y-4">
              <CardHeader className="p-0 mb-3 text-center">
                <CardTitle as="h1" className="page-title">Patient Registration</CardTitle>
                <CardDescription className="text-sm text-text-secondary">
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

                <div className="grid grid-cols-1 min-[360px]:grid-cols-2 gap-3">
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

                  <DatePicker
                    label="Date of Birth"
                    value={formData.dateOfBirth}
                    onChange={value => setFormData({ ...formData, dateOfBirth: value })}
                    autoComplete="bday"
                  />
                </div>
              </CardContent>

              <CardFooter className="p-0 pt-2 flex flex-col gap-3">
                <Button type="submit" fullWidth loading={loading} size="lg">
                  Send Verification OTP
                </Button>
                <div className="flex flex-wrap items-center justify-center gap-x-1.5 text-center text-sm text-text-secondary">
                  Already have an account?{" "}
                  <Link href="/login" className="inline-flex min-h-11 items-center font-medium text-accent hover:underline">
                    <NavigationPending />Sign In
                  </Link>
                </div>
              </CardFooter>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="p-4 sm:p-6 space-y-4">
              <CardHeader className="p-0 mb-3 text-center">
                <CardTitle as="h1" className="page-title">Verify OTP</CardTitle>
                <CardDescription className="text-sm text-text-secondary">
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
                  <Button type="button" onClick={() => setOtpSent(false)} variant="ghost" size="xs">
                    Change Details
                  </Button>
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
                <div className="flex w-full flex-col gap-2 min-[360px]:flex-row">
                  <Button type="button" variant="outline" onClick={() => setOtpSent(false)} >
                    Back
                  </Button>
                  <Button type="submit" fullWidth loading={loading} size="lg" className="flex-1">
                    Complete Registration
                  </Button>
                </div>
              </CardFooter>
            </form>
          )}
        </Card>
    </AuthPageShell>
  );
}
