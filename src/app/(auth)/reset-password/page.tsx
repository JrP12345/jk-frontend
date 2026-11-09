"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, Input, Button, useToast, cn } from "@/components/ui";
import AuthPageShell from "@/components/auth/AuthPageShell";
import AuthPageLoading from "@/components/auth/AuthPageLoading";
import auth from "@/components/auth/AuthPageShell.module.css";

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
    <AuthPageShell>
        <Card
          padding="none"
          className={cn(
            auth.card,
            isShaking && "animate-shake"
          )}
        >
          {!isSuccess ? (
            <form onSubmit={handleResetPassword} noValidate className="space-y-5">
              <CardHeader className={auth.formHeader}>
                <CardTitle as="h1" className="page-title">Reset Password</CardTitle>
                <CardDescription>
                  Enter your new password below to regain access to your account.
                </CardDescription>
              </CardHeader>

              <CardContent className="p-0 space-y-4">
                <Input
                  size="lg"
                  label="New Password *"
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  error={passwordError}
                  required
                />

                <Input
                  size="lg"
                  label="Confirm New Password *"
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  error={confirmError}
                  required
                />
              </CardContent>

              <CardFooter className={`${auth.formFooter} flex flex-col gap-3`}>
                <Button type="submit" fullWidth loading={loading} size="lg" className="font-bold min-h-[44px]">
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
            <div className="space-y-5">
              <div className="w-12 h-12 bg-success/10 border border-success/20 text-success-text rounded-full flex items-center justify-center mx-auto">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>

              <div>
                <h1 className="page-title">Password Updated</h1>
                <p className="text-sm text-text-secondary mt-2">
                  Your password has been reset successfully. You can now log in with your new password.
                </p>
              </div>

              <Button fullWidth onClick={() => router.push("/login")} size="lg" className="font-bold min-h-[44px]">
                Proceed to Sign In
              </Button>
            </div>
          )}
        </Card>
    </AuthPageShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<AuthPageLoading label="Loading password reset" />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
