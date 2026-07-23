"use client";

import { useState, Suspense } from "react";
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
  Textarea,
  Checkbox,
  ImageUpload,
  AnantaLogo,
  cn
} from "@/components/ui";
import { useR2Upload } from "@/lib/useR2Upload";

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

const STEPS = [
  { label: "Organization", description: "Facility details" },
  { label: "Administrator", description: "Master user setup" },
  { label: "Primary Clinic", description: "First clinic branch" },
  { label: "Review", description: "Confirm information" }
];

function OnboardingInner() {
  const [step, setStep] = useState(0);
  const router = useRouter();
  const searchParams = useSearchParams();
  const onboardingKey = searchParams.get("key") || "";
  const { login } = useAuthStore();
  const { toast } = useToast();
  const { uploadImage, uploading: uploadingR2 } = useR2Upload();
  
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [agreed, setAgreed] = useState(false);

  // Unified form data
  const [formData, setFormData] = useState({
    orgName: "",
    orgCity: "",
    orgAddress: "",
    orgPhone: "",
    orgEmail: "",
    orgDescription: "",
    orgImageUrl: "",
    orgTimings: "",
    orgWorkingDays: "",
    adminName: "",
    adminEmail: "",
    adminPassword: "",
    adminPhone: "",
    clinicName: "",
    clinicCity: "",
    clinicAddress: "",
    clinicPhone: "",
    clinicEmail: "",
    clinicTimings: "",
    clinicWorkingDays: "",
  });

  // Dynamic Validation State
  const [errors, setErrors] = useState<Record<string, string>>({});

  const triggerShake = () => {
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 450);
  };

  const handleChange = (field: keyof typeof formData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const val = e.target.value;
    setFormData((prev) => ({ ...prev, [field]: val }));
    
    // Clear validation error when user types
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const validateField = (field: keyof typeof formData) => {
    let error = "";
    const val = formData[field]?.toString().trim() || "";

    if (field === "orgName" && !val) {
      error = "Organization Name is required";
    } else if (field === "orgCity" && !val) {
      error = "City is required";
    } else if (field === "orgEmail" && val && !EMAIL_REGEX.test(val)) {
      error = "Please enter a valid email address";
    } else if (field === "adminName" && !val) {
      error = "Admin Full Name is required";
    } else if (field === "adminEmail") {
      if (!val) {
        error = "Admin Email is required";
      } else if (!EMAIL_REGEX.test(val)) {
        error = "Please enter a valid email address";
      }
    } else if (field === "adminPassword") {
      if (!val) {
        error = "Password is required";
      } else if (val.length < 6) {
        error = "Password must be at least 6 characters";
      }
    } else if (field === "clinicName" && !val) {
      error = "Clinic Name is required";
    } else if (field === "clinicCity" && !val) {
      error = "City is required";
    } else if (field === "clinicEmail" && val && !EMAIL_REGEX.test(val)) {
      error = "Please enter a valid email address";
    }

    setErrors((prev) => {
      if (error) {
        return { ...prev, [field]: error };
      } else {
        const next = { ...prev };
        delete next[field];
        return next;
      }
    });

    return !error;
  };

  const handleBlur = (field: keyof typeof formData) => () => {
    validateField(field);
  };

  const validateStep = (s: number) => {
    let isValid = true;
    if (s === 0) {
      const r1 = validateField("orgName");
      const r2 = validateField("orgCity");
      const r3 = validateField("orgEmail");
      isValid = r1 && r2 && r3;
    } else if (s === 1) {
      const r1 = validateField("adminName");
      const r2 = validateField("adminEmail");
      const r3 = validateField("adminPassword");
      isValid = r1 && r2 && r3;
    } else if (s === 2) {
      const r1 = validateField("clinicName");
      const r2 = validateField("clinicCity");
      const r3 = validateField("clinicEmail");
      isValid = r1 && r2 && r3;
    }
    return isValid;
  };

  const handleNext = () => {
    if (!validateStep(step)) {
      triggerShake();
      return;
    }

    if (step === 0) {
      // Prefill Clinic fields from Organization fields if not already modified
      setFormData((prev) => ({
        ...prev,
        clinicName: prev.clinicName || (prev.orgName ? `${prev.orgName} Primary Clinic` : ""),
        clinicCity: prev.clinicCity || prev.orgCity,
        clinicAddress: prev.clinicAddress || prev.orgAddress,
        clinicPhone: prev.clinicPhone || prev.orgPhone,
        clinicEmail: prev.clinicEmail || prev.orgEmail,
        clinicTimings: prev.clinicTimings || prev.orgTimings,
        clinicWorkingDays: prev.clinicWorkingDays || prev.orgWorkingDays,
      }));
    }

    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  };

  const handlePrev = () => setStep((s) => Math.max(0, s - 1));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (step < STEPS.length - 1) {
      handleNext();
      return;
    }

    if (!agreed) return;

    setLoading(true);
    try {
      // Step 1: Create Organization & Admin (send onboarding secret header)
      const orgRes = await api.post("/onboarding/organization", {
        org_name: formData.orgName,
        city: formData.orgCity,
        address: formData.orgAddress || undefined,
        org_phone: formData.orgPhone || undefined,
        org_email: formData.orgEmail || undefined,
        description: formData.orgDescription || undefined,
        image_url: formData.orgImageUrl || undefined,
        timings: formData.orgTimings || undefined,
        working_days: formData.orgWorkingDays || undefined,
        admin_name: formData.adminName,
        admin_email: formData.adminEmail,
        admin_password: formData.adminPassword,
        admin_phone: formData.adminPhone || undefined,
      }, {
        headers: { "X-Onboarding-Secret": onboardingKey },
      });

      // Login the admin user session immediately
      login(orgRes.data.data.user);

      // Step 2: Create primary clinic branch
      try {
        await api.post("/onboarding/clinics", {
          name: formData.clinicName,
          city: formData.clinicCity,
          address: formData.clinicAddress || undefined,
          phone: formData.clinicPhone || undefined,
          email: formData.clinicEmail || undefined,
          timings: formData.clinicTimings || undefined,
          workingDays: formData.clinicWorkingDays || undefined,
        });

        toast({
          title: "Registration Successful!",
          description: "Your organization and clinic have been fully configured.",
          variant: "success",
          duration: 4000,
        });
      } catch (clinicErr: any) {
        console.error("Clinic creation during onboarding failed:", clinicErr);
        toast({
          title: "Setup Partially Complete",
          description: clinicErr.response?.data?.message || "Organization created, but failed to create the primary clinic. You can configure it from the dashboard settings.",
          variant: "warning",
          duration: 7000,
        });
      }

      router.push("/dashboard");
    } catch (err: any) {
      triggerShake();
      toast({
        title: "Registration Failed",
        description: err.response?.data?.message || "Failed to create organization. Please verify your fields.",
        variant: "error",
        duration: 5000,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-surface-alt relative overflow-hidden">
      {/* Background Decorative Circles */}
      <div className="absolute top-[-15%] left-[-15%] w-[50%] h-[50%] bg-primary-500/15 rounded-full blur-[140px] pointer-events-none animate-pulse duration-[8s]" />
      <div className="absolute bottom-[-15%] right-[-15%] w-[50%] h-[50%] bg-blue-500/15 rounded-full blur-[140px] pointer-events-none animate-pulse duration-[6s] delay-1000" />

      <div className="absolute top-6 right-6 z-20">
        <ModeSwitcher />
      </div>

      <div className="w-full max-w-lg relative z-10 animate-fade-up">
        {/* Brand Header */}
        <div className="text-center mb-6 select-none flex flex-col items-center justify-center">
          <AnantaLogo size="md" className="mb-2" />
          <h1 className="text-xl font-bold text-text tracking-tight">Register Organization</h1>
          <p className="text-text-secondary text-xs mt-0.5">Let's set up your HealthOS workspace</p>
        </div>

        {/* Wizard Card Container */}
        <Card 
          className={cn(
            "shadow-xl shadow-black/5 border-border/50 backdrop-blur-md bg-surface/90 transition-transform duration-300", 
            isShaking && "animate-shake"
          )}
        >
          <CardHeader className="border-b border-border bg-surface-alt/50 pb-5">
            <Stepper
              steps={STEPS}
              currentStep={step}
            />
          </CardHeader>
          
          <form onSubmit={handleSubmit} noValidate>
            <CardContent className="pt-6 max-h-[60vh] overflow-y-auto">
              
              {/* STEP 0: Organization details */}
              {step === 0 && (
                <div className="space-y-4 animate-fade-in">
                  <div className="text-center mb-5">
                    <CardTitle>Organization Details</CardTitle>
                    <CardDescription className="mt-1">Provide background information about your primary hospital system or facility.</CardDescription>
                  </div>
                  <Input
                    label="Organization Name"
                    placeholder="e.g. City General Hospital"
                    value={formData.orgName}
                    onChange={handleChange("orgName")}
                    onBlur={handleBlur("orgName")}
                    error={errors.orgName}
                    required
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input 
                      label="City" 
                      placeholder="e.g. New York" 
                      value={formData.orgCity} 
                      onChange={handleChange("orgCity")} 
                      onBlur={handleBlur("orgCity")}
                      error={errors.orgCity}
                      required 
                    />
                    <Input 
                      label="Address" 
                      placeholder="123 Health Ave" 
                      value={formData.orgAddress} 
                      onChange={handleChange("orgAddress")} 
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input 
                      label="Contact Phone" 
                      placeholder="+1 234 567 890" 
                      value={formData.orgPhone} 
                      onChange={handleChange("orgPhone")} 
                    />
                    <Input 
                      label="Contact Email" 
                      type="email" 
                      placeholder="contact@hospital.com" 
                      value={formData.orgEmail} 
                      onChange={handleChange("orgEmail")} 
                      onBlur={handleBlur("orgEmail")}
                      error={errors.orgEmail}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input 
                      label="Timings" 
                      placeholder="e.g. 24/7 or 09:00 AM - 09:00 PM" 
                      value={formData.orgTimings} 
                      onChange={handleChange("orgTimings")} 
                    />
                    <Input 
                      label="Working Days" 
                      placeholder="e.g. Mon-Sun or Mon-Sat" 
                      value={formData.orgWorkingDays} 
                      onChange={handleChange("orgWorkingDays")} 
                    />
                  </div>
                  <Textarea 
                    label="Description" 
                    placeholder="Short description of your facility..." 
                    value={formData.orgDescription} 
                    onChange={handleChange("orgDescription")} 
                    maxLength={250}
                  />
                  <ImageUpload
                    label="Facility / Organization Logo"
                    value={formData.orgImageUrl}
                    uploading={uploadingR2}
                    onChange={async (val) => {
                      if (val instanceof File) {
                        try {
                          const res = await uploadImage(val);
                          setFormData(prev => ({ ...prev, orgImageUrl: res.publicUrl }));
                          toast({ title: "Logo Uploaded", description: "Facility logo uploaded successfully.", variant: "success" });
                        } catch (err) {
                          toast({ title: "Upload Failed", description: "Failed to upload logo image.", variant: "error" });
                        }
                      } else if (typeof val === "string") {
                        setFormData(prev => ({ ...prev, orgImageUrl: val }));
                      } else {
                        setFormData(prev => ({ ...prev, orgImageUrl: "" }));
                      }
                    }}
                    helperText="Upload official logo (PNG, JPG, WEBP)"
                  />
                </div>
              )}

              {/* STEP 1: Admin account */}
              {step === 1 && (
                <div className="space-y-4 animate-fade-in">
                  <div className="text-center mb-5">
                    <CardTitle>Administrator Account</CardTitle>
                    <CardDescription className="mt-1">Configure the master administrator credentials to access your organization.</CardDescription>
                  </div>
                  <Input
                    label="Admin Full Name"
                    placeholder="John Doe"
                    value={formData.adminName}
                    onChange={handleChange("adminName")}
                    onBlur={handleBlur("adminName")}
                    error={errors.adminName}
                    required
                  />
                  <Input
                    label="Admin Email"
                    type="email"
                    placeholder="admin@hospital.com"
                    value={formData.adminEmail}
                    onChange={handleChange("adminEmail")}
                    onBlur={handleBlur("adminEmail")}
                    error={errors.adminEmail}
                    required
                  />
                  <Input
                    label="Password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={formData.adminPassword}
                    onChange={handleChange("adminPassword")}
                    onBlur={handleBlur("adminPassword")}
                    error={errors.adminPassword}
                    required
                    iconRight={
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="p-1 text-text-muted hover:text-text rounded-md hover:bg-surface-hover/50 transition-all active:scale-75 cursor-pointer"
                        title={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? (
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                          </svg>
                        ) : (
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        )}
                      </button>
                    }
                  />
                  <Input
                    label="Phone Number"
                    placeholder="+1 234 567 890"
                    value={formData.adminPhone}
                    onChange={handleChange("adminPhone")}
                  />
                </div>
              )}

              {/* STEP 2: Clinic branch setup */}
              {step === 2 && (
                <div className="space-y-4 animate-fade-in">
                  <div className="text-center mb-5">
                    <CardTitle>Primary Clinic Setup</CardTitle>
                    <CardDescription className="mt-1">Add details for your first clinical branch (prefilled from organization details).</CardDescription>
                  </div>
                  <Input
                    label="Clinic Name"
                    placeholder="e.g. City General Clinic"
                    value={formData.clinicName}
                    onChange={handleChange("clinicName")}
                    onBlur={handleBlur("clinicName")}
                    error={errors.clinicName}
                    required
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input 
                      label="City" 
                      placeholder="e.g. New York" 
                      value={formData.clinicCity} 
                      onChange={handleChange("clinicCity")} 
                      onBlur={handleBlur("clinicCity")}
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
                      onBlur={handleBlur("clinicEmail")}
                      error={errors.clinicEmail}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input 
                      label="Timings" 
                      placeholder="e.g. 09:00 AM - 05:00 PM" 
                      value={formData.clinicTimings} 
                      onChange={handleChange("clinicTimings")} 
                    />
                    <Input 
                      label="Working Days" 
                      placeholder="e.g. Mon-Fri" 
                      value={formData.clinicWorkingDays} 
                      onChange={handleChange("clinicWorkingDays")} 
                    />
                  </div>
                </div>
              )}

              {/* STEP 3: Review & Summary page */}
              {step === 3 && (
                <div className="space-y-5 animate-fade-in text-sm text-text">
                  <div className="text-center mb-4">
                    <CardTitle>Review & Confirm</CardTitle>
                    <CardDescription className="mt-1">Please double check your settings before creating your workspace.</CardDescription>
                  </div>

                  {/* Organization Section */}
                  <div className="border border-border/60 rounded-xl p-4 bg-surface-alt/30 relative">
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="font-semibold text-text flex items-center gap-2">
                        <svg className="h-4.5 w-4.5 text-primary-600 dark:text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                        Organization Details
                      </h3>
                      <button
                        type="button"
                        onClick={() => setStep(0)}
                        className="text-xs font-semibold text-primary-600 hover:text-primary-700 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        Edit
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-xs">
                      <div><span className="text-text-muted">Name:</span> <span className="font-medium text-text">{formData.orgName}</span></div>
                      <div><span className="text-text-muted">City:</span> <span className="font-medium text-text">{formData.orgCity}</span></div>
                      {formData.orgAddress && <div className="sm:col-span-2"><span className="text-text-muted">Address:</span> <span className="font-medium text-text">{formData.orgAddress}</span></div>}
                      {formData.orgPhone && <div><span className="text-text-muted">Phone:</span> <span className="font-medium text-text">{formData.orgPhone}</span></div>}
                      {formData.orgEmail && <div><span className="text-text-muted">Email:</span> <span className="font-medium text-text">{formData.orgEmail}</span></div>}
                      {formData.orgTimings && <div><span className="text-text-muted">Timings:</span> <span className="font-medium text-text">{formData.orgTimings}</span></div>}
                      {formData.orgWorkingDays && <div><span className="text-text-muted">Working Days:</span> <span className="font-medium text-text">{formData.orgWorkingDays}</span></div>}
                      {formData.orgDescription && <div className="sm:col-span-2"><span className="text-text-muted">Description:</span> <span className="font-medium text-text">{formData.orgDescription}</span></div>}
                    </div>
                  </div>

                  {/* Admin Section */}
                  <div className="border border-border/60 rounded-xl p-4 bg-surface-alt/30 relative">
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="font-semibold text-text flex items-center gap-2">
                        <svg className="h-4.5 w-4.5 text-primary-600 dark:text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        Administrator Account
                      </h3>
                      <button
                        type="button"
                        onClick={() => setStep(1)}
                        className="text-xs font-semibold text-primary-600 hover:text-primary-700 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        Edit
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-xs">
                      <div><span className="text-text-muted">Name:</span> <span className="font-medium text-text">{formData.adminName}</span></div>
                      <div><span className="text-text-muted">Email:</span> <span className="font-medium text-text">{formData.adminEmail}</span></div>
                      {formData.adminPhone && <div><span className="text-text-muted">Phone:</span> <span className="font-medium text-text">{formData.adminPhone}</span></div>}
                      <div><span className="text-text-muted">Password:</span> <span className="font-medium text-text">••••••••</span></div>
                    </div>
                  </div>

                  {/* Clinic Section */}
                  <div className="border border-border/60 rounded-xl p-4 bg-surface-alt/30 relative">
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="font-semibold text-text flex items-center gap-2">
                        <svg className="h-4.5 w-4.5 text-primary-600 dark:text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 10.5V20a2 2 0 01-2 2H7a2 2 0 01-2-2v-9.5M3 10V4a2 2 0 012-2h14a2 2 0 012 2v6M3 10l9-6 9 6M12 11v5m0 0l-2-2m2 2l2-2" />
                        </svg>
                        Primary Clinic Branch
                      </h3>
                      <button
                        type="button"
                        onClick={() => setStep(2)}
                        className="text-xs font-semibold text-primary-600 hover:text-primary-700 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        Edit
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-xs">
                      <div><span className="text-text-muted">Name:</span> <span className="font-medium text-text">{formData.clinicName}</span></div>
                      <div><span className="text-text-muted">City:</span> <span className="font-medium text-text">{formData.clinicCity}</span></div>
                      {formData.clinicAddress && <div className="sm:col-span-2"><span className="text-text-muted">Address:</span> <span className="font-medium text-text">{formData.clinicAddress}</span></div>}
                      {formData.clinicPhone && <div><span className="text-text-muted">Phone:</span> <span className="font-medium text-text">{formData.clinicPhone}</span></div>}
                      {formData.clinicEmail && <div><span className="text-text-muted">Email:</span> <span className="font-medium text-text">{formData.clinicEmail}</span></div>}
                      {formData.clinicTimings && <div><span className="text-text-muted">Timings:</span> <span className="font-medium text-text">{formData.clinicTimings}</span></div>}
                      {formData.clinicWorkingDays && <div><span className="text-text-muted">Working Days:</span> <span className="font-medium text-text">{formData.clinicWorkingDays}</span></div>}
                    </div>
                  </div>

                  <div className="pt-2">
                    <Checkbox
                      label="I confirm all details are correct"
                      description="I agree to set up this organization, administrative account, and primary clinic with the configurations defined above."
                      checked={agreed}
                      onChange={(e) => setAgreed(e.target.checked)}
                    />
                  </div>
                </div>
              )}

            </CardContent>
            
            <CardFooter className="flex justify-between border-t border-border pt-5 bg-surface-alt/25">
              {step > 0 ? (
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

              {step === STEPS.length - 1 ? (
                <Button 
                  type="submit" 
                  loading={loading}
                  disabled={!agreed}
                  size="md"
                >
                  Create Workspace
                </Button>
              ) : (
                <Button 
                  type="button" 
                  onClick={handleNext}
                  size="md"
                >
                  Continue
                </Button>
              )}
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-surface-alt flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary-600 border-t-transparent animate-spin" />
      </div>
    }>
      <OnboardingInner />
    </Suspense>
  );
}
