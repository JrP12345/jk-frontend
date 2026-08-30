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
  cn
} from "@/components/ui";

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

const STEPS = [
  { label: "Organization", description: "Facility & Admin" },
  { label: "Primary Clinic", description: "First Branch" },
  { label: "Security & MFA", description: "Google Authenticator" },
  { label: "Success", description: "Workspace Ready" }
];

function OnboardingInner() {
  const [step, setStep] = useState(0);
  const router = useRouter();
  const searchParams = useSearchParams();
  const onboardingKey = searchParams.get("key") || "";
  const { user, login } = useAuthStore();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isShaking, setIsShaking] = useState(false);

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

  // Prefill logged-in user details
  useEffect(() => {
    if (user) {
      setFormData((prev) => ({
        ...prev,
        adminName: prev.adminName || user.name || "",
        adminEmail: prev.adminEmail || user.email || "",
      }));
    }
  }, [user]);

  // Restore Draft from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("ananta_onboarding_draft");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.formData) setFormData((prev) => ({ ...prev, ...parsed.formData }));
        if (parsed.step && parsed.step < STEPS.length - 1) setStep(parsed.step);
      }
    } catch (err) {
      console.warn("Could not parse onboarding local draft:", err);
    }
  }, []);

  // Debounced Autosave (500ms)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      try {
        localStorage.setItem("ananta_onboarding_draft", JSON.stringify({ step, formData }));
        if (onboardingKey) {
          api.post("/onboarding/draft", { token: onboardingKey, step, formData }).catch(() => {});
        }
      } catch (err) {
        // ignore
      }
    }, 500);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [formData, step, onboardingKey]);

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
      if (!formData.orgName.trim()) newErrors.orgName = "Organization Name is required";
      if (!formData.orgCity.trim()) newErrors.orgCity = "City is required";
      if (formData.orgEmail.trim() && !EMAIL_REGEX.test(formData.orgEmail)) newErrors.orgEmail = "Invalid email address";
      if (!user) {
        if (!formData.adminName.trim()) newErrors.adminName = "Administrator Name is required";
        if (!formData.adminEmail.trim()) newErrors.adminEmail = "Admin Email is required";
        else if (!EMAIL_REGEX.test(formData.adminEmail)) newErrors.adminEmail = "Invalid email address";
        if (!formData.adminPassword) newErrors.adminPassword = "Password is required";
        else if (formData.adminPassword.length < 8) newErrors.adminPassword = "Minimum 8 characters required";
        else if (!/[A-Z]/.test(formData.adminPassword)) newErrors.adminPassword = "Must contain an uppercase letter";
        else if (!/[a-z]/.test(formData.adminPassword)) newErrors.adminPassword = "Must contain a lowercase letter";
        else if (!/[0-9]/.test(formData.adminPassword)) newErrors.adminPassword = "Must contain a digit";
      }
    } else if (s === 1) {
      if (!formData.clinicName.trim()) newErrors.clinicName = "Clinic Branch Name is required";
      if (!formData.clinicCity.trim()) newErrors.clinicCity = "City is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (!validateStep(step)) {
      triggerShake();
      return;
    }

    if (step === 0) {
      // Prefill Clinic fields from Organization fields
      setFormData((prev) => ({
        ...prev,
        clinicName: prev.clinicName || (prev.orgName ? `${prev.orgName} Main Clinic` : ""),
        clinicCity: prev.clinicCity || prev.orgCity,
        clinicAddress: prev.clinicAddress || prev.orgAddress,
        clinicPhone: prev.clinicPhone || prev.orgPhone,
        clinicEmail: prev.clinicEmail || prev.orgEmail,
      }));
    }

    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  };

  const handlePrev = () => setStep((s) => Math.max(0, s - 1));

  // Step 1 Submission: Create Organization, Admin & Primary Clinic
  const handleCreateOrganizationAndClinic = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateStep(1)) {
      triggerShake();
      return;
    }

    setLoading(true);
    try {
      // 1. Create Organization, Admin & Primary Clinic in single atomic transaction
      const orgRes = await api.post("/onboarding/organization", {
        org_name: formData.orgName,
        city: formData.orgCity,
        address: formData.orgAddress || undefined,
        org_phone: formData.orgPhone || undefined,
        org_email: formData.orgEmail || undefined,
        description: formData.orgDescription || undefined,
        image_url: formData.orgImageUrl || undefined,
        admin_name: formData.adminName || user?.name || "",
        admin_email: formData.adminEmail || user?.email || "",
        admin_password: formData.adminPassword || undefined,
        admin_phone: formData.adminPhone || undefined,
        clinic_name: formData.clinicName || undefined,
        clinic_city: formData.clinicCity || undefined,
        clinic_address: formData.clinicAddress || undefined,
        clinic_phone: formData.clinicPhone || undefined,
        clinic_email: formData.clinicEmail || undefined,
      }, {
        headers: onboardingKey ? { "X-Onboarding-Secret": onboardingKey } : undefined,
      });

      // Login Admin session if user not already logged in
      if (!user) {
        login(orgRes.data.data.user);
      }

      // 3. Initialize 2FA Google Authenticator setup endpoint
      const totpRes = await api.post("/onboarding/totp/setup");
      setQrCodeUrl(totpRes.data.data.qrCodeDataUrl);
      setTotpSecret(totpRes.data.data.secret);

      toast({
        title: "Organization & Clinic Created! 🚀",
        description: "Now scan the QR code using Google Authenticator to enable 2FA.",
        variant: "success",
      });

      setStep(2); // Advance to 2FA Step
    } catch (err: any) {
      triggerShake();
      toast({
        title: "Setup Failed",
        description: err.response?.data?.message || "Failed to create organization. Please verify fields.",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  // Step 2 Submission: Verify Google Authenticator 6-Digit Code
  const handleVerifyTOTP = async () => {
    if (!otpCode.trim() || otpCode.trim().length < 6) {
      toast({ title: "Validation Error", description: "Please enter the 6-digit authenticator code.", variant: "error" });
      triggerShake();
      return;
    }

    try {
      setIsVerifyingOTP(true);
      const res = await api.post("/onboarding/totp/verify", {
        token: otpCode,
        secret: totpSecret,
      });

      localStorage.removeItem("ananta_onboarding_draft");

      toast({
        title: "Google Authenticator Verified! 🔒",
        description: res.data.message || "2FA successfully verified.",
        variant: "success",
      });

      setStep(3); // Advance to Success Screen
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
    router.push("/dashboard");
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-surface-alt relative overflow-hidden animate-page-enter">
      {/* Background Glow */}
      <div className="absolute top-[-15%] left-[-15%] w-[50%] h-[50%] bg-primary-500/15 rounded-full blur-[140px] pointer-events-none animate-pulse duration-[8s]" />
      <div className="absolute bottom-[-15%] right-[-15%] w-[50%] h-[50%] bg-blue-500/15 rounded-full blur-[140px] pointer-events-none animate-pulse duration-[6s] delay-1000" />

      <div className="absolute top-6 right-6 z-20">
        <ModeSwitcher />
      </div>

      <div className="w-full max-w-xl relative z-10 animate-fade-up">
        {/* Brand Header */}
        <div className="text-center mb-6 select-none flex flex-col items-center justify-center">
          <AnantaLogo size="md" className="mb-2" />
          <h1 className="text-xl font-bold text-text tracking-tight">Organization & Workspace Setup</h1>
          <p className="text-text-secondary text-xs mt-0.5">ANANT Enterprise Platform</p>
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
          
          <CardContent className="pt-6 max-h-[64vh] overflow-y-auto">
            
            {/* ── STEP 0: Organization & Master Administrator ─────────── */}
            {step === 0 && (
              <div className="space-y-5 animate-fade-in">
                <div className="text-center border-b border-border pb-3">
                  <Badge variant="primary" size="sm" className="mb-2">⏱️ ~2 Minutes Setup</Badge>
                  <CardTitle>Organization & Facility Profile</CardTitle>
                  <CardDescription className="mt-1">Enter your healthcare facility details and admin account credentials.</CardDescription>
                </div>

                {/* Section A: Organization Details */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-text uppercase tracking-wider text-primary-600 dark:text-primary-400">
                    1. Organization Profile
                  </h3>
                  <Input
                    label="Organization / Hospital Name"
                    placeholder="e.g. Apollo Group / City Health System"
                    value={formData.orgName}
                    onChange={handleChange("orgName")}
                    error={errors.orgName}
                    required
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input 
                      label="City" 
                      placeholder="e.g. San Francisco" 
                      value={formData.orgCity} 
                      onChange={handleChange("orgCity")} 
                      error={errors.orgCity}
                      required 
                    />
                    <Input 
                      label="Contact Email" 
                      type="email" 
                      placeholder="contact@hospital.com" 
                      value={formData.orgEmail} 
                      onChange={handleChange("orgEmail")} 
                      error={errors.orgEmail}
                    />
                  </div>
                  <Input 
                    label="Address" 
                    placeholder="123 Healthcare Boulevard" 
                    value={formData.orgAddress} 
                    onChange={handleChange("orgAddress")} 
                  />
                </div>

                {/* Section B: Administrator Credentials */}
                {!user && (
                  <div className="space-y-3 pt-3 border-t border-border">
                    <h3 className="text-xs font-bold text-text uppercase tracking-wider text-primary-600 dark:text-primary-400">
                      2. Master Administrator Account
                    </h3>
                    <Input
                      label="Admin Full Name"
                      placeholder="John Doe"
                      value={formData.adminName}
                      onChange={handleChange("adminName")}
                      error={errors.adminName}
                      required
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Input
                        label="Admin Email"
                        type="email"
                        placeholder="admin@hospital.com"
                        value={formData.adminEmail}
                        onChange={handleChange("adminEmail")}
                        error={errors.adminEmail}
                        required
                      />
                      <Input
                        label="Password"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={formData.adminPassword}
                        onChange={handleChange("adminPassword")}
                        error={errors.adminPassword}
                        required
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── STEP 1: Primary Clinic Branch ─────────────────────────── */}
            {step === 1 && (
              <div className="space-y-4 animate-fade-in">
                <div className="text-center mb-4">
                  <CardTitle>Primary Clinic Branch</CardTitle>
                  <CardDescription className="mt-1">Configure your initial clinic location under {formData.orgName || "Organization"}.</CardDescription>
                </div>
                <Input
                  label="Clinic Branch Name"
                  placeholder="e.g. Main Downtown Branch"
                  value={formData.clinicName}
                  onChange={handleChange("clinicName")}
                  error={errors.clinicName}
                  required
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input 
                    label="City" 
                    placeholder="e.g. San Francisco" 
                    value={formData.clinicCity} 
                    onChange={handleChange("clinicCity")} 
                    error={errors.clinicCity}
                    required 
                  />
                  <Input 
                    label="Address" 
                    placeholder="123 Clinic Ave" 
                    value={formData.clinicAddress} 
                    onChange={handleChange("clinicAddress")} 
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input 
                    label="Contact Phone" 
                    placeholder="+1 234 567 890" 
                    value={formData.clinicPhone} 
                    onChange={handleChange("clinicPhone")} 
                  />
                  <Input 
                    label="Contact Email" 
                    type="email" 
                    placeholder="clinic@hospital.com" 
                    value={formData.clinicEmail} 
                    onChange={handleChange("clinicEmail")} 
                  />
                </div>
              </div>
            )}

            {/* ── STEP 2: Google Authenticator 2FA Verification ─────────── */}
            {step === 2 && (
              <div className="space-y-5 animate-fade-in text-center py-2">
                <div className="space-y-1">
                  <CardTitle>Google Authenticator 2FA Security</CardTitle>
                  <CardDescription>Scan the QR Code with your Google Authenticator app on your phone.</CardDescription>
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
                  </div>
                ) : (
                  <div className="py-8">
                    <Spinner size="md" label="Generating 2FA QR Code..." />
                  </div>
                )}

                <div className="max-w-xs mx-auto space-y-2">
                  <label className="block text-xs font-bold text-text uppercase tracking-wider">
                    Enter 6-Digit Google Authenticator Code
                  </label>
                  <Input
                    placeholder="123456"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="text-center font-mono text-xl tracking-widest font-bold"
                    maxLength={6}
                  />
                </div>
              </div>
            )}

            {/* ── STEP 3: Success & Next Steps ───────────────────────────── */}
            {step === 3 && (
              <div className="space-y-6 animate-fade-in text-center py-2">
                <div className="w-16 h-16 rounded-full bg-success-500/15 text-success-500 flex items-center justify-center text-3xl mx-auto animate-bounce">
                  ✓
                </div>

                <div className="space-y-1.5">
                  <h2 className="text-xl font-bold text-text">Organization & Workspace Live!</h2>
                  <p className="text-xs text-text-secondary">ANANTA Healthcare Platform setup complete.</p>
                </div>

                {/* Hierarchy Summary */}
                <div className="bg-surface-hover/60 border border-border p-4 rounded-2xl max-w-md mx-auto space-y-2.5 text-xs text-left">
                  <div className="flex items-center justify-between border-b border-border/60 pb-2">
                    <span className="text-text-muted">Organization:</span>
                    <span className="font-bold text-text">{formData.orgName}</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-border/60 pb-2">
                    <span className="text-text-muted">Primary Clinic:</span>
                    <span className="font-bold text-text">{formData.clinicName}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-muted">Security Verification:</span>
                    <span className="font-bold text-success-600 dark:text-success-400">Google Authenticator Verified ✓</span>
                  </div>
                </div>

                {/* Direct Action Items */}
                <div className="border border-border/70 rounded-2xl p-4 text-left max-w-md mx-auto space-y-2">
                  <p className="text-xs font-bold text-text uppercase tracking-wider text-text-muted mb-2">
                    Next Administrative Actions
                  </p>
                  <ul className="space-y-1.5 text-xs text-text-secondary">
                    <li className="flex items-center gap-2">
                      <span className="text-primary-500">•</span>
                      <span>Invite Doctors, Nurses & Receptionists under Staff</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-primary-500">•</span>
                      <span>Add additional branch locations under Clinics</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-primary-500">•</span>
                      <span>Schedule patient appointments & outpatient queues</span>
                    </li>
                  </ul>
                </div>
              </div>
            )}

          </CardContent>
          
          {/* Footer Actions */}
          <CardFooter className="flex justify-between border-t border-border pt-4 bg-surface-alt/25">
            {step === 1 ? (
              <Button 
                type="button" 
                variant="outline" 
                onClick={handlePrev}
                disabled={loading}
              >
                Back
              </Button>
            ) : (
              <div />
            )}

            {step === 0 && (
              <Button 
                type="button" 
                onClick={handleNext}
                size="md"
                className="w-full"
              >
                Configure Primary Clinic →
              </Button>
            )}

            {step === 1 && (
              <Button 
                type="button" 
                onClick={handleCreateOrganizationAndClinic}
                loading={loading}
                size="md"
              >
                Create Workspace & Enable 2FA →
              </Button>
            )}

            {step === 2 && (
              <Button 
                type="button" 
                onClick={handleVerifyTOTP}
                loading={isVerifyingOTP}
                disabled={otpCode.length < 6}
                size="md"
                className="w-full"
              >
                Verify 2FA & Launch Workspace →
              </Button>
            )}

            {step === 3 && (
              <Button 
                type="button" 
                variant="primary" 
                onClick={handleLaunchWorkspace}
                size="md"
                className="w-full"
              >
                Launch ANANTA Workspace 🚀
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
    <Suspense fallback={
      <div className="min-h-screen bg-surface-alt flex items-center justify-center">
        <Spinner size="lg" label="Initializing onboarding..." />
      </div>
    }>
      <OnboardingInner />
    </Suspense>
  );
}
