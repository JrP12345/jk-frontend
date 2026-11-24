"use client";

import { useState, useEffect, useRef, useCallback, startTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore, type User } from "@/store/authStore";
import api from "@/lib/api";
import { apiErrorMessage } from "@/lib/apiError";
import AuthPageShell from "@/components/auth/AuthPageShell";
import auth from "@/components/auth/AuthPageShell.module.css";
import PasskeySignIn from "@/components/auth/PasskeySignIn";
import LoginWorkspacePicker from "@/components/auth/LoginWorkspacePicker";
import type { WorkspaceSelection } from "@/types/workspace";
import { workspaceEntryPath } from "@/lib/workspaceEntry";
import { detectPatientOtpTarget, patientOtpDestination, type PatientOtpTarget } from "@/lib/patientLogin";
import { COUNTRIES, phoneCountryOptions, type CountryCode } from "@/lib/countries";
import { NavigationPending } from "@/components/ui/RouteProgress";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, Input, Select, Button, Modal, useToast, Tabs } from "@/components/ui";
import { AlertTriangle, Smartphone, Mail, Lock, KeyRound, Eye, EyeOff, ArrowLeft, ArrowRight, ShieldCheck, CheckCircle2, Clock, RotateCcw } from "lucide-react";

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export default function LoginForm({ onRegister, initialAudience = "patient" }: { onRegister?: () => void; initialAudience?: "patient" | "staff" }) {
  const [authTab, setAuthTab] = useState<"mobile" | "email">(initialAudience === "staff" ? "email" : "mobile");
  const [patientIdentifier, setPatientIdentifier] = useState("");
  const [phoneCountry, setPhoneCountry] = useState<CountryCode>("IN");
  const enteringPhone = !patientIdentifier.includes("@");
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
  const [workspaceSelection, setWorkspaceSelection] = useState<WorkspaceSelection | null>(null);
  const [resetEmail, setResetEmail] = useState("");
  const [resetEmailError, setResetEmailError] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [isResetSent, setIsResetSent] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const navigationStarted = useRef(false);

  const router = useRouter();
  const { isAuthenticated, isLoading, login } = useAuthStore();
  const { toast } = useToast();

  const openDashboard = useCallback((user?: User | null) => {
    if (navigationStarted.current) return;
    navigationStarted.current = true;
    setIsNavigating(true);
    startTransition(() => router.replace(workspaceEntryPath(user || useAuthStore.getState().user)));
  }, [router]);

  const completeSignIn = (user: User) => {
    if (navigationStarted.current) return;
    if (!user?.id) throw new Error("The server did not return a signed-in account");
    login(user);
    if (!useAuthStore.getState().isAuthenticated) throw new Error("Sign-in did not establish a session");
    setSessionExpired(false);
    openDashboard(user);
  };

  const acceptSignIn = (data: { user?: User; workspaceRequired?: boolean } & Partial<WorkspaceSelection>) => {
    if (data.workspaceRequired) {
      if (!data.workspaceToken || !data.workspaces?.length) throw new Error("No organization workspace is available");
      setIsTwoFactorModalOpen(false);
      setTwoFactorToken("");
      setOtpCode("");
      setWorkspaceSelection(data as WorkspaceSelection);
      return;
    }
    completeSignIn(data.user!);
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("audience") === "staff") startTransition(() => setAuthTab("email"));
      if (["expired", "error", "logout", "logged_out"].some(key => params.has(key))) {
        setSessionExpired(params.get("expired") === "1");
        useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: false });
        document.cookie = "ekavyu_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
        if (params.get("logout") === "1") {
          router.replace("/browse");
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
  }, [toast, router]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requiresSignIn = ["expired", "error", "logout", "logged_out"].some(key => params.has(key));
    if (!requiresSignIn && !sessionExpired && !isLoading && isAuthenticated) {
      openDashboard();
    }
  }, [isLoading, isAuthenticated, sessionExpired, openDashboard]);

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
    const target = otpSent ? otpTarget : detectPatientOtpTarget(patientIdentifier, phoneCountry);
    if (!target) {
      setPatientIdentifierError("Enter a valid email or mobile number for the selected country.");
      triggerShake();
      return;
    }
    setPatientIdentifierError("");
    setOtpAction("sending");
    try {
      const res = await api.post("/auth/otp/request", { ...target, purpose: "authentication" });
      if (res.data?.success === false || res.data?.data?.success === false) throw new Error("Verification code delivery is unavailable. Please try again shortly.");
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
        description: apiErrorMessage(err, "Please try again."),
        variant: "error",
      });
    } finally {
      setOtpAction(null);
    }
  };

  const handleVerifyPatientOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otpLoading || navigationStarted.current || !otpTarget) return;
    if (!/^\d{6}$/.test(phoneOtp)) {
      toast({ title: "Validation Error", description: "Enter 6-digit OTP code", variant: "error" });
      triggerShake();
      return;
    }

    setOtpAction("verifying");
    try {
      const res = await api.post("/auth/otp/verify", { ...otpTarget, otp: phoneOtp, purpose: "authentication" });
      if (res.data?.data?.twoFactorRequired) {
        setTwoFactorToken(res.data.data.twoFactorToken || '');
        setIsTwoFactorModalOpen(true);
        return;
      }
      acceptSignIn(res.data.data);
    } catch (err: any) {
      triggerShake();
      toast({
        title: "Verification Failed",
        description: apiErrorMessage(err, "The code could not be verified. Please try again."),
        variant: "error",
      });
    } finally {
      if (!navigationStarted.current) setOtpAction(null);
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
    if (loading || navigationStarted.current) return;

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
        setIsTwoFactorModalOpen(true);
        setTwoFactorToken(res.data.data.twoFactorToken || "");
        return;
      }

      acceptSignIn(res.data.data);
    } catch (err: any) {
      triggerShake();
      toast({
        title: "Login Failed",
        description: apiErrorMessage(err, "Sign-in could not be completed. Please try again."),
        variant: "error",
        duration: 4000,
      });
    } finally {
      if (!navigationStarted.current) setLoading(false);
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
        description: apiErrorMessage(err, "Unable to process recovery request. Please try again later."),
        variant: "error",
        duration: 4000,
      });
    } finally {
      setResetLoading(false);
    }
  };

  const signInPanel = authTab === "mobile" ? (
    /* Patient OTP Form */
    !otpSent ? (
      <form onSubmit={handleRequestPatientOtp} noValidate className="space-y-4 animate-fade-in">
        <Input
          size="lg"
          label="Email or mobile number"
          type="text"
          placeholder={enteringPhone ? "Email or mobile number" : "Enter your email address"}
          icon={!enteringPhone ? <Mail className="w-4 h-4 text-text-muted" /> : undefined}
          leadingControl={enteringPhone ? <Select
            size="lg"
            aria-label="Country code"
            value={phoneCountry}
            options={phoneCountryOptions}
            renderValue={() => COUNTRIES[phoneCountry].callingCode}
            variant="flush"
            containerClassName="w-24 shrink-0"
            className="rounded-l-xl px-3 focus-visible:ring-0"
            minMenuWidth={240}
            disabled={otpLoading}
            onChange={(event) => {
              if (patientIdentifier.trim().startsWith("+")) {
                const digits = `+${patientIdentifier.replace(/\D/g, "")}`;
                if (digits.startsWith(COUNTRIES[phoneCountry].callingCode)) setPatientIdentifier(digits.slice(COUNTRIES[phoneCountry].callingCode.length));
              }
              setPhoneCountry(event.target.value as CountryCode);
              setPatientIdentifierError("");
            }}
          /> : undefined}
          value={patientIdentifier}
          onChange={(e) => {
            const value = e.target.value;
            setPatientIdentifier(value);
            setPatientIdentifierError("");
            if (value.trim().startsWith("+")) {
              const digits = `+${value.replace(/\D/g, "")}`;
              if (!digits.startsWith(COUNTRIES[phoneCountry].callingCode)) {
                const country = (Object.keys(COUNTRIES) as CountryCode[]).find(code => digits.startsWith(COUNTRIES[code].callingCode));
                if (country) setPhoneCountry(country);
              }
            }
          }}
          error={patientIdentifierError}
          aria-describedby="patient-sign-in-hint"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          disabled={otpLoading}
          required
        />

        <p id="patient-sign-in-hint" className="text-xs leading-relaxed text-text-muted">We&apos;ll send a 6-digit verification code.</p>

        <Button
          type="submit"
          fullWidth
          loading={otpLoading}
          loadingText="Sending code…"
          size="lg"

        >
          <span>Send verification code</span>
          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" strokeWidth={2.25} />
        </Button>
      </form>
    ) : (
      <form onSubmit={handleVerifyPatientOtp} className="space-y-4 animate-fade-in">
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
          <Button type="button" disabled={otpLoading} onClick={() => { setOtpSent(false); setPhoneOtp(""); setOtpTarget(null); setResendTimer(0); }} variant="outline" size="xs" className="shrink-0">
            Change
          </Button>
        </div>

        <Input
          size="lg"
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
          loadingText={isNavigating ? "Opening dashboard…" : otpAction === "sending" ? "Sending code…" : "Verifying…"}
          size="lg"

        >
          <span>Verify & Sign In</span>
          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" strokeWidth={2.25} />
        </Button>
      </form>
    )
  ) : (

    /* Email Password Form */
    <form onSubmit={handleLogin} noValidate className="space-y-4 animate-fade-in">
      <CardContent className="p-0 space-y-4">
        <Input
          size="lg"
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
            size="lg"
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
                className="text-text-muted hover:text-text rounded-md cursor-pointer flex items-center justify-center min-h-11 min-w-11 focus-visible:outline-2 focus-visible:outline-focus-ring"
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
            <Button type="button" onClick={() => {
                setIsForgotPassword(true);
                setIsResetSent(false);
                setResetEmail("");
                setResetEmailError("");
              }} variant="ghost" size="xs" className="text-accent">
              Forgot Password?
            </Button>
          </div>
        </div>
  </CardContent>

      <CardFooter className={`${auth.formFooter} flex flex-col gap-3`}>
        <Button
          type="submit"
          fullWidth
          loading={loading}
          loadingText={isNavigating ? "Opening dashboard…" : "Signing in…"}
          size="lg"

        >
          <span>Sign In to Dashboard</span>
          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" strokeWidth={2.25} />
        </Button>
      </CardFooter>
      <div><div className={auth.divider}>or</div><PasskeySignIn onSuccess={completeSignIn} onWorkspace={setWorkspaceSelection} disabled={loading || twoFactorLoading || isNavigating || isTwoFactorModalOpen || Boolean(workspaceSelection)} onTwoFactor={(token) => { setTwoFactorToken(token); setIsTwoFactorModalOpen(true); }} /></div>
    </form>
  );

  return (
    <AuthPageShell>
        {sessionExpired && (
          <div className="mb-4 p-3.5 rounded-2xl bg-warning/10 border border-warning/20 text-warning-text dark:text-warning-text text-xs flex items-center gap-2.5 shadow-2xs">
            <AlertTriangle className="w-4 h-4 shrink-0 text-warning-text" strokeWidth={2} />
            <span>Your session has expired for security. Please sign in again to continue.</span>
          </div>
        )}

        {/* Auth Card Container */}
        <fieldset disabled={isNavigating} aria-busy={isNavigating} aria-label="Sign in" className="min-w-0 w-full border-0 p-0">
        <Card padding="none" className={`${auth.card} ${isShaking ? "animate-shake" : ""}`}>
          {!isForgotPassword ? (
            <div className={auth.loginLayout}>
              <CardHeader className={auth.formHeader}>
                <CardTitle as="h1" className="page-title">Welcome back</CardTitle>
                <CardDescription className="text-sm text-text-secondary">
                  Sign in for your visits or your team’s workspace.
                </CardDescription>


              </CardHeader>

              <Tabs
                activeTab={authTab}
                variant="pills"
                scrollActiveIntoView={false}
                className={auth.tabs}
                onChange={tab => startTransition(() => {
                  setAuthTab(tab as "mobile" | "email");
                  setPassword("");
                  setShowPassword(false);
                  if (tab === "mobile") { setOtpSent(false); setPhoneOtp(""); setOtpTarget(null); }
                })}
                tabs={[
                  { id: "mobile", label: "Patient", icon: <Smartphone aria-hidden="true" className="h-4 w-4" />, disabled: otpLoading || loading || twoFactorLoading || isNavigating || isTwoFactorModalOpen || Boolean(workspaceSelection), content: authTab === "mobile" ? signInPanel : undefined },
                  { id: "email", label: "Staff", icon: <Mail aria-hidden="true" className="h-4 w-4" />, disabled: otpLoading || loading || twoFactorLoading || isNavigating || isTwoFactorModalOpen || Boolean(workspaceSelection), content: authTab === "email" ? signInPanel : undefined },
                ]}
              />

              {/* Patient Registration Link */}
              <div className={auth.accountLinks}>
                {authTab === "mobile" ? <div>New to Ekavyu? {onRegister ? <Button variant="ghost" size="sm" className="text-accent" disabled={otpLoading || isNavigating} onClick={onRegister}>Create patient account</Button> : <Link href="/login?mode=register"><NavigationPending />Create patient account</Link>}</div> : <>
                  <p className="text-xs">Use the account provided by your organization.</p>
                  <p>Setting up a practice? <Link href="/onboarding?mode=new_org"><NavigationPending />Request clinic setup</Link></p>
                  <Link href="/pharmacy-start">Start pharmacy onboarding</Link>
                </>}
              </div>
            </div>
          ) : (
            /* Forgot Password Form */
            <form onSubmit={handleResetPassword} noValidate className="space-y-5">
              <CardHeader className={auth.formHeader}>
                <CardTitle as="h1" className="page-title">Recover Password</CardTitle>
                <CardDescription className="text-sm text-text-secondary">
                  {!isResetSent
                    ? "Enter your email address and we will send password recovery instructions."
                    : "Instructions have been dispatched to your inbox."}
                </CardDescription>
              </CardHeader>

              <CardContent className="p-0 space-y-4">
                {!isResetSent ? (
                  <Input
                    size="lg"
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

              <CardFooter className={`${auth.formFooter} flex flex-col gap-3`}>
                {!isResetSent && (
                  <Button
                    type="submit"
                    fullWidth
                    loading={resetLoading}
                    loadingText="Sending link…"
                    size="md"

                  >
                    <span>Send Recovery Link</span>
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" strokeWidth={2.25} />
                  </Button>
                )}
                <Button type="button" onClick={() => setIsForgotPassword(false)} variant="ghost" size="xs">
                  <ArrowLeft className="w-3.5 h-3.5" strokeWidth={2} />
                  <span>Back to Sign In</span>
                </Button>
              </CardFooter>
            </form>
          )}
        </Card>
        </fieldset>
        <p role="status" aria-live="polite" className="sr-only">{isNavigating ? "Opening your dashboard" : ""}</p>


      {/* 2FA OTP Verification Modal */}
      {workspaceSelection && <LoginWorkspacePicker selection={workspaceSelection} onSuccess={completeSignIn}
        onCancel={() => { setWorkspaceSelection(null); setPassword(""); }} />}
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
              if (twoFactorLoading || navigationStarted.current) return;
              setTwoFactorLoading(true);
              try {
                const res = await api.post("/auth/login/verify-2fa", {
                  twoFactorToken,
                  otp: otpCode.trim(),
                });
                acceptSignIn(res.data.data);
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
                if (!navigationStarted.current) setTwoFactorLoading(false);
              }
            }}
            className="space-y-4"
          >
            <Input
              size="lg"
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
              loadingText={isNavigating ? "Opening dashboard…" : "Verifying…"}
              fullWidth
              size="lg"

            >
              <span>Verify & Sign In</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" strokeWidth={2.25} />
            </Button>
          </form>
        </Modal>
      )}
    </AuthPageShell>
  );
}
