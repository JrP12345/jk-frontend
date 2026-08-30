"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import api from "@/lib/api";

interface AISuggestedAction {
  type: string;
  label: string;
  targetUrl?: string;
  payload?: Record<string, any>;
}

interface Message {
  id: string;
  sender: "user" | "ai";
  text: string;
  timestamp: string;
  citations?: string[];
  suggestedActions?: AISuggestedAction[];
}

interface ChatSessionHeader {
  id: string;
  title: string;
  updatedAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Modern AI Spark Icon (Pristine 4-point curved vector)
// ─────────────────────────────────────────────────────────────────────────────
function AISparkIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C12 2 13.5 8 18 10C13.5 12 12 18 12 18C12 18 10.5 12 6 10C10.5 8 12 2 12 2Z" />
      <path d="M19 2C19 2 19.6 4.4 21.5 5.2C19.6 6 19 8.4 19 8.4C19 8.4 18.4 6 16.5 5.2C18.4 4.4 19 2 19 2Z" opacity="0.8" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Formatted Markdown Text Renderer
// ─────────────────────────────────────────────────────────────────────────────
function parseInlineMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong class='font-semibold text-text'>$1</strong>")
    .replace(/`(.*?)`/g, "<code class='bg-surface px-1.5 py-0.5 rounded font-mono text-[11px] text-text border border-border/50'>$1</code>");
}

function FormattedMarkdown({ content }: { content: string }) {
  if (!content) return null;

  const lines = content.split("\n");
  return (
    <div className="space-y-1 text-xs leading-relaxed text-text">
      {lines.map((line, idx) => {
        const trimmed = line.trim();

        if (trimmed.startsWith("### ")) {
          return (
            <h4 key={idx} className="font-semibold text-xs text-text mt-2 mb-0.5 tracking-tight">
              {trimmed.replace(/^###\s+/, "")}
            </h4>
          );
        }
        if (trimmed.startsWith("## ")) {
          return (
            <h3 key={idx} className="font-semibold text-xs text-text mt-2 mb-0.5 tracking-tight">
              {trimmed.replace(/^##\s+/, "")}
            </h3>
          );
        }

        if (trimmed.startsWith("* ") || trimmed.startsWith("- ")) {
          const itemText = trimmed.replace(/^[\*\-]\s+/, "");
          return (
            <div key={idx} className="flex items-start gap-2 pl-1 my-0.5">
              <span className="text-primary font-bold text-[10px] mt-0.5 shrink-0">•</span>
              <span dangerouslySetInnerHTML={{ __html: parseInlineMarkdown(itemText) }} />
            </div>
          );
        }

        if (!trimmed) return <div key={idx} className="h-0.5" />;

        return (
          <p key={idx} dangerouslySetInnerHTML={{ __html: parseInlineMarkdown(line) }} />
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Floating AI Copilot Widget Component
// ─────────────────────────────────────────────────────────────────────────────
export function FloatingAICopilot() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuthStore();

  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Session State
  const [sessions, setSessions] = useState<ChatSessionHeader[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [inputQuery, setInputQuery] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [showSessionSelector, setShowSessionSelector] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  useEffect(() => {
    if (isOpen && user?.id) {
      loadSessions();
    }
  }, [isOpen, user?.id]);

  const loadSessions = async () => {
    try {
      setIsLoadingSession(true);
      const res = await api.get("/ai/chat/sessions");
      const sessionList = res.data?.data || [];
      setSessions(sessionList);

      if (sessionList.length > 0) {
        const firstSessionId = sessionList[0].id || sessionList[0]._id;
        await loadSessionMessages(firstSessionId);
      } else {
        await handleNewChatSession();
      }
    } catch (err) {
      console.warn("[Copilot] Initializing fresh session", err);
      await handleNewChatSession();
    } finally {
      setIsLoadingSession(false);
    }
  };

  const loadSessionMessages = async (sessionId: string) => {
    try {
      setIsLoadingSession(true);
      setActiveSessionId(sessionId);
      const res = await api.get(`/ai/chat/sessions/${sessionId}`);
      const sessionData = res.data?.data || res.data;
      if (sessionData && Array.isArray(sessionData.messages)) {
        setMessages(sessionData.messages);
      }
    } catch (err) {
      console.error("[Copilot] Error loading session messages:", err);
    } finally {
      setIsLoadingSession(false);
    }
  };

  const handleNewChatSession = async () => {
    try {
      setIsLoadingSession(true);
      const res = await api.post("/ai/chat/sessions", { initialTitle: "New Clinical Session" });
      const newSession = res.data?.data || res.data;
      const newId = newSession.id || newSession._id;

      setActiveSessionId(newId);
      setMessages(newSession.messages || []);
      setSessions((prev) => [{ id: newId, title: newSession.title || "New Session", updatedAt: new Date().toISOString() }, ...prev]);
      setShowSessionSelector(false);
    } catch (err) {
      console.error("[Copilot] Error creating chat session:", err);
    } finally {
      setIsLoadingSession(false);
    }
  };

  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.delete(`/ai/chat/sessions/${sessionId}`);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (activeSessionId === sessionId) {
        const remaining = sessions.filter((s) => s.id !== sessionId);
        if (remaining.length > 0) {
          await loadSessionMessages(remaining[0].id);
        } else {
          await handleNewChatSession();
        }
      }
    } catch (err) {
      console.error("[Copilot] Error archiving session:", err);
    }
  };

  const copyMessageText = (msgId: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(msgId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const insertIntoEHRChart = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("Clinical AI note copied to clipboard. Ready to paste into EHR chart.");
  };

  const toggleVoiceMode = () => {
    if (typeof window === "undefined") return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }

    if (isVoiceActive) {
      recognitionRef.current?.stop();
      setIsVoiceActive(false);
    } else {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "en-US";

      recognition.onstart = () => setIsVoiceActive(true);
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputQuery(transcript);
        setIsVoiceActive(false);
      };
      recognition.onerror = () => setIsVoiceActive(false);
      recognition.onend = () => setIsVoiceActive(false);

      recognitionRef.current = recognition;
      recognition.start();
    }
  };

  const handleSendMessage = async (e?: React.FormEvent, customQuery?: string) => {
    if (e) e.preventDefault();
    const queryToSend = customQuery || inputQuery;
    if (!queryToSend.trim()) return;

    if (!activeSessionId) {
      await handleNewChatSession();
    }

    const currentSessionId = activeSessionId;
    if (!currentSessionId) return;

    const userMsg: Message = {
      id: `usr_${Date.now()}`,
      sender: "user",
      text: queryToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuery("");
    setIsThinking(true);

    try {
      const res = await api.post(`/ai/chat/sessions/${currentSessionId}/messages`, {
        query: queryToSend,
        currentRoute: pathname,
      });

      const resData = res.data?.data || res.data;
      if (resData && Array.isArray(resData.allMessages)) {
        setMessages(resData.allMessages);
      }

      if (resData.title) {
        setSessions((prev) =>
          prev.map((s) => (s.id === currentSessionId ? { ...s, title: resData.title } : s))
        );
      }
    } catch (err: any) {
      const errorMsg: Message = {
        id: `ai_${Date.now()}`,
        sender: "ai",
        text: "I encountered an issue connecting to the AI service. Please try again.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        citations: ["System Connection Probe"],
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsThinking(false);
    }
  };

  const handleRegenerate = () => {
    const lastUserMsg = [...messages].reverse().find((m) => m.sender === "user");
    if (lastUserMsg) {
      handleSendMessage(undefined, lastUserMsg.text);
    }
  };

  const isStaff = user?.role && ["root", "admin", "doctor", "nurse", "receptionist"].includes(user.role);
  const activeSessionTitle = sessions.find((s) => s.id === activeSessionId)?.title || "Clinical Session";

  return (
    <>
      {/* Floating Trigger Button (Bottom Right) */}
      <div className="fixed bottom-6 right-6 z-50">
        <div className="relative group">
          {/* Glowing Ambient Aura Ring */}
          {!isOpen && (
            <div className="absolute -inset-1 rounded-full bg-primary-500/60 opacity-75 blur-md animate-pulse group-hover:opacity-100 transition duration-500 pointer-events-none" />
          )}

          <button
            onClick={() => setIsOpen(!isOpen)}
            className={`relative w-13 h-13 rounded-full flex items-center justify-center cursor-pointer transition-all duration-300 shadow-xl ${
              isOpen
                ? "bg-surface-hover text-text border border-border/80 shadow-md rotate-90 scale-105"
                : "bg-primary-600 hover:bg-primary-700 text-white shadow-lg hover:scale-108 active:scale-95"
            }`}
            title={isOpen ? "Close AI Copilot" : "Open Anant AI Copilot"}
            aria-label="Toggle AI Copilot"
          >
            {isOpen ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <AISparkIcon className="w-6 h-6 text-white animate-pulse" />
            )}
          </button>
        </div>
      </div>

      {/* Floating Popover Copilot Window */}
      {isOpen && (
        <div
          className={`fixed z-50 bg-surface/95 backdrop-blur-2xl border border-border/80 rounded-2xl shadow-2xl shadow-black/25 flex flex-col transition-all duration-300 ease-spring animate-popover-in ${
            isExpanded
              ? "inset-4 md:inset-6 md:left-auto md:w-[640px] md:h-[calc(100vh-3rem)]"
              : "bottom-20 right-6 w-[400px] max-w-[calc(100vw-2rem)] h-[580px] max-h-[82vh]"
          }`}
        >
          {/* Header Bar */}
          <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between shrink-0 bg-surface-alt/30 rounded-t-2xl">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <AISparkIcon className="w-4 h-4" />
              </div>
              <div className="truncate">
                <div className="flex items-center gap-1.5">
                  <h3 className="text-xs font-bold text-text truncate">Anant AI Copilot</h3>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {/* New Chat Button */}
              <button
                onClick={handleNewChatSession}
                title="New Chat Session"
                className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface-hover transition-colors cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </button>

              {/* Expand / Minimize Toggle */}
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface-hover transition-colors cursor-pointer"
                title={isExpanded ? "Minimize Window" : "Expand Window"}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  {isExpanded ? (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 9L4 4m0 0l5 0m-5 0l0 5m11 5l5 5m0 0l-5 0m5 0l0-5" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 3h6m0 0v6m0-6L14 10M9 21H3m0 0v-6m0 6l7-7" />
                  )}
                </svg>
              </button>

              {/* Close Button */}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface-hover transition-colors cursor-pointer"
                title="Close"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Session Switcher Bar */}
          <div className="px-3.5 py-1.5 border-b border-border/40 bg-surface flex items-center justify-between text-xs shrink-0">
            <button
              onClick={() => setShowSessionSelector(!showSessionSelector)}
              className="flex items-center gap-1.5 text-text-muted hover:text-text font-medium text-xs truncate max-w-[240px] transition-colors cursor-pointer py-0.5"
            >
              <span className="truncate">{activeSessionTitle}</span>
              <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

          {/* Dropdown for Session Selection */}
          {showSessionSelector && (
            <div className="mx-3 mt-1 p-1.5 rounded-xl bg-surface border border-border/80 space-y-0.5 max-h-40 overflow-y-auto shadow-lg shrink-0 z-10">
              <div className="text-[10px] font-semibold text-text-muted uppercase tracking-wider px-2 py-1">
                Past Sessions:
              </div>
              {sessions.map((s) => (
                <div
                  key={s.id}
                  onClick={() => {
                    loadSessionMessages(s.id);
                    setShowSessionSelector(false);
                  }}
                  className={`flex items-center justify-between px-2.5 py-1 rounded-lg text-xs cursor-pointer transition-colors ${
                    s.id === activeSessionId
                      ? "bg-primary/10 text-primary font-medium"
                      : "hover:bg-surface-hover text-text-muted hover:text-text"
                  }`}
                >
                  <span className="truncate max-w-[240px]">{s.title}</span>
                  <button
                    onClick={(e) => handleDeleteSession(s.id, e)}
                    title="Archive chat"
                    className="text-text-muted hover:text-danger p-0.5 rounded transition-colors"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Chat Stream */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-3 min-h-0">
            {isLoadingSession ? (
              <div className="flex items-center justify-center h-28 text-xs text-text-muted">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping mr-2" />
                <span>Loading session...</span>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`max-w-[90%] rounded-xl p-3 text-xs leading-relaxed ${
                      msg.sender === "user"
                        ? "bg-primary text-white rounded-br-xs font-medium"
                        : "bg-surface-alt/60 text-text rounded-bl-xs"
                    }`}
                  >
                    {/* Action Bar for AI Messages */}
                    {msg.sender === "ai" && (
                      <div className="flex items-center justify-end gap-2 pb-1.5 mb-1.5 border-b border-border/30 text-[10px]">
                        <button
                          onClick={() => copyMessageText(msg.id, msg.text)}
                          className="text-text-muted hover:text-text transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          <span>{copiedId === msg.id ? "Copied" : "Copy"}</span>
                        </button>

                        {isStaff && (
                          <button
                            onClick={() => insertIntoEHRChart(msg.text)}
                            className="text-primary hover:underline transition-colors flex items-center gap-1 cursor-pointer font-medium"
                          >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <span>Insert to EHR</span>
                          </button>
                        )}
                      </div>
                    )}

                    {/* Markdown Output */}
                    <FormattedMarkdown content={msg.text} />

                    {/* Action Suggestions */}
                    {msg.suggestedActions && msg.suggestedActions.length > 0 && (
                      <div className="mt-2.5 pt-2 border-t border-border/30 space-y-1">
                        {msg.suggestedActions.map((act, aIdx) => (
                          <button
                            key={aIdx}
                            onClick={() => {
                              if (act.targetUrl) {
                                setIsOpen(false);
                                router.push(act.targetUrl);
                              }
                            }}
                            className="w-full px-2.5 py-1.5 bg-surface hover:bg-surface-hover text-text font-medium rounded-lg text-[11px] transition-all flex items-center justify-between gap-2 cursor-pointer"
                          >
                            <span>{act.label}</span>
                            <svg className="w-3 h-3 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                            </svg>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Citations */}
                    {msg.citations && msg.citations.length > 0 && (
                      <div className="mt-2 pt-1.5 border-t border-border/30 text-[10px] text-text-muted">
                        <span className="font-semibold text-text-muted">Sources: </span>
                        <span>{msg.citations.join(", ")}</span>
                      </div>
                    )}
                  </div>
                  <span className="text-[9px] text-text-muted mt-0.5 px-1">{msg.timestamp}</span>
                </div>
              ))
            )}

            {/* Thinking Indicator */}
            {isThinking && (
              <div className="flex items-center gap-2 text-xs bg-surface-alt/40 px-3 py-2 rounded-xl text-text-muted w-fit animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
                <span>Thinking...</span>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Quick Suggestions Chips */}
          <div className="px-3 py-1.5 border-t border-border/40 flex gap-1 overflow-x-auto text-[11px] no-scrollbar shrink-0">
            {isStaff ? (
              <>
                <button
                  onClick={() => handleSendMessage(undefined, "How many patients do I have and list their medical problems?")}
                  className="px-2.5 py-1 bg-surface-alt/50 hover:bg-surface-hover text-text-muted hover:text-text rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                >
                  Patient Roster
                </button>
                <button
                  onClick={() => handleSendMessage(undefined, "What are our clinic appointments and queue metrics for today?")}
                  className="px-2.5 py-1 bg-surface-alt/50 hover:bg-surface-hover text-text-muted hover:text-text rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                >
                  Appointments & Queue
                </button>
                <button
                  onClick={handleRegenerate}
                  className="px-2.5 py-1 bg-surface-alt/50 hover:bg-surface-hover text-text-muted hover:text-text rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                >
                  Regenerate
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => handleSendMessage(undefined, "What are my active prescriptions?")}
                  className="px-2.5 py-1 bg-surface-alt/50 hover:bg-surface-hover text-text-muted hover:text-text rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                >
                  My Prescriptions
                </button>
                <button
                  onClick={() => handleSendMessage(undefined, "Explain my latest lab test results")}
                  className="px-2.5 py-1 bg-surface-alt/50 hover:bg-surface-hover text-text-muted hover:text-text rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                >
                  Lab Results
                </button>
                <button
                  onClick={handleRegenerate}
                  className="px-2.5 py-1 bg-surface-alt/50 hover:bg-surface-hover text-text-muted hover:text-text rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                >
                  Regenerate
                </button>
              </>
            )}
          </div>

          {/* Unified Input Box (Pill Container) */}
          <div className="p-3 border-t border-border/40 shrink-0 bg-surface">
            <form
              onSubmit={(e) => handleSendMessage(e)}
              className="bg-surface-alt rounded-xl border border-border/60 flex items-center px-2 py-1 focus-within:border-primary/60 transition-colors"
            >
              <button
                type="button"
                onClick={toggleVoiceMode}
                title="Voice Dictation"
                className={`p-1.5 rounded-lg text-xs transition-colors shrink-0 cursor-pointer ${
                  isVoiceActive ? "text-danger animate-pulse" : "text-text-muted hover:text-text"
                }`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </button>

              <input
                type="text"
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                placeholder={isVoiceActive ? "Listening..." : "Ask Anant AI..."}
                className="flex-1 bg-transparent text-xs text-text placeholder:text-text-muted focus:outline-none px-2 py-1"
              />

              {isThinking ? (
                <button
                  type="button"
                  onClick={() => setIsThinking(false)}
                  className="p-1.5 text-danger hover:bg-danger/10 rounded-lg transition-colors cursor-pointer shrink-0"
                  title="Stop generation"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <rect x="6" y="6" width="12" height="12" rx="2" />
                  </svg>
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!inputQuery.trim()}
                  className="p-1.5 text-primary disabled:text-text-muted/40 hover:bg-primary/10 rounded-lg transition-colors cursor-pointer shrink-0"
                  title="Send message"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </button>
              )}
            </form>
          </div>
        </div>
      )}
    </>
  );
}
