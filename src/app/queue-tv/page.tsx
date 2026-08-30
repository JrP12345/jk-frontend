"use client";

import { useEffect, useState } from "react";
import { Badge, Card, CardHeader, CardTitle, CardContent, Spinner } from "@/components/ui";
import api from "@/lib/api";

export default function WaitingRoomTvQueueBoard() {
  const [clinicName, setClinicName] = useState("ANANT Healthcare Desk");
  const [activeToken, setActiveToken] = useState<any | null>(null);
  const [waitingQueue, setWaitingQueue] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastAnnounced, setLastAnnounced] = useState<string>("");

  const fetchQueueState = async () => {
    try {
      const res = await api.get("/queue");
      const list = res.data?.data || [];

      const inConsult = list.find((item: any) => item.status === "in-consultation" || item.status === "checked-in");
      const waiting = list.filter((item: any) => item.id !== inConsult?.id && item.status !== "completed" && item.status !== "cancelled");

      setActiveToken(inConsult || list[0] || null);
      setWaitingQueue(waiting.slice(0, 6));

      if (inConsult && inConsult.tokenNumber && String(inConsult.tokenNumber) !== lastAnnounced) {
        setLastAnnounced(String(inConsult.tokenNumber));
        speakAnnouncement(inConsult.tokenNumber, inConsult.patientId?.userId?.name || "Patient");
      }
    } catch {
      // Non-critical
    } finally {
      setLoading(false);
    }
  };

  const speakAnnouncement = (token: number, patientName: string) => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(
        `Token number ${token}, ${patientName}, please proceed to the doctor's consultation room.`
      );
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    }
  };

  useEffect(() => {
    fetchQueueState();
    const interval = setInterval(fetchQueueState, 4000); // 4-second live poll & SSE fallback
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-[#0b0c10] text-white p-8 flex flex-col justify-between select-none animate-fade-in font-sans">
      {/* Top TV Banner */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-primary-600 flex items-center justify-center font-black text-2xl shadow-lg">
            ⚡
          </div>
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight">{clinicName}</h1>
            <p className="text-sm font-semibold text-zinc-400">Live Waiting Room Queue Display • Real-Time Updates</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant="success" className="text-sm px-4 py-1.5 animate-pulse font-bold">
            ● LIVE QUEUE ACTIVE
          </Badge>
          <span className="text-lg font-bold text-zinc-400">
            {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
      </div>

      {/* Main Waiting Room Display Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 my-8 flex-1">
        {/* Left Column: Currently Serving / Called Token */}
        <div className="lg:col-span-2 bg-gradient-to-br from-zinc-900 via-zinc-900 to-primary-950/40 p-8 rounded-3xl border border-primary-500/30 flex flex-col justify-between shadow-2xl relative overflow-hidden">
          <div className="flex justify-between items-center">
            <span className="text-sm font-black uppercase tracking-widest text-primary-400 bg-primary-500/10 px-4 py-1.5 rounded-full border border-primary-500/20">
              NOW SERVING / CURRENT CONSULTATION
            </span>
            <span className="text-xs text-zinc-400 font-semibold">Room 101 • OPD Wing A</span>
          </div>

          {activeToken ? (
            <div className="my-10 text-center space-y-4">
              <div className="text-[120px] font-black text-emerald-400 leading-none tracking-tighter drop-shadow-[0_0_35px_rgba(52,211,153,0.3)]">
                #{activeToken.tokenNumber}
              </div>
              <h2 className="text-4xl font-bold text-white tracking-wide">
                {activeToken.patientId?.userId?.name || "Patient"}
              </h2>
              <p className="text-xl font-medium text-zinc-400">
                Attending Practitioner: <span className="text-primary-400 font-bold">Dr. {activeToken.doctorId?.name || "On Duty"}</span>
              </p>
            </div>
          ) : (
            <div className="my-16 text-center text-zinc-500 space-y-2">
              <p className="text-3xl font-bold">No Active Consultation</p>
              <p className="text-sm">Please wait for doctor to call next token</p>
            </div>
          )}

          <div className="p-4 bg-zinc-950/60 rounded-2xl border border-zinc-800 flex justify-between items-center text-sm font-semibold text-zinc-300">
            <span>📢 Audio Voice Announcement Enabled</span>
            <span className="text-xs text-emerald-400">Auto-sync active</span>
          </div>
        </div>

        {/* Right Column: Upcoming Queue */}
        <div className="bg-zinc-900/90 p-6 rounded-3xl border border-zinc-800 flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-extrabold text-white mb-4 flex items-center justify-between border-b border-zinc-800 pb-3">
              <span>Next Patients in Queue</span>
              <span className="text-xs text-zinc-400 font-normal">{waitingQueue.length} Waiting</span>
            </h3>

            <div className="space-y-3">
              {waitingQueue.length === 0 ? (
                <p className="text-sm text-zinc-500 italic text-center py-8">Queue is currently empty</p>
              ) : (
                waitingQueue.map((item, idx) => (
                  <div
                    key={item.id || idx}
                    className="p-3.5 bg-zinc-950 rounded-2xl border border-zinc-800/80 flex items-center justify-between transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center text-base font-black text-white">
                        #{item.tokenNumber}
                      </div>
                      <div>
                        <p className="font-bold text-sm text-white">{item.patientId?.userId?.name || "Patient"}</p>
                        <p className="text-xs text-zinc-400">Dr. {item.doctorId?.name || "Doctor"}</p>
                      </div>
                    </div>

                    <Badge variant="outline" className="text-xs border-zinc-700 text-zinc-300">
                      Position #{idx + 1}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-zinc-800 text-center text-xs text-zinc-500">
            Displaying live OPD token order • Refreshing automatically
          </div>
        </div>
      </div>

      {/* Footer ticker */}
      <div className="bg-zinc-900 px-6 py-3 rounded-2xl border border-zinc-800 text-xs text-zinc-400 flex justify-between items-center">
        <span>Emergency Services available 24/7. Please contact Reception Desk for urgent assistance.</span>
        <span className="font-bold text-primary-400">ANANT HealthOS v2.0</span>
      </div>
    </div>
  );
}
