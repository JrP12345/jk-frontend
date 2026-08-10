"use client";

import React, { useState, useEffect } from "react";
import api from "@/lib/api";
import { Card, CardContent, Badge, Button, Spinner } from "@/components/ui";

export interface QueueStatusCardProps {
  clinicId: string;
  doctorId: string;
  appointmentId?: string;
  date?: string;
  onRefresh?: () => void;
  className?: string;
}

export function QueueStatusCard({
  clinicId,
  doctorId,
  appointmentId,
  date,
  onRefresh,
  className = "",
}: QueueStatusCardProps) {
  const [statusData, setStatusData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState(false);

  const fetchQueueStatus = async () => {
    if (!clinicId || !doctorId) return;
    try {
      setLoading(true);
      let url = `/queue/status?clinicId=${clinicId}&doctorId=${doctorId}`;
      if (date) url += `&date=${date}`;
      const res = await api.get(url);
      setStatusData(res.data?.data || null);
    } catch (err) {
      console.error("Failed to fetch queue status:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueueStatus();
    const interval = setInterval(fetchQueueStatus, 15000); // 15s refresh
    return () => clearInterval(interval);
  }, [clinicId, doctorId, date]);

  const handleCheckIn = async () => {
    if (!appointmentId) return;
    try {
      setCheckingIn(true);
      await api.post(`/appointments/${appointmentId}/check-in`);
      fetchQueueStatus();
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error("Check in failed:", err);
    } finally {
      setCheckingIn(false);
    }
  };

  if (loading && !statusData) {
    return (
      <Card className={`p-4 text-center ${className}`}>
        <Spinner size="sm" label="Loading live queue status..." />
      </Card>
    );
  }

  if (!statusData) return null;

  const isQueueMode = statusData.bookingMode === "sequential_queue";

  return (
    <Card className={`border-l-4 border-l-primary-600 bg-gradient-to-r from-primary-50/40 via-surface to-surface shadow-xs ${className}`}>
      <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left Section: Token Badges & Queue Status */}
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-600 to-primary-700 text-white flex flex-col items-center justify-center font-bold shadow-md shrink-0">
            <span className="text-[10px] opacity-80 uppercase tracking-widest font-medium">Your Token</span>
            <span className="text-2xl leading-6">{statusData.myToken ? `#${statusData.myToken}` : `#${statusData.nextToken}`}</span>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-bold text-text text-sm">
                {isQueueMode ? "🎟 Sequential Token Queue" : "🗓 Live OPD Queue"}
              </span>
              {statusData.myStatus && (
                <Badge
                  variant={
                    statusData.myStatus === "in-consultation"
                      ? "success"
                      : statusData.myStatus === "checked-in"
                      ? "primary"
                      : "warning"
                  }
                  className="capitalize font-bold text-[10px]"
                >
                  {statusData.myStatus.replace("-", " ")}
                </Badge>
              )}
            </div>

            <p className="text-xs text-text-secondary">
              Now In Consultation:{" "}
              <span className="font-bold text-primary-600 dark:text-primary-400">
                {statusData.currentlyServing ? `Token #${statusData.currentlyServing}` : "None currently"}
              </span>
            </p>

          </div>
        </div>

        {/* Right Section: Metrics & Action */}
        <div className="flex flex-wrap items-center gap-4 border-t md:border-t-0 md:border-l border-border pt-3 md:pt-0 md:pl-5">
          <div className="text-left md:text-right">
            <span className="text-[11px] text-text-muted block font-medium">People Ahead</span>
            <span className="font-bold text-text text-sm sm:text-base">{statusData.peopleAhead} Patients</span>
          </div>

          <div className="text-left md:text-right">
            <span className="text-[11px] text-text-muted block font-medium">Estimated Wait</span>
            <span className="font-bold text-amber-600 dark:text-amber-400 text-sm sm:text-base">
              ~{statusData.estimatedWaitMinutes} mins
            </span>
          </div>

          {appointmentId && (statusData.myStatus === "pending" || statusData.myStatus === "confirmed") && (
            <Button
              size="xs"
              variant="primary"
              onClick={handleCheckIn}
              disabled={checkingIn}
              className="font-bold shrink-0 shadow-xs"
            >
              {checkingIn ? "Checking in..." : "Check In Now ✅"}
            </Button>
          )}

          <Button
            size="xs"
            variant="outline"
            onClick={() => {
              fetchQueueStatus();
              if (onRefresh) onRefresh();
            }}
            title="Refresh Live Status"
            className="shrink-0"
          >
            🔄
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
