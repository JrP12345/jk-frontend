"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, Input, Button, useToast, ModeSwitcher, EkavyuLogo, cn } from "@/components/ui";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const email = searchParams.get("email") || "";
  const { toast } = useToast();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [confirmError, setConfirmError] = useState("");
  const [isShaking, setIsShaking] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const triggerShake = () => {
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 450);
  };

  const validate = () => {
    let valid = true;
    if (!newPassword) {
      setPasswordError("Password is required");
      valid = false;
    } else if (newPassword.length < 8) {
      setPasswordError("Password must be at least 8 characters");
      valid = false;
    } else if (!/[A-Z]/.test(newPassword)) {
      setPasswordError("Password must contain at least one uppercase letter");
      valid = false;
    } else if (!/[a-z]/.test(newPassword)) {
      setPasswordError("Password must contain at least one lowercase letter");
      valid = false;
    } else if (!/[0-9]/.test(newPassword)) {
      setPasswordError("Password must contain at least one digit");
      valid = false;
    } else {
      setPasswordError("");
    }

    if (newPassword !== confirmPassword) {
      setConfirmError("Passwords do not match");
      valid = false;
    } else {
      setConfirmError("");
    }

    return valid;
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      triggerShake();
      return;
    }

    if (!token) {
      toast({
        title: "Invalid Link",
        description: "Password reset token is missing from the link. Please request a new recovery email.",
        variant: "error",
      });
      return;
    }

    setLoading(true);
    try {
      const res = await api.post("/auth/reset-password", {
        token,
        email,
        newPassword,
      });

      if (res.data && res.data.success) {
        setIsSuccess(true);
        toast({
          title: "Password Reset Successfully",
          description: "Your password has been updated. You can now log in with your new credentials.",
          variant: "success",
          duration: 4000,
        });
      }
    } catch (err: any) {
      triggerShake();
      toast({
        title: "Reset Failed",
        description: err.response?.data?.message || "Invalid or expired reset token. Please request a new link.",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center py-20 px-4 bg-surface-alt relative font-sans text-text animate-page-enter">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 brand-wash" />
      </div>

      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-20">
        <ModeSwitcher variant="icon" />
      </div>

      <div className="w-full max-w-md relative z-10 animate-fade-up">
        <div className="text-center mb-6 flex flex-col items-center justify-center">
          <EkavyuLogo size="xl" showTagline />
          <p className="text-text-secondary text-xs sm:text-sm mt-2">Set New Account Password</p>
        </div>

        <Card
          className={cn(
            "border-border bg-surface p-0 rounded-xl overflow-hidden transition-transform duration-300",
            isShaking && "animate-shake"
          )}
        >
          {!isSuccess ? (
            <form onSubmit={handleResetPassword} noValidate className="p-5 sm:p-6 space-y-4">
              <CardHeader className="p-0 mb-3">
                <CardTitle as="h1" className="text-xl font-bold">Reset Password</CardTitle>
                <CardDescription className="text-xs text-text-muted mt-1">
                  Enter your new password below to regain access to your account.
                </CardDescription>
              </CardHeader>

              <CardContent className="p-0 space-y-4">
                <Input
                  label="New Password *"
                  type="password"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  error={passwordError}
                  required
                />

                <Input
                  label="Confirm New Password *"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  error={confirmError}
                  required
                />
              </CardContent>

              <CardFooter className="p-0 pt-2 flex flex-col gap-3">
                <Button type="submit" fullWidth loading={loading} size="lg" className="rounded-xl font-bold min-h-[44px]">
                  Update Password
                </Button>
                <Link
                  href="/login"
                  className="text-xs text-center font-semibold text-text-secondary hover:text-text transition-colors min-h-[44px] flex items-center justify-center"
                >
                  &larr; Back to Sign In
                </Link>
              </CardFooter>
            </form>
          ) : (
            <div className="p-6 text-center space-y-4">
              <div className="w-12 h-12 bg-success/10 border border-success/20 text-success-text rounded-full flex items-center justify-center mx-auto">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>

              <div>
                <h2 className="text-xl font-bold text-text">Password Updated</h2>
                <p className="text-xs text-text-muted mt-1">
                  Your password has been reset successfully. You can now log in with your new password.
                </p>
              </div>

              <Button fullWidth onClick={() => router.push("/login")} size="lg" className="rounded-xl font-bold min-h-[44px]">
                Proceed to Sign In
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-xs text-text-muted">Loading...</div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
