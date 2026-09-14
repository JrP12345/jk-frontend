"use client";

import { useState, useEffect, useRef } from "react";
import { useAuthStore } from "@/store/authStore";
import { Button, Input, Badge, Avatar, useToast } from "@/components/ui";
import api from "@/lib/api";
import { Lock, KeyRound, LogOut, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";

const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes of inactivity

export function ClinicalScreenLock() {
  const { user, logout } = useAuthStore();
  const { toast } = useToast();
  const router = useRouter();

  const [isLocked, setIsLocked] = useState(false);
  const [password, setPassword] = useState("");
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);

  const resetIdleTimer = () => {
    if (isLocked) return;
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      if (user && user.role !== "patient") {
        setIsLocked(true);
      }
    }, IDLE_TIMEOUT_MS);
  };

  useEffect(() => {
    if (!user || user.role === "patient") return;

    const events = ["mousemove", "keydown", "touchstart", "scroll", "click"];
    const handleActivity = () => resetIdleTimer();

    events.forEach((ev) => window.addEventListener(ev, handleActivity));
    resetIdleTimer();

    const handleManualLock = () => {
      setIsLocked(true);
      setPassword("");
      setErrorMsg("");
    };

    window.addEventListener("lock-workstation", handleManualLock);

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, handleActivity));
      window.removeEventListener("lock-workstation", handleManualLock);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [user, isLocked]);

  if (!isLocked || !user || user.role === "patient") {
    return null;
  }

  const handleUnlockWithPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setErrorMsg("Please enter your account password");
      return;
    }

    try {
      setIsUnlocking(true);
      setErrorMsg("");
      // Verify credentials with backend auth login endpoint
      await api.post("/auth/login", {
        email: user.email,
        password: password.trim(),
      });

      toast({
        title: "Workstation Unlocked",
        description: `Welcome back, Dr./Staff ${user.name}`,
        variant: "success",
      });

      setIsLocked(false);
      setPassword("");
      resetIdleTimer();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || "Invalid password. Please check credentials.");
    } finally {
      setIsUnlocking(false);
    }
  };

  const handleSignOut = async () => {
    await logout();
    setIsLocked(false);
    router.push("/login");
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-2xl animate-fade-in select-none">
      <div className="w-full max-w-md bg-surface/98 border border-border/90 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 relative overflow-hidden text-center text-text">
        {/* Glow Header */}
        <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-primary-500 via-purple-500 to-primary-500" />

        {/* Lock Icon and User Badge */}
        <div className="space-y-3 flex flex-col items-center">
          <div className="relative">
            <Avatar name={user.name} size="lg" className="h-20 w-20 text-xl border-4 border-surface shadow-xl" />
            <div className="absolute -bottom-1 -right-1 p-2 bg-primary-600 rounded-full text-white shadow-lg">
              <Lock className="w-4 h-4" />
            </div>
          </div>

          <div className="space-y-1">
            <h2 className="text-xl font-bold text-text tracking-tight">{user.name}</h2>
            <div className="flex items-center justify-center gap-2">
              <Badge variant="primary" size="sm" className="capitalize font-semibold text-[10px]">
                {user.role}
              </Badge>
              <span className="text-xs text-text-muted">Workstation Secured</span>
            </div>
          </div>
        </div>

        {/* Unlock Form */}
        <form onSubmit={handleUnlockWithPassword} className="space-y-4 text-left">
          <p className="text-xs text-text-muted text-center leading-relaxed">
            Session locked due to inactivity. Enter your account password to resume clinical operations.
          </p>

          <div className="space-y-1.5">
            <Input
              type="password"
              placeholder="Enter password..."
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setErrorMsg("");
              }}
              icon={<KeyRound className="w-4 h-4 text-text-muted" />}
              autoFocus
              required
            />
            {errorMsg && <p className="text-xs text-rose-500 font-medium">{errorMsg}</p>}
          </div>

          <Button type="submit" variant="primary" size="lg" className="w-full font-bold shadow-xs cursor-pointer" loading={isUnlocking}>
            <span>Unlock Workstation</span>
            <ArrowRight className="w-4 h-4 ml-1.5" />
          </Button>

          {/* Sign Out action */}
          <div className="flex items-center justify-center pt-3 border-t border-border/70 text-xs">
            <button
              type="button"
              onClick={handleSignOut}
              className="text-text-muted hover:text-text font-semibold flex items-center gap-1.5 cursor-pointer py-1.5 px-3 rounded-lg hover:bg-surface-alt transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Switch / Sign Out</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
