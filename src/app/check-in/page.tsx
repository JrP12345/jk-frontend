"use client";

import { useState } from "react";
import { Button, Input, Card, CardHeader, CardTitle, CardContent, Badge, useToast } from "@/components/ui";
import api from "@/lib/api";

export default function PublicSelfCheckInKiosk() {
  const { toast } = useToast();

  const [inputToken, setInputToken] = useState("");
  const [inputClinicId, setInputClinicId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [checkInResult, setCheckInResult] = useState<any | null>(null);

  const handleCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputToken.trim()) {
      toast({ title: "Validation Error", description: "Please enter your queue token number", variant: "error" });
      return;
    }

    setSubmitting(true);
    setCheckInResult(null);

    try {
      const res = await api.post("/check-in/qr", {
        tokenNumber: Number(inputToken),
        clinicId: inputClinicId.trim() || undefined,
      });

      const data = res.data?.data;
      setCheckInResult(data);

      toast({
        title: "Self Check-In Complete! 🎉",
        description: res.data?.message || `Checked in! Your Queue Token is #${data?.tokenNumber}`,
        variant: "success",
      });
    } catch (err: any) {
      toast({
        title: "Check-In Failed",
        description: err.response?.data?.message || "Invalid token number or appointment not found",
        variant: "error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-alt flex flex-col items-center justify-center p-6 animate-fade-in">
      <div className="w-full max-w-lg space-y-6">
        {/* Kiosk Branding Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary-500/10 border border-primary-500/20 text-xs font-bold text-primary-500">
            🏥 Clinic Reception Kiosk • Touch Self Check-In
          </div>
          <h1 className="text-3xl font-black text-text tracking-tight">ANANTA Health Desk</h1>
          <p className="text-sm text-text-muted">
            Arrived for your consultation? Enter your appointment Queue Token number below to activate your turn.
          </p>
        </div>

        <Card className="border-border shadow-xl">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-text text-center">Enter Queue Token Number</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!checkInResult ? (
              <form onSubmit={handleCheckIn} className="space-y-4">
                <div className="text-center">
                  <Input
                    type="number"
                    placeholder="e.g. 1, 2, 14..."
                    className="text-center text-3xl font-black tracking-widest h-16 rounded-2xl border-2 border-primary-500/30 focus:border-primary-500"
                    value={inputToken}
                    onChange={(e) => setInputToken(e.target.value)}
                    required
                  />
                </div>

                <Button type="submit" size="lg" className="w-full h-14 text-lg font-bold rounded-2xl" loading={submitting}>
                  Check In Now 🚀
                </Button>
              </form>
            ) : (
              <div className="space-y-6 text-center animate-fade-in">
                <div className="p-6 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl space-y-2">
                  <Badge variant="success" className="text-sm px-3 py-1">
                    CHECKED IN
                  </Badge>
                  <p className="text-xs font-semibold text-text-muted">Queue Token</p>
                  <div className="text-6xl font-black text-emerald-600 dark:text-emerald-400">
                    #{checkInResult.tokenNumber}
                  </div>
                  <p className="text-sm font-bold text-text mt-2">{checkInResult.patientName}</p>
                  <p className="text-xs text-text-muted">Doctor: Dr. {checkInResult.doctorName}</p>
                </div>

                <p className="text-xs text-text-secondary">
                  Please take a seat in the reception waiting area. The doctor will call your token number shortly.
                </p>

                <Button variant="outline" className="w-full" onClick={() => { setCheckInResult(null); setInputToken(""); }}>
                  Done / Next Check-In
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
