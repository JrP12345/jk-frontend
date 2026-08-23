"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/store/authStore";
import api from "@/lib/api";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Input,
  Button,
  Select,
  useToast,
  ModeSwitcher,
  AnantaLogo,
  cn,
} from "@/components/ui";

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

  const validateDetails = () => {
    const errs: Record<string, string> = {};
    if (!formData.name.trim()) errs.name = "Full name is required";
    if (!formData.phone.trim() || formData.phone.trim().length < 10) errs.phone = "Valid mobile phone number is required";
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
        phone: formData.phone,
        purpose: "authentication",
      });

      setOtpSent(true);
      toast({
        title: "OTP Dispatched! 📱",
        description: res.data?.data?.devOtp
          ? `[DEV MODE] OTP Code: ${res.data.data.devOtp}`
          : `Verification OTP sent to ${formData.phone}`,
        variant: "success",
        duration: 8000,
      });
    } catch (err: any) {
      triggerShake();
      toast({
        title: "OTP Request Failed",
        description: err.response?.data?.message || "Failed to send OTP",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || otpCode.length < 6) {
      toast({ title: "Validation Error", description: "Enter 6-digit OTP code", variant: "error" });
      triggerShake();
      return;
    }

    setLoading(true);
    try {
      const res = await api.post("/auth/otp/verify", {
        phone: formData.phone,
        otp: otpCode,
        name: formData.name,
        purpose: "authentication",
      });

      if (res.data?.success) {
        login(res.data.data.user);
        toast({
          title: "Registration Successful 🎉",
          description: `Welcome to ANANTA Healthcare, ${res.data.data.user.name}!`,
          variant: "success",
        });
        router.push("/dashboard/patient-portal");
      }
    } catch (err: any) {
      triggerShake();
      toast({
        title: "Verification Failed",
        description: err.response?.data?.message || "Invalid OTP code",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-surface-alt relative overflow-hidden font-sans text-text">
      <div className="absolute top-[-15%] left-[-15%] w-[50%] h-[50%] bg-primary-500/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-15%] right-[-15%] w-[50%] h-[50%] bg-blue-500/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="absolute top-6 left-6 z-20">
        <Link
          href="/browse"
          className="text-xs font-semibold text-text-secondary hover:text-text flex items-center gap-1.5 bg-surface/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-border/60 transition-all hover:border-border"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Browse Clinics
        </Link>
      </div>

      <div className="absolute top-6 right-6 z-20">
        <ModeSwitcher />
      </div>

      <div className="w-full max-w-lg relative z-10 animate-fade-up my-8">
        <div className="text-center mb-6 flex flex-col items-center justify-center">
          <AnantaLogo size="xl" />
          <p className="text-text-secondary text-xs sm:text-sm mt-2">Quick Patient Registration</p>
        </div>

        <Card
          className={cn(
            "shadow-xl border-border/80 backdrop-blur-md bg-surface p-0 rounded-2xl overflow-hidden transition-transform duration-300",
            isShaking && "animate-shake"
          )}
        >
          {!otpSent ? (
            <form onSubmit={handleRequestOtp} noValidate className="p-5 sm:p-6 space-y-4">
              <CardHeader className="p-0 mb-4">
                <CardTitle className="text-xl sm:text-2xl font-black text-text">Patient Registration</CardTitle>
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
                  required
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label="Mobile Phone Number *"
                    placeholder="9876543210"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    error={errors.phone}
                    required
                  />

                  <Input
                    label="Email Address (Optional)"
                    type="email"
                    placeholder="patient@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    error={errors.email}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">Gender</label>
                    <Select
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
                  />
                </div>
              </CardContent>

              <CardFooter className="p-0 pt-2 flex flex-col gap-3">
                <Button type="submit" fullWidth loading={loading} size="lg" className="rounded-xl font-bold">
                  Send Verification OTP
                </Button>
                <div className="text-center text-xs text-text-muted mt-1">
                  Already have an account?{" "}
                  <Link href="/login" className="font-semibold text-primary-600 hover:underline">
                    Sign In
                  </Link>
                </div>
              </CardFooter>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="p-5 sm:p-6 space-y-4">
              <CardHeader className="p-0 mb-4">
                <CardTitle className="text-xl sm:text-2xl font-black text-text">Verify OTP</CardTitle>
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
                  required
                />
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
