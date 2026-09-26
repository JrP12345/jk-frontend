"use client";

import { useState, useEffect, startTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/store/authStore";
import api from "@/lib/api";
import PasskeySignIn from "@/components/auth/PasskeySignIn";
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
import {
  AlertTriangle,
  Smartphone,
  Mail,
  Lock,
  KeyRound,
  Eye,
  EyeOff,
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Clock,
  RotateCcw,
  Sparkles,
} from "lucide-react";

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export default function LoginPage() {
  const [authTab, setAuthTab] = useState<"mobile" | "email">("mobile");
  const [patientOtpMode, setPatientOtpMode] = useState<"mobile" | "email">("mobile");
  const [phone, setPhone] = useState("");
  const [patientEmail, setPatientEmail] = useState("");
  const [phoneOtp, setPhoneOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

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
  const [twoFactorLoading, setTwoFactorLoading] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetEmailError, setResetEmailError] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [isResetSent, setIsResetSent] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);

  const router = useRouter();
  const { isAuthenticated, isLoading, login } = useAuthStore();
  const { toast } = useToast();

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("expired") === "1" || params.get("error") || params.get("logout") === "1") {
        setSessionExpired(true);
        useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: false });
        document.cookie = "ananta_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
        if (params.get("logout") === "1") {
          toast({
            title: "Signed Out",
            description: "You have been successfully signed out.",
            variant: "info",
            duration: 4000,
          });
        } else if (params.get("expired") === "1") {
          toast({
            title: "Session Expired",
            description: "Your session has timed out for security. Please sign in again.",
            variant: "warning",
            duration: 6000,
          });
        }
      }
    }
  }, [toast]);

  useEffect(() => {
    if (!sessionExpired && !isLoading && isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [isLoading, isAuthenticated, sessionExpired, router]);

  useEffect(() => {
    let interval: any;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);


  const handleRequestPatientOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (patientOtpMode === "mobile") {
      if (!phone || phone.length < 10) {
        toast({ title: "Validation Error", description: "Please enter a valid 10-digit mobile phone number", variant: "error" });
        triggerShake();
        return;
      }
    } else {
      if (!patientEmail || !EMAIL_REGEX.test(patientEmail)) {
        toast({ title: "Validation Error", description: "Please enter a valid email address", variant: "error" });
        triggerShake();
        return;
      }
    }

    setOtpLoading(true);
    try {
      const payload = patientOtpMode === "mobile"
        ? { phone, purpose: "authentication" }
        : { email: patientEmail.trim().toLowerCase(), purpose: "authentication" };

      const res = await api.post("/auth/otp/request", payload);
      setOtpSent(true);
      setResendTimer(30);
      const destination = patientOtpMode === "mobile" ? `+91 ${phone}` : patientEmail;
      toast({
        title: patientOtpMode === "mobile" ? "OTP Dispatched! 📱" : "OTP Dispatched! ✉️",
        description: res.data?.data?.devOtp
          ? `[DEV MODE] Your OTP code is: ${res.data.data.devOtp}`
          : `Verification OTP has been sent to ${destination}`,
        variant: "success",
        duration: 8000,
      });
    } catch (err: any) {
      triggerShake();
      toast({
        title: "OTP Dispatch Failed",
        description: err.response?.data?.message || "Failed to send OTP",
        variant: "error",
      });
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyPatientOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneOtp || phoneOtp.length < 6) {
      toast({ title: "Validation Error", description: "Enter 6-digit OTP code", variant: "error" });
      triggerShake();
      return;
    }

    setOtpLoading(true);
    try {
      const payload = patientOtpMode === "mobile"
        ? { phone, otp: phoneOtp, purpose: "authentication" }
        : { email: patientEmail.trim().toLowerCase(), otp: phoneOtp, purpose: "authentication" };

      const res = await api.post("/auth/otp/verify", payload);
      login(res.data.data.user);
      toast({
        title: "Welcome!",
        description: `Successfully logged in as ${res.data.data.user.name}.`,
        variant: "success",
      });
      router.push("/dashboard");
    } catch (err: any) {
      triggerShake();
      toast({
        title: "Verification Failed",
        description: err.response?.data?.message || "Invalid OTP code",
        variant: "error",
      });
    } finally {
      setOtpLoading(false);
    }
  };


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
    <div className="min-h-screen flex flex-col items-center justify-center p-4 py-10 bg-surface-alt relative font-sans text-text animate-page-enter">
      {/* Background ambient glow & subtle pattern */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-15%] w-[60%] h-[60%] bg-primary-500/12 rounded-full blur-[160px]" />
        <div className="absolute bottom-[-20%] right-[-15%] w-[60%] h-[60%] bg-blue-500/10 rounded-full blur-[160px]" />
        <div className="absolute inset-0 bg-[radial-gradient(var(--color-border)_1px,transparent_1px)] [background-size:24px_24px] opacity-30 dark:opacity-20" />
      </div>

      {/* Top Header Navigation */}
      <div className="absolute top-[max(1.25rem,env(safe-area-inset-top))] left-4 sm:left-8 z-20">
        <Link
          href="/browse"
          className="text-xs font-semibold text-text-secondary hover:text-text flex items-center gap-2 bg-surface/80 hover:bg-surface backdrop-blur-md px-3.5 py-2 rounded-full border border-border/80 hover:border-primary-500/30 transition-all shadow-2xs hover:shadow-xs group min-h-[40px] sm:min-h-0"
        >
          <ArrowLeft className="w-3.5 h-3.5 shrink-0 transition-transform group-hover:-translate-x-0.5" strokeWidth={2.25} />
          <span>Browse Clinics</span>
        </Link>
      </div>

      <div className="absolute top-[max(1.25rem,env(safe-area-inset-top))] right-4 sm:right-8 z-20">
        <ModeSwitcher />
      </div>

      <div className="w-full max-w-md relative z-10 animate-fade-up">
        {/* Brand Header */}
        <div className="text-center mb-6 flex flex-col items-center justify-center">
          <div className="relative mb-2">
            <div className="absolute inset-0 bg-primary-500/20 blur-xl rounded-full scale-150 pointer-events-none" />
            <div className="relative">
              <AnantaLogo size="xl" />
            </div>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-500/10 border border-primary-500/20 text-[11px] font-bold text-primary-600 dark:text-primary-400 mt-2 shadow-2xs">
            <Sparkles className="w-3 h-3" strokeWidth={2} />
            <span>ANANTA Healthcare OS</span>
          </div>
        </div>

        {sessionExpired && (
          <div className="mb-4 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2.5 shadow-2xs">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" strokeWidth={2} />
            <span>Your session has expired for security. Please sign in again to continue.</span>
          </div>
        )}

        {/* Auth Card Container */}
        <Card
          className={cn(
            "shadow-2xl shadow-primary-950/10 dark:shadow-black/50 border border-border/80 backdrop-blur-xl bg-surface/95 dark:bg-surface/90 p-0 rounded-3xl overflow-hidden transition-transform duration-300 relative before:absolute before:inset-x-0 before:top-0 before:h-[2px] before:bg-gradient-to-r before:from-transparent before:via-primary-500 before:to-transparent ring-1 ring-border/40",
            isShaking && "animate-shake"
          )}
        >
          {!isForgotPassword ? (
            <div className="p-6 sm:p-7 space-y-4">
              <CardHeader className="p-0 mb-3 text-center">
                <CardTitle className="text-2xl font-black text-text tracking-tight">Welcome Back</CardTitle>
                <CardDescription className="text-xs text-text-muted mt-1 font-medium">
                  Access your patient portal or healthcare workspace
                </CardDescription>

                {/* Auth Mode Tabs */}
                <div role="tablist" aria-label="Sign in options" className="grid grid-cols-2 p-1.5 bg-surface-alt/90 rounded-2xl border border-border/70 mt-4 gap-1.5">
                  <button
                    id="tab-mobile"
                    role="tab"
                    aria-selected={authTab === "mobile"}
                    aria-controls="panel-mobile"
                    type="button"
                    onClick={() => {
                      startTransition(() => {
                        setAuthTab("mobile");
                        setOtpSent(false);
                        setPhoneOtp("");
                      });
                    }}
                    className={cn(
                      "py-2 text-xs font-bold rounded-xl transition-all duration-200 cursor-pointer min-h-[44px] sm:min-h-0 flex items-center justify-center gap-1.5",
                      authTab === "mobile"
                        ? "bg-surface text-primary-600 dark:text-primary-400 shadow-xs border border-border/70"
                        : "text-text-muted hover:text-text hover:bg-surface/40"
                    )}
                  >
                    <Smartphone className="w-4 h-4 shrink-0" strokeWidth={authTab === "mobile" ? 2.25 : 1.75} />
                    <span>Patient Sign In</span>
                    <span className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded-md font-semibold hidden sm:inline-block",
                      authTab === "mobile" ? "bg-primary-500/10 text-primary-600 dark:text-primary-400" : "bg-surface-alt text-text-muted"
                    )}>
                      OTP
                    </span>
                  </button>
                  <button
                    id="tab-email"
                    role="tab"
                    aria-selected={authTab === "email"}
                    aria-controls="panel-email"
                    type="button"
                    onClick={() => {
                      startTransition(() => {
                        setAuthTab("email");
                      });
                    }}
                    className={cn(
                      "py-2 text-xs font-bold rounded-xl transition-all duration-200 cursor-pointer min-h-[44px] sm:min-h-0 flex items-center justify-center gap-1.5",
                      authTab === "email"
                        ? "bg-surface text-primary-600 dark:text-primary-400 shadow-xs border border-border/70"
                        : "text-text-muted hover:text-text hover:bg-surface/40"
                    )}
                  >
                    <Mail className="w-4 h-4 shrink-0" strokeWidth={authTab === "email" ? 2.25 : 1.75} />
                    <span>Staff Email</span>
                    <span className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded-md font-semibold hidden xs:inline-block",
                      authTab === "email" ? "bg-primary-500/10 text-primary-600 dark:text-primary-400" : "bg-surface-alt text-text-muted"
                    )}>
                      Clinic
                    </span>
                  </button>
                </div>
              </CardHeader>

              {authTab === "mobile" ? (
                /* Patient OTP Form */
                !otpSent ? (
                  <form id="panel-mobile" role="tabpanel" aria-labelledby="tab-mobile" onSubmit={handleRequestPatientOtp} className="space-y-4 animate-fade-in">
                    {/* Patient Mode Selector: Mobile OTP vs Email OTP */}
                    <div className="flex p-1 bg-surface-alt/80 rounded-xl border border-border/60 gap-1 mb-2">
                      <button
                        type="button"
                        onClick={() => { setPatientOtpMode("mobile"); setPhoneOtp(""); }}
                        className={cn(
                          "flex-1 py-1.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer",
                          patientOtpMode === "mobile"
                            ? "bg-surface text-primary-600 dark:text-primary-400 shadow-2xs font-bold border border-border/40"
                            : "text-text-muted hover:text-text"
                        )}
                      >
                        <Smartphone className="w-3.5 h-3.5" />
                        <span>Mobile Phone</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => { setPatientOtpMode("email"); setPhoneOtp(""); }}
                        className={cn(
                          "flex-1 py-1.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer",
                          patientOtpMode === "email"
                            ? "bg-surface text-primary-600 dark:text-primary-400 shadow-2xs font-bold border border-border/40"
                            : "text-text-muted hover:text-text"
                        )}
                      >
                        <Mail className="w-3.5 h-3.5" />
                        <span>Email Address</span>
                      </button>
                    </div>

                    {patientOtpMode === "mobile" ? (
                      <Input
                        label="Mobile Phone Number *"
                        type="tel"
                        inputMode="tel"
                        placeholder="9876543210"
                        icon={<Smartphone className="w-4 h-4 text-text-muted" strokeWidth={2} />}
                        prefix="+91"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                        autoComplete="tel"
                        required
                      />
                    ) : (
                      <Input
                        label="Patient Email Address *"
                        type="email"
                        inputMode="email"
                        placeholder="patient@example.com"
                        icon={<Mail className="w-4 h-4 text-text-muted" strokeWidth={2} />}
                        value={patientEmail}
                        onChange={(e) => setPatientEmail(e.target.value.trim())}
                        autoComplete="email"
                        required
                      />
                    )}

                    <Button
                      type="submit"
                      fullWidth
                      loading={otpLoading}
                      size="lg"
                      className="rounded-xl font-bold min-h-[46px] shadow-md shadow-primary-500/20 hover:shadow-lg hover:shadow-primary-500/30 transition-all flex items-center justify-center gap-2 group"
                    >
                      <span>Send Verification OTP</span>
                      <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" strokeWidth={2.25} />
                    </Button>
                  </form>
                ) : (
                  <form id="panel-mobile" role="tabpanel" aria-labelledby="tab-mobile" onSubmit={handleVerifyPatientOtp} className="space-y-4 animate-fade-in">
                    {/* Active Destination Chip */}
                    <div className="flex items-center justify-between p-3 bg-primary-500/8 dark:bg-primary-500/10 rounded-2xl border border-primary-500/20 text-xs">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                        <div className="flex flex-col min-w-0">
                          <span className="text-[11px] text-text-muted font-medium">OTP dispatched to</span>
                          <span className="font-bold text-text text-xs tracking-wide truncate">
                            {patientOtpMode === "mobile" ? `+91 ${phone}` : patientEmail}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setOtpSent(false); setPhoneOtp(""); }}
                        className="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline cursor-pointer px-2.5 py-1 rounded-lg hover:bg-primary-500/10 transition-colors shrink-0"
                      >
                        Change {patientOtpMode === "mobile" ? "Number" : "Email"}
                      </button>
                    </div>

                    <Input
                      label="6-Digit Verification OTP *"
                      placeholder="••••••"
                      maxLength={6}
                      inputMode="numeric"
                      icon={<KeyRound className="w-4 h-4 text-text-muted" strokeWidth={2} />}
                      className="tracking-[0.4em] font-mono text-center text-lg sm:text-base font-bold placeholder:tracking-normal placeholder:font-sans"
                      value={phoneOtp}
                      onChange={(e) => setPhoneOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      autoComplete="one-time-code"
                      required
                    />

                    <div className="flex items-center justify-between text-xs px-1">
                      <span className="text-text-muted flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" strokeWidth={2} />
                        <span>Didn't receive code?</span>
                      </span>
                      {resendTimer > 0 ? (
                        <span className="text-primary-600 dark:text-primary-400 font-semibold bg-primary-500/10 px-2.5 py-0.5 rounded-full text-[11px]">
                          Resend in {resendTimer}s
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={handleRequestPatientOtp}
                          disabled={otpLoading}
                          className="text-primary-600 dark:text-primary-400 font-bold hover:underline cursor-pointer flex items-center gap-1 text-xs"
                        >
                          <RotateCcw className="w-3.5 h-3.5" strokeWidth={2} />
                          <span>Resend OTP</span>
                        </button>
                      )}
                    </div>

                    <Button
                      type="submit"
                      fullWidth
                      loading={otpLoading}
                      size="lg"
                      className="rounded-xl font-bold min-h-[46px] shadow-md shadow-primary-500/20 hover:shadow-lg hover:shadow-primary-500/30 transition-all flex items-center justify-center gap-2 group"
                    >
                      <span>Verify & Sign In</span>
                      <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" strokeWidth={2.25} />
                    </Button>
                  </form>
                )
              ) : (

                /* Email Password Form */
                <form id="panel-email" role="tabpanel" aria-labelledby="tab-email" onSubmit={handleLogin} noValidate className="space-y-4 animate-fade-in">
                  <CardContent className="p-0 space-y-4">
                    <Input
                      label="Staff Email Address *"
                      type="email"
                      placeholder="doctor@anant.health"
                      icon={<Mail className="w-4 h-4 text-text-muted" strokeWidth={2} />}
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (emailError) validateEmail(e.target.value);
                      }}
                      onBlur={() => validateEmail(email)}
                      error={emailError}
                      required
                      autoComplete="username"
                    />

                    <div>
                      <Input
                        label="Password *"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        icon={<Lock className="w-4 h-4 text-text-muted" strokeWidth={2} />}
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          if (passwordError) validatePassword(e.target.value);
                        }}
                        onBlur={() => validatePassword(password)}
                        error={passwordError}
                        required
                        autoComplete="current-password"
                        rightIcon={
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="p-1 text-text-muted hover:text-text rounded-md transition-all cursor-pointer flex items-center justify-center min-h-[28px] min-w-[28px]"
                            title={showPassword ? "Hide password" : "Show password"}
                            aria-label={showPassword ? "Hide password" : "Show password"}
                          >
                            {showPassword ? (
                              <EyeOff className="w-4 h-4" strokeWidth={2} />
                            ) : (
                              <Eye className="w-4 h-4" strokeWidth={2} />
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
                          className="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline cursor-pointer"
                        >
                          Forgot Password?
                        </button>
                      </div>
                    </div>
                  <div className="pt-4"><PasskeySignIn onTwoFactor={(token) => { setTwoFactorToken(token); setIsTwoFactorModalOpen(true); }} /></div>
              </CardContent>

                  <CardFooter className="p-0 pt-2 flex flex-col gap-3">
                    <Button
                      type="submit"
                      fullWidth
                      loading={loading}
                      size="lg"
                      className="rounded-xl font-bold min-h-[46px] shadow-md shadow-primary-500/20 hover:shadow-lg hover:shadow-primary-500/30 transition-all flex items-center justify-center gap-2 group"
                    >
                      <span>Sign In to Dashboard</span>
                      <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" strokeWidth={2.25} />
                    </Button>
                  </CardFooter>
                </form>
              )}

              {/* Patient Registration Link */}
              <div className="mt-6 pt-4 border-t border-border/60 text-center flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 text-xs text-text-secondary">
                <span>New to ANANTA Health?</span>
                <Link href="/register" className="font-bold text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1">
                  <span>Create Patient Account</span>
                  <ArrowRight className="w-3 h-3 inline" strokeWidth={2} />
                </Link>
              </div>
            </div>
          ) : (
            /* Forgot Password Form */
            <form onSubmit={handleResetPassword} noValidate className="p-6 sm:p-7 space-y-4 animate-fade-in">
              <CardHeader className="p-0 mb-3">
                <CardTitle className="text-xl font-bold tracking-tight">Recover Password</CardTitle>
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
                    placeholder="doctor@anant.health"
                    icon={<Mail className="w-4 h-4 text-text-muted" strokeWidth={2} />}
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
                  <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs leading-relaxed flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" strokeWidth={2} />
                    <div>
                      Instructions have been sent to <strong className="text-text">{resetEmail}</strong>. Please check your inbox.
                    </div>
                  </div>
                )}
              </CardContent>

              <CardFooter className="p-0 pt-2 flex flex-col gap-3">
                {!isResetSent && (
                  <Button
                    type="submit"
                    fullWidth
                    loading={resetLoading}
                    size="md"
                    className="rounded-xl font-bold min-h-[44px] shadow-md shadow-primary-500/20 hover:shadow-lg hover:shadow-primary-500/30 transition-all flex items-center justify-center gap-2 group"
                  >
                    <span>Send Recovery Link</span>
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" strokeWidth={2.25} />
                  </Button>
                )}
                <button
                  type="button"
                  onClick={() => setIsForgotPassword(false)}
                  className="text-xs font-semibold text-text-secondary hover:text-text transition-colors cursor-pointer flex items-center justify-center gap-1.5 py-1 min-h-[36px]"
                >
                  <ArrowLeft className="w-3.5 h-3.5" strokeWidth={2} />
                  <span>Back to Sign In</span>
                </button>
              </CardFooter>
            </form>
          )}
        </Card>

        {/* Security & Compliance Badges */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[11px] text-text-muted font-medium">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" strokeWidth={2.25} />
            <span>256-Bit SSL Encrypted</span>
          </span>
          <span className="w-1 h-1 rounded-full bg-border" />
          <span className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-primary-500" strokeWidth={2} />
            <span>ABDM & HIPAA Compliant</span>
          </span>
        </div>
      </div>

      {/* 2FA OTP Verification Modal */}
      {isTwoFactorModalOpen && (
        <Modal
          open={isTwoFactorModalOpen}
          onClose={() => setIsTwoFactorModalOpen(false)}
          title="Two-Factor Authentication"
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
              label="6-Digit OTP Code *"
              placeholder="••••••"
              maxLength={6}
              inputMode="numeric"
              pattern="[0-9]{6}"
              icon={<ShieldCheck className="w-4 h-4 text-text-muted" strokeWidth={2} />}
              className="tracking-[0.4em] font-mono text-center font-bold text-lg placeholder:tracking-normal placeholder:font-sans"
              autoComplete="one-time-code"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
              required
            />
            <Button
              type="submit"
              loading={otpLoading}
              fullWidth
              size="lg"
              className="rounded-xl font-bold min-h-[46px] shadow-md shadow-primary-500/20 hover:shadow-lg hover:shadow-primary-500/30 transition-all flex items-center justify-center gap-2 group"
            >
              <span>Verify & Sign In</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" strokeWidth={2.25} />
            </Button>
          </form>
        </Modal>
      )}
    </div>
  );
}
