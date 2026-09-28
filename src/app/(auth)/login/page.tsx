"use client";

import { useState, useEffect, startTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/store/authStore";
import api from "@/lib/api";
import PasskeySignIn from "@/components/auth/PasskeySignIn";
import { detectPatientOtpTarget, patientOtpDestination, type PatientOtpTarget } from "@/lib/patientLogin";
import { NavigationPending } from "@/components/ui/RouteProgress";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, Input, Button, Modal, useToast, ModeSwitcher, EkavyuLogo, cn } from "@/components/ui";
import { AlertTriangle, Smartphone, Mail, Lock, KeyRound, Eye, EyeOff, ArrowLeft, ArrowRight, ShieldCheck, CheckCircle2, Clock, RotateCcw, Sparkles } from "lucide-react";

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export default function LoginPage() {
  const [authTab, setAuthTab] = useState<"mobile" | "email">("mobile");
  const [patientIdentifier, setPatientIdentifier] = useState("");
  const [patientIdentifierError, setPatientIdentifierError] = useState("");
  const [otpTarget, setOtpTarget] = useState<PatientOtpTarget | null>(null);
  const [phoneOtp, setPhoneOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpAction, setOtpAction] = useState<"sending" | "verifying" | null>(null);
  const otpLoading = otpAction !== null;
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
    if (otpLoading) return;
    const target = otpSent ? otpTarget : detectPatientOtpTarget(patientIdentifier);
    if (!target) {
      setPatientIdentifierError("Enter a valid email address or 10-digit mobile number.");
      triggerShake();
      return;
    }
    setPatientIdentifierError("");
    setOtpAction("sending");
    try {
      const res = await api.post("/auth/otp/request", { ...target, purpose: "authentication" });
      setOtpTarget(target);
      setOtpSent(true);
      setResendTimer(30);
      const destination = patientOtpDestination(target);
      toast({
        title: "Verification code sent",
        description: res.data?.data?.devOtp
          ? `Your verification code is ${res.data.data.devOtp}.`
          : `A verification code was sent to ${destination}.`,
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
      setOtpAction(null);
    }
  };

  const handleVerifyPatientOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otpLoading || !otpTarget) return;
    if (!/^\d{6}$/.test(phoneOtp)) {
      toast({ title: "Validation Error", description: "Enter 6-digit OTP code", variant: "error" });
      triggerShake();
      return;
    }

    setOtpAction("verifying");
    try {
      const res = await api.post("/auth/otp/verify", { ...otpTarget, otp: phoneOtp, purpose: "authentication" });
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
      setOtpAction(null);
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
        <div className="absolute inset-0 brand-wash" />
      </div>

      {/* Top Header Navigation */}
      <div className="absolute top-[max(1.25rem,env(safe-area-inset-top))] left-4 sm:left-8 z-20">
        <Link
          href="/browse"
          className="text-xs font-semibold text-text-secondary hover:text-text flex items-center gap-2 bg-surface/80 hover:bg-surface  px-3.5 py-2 rounded-full border border-border/80 hover:border-primary-500/30 transition-all shadow-2xs hover:shadow-xs group min-h-[40px] sm:min-h-0"
        >
          <NavigationPending />
          <ArrowLeft className="w-3.5 h-3.5 shrink-0 transition-transform group-hover:-translate-x-0.5" strokeWidth={2.25} />
          <span>Browse Clinics</span>
        </Link>
      </div>

      <div className="absolute top-[max(1.25rem,env(safe-area-inset-top))] right-4 sm:right-8 z-20">
        <ModeSwitcher variant="icon" />
      </div>

      <div className="w-full max-w-md relative z-10 animate-fade-up">
        {/* Brand Header */}
        <div className="text-center mb-6 flex flex-col items-center justify-center">
          <div className="relative mb-2">
            <div className="relative">
              <EkavyuLogo size="xl" />
            </div>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-500/10 border border-primary-500/20 text-[11px] font-bold text-accent dark:text-accent mt-2 shadow-2xs">
            <Sparkles className="w-3 h-3" strokeWidth={2} />
            <span>Care That Keeps Moving</span>
          </div>
        </div>

        {sessionExpired && (
          <div className="mb-4 p-3.5 rounded-2xl bg-warning/10 border border-warning/20 text-warning-text dark:text-warning-text text-xs flex items-center gap-2.5 shadow-2xs">
            <AlertTriangle className="w-4 h-4 shrink-0 text-warning-text" strokeWidth={2} />
            <span>Your session has expired for security. Please sign in again to continue.</span>
          </div>
        )}

        {/* Auth Card Container */}
        <Card
          className={cn(
            "shadow-lg   border border-border/80  bg-surface p-0 rounded-3xl overflow-hidden transition-transform duration-300 relative ring-1 ring-border/40",
            isShaking && "animate-shake"
          )}
        >
          {!isForgotPassword ? (
            <div className="p-6 sm:p-7 space-y-4">
              <CardHeader className="p-0 mb-3 text-center">
                <CardTitle as="h1" className="text-2xl font-black text-text tracking-tight">Welcome Back</CardTitle>
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
                    disabled={otpLoading}
                    onClick={() => {
                      startTransition(() => {
                        setAuthTab("mobile");
                        setOtpSent(false);
                        setPhoneOtp("");
                        setOtpTarget(null);
                      });
                    }}
                    className={cn(
                      "py-2 text-xs font-bold rounded-xl transition-all duration-200 cursor-pointer min-h-[44px] sm:min-h-0 flex items-center justify-center gap-1.5",
                      authTab === "mobile"
                        ? "bg-surface text-accent dark:text-accent shadow-xs border border-border/70"
                        : "text-text-muted hover:text-text hover:bg-surface/40"
                    )}
                  >
                    <Smartphone className="w-4 h-4 shrink-0" strokeWidth={authTab === "mobile" ? 2.25 : 1.75} />
                    <span>Patient Sign In</span>
                    <span className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded-md font-semibold hidden sm:inline-block",
                      authTab === "mobile" ? "bg-primary-500/10 text-accent dark:text-accent" : "bg-surface-alt text-text-muted"
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
                    disabled={otpLoading}
                    onClick={() => {
                      startTransition(() => {
                        setAuthTab("email");
                      });
                    }}
                    className={cn(
                      "py-2 text-xs font-bold rounded-xl transition-all duration-200 cursor-pointer min-h-[44px] sm:min-h-0 flex items-center justify-center gap-1.5",
                      authTab === "email"
                        ? "bg-surface text-accent dark:text-accent shadow-xs border border-border/70"
                        : "text-text-muted hover:text-text hover:bg-surface/40"
                    )}
                  >
                    <Mail className="w-4 h-4 shrink-0" strokeWidth={authTab === "email" ? 2.25 : 1.75} />
                    <span>Staff Email</span>
                    <span className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded-md font-semibold hidden xs:inline-block",
                      authTab === "email" ? "bg-primary-500/10 text-accent dark:text-accent" : "bg-surface-alt text-text-muted"
                    )}>
                      Clinic
                    </span>
                  </button>
                </div>
              </CardHeader>

              {authTab === "mobile" ? (
                /* Patient OTP Form */
                !otpSent ? (
                  <form id="panel-mobile" role="tabpanel" aria-labelledby="tab-mobile" onSubmit={handleRequestPatientOtp} noValidate className="space-y-4 animate-fade-in">
                    <Input
                      label="Email or mobile number"
                      type="text"
                      placeholder="Email address or 10-digit mobile number"
                      icon={patientIdentifier.includes("@") ? <Mail className="w-4 h-4 text-text-muted" /> : <Smartphone className="w-4 h-4 text-text-muted" />}
                      value={patientIdentifier}
                      onChange={(e) => { setPatientIdentifier(e.target.value); setPatientIdentifierError(""); }}
                      error={patientIdentifierError}
                      hint="We'll send a verification code to your email or phone."
                      autoComplete="username"
                      autoCapitalize="none"
                      spellCheck={false}
                      disabled={otpLoading}
                      required
                    />

                    <Button
                      type="submit"
                      fullWidth
                      loading={otpLoading}
                      loadingText="Sending code…"
                      size="lg"
                      className="rounded-xl font-bold min-h-[46px] shadow-md  hover:shadow-lg  transition-all flex items-center justify-center gap-2 group"
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
                        <div className="w-2 h-2 rounded-full bg-success animate-pulse shrink-0" />
                        <div className="flex flex-col min-w-0">
                          <span className="text-[11px] text-text-muted font-medium">OTP dispatched to</span>
                          <span className="font-bold text-text text-xs tracking-wide truncate">
                            {otpTarget ? patientOtpDestination(otpTarget) : ""}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={otpLoading}
                        onClick={() => { setOtpSent(false); setPhoneOtp(""); setOtpTarget(null); setResendTimer(0); }}
                        className="text-xs font-semibold text-accent dark:text-accent hover:underline cursor-pointer px-2.5 py-1 rounded-lg hover:bg-primary-500/10 transition-colors shrink-0"
                      >
                        Change
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
                      disabled={otpLoading}
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
                        <span className="text-accent dark:text-accent font-semibold bg-primary-500/10 px-2.5 py-0.5 rounded-full text-[11px]">
                          Resend in {resendTimer}s
                        </span>
                      ) : (
                        <Button variant="ghost" size="sm"
                          type="button"
                          onClick={handleRequestPatientOtp}
                          disabled={otpLoading}
                          className="text-accent dark:text-accent font-bold hover:underline cursor-pointer flex items-center gap-1 text-xs"
                        >
                          <RotateCcw className="w-3.5 h-3.5" strokeWidth={2} />
                          <span>Resend OTP</span>
                        </Button>
                      )}
                    </div>

                    <Button
                      type="submit"
                      fullWidth
                      loading={otpLoading}
                      loadingText={otpAction === "sending" ? "Sending code…" : "Verifying…"}
                      size="lg"
                      className="rounded-xl font-bold min-h-[46px] shadow-md  hover:shadow-lg  transition-all flex items-center justify-center gap-2 group"
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
                      placeholder="doctor@example.com"
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
                          className="text-xs font-semibold text-accent dark:text-accent hover:underline cursor-pointer"
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
                      loadingText="Signing in…"
                      size="lg"
                      className="rounded-xl font-bold min-h-[46px] shadow-md  hover:shadow-lg  transition-all flex items-center justify-center gap-2 group"
                    >
                      <span>Sign In to Dashboard</span>
                      <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" strokeWidth={2.25} />
                    </Button>
                  </CardFooter>
                </form>
              )}

              {/* Patient Registration Link */}
              <div className="mt-6 pt-4 border-t border-border/60 text-center flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 text-xs text-text-secondary">
                <span>New to Ekavyu Health?</span>
                <Link href="/register" className="font-bold text-accent dark:text-accent hover:underline flex items-center gap-1">
                  <NavigationPending />
                  <span>Create Patient Account</span>
                  <ArrowRight className="w-3 h-3 inline" strokeWidth={2} />
                </Link>
              </div>
            </div>
          ) : (
            /* Forgot Password Form */
            <form onSubmit={handleResetPassword} noValidate className="p-6 sm:p-7 space-y-4 animate-fade-in">
              <CardHeader className="p-0 mb-3">
                <CardTitle as="h1" className="text-xl font-bold tracking-tight">Recover Password</CardTitle>
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
                    placeholder="doctor@example.com"
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
                  <div className="p-4 rounded-2xl bg-success/10 border border-success/20 text-success-text dark:text-success-text text-xs leading-relaxed flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-success-text shrink-0 mt-0.5" strokeWidth={2} />
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
                    loadingText="Sending link…"
                    size="md"
                    className="rounded-xl font-bold min-h-[44px] shadow-md  hover:shadow-lg  transition-all flex items-center justify-center gap-2 group"
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
            <ShieldCheck className="w-3.5 h-3.5 text-success-text" strokeWidth={2.25} />
            <span>256-Bit SSL Encrypted</span>
          </span>
          <span className="w-1 h-1 rounded-full bg-border" />
          <span className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-accent" strokeWidth={2} />
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
          size="sm"
          presentation="dialog"
          busy={twoFactorLoading}
          description="Enter the 6-digit verification code from your authenticator app"
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (twoFactorLoading) return;
              setTwoFactorLoading(true);
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
                setTwoFactorLoading(false);
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
              disabled={twoFactorLoading}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
              required
            />
            <Button
              type="submit"
              loading={twoFactorLoading}
              loadingText="Verifying…"
              fullWidth
              size="lg"
              className="rounded-xl font-bold min-h-[46px] shadow-md  hover:shadow-lg  transition-all flex items-center justify-center gap-2 group"
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
