"use client";

import { useState, useEffect } from "react";
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
  Badge,
  Modal,
  useToast,
  ModeSwitcher,
  AnantaLogo,
  Spinner,
  cn,
} from "@/components/ui";

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Validation states
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");

  // Shake feedback on failed login
  const [isShaking, setIsShaking] = useState(false);

  // 2FA Auth states & Forgot Password states
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [isTwoFactorModalOpen, setIsTwoFactorModalOpen] = useState(false);
  const [twoFactorToken, setTwoFactorToken] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetEmailError, setResetEmailError] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [isResetSent, setIsResetSent] = useState(false);

  const router = useRouter();
  const { isAuthenticated, isLoading, login } = useAuthStore();
  const { toast } = useToast();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading || isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <Spinner size="lg" label="Signing into workspace..." />
      </div>
    );
  }

  const validateEmail = (val: string, isReset = false) => {
    const errorStateSetter = isReset ? setResetEmailError : setEmailError;
    if (!val) {
      errorStateSetter("Email address is required");
      return false;
    }
    if (!EMAIL_REGEX.test(val)) {
      errorStateSetter("Please enter a valid email address");
      return false;
    }
    errorStateSetter("");
    return true;
  };

  const validatePassword = (val: string) => {
    if (!val) {
      setPasswordError("Password is required");
      return false;
    }
    if (val.length < 8) {
      setPasswordError("Password must be at least 8 characters");
      return false;
    }
    if (!/[A-Z]/.test(val)) {
      setPasswordError("Password must contain at least one uppercase letter");
      return false;
    }
    if (!/[a-z]/.test(val)) {
      setPasswordError("Password must contain at least one lowercase letter");
      return false;
    }
    if (!/[0-9]/.test(val)) {
      setPasswordError("Password must contain at least one digit");
      return false;
    }
    setPasswordError("");
    return true;
  };

  const triggerShake = () => {
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 450);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    const isEmailValid = validateEmail(email);
    const isPassValid = validatePassword(password);

    if (!isEmailValid || !isPassValid) {
      triggerShake();
      return;
    }

    setLoading(true);

    try {
      const res = await api.post("/auth/login", { email, password });
      if (res.data?.data?.twoFactorRequired) {
        toast({
          title: "2FA Authentication Required",
          description: "Please enter your 2FA verification code to complete sign in.",
          variant: "warning",
        });
        setIsTwoFactorModalOpen(true);
        setTwoFactorToken(res.data.data.twoFactorToken || "");
        return;
      }

      login(res.data.data.user);
      toast({
        title: "Welcome back!",
        description: `Successfully logged in as ${res.data.data.user.name}.`,
        variant: "success",
        duration: 3000,
      });
      router.push("/dashboard");
    } catch (err: any) {
      triggerShake();
      toast({
        title: "Login Failed",
        description: err.response?.data?.message || "Invalid credentials. Please verify your email and password.",
        variant: "error",
        duration: 4000,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const isEmailValid = validateEmail(resetEmail, true);
    if (!isEmailValid) return;

    setResetLoading(true);
    try {
      await api.post("/auth/forgot-password", { email: resetEmail });
      setIsResetSent(true);
      toast({
        title: "Recovery Link Sent",
        description: `If an account exists for ${resetEmail}, password reset instructions have been dispatched.`,
        variant: "success",
        duration: 5000,
      });
    } catch (err: any) {
      toast({
        title: "Request Failed",
        description: err.response?.data?.message || "Unable to process recovery request. Please try again later.",
        variant: "error",
        duration: 4000,
      });
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-surface-alt relative overflow-hidden font-sans text-text">
      {/* Background ambient glow */}
      <div className="absolute top-[-15%] left-[-15%] w-[50%] h-[50%] bg-primary-500/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-15%] right-[-15%] w-[50%] h-[50%] bg-blue-500/10 rounded-full blur-[140px] pointer-events-none" />

      {/* Top Header Navigation */}
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

      <div className="w-full max-w-md relative z-10 animate-fade-up">
        {/* Brand Header */}
        <div className="text-center mb-6 flex flex-col items-center justify-center">
          <AnantaLogo size="xl" />
          <p className="text-text-secondary text-xs sm:text-sm mt-2">Sign in to ANANTA Healthcare OS</p>
        </div>

        {/* Auth Card Container */}
        <Card
          className={cn(
            "shadow-xl border-border/80 backdrop-blur-md bg-surface p-0 rounded-2xl overflow-hidden transition-transform duration-300",
            isShaking && "animate-shake"
          )}
        >
          {!isForgotPassword ? (
            /* Login Form */
            <form onSubmit={handleLogin} noValidate autoComplete="off" className="p-5 sm:p-6 space-y-4">
              <CardHeader className="p-0 mb-4 text-center">
                <CardTitle className="text-xl sm:text-2xl font-black text-text">Welcome Back</CardTitle>
                <CardDescription className="text-xs text-text-muted mt-1">
                  Enter your clinical credentials to access your account dashboard
                </CardDescription>
              </CardHeader>

              <CardContent className="p-0 space-y-4">
                <Input
                  label="Email Address *"
                  type="email"
                  placeholder="doctor@ananta.health"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (emailError) validateEmail(e.target.value);
                  }}
                  onBlur={() => validateEmail(email)}
                  error={emailError}
                  required
                  autoComplete="off"
                />

                <div>
                  <Input
                    label="Password *"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (passwordError) validatePassword(e.target.value);
                    }}
                    onBlur={() => validatePassword(password)}
                    error={passwordError}
                    required
                    autoComplete="off"
                    iconRight={
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="p-1 text-text-muted hover:text-text rounded-md transition-all cursor-pointer"
                        title={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? (
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                          </svg>
                        ) : (
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        )}
                      </button>
                    }
                  />
                  <div className="flex justify-end pt-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setIsForgotPassword(true);
                        setIsResetSent(false);
                        setResetEmail("");
                        setResetEmailError("");
                      }}
                      className="text-xs font-semibold text-primary-600 hover:underline cursor-pointer"
                    >
                      Forgot Password?
                    </button>
                  </div>
                </div>
              </CardContent>

              <CardFooter className="p-0 pt-2 flex flex-col gap-3">
                <Button type="submit" fullWidth loading={loading} size="lg" className="rounded-xl font-bold">
                  Sign In to Dashboard
                </Button>
              </CardFooter>
            </form>
          ) : (
            /* Forgot Password Form */
            <form onSubmit={handleResetPassword} noValidate className="p-5 sm:p-6 space-y-4">
              <CardHeader className="p-0 mb-3">
                <CardTitle className="text-xl font-bold">Recover Password</CardTitle>
                <CardDescription className="text-xs text-text-muted mt-1">
                  {!isResetSent
                    ? "Enter your email address and we will send password recovery instructions."
                    : "Instructions have been dispatched to your inbox."}
                </CardDescription>
              </CardHeader>

              <CardContent className="p-0 space-y-4">
                {!isResetSent ? (
                  <Input
                    label="Registered Email *"
                    type="email"
                    placeholder="doctor@ananta.health"
                    value={resetEmail}
                    onChange={(e) => {
                      setResetEmail(e.target.value);
                      if (resetEmailError) validateEmail(e.target.value, true);
                    }}
                    onBlur={() => validateEmail(resetEmail, true)}
                    error={resetEmailError}
                    required
                    autoComplete="email"
                  />
                ) : (
                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs leading-relaxed flex gap-2.5">
                    <svg className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a10 10 0 11-20 0 10 10 0 0120 0z" />
                    </svg>
                    <div>
                      Instructions have been sent to <strong className="text-text">{resetEmail}</strong>. Please check your inbox.
                    </div>
                  </div>
                )}
              </CardContent>

              <CardFooter className="p-0 pt-2 flex flex-col gap-3">
                {!isResetSent && (
                  <Button type="submit" fullWidth loading={resetLoading} size="md" className="rounded-xl font-bold">
                    Send Recovery Link
                  </Button>
                )}
                <button
                  type="button"
                  onClick={() => setIsForgotPassword(false)}
                  className="text-xs font-semibold text-text-secondary hover:text-text transition-colors cursor-pointer"
                >
                  &larr; Back to Sign In
                </button>
              </CardFooter>
            </form>
          )}
        </Card>
      </div>

      {/* 2FA OTP Verification Modal */}
      {isTwoFactorModalOpen && (
        <Modal
          isOpen={isTwoFactorModalOpen}
          onClose={() => setIsTwoFactorModalOpen(false)}
          title="Two-Factor Authentication Required"
          description="Enter the 6-digit verification code from your authenticator app"
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setOtpLoading(true);
              try {
                const res = await api.post("/auth/login/verify-2fa", {
                  twoFactorToken,
                  otp: otpCode.trim(),
                });
                login(res.data.data.user);
                toast({
                  title: "Welcome back!",
                  description: `2FA Verified. Logged in as ${res.data.data.user.name}.`,
                  variant: "success",
                });
                setIsTwoFactorModalOpen(false);
                router.push("/dashboard");
              } catch (err: any) {
                const msg = err.response?.data?.message || "";
                const isExpired = msg.toLowerCase().includes("expired") || msg.toLowerCase().includes("challenge");
                setOtpCode("");
                toast({
                  title: isExpired ? "Session Expired" : "Verification Failed",
                  description: isExpired
                    ? "Your 2FA session has expired. Please sign in again to get a new code prompt."
                    : msg || "Invalid 2FA code. Please check your authenticator app and try again.",
                  variant: "error",
                  duration: 5000,
                });
                if (isExpired) {
                  setIsTwoFactorModalOpen(false);
                  setTwoFactorToken("");
                }
              } finally {
                setOtpLoading(false);
              }
            }}
            className="space-y-4"
          >
            <Input
              label="6-Digit OTP Code"
              placeholder="123456"
              maxLength={6}
              inputMode="numeric"
              pattern="[0-9]{6}"
              autoComplete="one-time-code"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
              required
            />
            <Button type="submit" loading={otpLoading} fullWidth variant="primary">
              Verify & Sign In
            </Button>
          </form>
        </Modal>
      )}
    </div>
  );
}
