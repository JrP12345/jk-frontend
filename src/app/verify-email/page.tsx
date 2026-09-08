"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Button,
  ModeSwitcher,
  AnantaLogo,
  Spinner,
} from "@/components/ui";
import { CheckCircle2, AlertTriangle, MailCheck, ArrowRight, Home } from "lucide-react";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<"loading" | "success" | "error" | "no_token">("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("no_token");
      return;
    }

    let isMounted = true;

    async function verify() {
      try {
        await api.post("/auth/verify-email", { token });
        if (isMounted) {
          setStatus("success");
        }
      } catch (err: any) {
        if (isMounted) {
          setStatus("error");
          setErrorMessage(
            err.response?.data?.message ||
              err.response?.data?.error ||
              "This verification link is invalid or has expired. Please log in to request a fresh verification link."
          );
        }
      }
    }

    verify();

    return () => {
      isMounted = false;
    };
  }, [token]);

  return (
    <div className="min-h-screen flex flex-col justify-center items-center p-4 relative overflow-hidden bg-background">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-4 right-4 z-50">
        <ModeSwitcher />
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="flex flex-col items-center mb-8">
          <AnantaLogo size="xl" className="mb-2" />
        </div>

        <Card className="border-border/60 shadow-xl backdrop-blur-md bg-card/95">
          <CardHeader className="text-center pb-2">
            {status === "loading" && (
              <div className="mx-auto my-4 w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <Spinner size="lg" />
              </div>
            )}

            {status === "success" && (
              <div className="mx-auto my-4 w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center animate-in zoom-in-50 duration-300">
                <CheckCircle2 className="w-8 h-8" />
              </div>
            )}

            {status === "error" && (
              <div className="mx-auto my-4 w-14 h-14 rounded-full bg-destructive/10 text-destructive flex items-center justify-center animate-in zoom-in-50 duration-300">
                <AlertTriangle className="w-8 h-8" />
              </div>
            )}

            {status === "no_token" && (
              <div className="mx-auto my-4 w-14 h-14 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center">
                <MailCheck className="w-8 h-8" />
              </div>
            )}

            <CardTitle className="text-2xl font-bold tracking-tight">
              {status === "loading" && "Verifying your email..."}
              {status === "success" && "Email Verified!"}
              {status === "error" && "Verification Failed"}
              {status === "no_token" && "Verification Link Missing"}
            </CardTitle>

            <CardDescription className="text-muted-foreground mt-2">
              {status === "loading" && "Please wait while we confirm your account details."}
              {status === "success" && "Your ANANTA account email has been verified. You now have full access."}
              {status === "error" && errorMessage}
              {status === "no_token" && "No verification token was detected in your link. Please check your email inbox."}
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-2">
            {status === "success" && (
              <div className="rounded-lg bg-emerald-500/10 p-4 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-sm text-center">
                Ready to sign in to your healthcare workspace or patient portal.
              </div>
            )}
          </CardContent>

          <CardFooter className="flex flex-col gap-2 pt-2">
            {status === "success" && (
              <Button
                className="w-full flex items-center justify-center gap-2 font-medium"
                size="lg"
                onClick={() => router.push("/login")}
              >
                Continue to Login
                <ArrowRight className="w-4 h-4" />
              </Button>
            )}

            {status === "error" && (
              <>
                <Button
                  className="w-full"
                  size="lg"
                  onClick={() => router.push("/login")}
                >
                  Return to Login
                </Button>
                <Button
                  variant="outline"
                  className="w-full flex items-center justify-center gap-2"
                  onClick={() => router.push("/")}
                >
                  <Home className="w-4 h-4" />
                  Return Home
                </Button>
              </>
            )}

            {status === "no_token" && (
              <Button
                className="w-full"
                size="lg"
                onClick={() => router.push("/login")}
              >
                Go to Login
              </Button>
            )}
          </CardFooter>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          &copy; {new Date().getFullYear()} ANANTA Health Platform. All rights reserved.
        </p>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <Spinner size="xl" />
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
