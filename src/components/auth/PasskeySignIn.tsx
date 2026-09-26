"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { browserSupportsWebAuthn, startAuthentication } from "@simplewebauthn/browser";
import { Button, useToast } from "@/components/ui";
import { KeyRound } from "lucide-react";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

export default function PasskeySignIn({ onTwoFactor }: { onTwoFactor: (token: string) => void }) {
  const [support, setSupport] = useState<{ checked: boolean; supported: boolean; reason?: string }>({ checked: false, supported: false });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  useEffect(() => {
    const hasWebAuthn = browserSupportsWebAuthn();
    const isSecure = window.isSecureContext;
    setSupport({
      checked: true,
      supported: isSecure && hasWebAuthn,
      reason: !isSecure
        ? "Passkeys need HTTPS, or open local development from http://localhost."
        : !hasWebAuthn
          ? "This browser does not support passkeys."
          : undefined,
    });
  }, []);
  const signIn = async () => {
    setLoading(true);
    try {
      const options = await api.post("/auth/passkeys/login/options");
      const response = await startAuthentication({ optionsJSON: options.data.data });
      const result = await api.post("/auth/passkeys/login/verify", { response });
      const data = result.data.data;
      if (data.twoFactorRequired) { onTwoFactor(data.twoFactorToken); return; }
      useAuthStore.getState().login(data.user);
      toast({ title: "Signed in with passkey", variant: "success" });
      router.push("/dashboard");
    } catch (error: any) {
      if (error.name !== "NotAllowedError" && error.name !== "AbortError") toast({ title: "Passkey sign-in failed", description: error.response?.data?.message || "Please try again or use your usual sign-in method.", variant: "error" });
    } finally { setLoading(false); }
  };
  if (!support.checked) return null;
  return (
    <div className="space-y-2">
      <Button type="button" variant="outline" className="w-full min-h-11" loading={loading} disabled={!support.supported} onClick={signIn}>
        <KeyRound className="w-4 h-4 mr-2" />Sign in with a passkey
      </Button>
      {!support.supported && support.reason && <p className="text-xs leading-5 text-text-muted">{support.reason}</p>}
    </div>
  );
}
