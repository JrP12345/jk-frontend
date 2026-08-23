"use client";

import React, { useState, useEffect } from "react";
import api from "@/lib/api";
import { Card, CardContent, Badge, Button, Spinner } from "@/components/ui";

interface PatientQueueTrackerProps {
  appointmentId: string;
  clinicId: string;
  doctorId: string;
}

export function PatientQueueTracker({ appointmentId, clinicId, doctorId }: PatientQueueTrackerProps) {
  const [queueInfo, setQueueInfo] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchQueueInfo = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/queue?clinicId=${clinicId}&doctorId=${doctorId}`);
      const queueList: any[] = res.data?.data || [];
      
      const currentPatientAppt = queueList.find((a) => (a.id || a._id) === appointmentId);
      const inConsultationAppt = queueList.find((a) => a.status === "in-consultation");

      setQueueInfo({
        myToken: currentPatientAppt?.tokenNumber,
        myStatus: currentPatientAppt?.status || "scheduled",
        estimatedWaitTime: currentPatientAppt?.estimatedWaitTime || 0,
        currentInConsultationToken: inConsultationAppt?.tokenNumber || null,
        totalWaitingAhead: queueList.filter((a) => ["checked-in", "confirmed", "pending"].includes(a.status) && a.tokenNumber < (currentPatientAppt?.tokenNumber || 0)).length,
      });
    } catch (err) {
      console.error("Failed to fetch live queue status:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (appointmentId && clinicId && doctorId) {
      fetchQueueInfo();
      const interval = setInterval(fetchQueueInfo, 10000); // Live poll every 10 sec
      return () => clearInterval(interval);
    }
  }, [appointmentId, clinicId, doctorId]);

  if (loading && !queueInfo) {
    return (
      <Card className="p-4 text-center">
        <Spinner size="sm" label="Fetching live queue position..." />
      </Card>
    );
  }

  if (!queueInfo || queueInfo.myToken == null) return null;

  return (
    <Card className="border-l-4 border-l-primary-500 bg-surface border border-border/80 shadow-xs rounded-2xl overflow-hidden">
      <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs font-sans">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-primary-600 text-white flex flex-col items-center justify-center font-extrabold shadow-md shrink-0">
            <span className="text-[9px] opacity-80 uppercase tracking-widest font-semibold">My Token</span>
            <span className="text-xl leading-5 mt-0.5">#{queueInfo.myToken}</span>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-bold text-text text-sm tracking-tight">Live OPD Queue Status</span>
              <Badge variant={queueInfo.myStatus === "in-consultation" ? "success" : queueInfo.myStatus === "checked-in" ? "primary" : "warning"} className="capitalize font-bold text-[10px]">
                {queueInfo.myStatus.replace("-", " ")}
              </Badge>
            </div>
            <p className="text-text-secondary text-xs">
              Currently in consultation:{" "}
              <span className="font-bold text-primary-500">
                {queueInfo.currentInConsultationToken ? `Token #${queueInfo.currentInConsultationToken}` : "Doctor Desk Ready"}
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 border-t md:border-t-0 md:border-l border-border pt-3 md:pt-0 md:pl-4">
          <div className="text-center md:text-right">
            <span className="text-text-muted block font-medium">Patients Ahead</span>
            <span className="font-bold text-text text-sm">{queueInfo.totalWaitingAhead} Patients</span>
          </div>

          <div className="text-center md:text-right">
            <span className="text-text-muted block font-medium">Estimated Wait</span>
            <span className="font-bold text-amber-600 text-sm">{queueInfo.estimatedWaitTime} mins</span>
          </div>

          {(queueInfo.myStatus === "pending" || queueInfo.myStatus === "confirmed") && (
            <Button
              size="xs"
              variant="primary"
              onClick={async () => {
                try {
                  await api.post(`/appointments/${appointmentId}/check-in`);
                  fetchQueueInfo();
                } catch (e) {
                  // ignore
                }
              }}
              className="font-bold shrink-0"
            >
              Check In Now ✅
            </Button>
          )}

          <Button size="xs" variant="outline" onClick={fetchQueueInfo} title="Refresh Queue Status">
            🔄
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
