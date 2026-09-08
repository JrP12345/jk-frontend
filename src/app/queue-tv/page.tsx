"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Badge, Spinner } from "@/components/ui";
import api from "@/lib/api";
import { announcePatientToken, VoiceAnnounceLanguage } from "@/utils/audioChimes";
import { getWebSocketUrl } from "@/utils/websocket";

export default function WaitingRoomTvQueueBoard() {
  const [clinicName, setClinicName] = useState("ANANT Healthcare OPD");
  const [clinicId, setClinicId] = useState<string>("");
  const [doctorId, setDoctorId] = useState<string>("");
  const [activeToken, setActiveToken] = useState<any | null>(null);
  const [waitingQueue, setWaitingQueue] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastAnnounced, setLastAnnounced] = useState<string>("");
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [voiceLanguage, setVoiceLanguage] = useState<VoiceAnnounceLanguage>("both");
  const [doctorBreak, setDoctorBreak] = useState<{
    isOnBreak: boolean;
    reason?: string;
    expectedMinutes?: number;
    startedAt?: string;
  } | null>(null);
  const [cabins, setCabins] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<"auto" | "single" | "multi">("auto");
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Play two-tone medical waiting room chime (E5 -> C5)
  const playMelodicChime = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") {
        ctx.resume();
      }
      const now = ctx.currentTime;

      // Bell 1: E5 (659.25 Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(659.25, now);
      gain1.gain.setValueAtTime(0.25, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.4);

      // Bell 2: C5 (523.25 Hz)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(523.25, now + 0.22);
      gain2.gain.setValueAtTime(0.3, now + 0.22);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.22);
      osc2.stop(now + 0.85);
    } catch {
      // Audio autoplay policy handled
    }
  }, []);

  // Emergency siren alarm sound (oscillates 800Hz - 1200Hz)
  const playEmergencySiren = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") {
        ctx.resume();
      }
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.linearRampToValueAtTime(1200, now + 0.3);
      osc.frequency.linearRampToValueAtTime(800, now + 0.6);
      osc.frequency.linearRampToValueAtTime(1200, now + 0.9);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 1.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 1.2);
    } catch {
      // Audio autoplay handled
    }
  }, []);

  const speakAnnouncement = useCallback((token: number, patientName: string, doctorName: string, isReportReview: boolean) => {
    announcePatientToken({
      tokenNumber: token,
      doctorName,
      cabinName: isReportReview ? "Cabin (Report Review)" : undefined,
      language: voiceLanguage,
      chimeType: "ding-dong",
    });
  }, [voiceLanguage]);

  const unlockAudio = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        if (!audioCtxRef.current) audioCtxRef.current = new AudioCtx();
        if (audioCtxRef.current.state === "suspended") {
          audioCtxRef.current.resume();
        }
      }
      setAudioUnlocked(true);
      playMelodicChime();
    } catch {
      setAudioUnlocked(true);
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const search = new URLSearchParams(window.location.search);
      const cId = search.get("clinicId") || localStorage.getItem("ananta_active_clinic_id") || localStorage.getItem("activeClinicId") || "";
      const dId = search.get("doctorId") || "";
      setClinicId(cId);
      setDoctorId(dId);
    }
  }, []);

  const fetchQueueState = useCallback(async () => {
    try {
      if (clinicId) {
        // Public Kiosk / TV display endpoint (no sensitive auth credentials required)
        const doctorQuery = doctorId ? `?doctorId=${doctorId}` : "";
        const res = await api.get(`/public/queue-tv/${clinicId}${doctorQuery}`);
        const data = res.data?.data;
        if (data) {
          if (data.clinic?.name) setClinicName(data.clinic.name);
          const currentToken = data.activeToken;
          setActiveToken(currentToken);
          setWaitingQueue(data.waitingQueue || []);
          setDoctorBreak(data.doctorBreak || null);
          if (data.cabins && Array.isArray(data.cabins)) {
            setCabins(data.cabins);
          }

          if (currentToken && currentToken.tokenNumber && String(currentToken.tokenNumber) !== lastAnnounced) {
            setLastAnnounced(String(currentToken.tokenNumber));
            speakAnnouncement(
              currentToken.tokenNumber,
              currentToken.patientName || "Patient",
              currentToken.doctorName || "On Duty",
              currentToken.room || (currentToken.consultationPhase === "report_review" ? "Cabin (Report Review)" : undefined)
            );
          }
        }
      } else {
        // Fallback to internal authenticated queue
        const res = await api.get("/queue");
        const list = res.data?.data || [];
        const inConsult = list.find((item: any) => item.status === "in-consultation");
        const waiting = list
          .filter((item: any) => item._id !== inConsult?._id && item.status !== "completed" && item.status !== "cancelled")
          .map((item: any) => ({
            id: item._id,
            tokenNumber: item.tokenNumber,
            status: item.status,
            patientName: item.patientId?.userId?.name || (item.patientId as any)?.name || "Patient",
            doctorName: item.doctorId?.name || "Doctor",
            isReportReview: item.consultationPhase === "report_review" || item.reasonForVisit === "report_review",
            isStandby: item.status === "standby",
            patientReturned: item.patientReturned || false,
          }));

        setActiveToken(
          inConsult
            ? {
                id: inConsult._id,
                tokenNumber: inConsult.tokenNumber,
                status: inConsult.status,
                patientName: inConsult.patientId?.userId?.name || (inConsult.patientId as any)?.name || "Patient",
                doctorName: inConsult.doctorId?.name || "Doctor",
                consultationPhase: inConsult.consultationPhase,
                room: "OPD Room 1",
              }
            : null
        );
        setWaitingQueue(waiting.slice(0, 8));

        if (inConsult && inConsult.tokenNumber && String(inConsult.tokenNumber) !== lastAnnounced) {
          setLastAnnounced(String(inConsult.tokenNumber));
          speakAnnouncement(
            inConsult.tokenNumber,
            inConsult.patientId?.userId?.name || "Patient",
            inConsult.doctorId?.name || "Doctor",
            inConsult.consultationPhase === "report_review"
          );
        }
      }
    } catch {
      // Background poll error handled gracefully
    } finally {
      setLoading(false);
    }
  }, [clinicId, doctorId, lastAnnounced, speakAnnouncement]);

  useEffect(() => {
    fetchQueueState();
    const interval = setInterval(fetchQueueState, 3500); // 3.5s refresh for wall displays

    // WebSocket real-time connection for instantaneous token summon
    let ws: WebSocket | null = null;
    if (typeof window !== "undefined" && clinicId) {
      try {
        const wsUrl = getWebSocketUrl(`/api/queue/ws?clinicId=${clinicId}`);
        ws = new WebSocket(wsUrl);

        ws.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data);
            if (
              payload.type === "QUEUE_UPDATED" ||
              payload.type === "QUEUE_CALL_NEXT" ||
              payload.type === "PATIENT_RETURNED" ||
              payload.type === "QUEUE_EMERGENCY_STAT"
            ) {
              if (payload.type === "QUEUE_EMERGENCY_STAT") {
                playEmergencySiren();
              }
              fetchQueueState();
            }
          } catch (err) {
            console.error("[Queue TV WS Error]", err);
          }
        };
      } catch (err) {
        console.warn("[Queue TV WS Conn Error]", err);
      }
    }

    return () => {
      clearInterval(interval);
      if (ws) ws.close();
    };
  }, [fetchQueueState, clinicId]);

  return (
    <div className="min-h-screen bg-[#0b0c10] text-white p-6 sm:p-10 flex flex-col justify-between select-none animate-fade-in font-sans">
      {/* Top TV Banner */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-primary-600 to-indigo-600 flex items-center justify-center font-black text-2xl shadow-xl border border-primary-400/20">
            ⚡
          </div>
          <div>
            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">{clinicName}</h1>
            <p className="text-sm font-semibold text-zinc-400">Live Waiting Room Queue Display • Real-Time OPD Calls</p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Multi-Lingual Voice Announcer Selector */}
          <div className="flex items-center gap-1 bg-zinc-900/90 p-1.5 rounded-2xl border border-zinc-800 text-xs">
            <span className="text-[11px] font-bold text-zinc-400 px-1.5 flex items-center gap-1">
              <span>🔊</span> Voice:
            </span>
            {(["off", "en", "hi", "both"] as const).map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => {
                  setVoiceLanguage(lang);
                  if (!audioUnlocked) unlockAudio();
                }}
                className={`px-2.5 py-1 rounded-xl text-[11px] font-bold uppercase transition-all cursor-pointer ${
                  voiceLanguage === lang
                    ? "bg-primary-600 text-white shadow-xs"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-800/80"
                }`}
                title={`Announce in ${lang.toUpperCase()}`}
              >
                {lang === "both" ? "Dual (EN+HI)" : lang}
              </button>
            ))}
          </div>

          {/* Multi-Cabin vs Single Stage View Selector */}
          {cabins.length > 1 && (
            <div className="flex items-center gap-1 bg-zinc-900/90 p-1.5 rounded-2xl border border-zinc-800 text-xs">
              <button
                type="button"
                onClick={() => setViewMode(viewMode === "multi" ? "single" : "multi")}
                className="px-2.5 py-1 rounded-xl text-[11px] font-bold text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <span>{viewMode === "multi" ? "🖥️ Stage View" : "🔲 Multi-Cabin Grid"}</span>
              </button>
            </div>
          )}

          {!audioUnlocked && (
            <button
              onClick={unlockAudio}
              className="px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-xl text-xs font-bold border border-amber-500/30 flex items-center gap-2 cursor-pointer transition-all animate-pulse"
            >
              <span>🔔</span> Enable TV Chime Audio
            </button>
          )}
          <Badge variant="success" className="text-sm px-4 py-2 font-black tracking-wide flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
            LIVE QUEUE ACTIVE
          </Badge>
          <span className="text-2xl font-black text-zinc-300 font-mono">
            {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
      </div>

      {/* Doctor OPD Intermission / Break Waiting Lounge Banner */}
      {doctorBreak?.isOnBreak && (
        <div className="mt-6 p-6 rounded-3xl bg-gradient-to-r from-amber-950/80 via-amber-900/60 to-zinc-900 border-2 border-amber-500/50 shadow-2xl flex items-center justify-between gap-6 animate-pulse">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-3xl shrink-0">
              ☕
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-widest text-amber-400 bg-amber-500/20 px-3 py-1 rounded-full border border-amber-500/30">
                  DOCTOR INTERMISSION IN PROGRESS
                </span>
                <span className="text-xs text-amber-200/80 font-bold">
                  {doctorBreak.reason || "Short Break"}
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-amber-100 mt-1">
                Consultations will resume in approx. {doctorBreak.expectedMinutes || 15} minutes
              </h2>
              <p className="text-xs sm:text-sm text-amber-200/70 mt-0.5">
                Please remain seated in the waiting lounge. Your sequence in the queue is fully preserved.
              </p>
            </div>
          </div>
          <div className="hidden sm:flex flex-col items-end shrink-0">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400">Queue Order</span>
            <span className="text-lg font-black text-white">🔒 Locked & Preserved</span>
          </div>
        </div>
      )}

      {/* Main Display: Multi-Cabin Polyclinic Matrix vs Single Stage Grid */}
      {(viewMode === "multi" || (viewMode === "auto" && cabins.length > 1)) ? (
        <div className="my-8 flex-1">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
              <h2 className="text-xl font-black text-zinc-200 uppercase tracking-wider">
                Active Polyclinic Consultation Cabins ({cabins.length})
              </h2>
            </div>
            <span className="text-xs text-zinc-400 font-semibold">
              Please proceed directly to the designated cabin when your token is called
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {cabins.map((cabin, cIdx) => {
              const isActive = Boolean(cabin.activeToken);
              const isOnBreak = cabin.isOnBreak;

              return (
                <div
                  key={cabin.doctorId || cIdx}
                  className={`p-6 rounded-3xl border transition-all flex flex-col justify-between shadow-2xl relative overflow-hidden ${
                    isOnBreak
                      ? "bg-gradient-to-br from-zinc-900 via-amber-950/20 to-zinc-900 border-amber-500/40"
                      : isActive
                      ? "bg-gradient-to-br from-zinc-900 via-zinc-900 to-emerald-950/40 border-emerald-500/50 ring-2 ring-emerald-500/20 shadow-emerald-500/10"
                      : "bg-zinc-900/90 border-zinc-800"
                  }`}
                >
                  <div>
                    {/* Cabin Header */}
                    <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-4">
                      <div className="flex items-center gap-2">
                        <span className="px-3 py-1 rounded-xl bg-primary-500/20 border border-primary-500/40 text-primary-300 font-black text-xs font-mono uppercase tracking-wider">
                          {cabin.cabinNumber}
                        </span>
                        {isActive && (
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                        )}
                      </div>
                      <Badge
                        variant={isOnBreak ? "warning" : isActive ? "success" : "neutral"}
                        className="text-[10px] uppercase font-bold"
                      >
                        {isOnBreak ? "Intermission" : isActive ? "In Consultation" : "Available"}
                      </Badge>
                    </div>

                    {/* Doctor Info */}
                    <div className="mb-4">
                      <h3 className="text-lg font-black text-white">Dr. {cabin.doctorName}</h3>
                      <p className="text-xs text-zinc-400 font-medium">{cabin.specialization}</p>
                    </div>

                    {/* Active Token Display */}
                    {isOnBreak ? (
                      <div className="my-4 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-center space-y-1">
                        <span className="text-2xl">☕</span>
                        <p className="text-xs font-bold text-amber-300 uppercase tracking-wider">Doctor on Break</p>
                        <p className="text-[11px] text-amber-200/80">
                          {cabin.breakReason || "Short Intermission"} (~{cabin.breakExpectedMinutes || 15}m)
                        </p>
                      </div>
                    ) : cabin.activeToken ? (
                      <div className="my-4 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-1 animate-pulse">
                        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
                          NOW SERVING
                        </span>
                        <div className="text-5xl font-black font-mono text-white tracking-tight">
                          #{cabin.activeToken.tokenNumber}
                        </div>
                        <p className="text-xs font-bold text-emerald-200 truncate">
                          {cabin.activeToken.patientName}
                        </p>
                      </div>
                    ) : (
                      <div className="my-6 py-6 text-center text-zinc-500 text-xs font-semibold rounded-2xl bg-zinc-950/40 border border-zinc-800/60">
                        Ready for Next Patient
                      </div>
                    )}
                  </div>

                  {/* Next in Queue Chips */}
                  <div className="pt-3 border-t border-zinc-800/80">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-2">
                      Upcoming Tokens
                    </span>
                    {cabin.upcomingQueue && cabin.upcomingQueue.length > 0 ? (
                      <div className="flex items-center gap-2 flex-wrap">
                        {cabin.upcomingQueue.map((w: any) => (
                          <span
                            key={w.id}
                            className="px-2.5 py-1 rounded-xl bg-zinc-800/80 border border-zinc-700/60 text-xs font-mono font-bold text-zinc-200"
                          >
                            #{w.tokenNumber}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[11px] text-zinc-500 italic">No patients in queue</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Main Waiting Room Display Grid (Single Doctor Focus) */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 my-8 flex-1">
          {/* Left Column: Currently Serving / Called Token */}
          <div className="lg:col-span-2 bg-gradient-to-br from-zinc-900 via-zinc-900 to-primary-950/50 p-8 sm:p-12 rounded-3xl border border-primary-500/30 flex flex-col justify-between shadow-2xl relative overflow-hidden">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <span className="text-sm font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-5 py-2 rounded-full border border-emerald-500/30 animate-pulse">
                  NOW CALLING / CURRENT CONSULTATION
                </span>
                {activeToken?.consultationPhase === "report_review" && (
                  <span className="text-xs font-black uppercase tracking-widest text-purple-300 bg-purple-500/20 px-4 py-1.5 rounded-full border border-purple-500/30">
                    🔬 REPORT REVIEW
                  </span>
                )}
              </div>
              <span className="text-sm text-zinc-400 font-bold tracking-wide">
                {activeToken?.room || "OPD Room 1"} • Main Hall
              </span>
            </div>

            {activeToken ? (
              <div className="my-10 text-center space-y-4">
                <div className="text-[130px] sm:text-[160px] font-black text-emerald-400 leading-none tracking-tighter drop-shadow-[0_0_50px_rgba(52,211,153,0.35)] font-mono">
                  #{activeToken.tokenNumber}
                </div>
                <h2 className="text-4xl sm:text-5xl font-black text-white tracking-wide">
                  {activeToken.patientName || "Patient"}
                </h2>
                <p className="text-2xl font-medium text-zinc-400 pt-2">
                  Attending Doctor: <span className="text-primary-400 font-extrabold">Dr. {activeToken.doctorName || "On Duty"}</span>
                </p>
              </div>
            ) : (
              <div className="my-20 text-center text-zinc-500 space-y-3">
                <p className="text-4xl font-extrabold text-zinc-400">Doctor Ready for Next Consultation</p>
                <p className="text-base text-zinc-500">Please watch the screen for your token call.</p>
              </div>
            )}

            <div className="p-4 bg-zinc-950/70 rounded-2xl border border-zinc-800 flex justify-between items-center text-sm font-semibold text-zinc-300">
              <div className="flex items-center gap-2">
                <span>🔔 Melodic Chime & Voice Synthesis Active</span>
              </div>
              <span className="text-xs text-emerald-400 font-mono">Real-time sync</span>
            </div>
          </div>

          {/* Right Column: Upcoming Queue */}
          <div className="bg-zinc-900/95 p-6 sm:p-8 rounded-3xl border border-zinc-800 flex flex-col justify-between shadow-xl">
            <div>
              <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-4">
                <h3 className="text-xl font-black text-white">Next in Line</h3>
                <span className="text-xs text-zinc-400 font-bold px-2.5 py-1 bg-zinc-800 rounded-lg">
                  {waitingQueue.length} Patient{waitingQueue.length === 1 ? "" : "s"} Waiting
                </span>
              </div>

              <div className="space-y-3">
                {waitingQueue.length === 0 ? (
                  <div className="text-center py-16 space-y-2">
                    <p className="text-base text-zinc-400 font-bold">Waiting Queue is Empty</p>
                    <p className="text-xs text-zinc-600">All registered patients have been attended.</p>
                  </div>
                ) : (
                  waitingQueue.map((item, idx) => (
                    <div
                      key={item.id || idx}
                      className={`p-4 rounded-2xl border flex items-center justify-between transition-all ${
                        item.isEmergency
                          ? "bg-red-950/40 border-red-500/60 shadow-lg shadow-red-500/10 animate-pulse"
                          : "bg-zinc-950 border-zinc-800/80 hover:border-zinc-700"
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-black font-mono border ${
                            item.isEmergency
                              ? "bg-red-600 text-white border-red-400"
                              : "bg-zinc-800 text-white border-zinc-700"
                          }`}
                        >
                          #{item.tokenNumber}
                        </div>
                        <div>
                          <p className="font-extrabold text-base text-white">{item.patientName}</p>
                          <p className="text-xs text-zinc-400">Dr. {item.doctorName}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {item.isEmergency ? (
                          <span className="px-3 py-1 rounded-md bg-red-600 text-white text-xs font-black tracking-wide border border-red-400">
                            🚨 STAT Emergency
                          </span>
                        ) : item.isReportReview ? (
                          <span className="px-2.5 py-1 rounded-md bg-purple-500/20 text-purple-300 text-[11px] font-bold border border-purple-500/30">
                            🔬 Report Review
                          </span>
                        ) : item.isStandby ? (
                          <span className="px-2.5 py-1 rounded-md bg-amber-500/20 text-amber-300 text-[11px] font-bold border border-amber-500/30">
                            {item.patientReturned ? "✓ In Waiting" : "Standby"}
                          </span>
                        ) : (
                          <span className="px-3 py-1 rounded-md bg-zinc-800 text-zinc-300 text-xs font-bold">
                            Next Up #{idx + 1}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-zinc-800 text-center text-xs text-zinc-500">
              Displaying live OPD token order • Automatically updated via HealthOS
            </div>
          </div>
        </div>
      )}

      {/* Footer ticker */}
      <div className="bg-zinc-900/90 px-6 py-3.5 rounded-2xl border border-zinc-800 text-xs text-zinc-400 flex justify-between items-center">
        <span>If you require emergency medical attention or wheelchair assistance, please notify the reception desk immediately.</span>
        <span className="font-black text-primary-400 tracking-wide">ANANT HealthOS Live Display</span>
      </div>
    </div>
  );
}
