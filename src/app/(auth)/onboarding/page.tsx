"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  useToast,
  Stepper,
  ModeSwitcher,
  AnantaLogo,
  Badge,
  Spinner,
  Checkbox,
  cn
} from "@/components/ui";
import { Eye, EyeOff, RefreshCw, ArrowLeft } from "lucide-react";

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const PHONE_REGEX = /^[0-9+\s-]{8,15}$/;

const STEPS = [
  { label: "Your Practice", description: "Profile & Admin" },
  { label: "Secure Account", description: "Google Authenticator" },
  { label: "You're Ready!", description: "Workspace Live" }
];

function OnboardingInner() {
  const [step, setStep] = useState(0);
  const router = useRouter();
  const searchParams = useSearchParams();
  const onboardingKey = searchParams.get("key") || "";
  const planParam = searchParams.get("plan") || "starter";
  const modeParam = searchParams.get("mode") || "";
  const { user, login } = useAuthStore();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [isMultiLocation, setIsMultiLocation] = useState(false);
  const [createdOrgId, setCreatedOrgId] = useState<string>("");
  const [isGeneratingQR, setIsGeneratingQR] = useState(false);

  // 2FA Google Authenticator State
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const [totpSecret, setTotpSecret] = useState<string>("");
  const [otpCode, setOtpCode] = useState<string>("");
  const [isVerifyingOTP, setIsVerifyingOTP] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    orgName: "",
    orgCity: "",
    orgAddress: "",
    orgPhone: "",
    orgEmail: "",
    orgDescription: "",
    orgImageUrl: "",
    adminName: "",
    adminEmail: "",
    adminPassword: "",
    adminPhone: "",
    clinicName: "",
    clinicCity: "",
    clinicAddress: "",
    clinicPhone: "",
    clinicEmail: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Prefill logged-in user details (only for standard staff, not root admin provisioning)
  useEffect(() => {
    if (user && user.role !== "root") {
      setFormData((prev) => ({
        ...prev,
        adminName: prev.adminName || user.name || "",
        adminEmail: prev.adminEmail || user.email || "",
      }));
    }
  }, [user]);

  // Restore Draft from localStorage (strictly omitting password for security)
  useEffect(() => {
    try {
      const saved = localStorage.getItem("ananta_onboarding_draft");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.formData) {
          const { adminPassword, ...safeFormData } = parsed.formData;
          setFormData((prev) => ({ ...prev, ...safeFormData }));
        }
        if (typeof parsed.isMultiLocation === "boolean") setIsMultiLocation(parsed.isMultiLocation);
        if (parsed.step && parsed.step < STEPS.length - 1) setStep(parsed.step);
      }
    } catch (err) {
      console.warn("Could not parse onboarding local draft:", err);
    }
  }, []);

  // Debounced Autosave (500ms) - Excludes plain-text adminPassword (CWE-312 prevention)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      try {
        const { adminPassword, ...safeFormData } = formData;
        localStorage.setItem("ananta_onboarding_draft", JSON.stringify({ step, formData: safeFormData, isMultiLocation }));
        if (onboardingKey) {
          api.post("/onboarding/draft", { token: onboardingKey, step, formData: safeFormData }).catch(() => {});
        }
      } catch (err) {
        // ignore
      }
    }, 500);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [formData, step, onboardingKey, isMultiLocation]);

  const triggerShake = () => {
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 450);
  };

  const handleChange = (field: keyof typeof formData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const val = e.target.value;
    setFormData((prev) => ({ ...prev, [field]: val }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const validateStep = (s: number) => {
    const newErrors: Record<string, string> = {};

    if (s === 0) {
      if (!formData.orgName.trim()) newErrors.orgName = "Practice name is required";
      if (!formData.orgCity.trim()) newErrors.orgCity = "City is required";
      else if (/^[0-9+\s-]{6,}$/.test(formData.orgCity.trim())) newErrors.orgCity = "City appears to be a phone number. Please enter a valid city name (e.g. Mumbai).";
      if (formData.orgEmail.trim() && !EMAIL_REGEX.test(formData.orgEmail)) newErrors.orgEmail = "Invalid email address";
      if (formData.orgPhone.trim() && !PHONE_REGEX.test(formData.orgPhone.trim())) newErrors.orgPhone = "Invalid phone number (8-15 digits)";
      
      // Admin fields
      if (!formData.adminName.trim()) newErrors.adminName = "Your name is required";
      if (!formData.adminEmail.trim()) newErrors.adminEmail = "Email is required";
      else if (!EMAIL_REGEX.test(formData.adminEmail)) newErrors.adminEmail = "Invalid email address";
      if (formData.adminPhone.trim() && !PHONE_REGEX.test(formData.adminPhone.trim())) newErrors.adminPhone = "Invalid phone number (8-15 digits)";
      if (!formData.adminPassword) newErrors.adminPassword = "Password is required";
      else if (formData.adminPassword.length < 8) newErrors.adminPassword = "Minimum 8 characters required";
      else if (!/[A-Z]/.test(formData.adminPassword)) newErrors.adminPassword = "Must contain an uppercase letter";
      else if (!/[a-z]/.test(formData.adminPassword)) newErrors.adminPassword = "Must contain a lowercase letter";
      else if (!/[0-9]/.test(formData.adminPassword)) newErrors.adminPassword = "Must contain a digit";
      else if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(formData.adminPassword)) newErrors.adminPassword = "Must contain a special character (!@#$%^&* etc.)";

      // Multi-location: first location name is required
      if (isMultiLocation) {
        if (!formData.clinicName.trim()) newErrors.clinicName = "First location name is required";
        if (formData.clinicCity.trim() && /^[0-9+\s-]{6,}$/.test(formData.clinicCity.trim())) {
          newErrors.clinicCity = "City appears to be a phone number. Please enter a valid city name.";
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Helper to fetch fresh TOTP Setup & QR code
  const fetchTOTPSetup = async () => {
    setIsGeneratingQR(true);
    try {
      const totpRes = await api.post("/onboarding/totp/setup");
      if (totpRes.data?.data?.qrCodeDataUrl) {
        setQrCodeUrl(totpRes.data.data.qrCodeDataUrl);
      }
      if (totpRes.data?.data?.secret) {
        setTotpSecret(totpRes.data.data.secret);
      }
    } catch (err: any) {
      toast({
        title: "2FA Setup Failed",
        description: err.response?.data?.message || "Failed to generate QR code. Please click reload to try again.",
        variant: "error",
      });
    } finally {
      setIsGeneratingQR(false);
    }
  };

  // Auto-generate or restore QR code if on Step 1 and qrCodeUrl is missing
  useEffect(() => {
    if (step === 1 && !qrCodeUrl && !isGeneratingQR) {
      fetchTOTPSetup();
    }
  }, [step, qrCodeUrl]);

  // Step 0 Submission: Create Organization, Admin & Primary Location
  const handleCreatePractice = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateStep(0)) {
      triggerShake();
      return;
    }

    // Derive clinic fields: for single-location, auto-create from org details
    const clinicName = isMultiLocation && formData.clinicName.trim()
      ? formData.clinicName.trim()
      : undefined; // Let the backend use default: org_name.trim()
    const clinicCity = isMultiLocation && formData.clinicCity.trim()
      ? formData.clinicCity.trim()
      : undefined; // Backend defaults to org city

    setLoading(true);
    try {
      const headers: Record<string, string> = {};
      if (onboardingKey) headers["X-Onboarding-Secret"] = onboardingKey;
      if (modeParam) headers["X-Onboarding-Mode"] = modeParam;

      // Create Organization, Admin & Primary Location in single atomic transaction
      const orgRes = await api.post("/onboarding/organization", {
        org_name: formData.orgName.trim(),
        city: formData.orgCity.trim(),
        address: formData.orgAddress.trim() || undefined,
        org_phone: formData.orgPhone.trim() || undefined,
        org_email: formData.orgEmail.trim() || undefined,
        description: formData.orgDescription.trim() || undefined,
        image_url: formData.orgImageUrl.trim() || undefined,
        plan: planParam,
        admin_name: formData.adminName.trim(),
        admin_email: formData.adminEmail.trim().toLowerCase(),
        admin_password: formData.adminPassword,
        admin_phone: formData.adminPhone.trim() || undefined,
        clinic_name: clinicName,
        clinic_city: clinicCity,
        clinic_address: isMultiLocation ? (formData.clinicAddress.trim() || undefined) : (formData.orgAddress.trim() || undefined),
        clinic_phone: isMultiLocation ? (formData.clinicPhone.trim() || undefined) : (formData.orgPhone.trim() || undefined),
        clinic_email: isMultiLocation ? (formData.clinicEmail.trim() || undefined) : (formData.orgEmail.trim() || undefined),
      }, { headers: Object.keys(headers).length > 0 ? headers : undefined });

      // Save created org ID and active org context
      if (orgRes.data?.data?.organization?.id) {
        const newOrgId = orgRes.data.data.organization.id;
        setCreatedOrgId(newOrgId);
        localStorage.setItem("ananta_active_org_id", newOrgId);
      }

      // Login Admin session if user not already logged in
      if (!user && orgRes.data?.data?.user) {
        login(orgRes.data.data.user);
      }

      // Clear saved draft on successful practice creation
      try {
        localStorage.removeItem("ananta_onboarding_draft");
      } catch {}

      toast({
        title: "Practice Created! 🚀",
        description: "Now scan the QR code using Google Authenticator to secure your account.",
        variant: "success",
      });

      setStep(1); // Advance to 2FA Step
      await fetchTOTPSetup();
    } catch (err: any) {
      triggerShake();
      toast({
        title: "Setup Failed",
        description: err.response?.data?.message || "Failed to create your practice. Please verify fields.",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  // Step 1 Submission: Verify Google Authenticator 6-Digit Code
  const handleVerifyTOTP = async () => {
    if (!otpCode.trim() || otpCode.trim().length < 6) {
      toast({ title: "Validation Error", description: "Please enter the 6-digit authenticator code.", variant: "error" });
      triggerShake();
      return;
    }

    try {
      setIsVerifyingOTP(true);
      const res = await api.post("/onboarding/totp/verify", {
        token: otpCode.trim(),
        secret: totpSecret,
      });

      localStorage.removeItem("ananta_onboarding_draft");

      toast({
        title: "Account Secured! 🔒",
        description: res.data.message || "2FA successfully verified.",
        variant: "success",
      });

      setStep(2); // Advance to Success Screen
    } catch (err: any) {
      triggerShake();
      toast({
        title: "Verification Failed",
        description: err.response?.data?.message || "Invalid 6-digit authenticator code.",
        variant: "error",
      });
    } finally {
      setIsVerifyingOTP(false);
    }
  };

  const handleLaunchWorkspace = () => {
    if (createdOrgId) {
      localStorage.setItem("ananta_active_org_id", createdOrgId);
    }
    router.replace("/dashboard");
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-3 sm:p-4 py-8 sm:py-12 bg-surface-alt relative font-sans animate-page-enter">
      {/* Background Glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-15%] left-[-15%] w-[50%] h-[50%] bg-primary-500/15 rounded-full blur-[140px] animate-pulse duration-[8s]" />
        <div className="absolute bottom-[-15%] right-[-15%] w-[50%] h-[50%] bg-blue-500/15 rounded-full blur-[140px] animate-pulse duration-[6s] delay-1000" />
      </div>

      <div className="absolute top-[max(1rem,env(safe-area-inset-top))] right-4 sm:right-6 z-20">
        <ModeSwitcher />
      </div>

      <div className="w-full max-w-xl relative z-10 animate-fade-up">
        {/* Brand Header */}
        <div className="text-center mb-6 select-none flex flex-col items-center justify-center">
          <AnantaLogo size="md" className="mb-2" />
          <h1 className="text-xl font-bold text-text tracking-tight">Set Up Your Practice</h1>
          <p className="text-text-secondary text-xs mt-0.5">Get your workspace ready in under 2 minutes</p>
        </div>

        {/* Wizard Card Container */}
        <Card 
          className={cn(
            "shadow-xl shadow-black/5 border-border/50 backdrop-blur-md bg-surface/90 transition-transform duration-300", 
            isShaking && "animate-shake"
          )}
        >
          {/* Header & Stepper */}
          <CardHeader className="border-b border-border bg-surface-alt/50 pb-4">
            <div className="flex items-center justify-between mb-3 text-xs">
              <span className="font-bold text-primary-600 dark:text-primary-400 uppercase tracking-wider">
                Step {step + 1} of {STEPS.length} — {STEPS[step].label}
              </span>
              <span className="text-text-muted font-medium">
                {Math.round(((step + 1) / STEPS.length) * 100)}% Completed
              </span>
            </div>
            <Stepper steps={STEPS} currentStep={step} />
          </CardHeader>
          
          <CardContent className="pt-5 sm:pt-6 max-h-[64vh] sm:max-h-[60vh] overflow-y-auto touch-scroll">
            
            {/* ── STEP 0: Practice Profile + Admin + Optional Location ─────────── */}
            {step === 0 && (
              <form id="onboarding-step-0-form" onSubmit={handleCreatePractice} className="space-y-4 animate-fade-in">
                <div className="text-center border-b border-border pb-3">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Badge variant="primary" size="sm">⏱️ ~2 Minutes Setup</Badge>
                    {planParam && planParam !== "starter" && (
                      <Badge variant="info" size="sm" className="uppercase font-bold tracking-wide">
                        {planParam} Tier
                      </Badge>
                    )}
                  </div>
                  <CardTitle>Your Practice Profile</CardTitle>
                  <CardDescription className="mt-1">Tell us about your clinic or hospital. We&apos;ll set everything up for you.</CardDescription>
                </div>

                {/* Section A: Practice Details */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-text uppercase tracking-wider text-primary-600 dark:text-primary-400">
                    Practice Details
                  </h3>
                  <Input
                    label="Practice / Hospital Name *"
                    placeholder="e.g. City Health Clinic, Apollo Hospital"
                    value={formData.orgName}
                    onChange={handleChange("orgName")}
                    error={errors.orgName}
                    autoComplete="off"
                    required
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input 
                      label="Contact Phone Number" 
                      type="tel"
                      placeholder="+91 98765 43210" 
                      value={formData.orgPhone} 
                      onChange={handleChange("orgPhone")} 
                      error={errors.orgPhone}
                      autoComplete="off"
                    />
                    <Input 
                      label="Contact Email" 
                      type="email" 
                      placeholder="contact@clinic.com" 
                      value={formData.orgEmail} 
                      onChange={handleChange("orgEmail")} 
                      error={errors.orgEmail}
                      autoComplete="off"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input 
                      label="City *" 
                      placeholder="e.g. Mumbai, Delhi" 
                      value={formData.orgCity} 
                      onChange={handleChange("orgCity")} 
                      error={errors.orgCity}
                      autoComplete="off"
                      required 
                    />
                    <Input 
                      label="Physical Address" 
                      placeholder="123 Healthcare Boulevard" 
                      value={formData.orgAddress} 
                      onChange={handleChange("orgAddress")} 
                      autoComplete="off"
                    />
                  </div>
                </div>

                {/* Section B: Administrator Credentials (Always Visible) */}
                <div className="space-y-3 pt-3 border-t border-border">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-text uppercase tracking-wider text-primary-600 dark:text-primary-400">
                      Your Admin Account
                    </h3>
                  </div>

                  {user && (
                    <div className="p-2.5 rounded-xl bg-primary-500/10 border border-primary-500/20 text-xs text-primary-700 dark:text-primary-300 flex items-center gap-2">
                      <span className="text-sm">ℹ️</span>
                      <span>
                        Signed in as <strong>{user.name || user.email}</strong>. Define the administrator credentials for this new practice.
                      </span>
                    </div>
                  )}

                  <Input
                    label="Your Full Name *"
                    placeholder="Dr. Rajesh Kumar"
                    value={formData.adminName}
                    onChange={handleChange("adminName")}
                    error={errors.adminName}
                    autoComplete="off"
                    required
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input
                      label="Admin Email *"
                      type="email"
                      placeholder="admin@clinic.com"
                      value={formData.adminEmail}
                      onChange={handleChange("adminEmail")}
                      error={errors.adminEmail}
                      autoComplete="off"
                      required
                    />
                    <Input
                      label="Admin Mobile Phone"
                      type="tel"
                      placeholder="+91 98765 43210"
                      value={formData.adminPhone}
                      onChange={handleChange("adminPhone")}
                      error={errors.adminPhone}
                      autoComplete="off"
                    />
                  </div>
                  <div className="relative">
                    <Input
                      label="Password *"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={formData.adminPassword}
                      onChange={handleChange("adminPassword")}
                      error={errors.adminPassword}
                      autoComplete="new-password"
                      required
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-8 text-text-muted hover:text-text focus:outline-none transition-colors cursor-pointer"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Section C: Multi-Location Disclosure */}
                <div className="pt-3 border-t border-border">
                  <div
                    className="flex items-start gap-3 p-3 rounded-xl bg-surface-hover/50 border border-border/50 cursor-pointer hover:bg-surface-hover transition-colors"
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest('input[type="checkbox"]')) return;
                      setIsMultiLocation(!isMultiLocation);
                    }}
                  >
                    <Checkbox
                      checked={isMultiLocation}
                      onChange={() => setIsMultiLocation(!isMultiLocation)}
                      id="multi-location-toggle"
                    />
                    <div className="space-y-0.5 select-none">
                      <p className="text-sm font-semibold text-text">I have multiple locations</p>
                      <p className="text-xs text-text-muted">Enable this if you run multiple branches, departments, or hospital locations. You can always add more locations later.</p>
                    </div>
                  </div>

                  {/* Multi-location: First Location Name */}
                  {isMultiLocation && (
                    <div className="mt-3 space-y-3 animate-fade-in pl-1">
                      <h3 className="text-xs font-bold text-text uppercase tracking-wider text-primary-600 dark:text-primary-400">
                        First Location
                      </h3>
                      <Input
                        label="Location / Branch Name *"
                        placeholder="e.g. Main Branch, North Wing, Downtown Clinic"
                        value={formData.clinicName}
                        onChange={handleChange("clinicName")}
                        error={errors.clinicName}
                        required
                      />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Input 
                          label="City (if different)" 
                          placeholder="Same as above if blank" 
                          value={formData.clinicCity} 
                          onChange={handleChange("clinicCity")} 
                        />
                        <Input 
                          label="Location Address" 
                          placeholder="Branch address" 
                          value={formData.clinicAddress} 
                          onChange={handleChange("clinicAddress")} 
                        />
                      </div>
                    </div>
                  )}
                </div>
              </form>
            )}

            {/* ── STEP 1: Google Authenticator 2FA Verification ─────────── */}
            {step === 1 && (
              <form onSubmit={(e) => { e.preventDefault(); handleVerifyTOTP(); }} className="space-y-5 animate-fade-in text-center py-2">
                <div className="space-y-1">
                  <CardTitle>Secure Your Account</CardTitle>
                  <CardDescription>Scan the QR Code with Google Authenticator on your phone.</CardDescription>
                </div>

                {qrCodeUrl ? (
                  <div className="flex flex-col items-center justify-center space-y-3">
                    <div className="p-3 bg-white rounded-2xl border border-border shadow-md">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={qrCodeUrl} alt="Google Authenticator 2FA QR Code" className="w-44 h-44" />
                    </div>

                    {totpSecret && (
                      <div className="space-y-1">
                        <p className="text-[11px] text-text-muted">Secret Key (Manual Entry):</p>
                        <code className="text-xs bg-surface-hover px-3 py-1 rounded-lg font-mono text-primary-600 dark:text-primary-400 select-all font-bold">
                          {totpSecret}
                        </code>
                      </div>
                    )}

                    <div className="pt-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        onClick={fetchTOTPSetup}
                        loading={isGeneratingQR}
                        className="text-xs text-primary-600 dark:text-primary-400 gap-1"
                      >
                        <RefreshCw className={cn("w-3 h-3", isGeneratingQR && "animate-spin")} />
                        Regenerate QR Code
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="py-8 space-y-3">
                    <Spinner size="md" label="Generating 2FA QR Code..." />
                    <div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        onClick={fetchTOTPSetup}
                        className="text-xs text-primary-600 dark:text-primary-400 gap-1"
                      >
                        <RefreshCw className="w-3 h-3" />
                        Retry QR Generation
                      </Button>
                    </div>
                  </div>
                )}

                <div className="max-w-xs mx-auto space-y-2">
                  <label className="block text-xs font-bold text-text uppercase tracking-wider">
                    Enter 6-Digit Authenticator Code
                  </label>
                  <Input
                    placeholder="123456"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="text-center font-mono text-xl tracking-widest font-bold"
                    maxLength={6}
                    autoFocus
                  />
                </div>
              </form>
            )}

            {/* ── STEP 2: Success & Next Steps ───────────────────────────── */}
            {step === 2 && (
              <div className="space-y-6 animate-fade-in text-center py-2">
                <div className="w-16 h-16 rounded-full bg-success-500/15 text-success-500 flex items-center justify-center text-3xl mx-auto animate-bounce">
                  ✓
                </div>

                <div className="space-y-1.5">
                  <h2 className="text-xl font-bold text-text">Your Practice is Live!</h2>
                  <p className="text-xs text-text-secondary">Everything is set up and ready to go.</p>
                </div>

                {/* Summary */}
                <div className="bg-surface-hover/60 border border-border p-4 rounded-2xl max-w-md mx-auto space-y-2.5 text-xs text-left">
                  <div className="flex items-center justify-between border-b border-border/60 pb-2">
                    <span className="text-text-muted">Practice:</span>
                    <span className="font-bold text-text">{formData.orgName}</span>
                  </div>
                  {isMultiLocation && formData.clinicName && (
                    <div className="flex items-center justify-between border-b border-border/60 pb-2">
                      <span className="text-text-muted">First Location:</span>
                      <span className="font-bold text-text">{formData.clinicName}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-text-muted">Account Security:</span>
                    <span className="font-bold text-success-600 dark:text-success-400">2FA Verified ✓</span>
                  </div>
                </div>

                {/* Next Steps */}
                <div className="border border-border/70 rounded-2xl p-4 text-left max-w-md mx-auto space-y-2">
                  <p className="text-xs font-bold text-text uppercase tracking-wider text-text-muted mb-2">
                    What to do next
                  </p>
                  <ul className="space-y-1.5 text-xs text-text-secondary">
                    <li className="flex items-center gap-2">
                      <span className="text-primary-500">•</span>
                      <span>Add your team — doctors, nurses, receptionists</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-primary-500">•</span>
                      <span>Set up your consultation schedule & availability</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-primary-500">•</span>
                      <span>Start booking your first appointments</span>
                    </li>
                  </ul>
                </div>
              </div>
            )}

          </CardContent>
          
          {/* Footer Actions */}
          <CardFooter className="flex justify-between border-t border-border pt-4 bg-surface-alt/25">
            {step === 0 && (
              <Button 
                type="submit" 
                form="onboarding-step-0-form"
                loading={loading}
                size="md"
                className="w-full"
              >
                Create My Practice & Continue →
              </Button>
            )}

            {step === 1 && (
              <div className="flex items-center justify-between w-full gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => setStep(0)}
                  disabled={isVerifyingOTP}
                  className="gap-1.5"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </Button>
                <Button 
                  type="button" 
                  onClick={handleVerifyTOTP}
                  loading={isVerifyingOTP}
                  disabled={otpCode.length < 6}
                  size="md"
                  className="flex-1"
                >
                  Verify & Continue →
                </Button>
              </div>
            )}

            {step === 2 && (
              <Button 
                type="button" 
                variant="primary" 
                onClick={handleLaunchWorkspace}
                size="md"
                className="w-full"
              >
                Go to Dashboard 🚀
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-surface-alt flex flex-col items-center justify-center p-4" aria-busy="true" aria-label="Initializing setup">
          <div className="w-full max-w-xl bg-surface border border-border/80 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6 animate-fade-in">
            <div className="space-y-2 text-center">
              <div className="h-7 w-48 bg-surface-alt rounded-lg mx-auto animate-pulse" />
              <div className="h-4 w-64 bg-surface-alt rounded mx-auto animate-pulse" />
            </div>
            <div className="space-y-4 pt-4">
              <div className="h-10 bg-surface-alt rounded-xl animate-pulse" />
              <div className="h-10 bg-surface-alt rounded-xl animate-pulse" />
              <div className="h-10 bg-surface-alt rounded-xl animate-pulse" />
            </div>
          </div>
        </div>
      }
    >
      <OnboardingInner />
    </Suspense>
  );
}
