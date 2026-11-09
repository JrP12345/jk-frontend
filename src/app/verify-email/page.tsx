"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

import api from "@/lib/api";
import { userFacingError } from "@/lib/userFacingError";
import { Card, CardHeader, CardTitle, CardDescription, CardFooter, Button, Spinner } from "@/components/ui";
import AuthPageShell from "@/components/auth/AuthPageShell";
import AuthPageLoading from "@/components/auth/AuthPageLoading";
import auth from "@/components/auth/AuthPageShell.module.css";
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
          setErrorMessage(userFacingError(err.response?.data?.message || err.response?.data?.error, "This verification link is invalid or has expired. Sign in to request a new link."));
        }
      }
    }

    verify();

    return () => {
      isMounted = false;
    };
  }, [token]);

  return <AuthPageShell>
    <Card padding="none" className={auth.card}>
      <div aria-live="polite">
        <CardHeader className={auth.formHeader}>
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-control bg-selected text-accent">
            {status === "loading" && <Spinner size="lg" />}
            {status === "success" && <CheckCircle2 className="h-7 w-7" aria-hidden="true" />}
            {status === "error" && <AlertTriangle className="h-7 w-7 text-danger-text" aria-hidden="true" />}
            {status === "no_token" && <MailCheck className="h-7 w-7" aria-hidden="true" />}
          </div>
          <CardTitle as="h1" className="page-title">
            {status === "loading" && "Verifying your email..."}
            {status === "success" && "Email Verified!"}
            {status === "error" && "Verification Failed"}
            {status === "no_token" && "Verification Link Missing"}
          </CardTitle>
          <CardDescription>
            {status === "loading" && "Please wait while we confirm your account details."}
            {status === "success" && "Your Ekavyu account email has been verified. Sign in to continue."}
            {status === "error" && errorMessage}
            {status === "no_token" && "No verification token was detected in your link. Please check your email inbox."}
          </CardDescription>
        </CardHeader>
      </div>
      {status !== "loading" && <CardFooter className={auth.formFooter + " flex flex-col gap-3"}>
        <Button fullWidth size="lg" onClick={() => router.push("/login")} iconRight={<ArrowRight aria-hidden="true" />}>
          {status === "success" ? "Continue to Login" : status === "error" ? "Return to Login" : "Go to Login"}
        </Button>
        {status === "error" && <Button variant="outline" fullWidth onClick={() => router.push("/")} icon={<Home aria-hidden="true" />}>Return Home</Button>}
      </CardFooter>}
    </Card>
  </AuthPageShell>;
}

export default function VerifyEmailPage() {
  return <Suspense fallback={<AuthPageLoading label="Verifying email" />}><VerifyEmailContent /></Suspense>;
}
