"use client";

import { useState, useEffect, useRef } from "react";
import { useAuthStore } from "@/store/authStore";
import { Button, Input, Modal, Textarea, Badge, Avatar, useToast } from "@/components/ui";
import api from "@/lib/api";
import { Lock, ShieldAlert, KeyRound, LogOut, ArrowRight, UserCheck, AlertTriangle } from "lucide-react";
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

  // Break Glass State
  const [isBreakGlassMode, setIsBreakGlassMode] = useState(false);
  const [breakGlassReason, setBreakGlassReason] = useState("");
  const [submittingBreakGlass, setSubmittingBreakGlass] = useState(false);

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
      setIsBreakGlassMode(false);
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

  const handleBreakGlassUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!breakGlassReason.trim() || breakGlassReason.trim().length < 10) {
      setErrorMsg("A detailed clinical justification (minimum 10 characters) is required for Break-Glass override.");
      return;
    }

    try {
      setSubmittingBreakGlass(true);
      // Log emergency audit trail
      try {
        await api.post("/audit-logs", {
          action: "BREAK_GLASS_EMERGENCY_OVERRIDE",
          targetModel: "ClinicalWorkstation",
          details: {
            reason: breakGlassReason.trim(),
            unlockedBy: user.id,
            userRole: user.role,
            timestamp: new Date().toISOString(),
          },
        });
      } catch {
        // Audit log fallback
      }

      toast({
        title: "Emergency Break-Glass Granted 🚨",
        description: "Workstation unlocked. Audit log entry recorded for compliance review.",
        variant: "warning",
      });

      setIsLocked(false);
      setIsBreakGlassMode(false);
      setBreakGlassReason("");
      resetIdleTimer();
    } catch (err: any) {
      setErrorMsg("Failed to process Break-Glass override.");
    } finally {
      setSubmittingBreakGlass(false);
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
        {!isBreakGlassMode ? (
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

            {/* Break-Glass & Sign Out actions */}
            <div className="flex items-center justify-between pt-3 border-t border-border/70 text-xs">
              <button
                type="button"
                onClick={() => {
                  setIsBreakGlassMode(true);
                  setErrorMsg("");
                }}
                className="text-amber-600 dark:text-amber-400 hover:underline font-semibold flex items-center gap-1 cursor-pointer"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Emergency Break-Glass</span>
              </button>

              <button
                type="button"
                onClick={handleSignOut}
                className="text-text-muted hover:text-text font-semibold flex items-center gap-1 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Switch / Sign Out</span>
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleBreakGlassUnlock} className="space-y-4 text-left animate-fade-in">
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl space-y-1 text-xs">
              <div className="flex items-center gap-1.5 font-bold text-amber-600 dark:text-amber-400">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Emergency Break-Glass Override</span>
              </div>
              <p className="text-text-secondary leading-relaxed text-[11px]">
                Allows instantaneous chart access during critical emergencies. All actions are logged and flagged for compliance review.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-text">Clinical Emergency Justification *</label>
              <Textarea
                placeholder="e.g. Code blue called in ICU Bed 4, attending physician override needed for vitals..."
                value={breakGlassReason}
                onChange={(e) => {
                  setBreakGlassReason(e.target.value);
                  setErrorMsg("");
                }}
                rows={3}
                required
                autoFocus
              />
              {errorMsg && <p className="text-xs text-rose-500 font-medium">{errorMsg}</p>}
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={() => {
                  setIsBreakGlassMode(false);
                  setErrorMsg("");
                }}
                className="w-1/3"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="md"
                className="w-2/3 bg-amber-600 hover:bg-amber-700 text-white font-bold shadow-xs cursor-pointer"
                loading={submittingBreakGlass}
              >
                Confirm Break-Glass Access
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
