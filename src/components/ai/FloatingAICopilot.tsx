"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Alert, Button, Modal } from "@/components/ui";
import { useClinicStore } from "@/store/clinicStore";
import { hasAnyPermission } from "@/lib/permissions";
import { userFacingError } from "@/lib/userFacingError";
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
function renderInlineMarkdown(text: string): React.ReactNode[] {
  // AI output is untrusted. Return React nodes rather than constructing HTML so
  // that React escapes all text, including model output that looks like markup.
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index} className="font-semibold text-text">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={index} className="bg-surface px-1.5 py-0.5 rounded font-mono text-[11px] text-text border border-border/50">{part.slice(1, -1)}</code>;
    }
    return <React.Fragment key={index}>{part}</React.Fragment>;
  });
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
              <span className="text-accent font-bold text-[10px] mt-0.5 shrink-0">•</span>
              <span>{renderInlineMarkdown(itemText)}</span>
            </div>
          );
        }

        if (!trimmed) return <div key={idx} className="h-0.5" />;

        return (
          <p key={idx}>{renderInlineMarkdown(line)}</p>
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
  const { activeClinicId } = useClinicStore();
  const permitted = hasAnyPermission(user, "MANAGE_CLINICAL_NOTES", "MANAGE_EHR", "VIEW_EHR");
  const hasContext = Boolean(user?.organization_id || (user?.role === "root" && activeClinicId));
  const contextVersion = useRef(0);
  const sessionBusy = useRef(false);
  const sendBusy = useRef(false);
  const requestController = useRef<AbortController | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const chatUrl = (path: string) => user?.role === "root" && !user.organization_id && activeClinicId ? path + "?clinicId=" + encodeURIComponent(activeClinicId) : path;
  const reportError = (error: any) => setChatError(error.response?.status === 403 ? userFacingError(error.response?.data?.message, "AI assistance is unavailable for your account. Contact your organization administrator.") : "AI assistance could not connect. Check your connection and try again.");
  const [isExpanded, setIsExpanded] = useState(false);

  // Session State
  const [sessions, setSessions] = useState<ChatSessionHeader[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState("");

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
    contextVersion.current++;
    requestController.current?.abort();
    requestController.current = new AbortController();
    sessionBusy.current = false;
    sendBusy.current = false;
    setSessions([]);
    setMessages([]);
    setActiveSessionId(null);
    setChatError(null);
    setIsThinking(false);
    setIsLoadingSession(false);
    setShowSessionSelector(false);
    setInputQuery("");
    if (isOpen && permitted && hasContext) void loadSessions();
    return () => { contextVersion.current++; requestController.current?.abort(); recognitionRef.current?.stop(); };
  }, [isOpen, user?.id, user?.organization_id, activeClinicId, permitted, hasContext]);

  const createSession = async (version: number): Promise<string | null> => {
    const res = await api.post(chatUrl("/ai/chat/sessions"), { initialTitle: "New Clinical Session" }, { signal: requestController.current?.signal });
    if (version !== contextVersion.current) return null;
    const session = res.data?.data;
    const sessionId = session?.id || session?._id;
    if (!sessionId) throw new Error("Invalid chat response");
    setActiveSessionId(sessionId);
    setMessages(session.messages || []);
    setSessions(prev => [{ id: sessionId, title: session.title || "New Session", updatedAt: new Date().toISOString() }, ...prev]);
    setShowSessionSelector(false);
    return sessionId;
  };

  const readSession = async (sessionId: string, version: number) => {
    const res = await api.get(chatUrl(`/ai/chat/sessions/${sessionId}`), { signal: requestController.current?.signal });
    if (version !== contextVersion.current) return;
    setActiveSessionId(sessionId);
    setMessages(res.data?.data?.messages || []);
  };

  const sessionAction = async (action: (version: number) => Promise<unknown>) => {
    if (sessionBusy.current || sendBusy.current || !hasContext || !permitted) return;
    const version = contextVersion.current;
    sessionBusy.current = true;
    setIsLoadingSession(true);
    setChatError(null);
    try { await action(version); }
    catch (error) { if (version === contextVersion.current) reportError(error); }
    finally {
      if (version === contextVersion.current) { sessionBusy.current = false; setIsLoadingSession(false); }
    }
  };

  const loadSessions = () => sessionAction(async version => {
    const res = await api.get(chatUrl("/ai/chat/sessions"), { signal: requestController.current?.signal });
    if (version !== contextVersion.current) return;
    const list = res.data?.data;
    if (!Array.isArray(list)) throw new Error("Invalid chat response");
    const normalized = list.map(session => ({ ...session, id: session.id || session._id }));
    setSessions(normalized);
    if (normalized.length) await readSession(normalized[0].id, version);
    else await createSession(version);
  });

  const loadSessionMessages = (sessionId: string) => sessionAction(version => readSession(sessionId, version));
  const handleNewChatSession = () => sessionAction(version => createSession(version));
  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await sessionAction(async version => {
      setArchivingId(sessionId);
      try {
        await api.delete(chatUrl(`/ai/chat/sessions/${sessionId}`), { signal: requestController.current?.signal });
        if (version !== contextVersion.current) return;
        const remaining = sessions.filter(session => session.id !== sessionId);
        setSessions(remaining);
        if (activeSessionId === sessionId) {
          if (remaining.length) await readSession(remaining[0].id, version);
          else await createSession(version);
        }
      } finally { if (version === contextVersion.current) setArchivingId(null); }
    });
  };

  const copyMessageText = async (msgId: string, text: string, forChart = false) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(forChart ? `chart-${msgId}` : msgId);
      setActionMessage(forChart ? "Copied. Paste this into the patient's chart when ready." : "Message copied.");
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setActionMessage("Could not copy the message. Check clipboard access and try again.");
    }
  };

  const toggleVoiceMode = () => {
    if (typeof window === "undefined") return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setActionMessage("Voice input is unavailable in this browser. You can type your message instead.");
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
    e?.preventDefault();
    const query = (customQuery || inputQuery).trim();
    if (!query || sendBusy.current || sessionBusy.current || !hasContext || !permitted) return;
    const version = contextVersion.current;
    sendBusy.current = true;
    setChatError(null);
    setIsThinking(true);
    try {
      // React state updates are asynchronous; use the newly created ID directly.
      const sessionId = activeSessionId || await createSession(version);
      if (!sessionId || version !== contextVersion.current) return;
      setMessages(prev => [...prev, { id: "usr_" + Date.now(), sender: "user", text: query, timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }]);
      setInputQuery("");
      const res = await api.post(chatUrl(`/ai/chat/sessions/${sessionId}/messages`), { query, currentRoute: pathname }, { signal: requestController.current?.signal, timeout: 60000 });
      if (version !== contextVersion.current) return;
      const data = res.data?.data;
      if (data?.incremental && data.userMessage && data.aiMessage) {
        setMessages(previous => [...previous.slice(0, -1), data.userMessage, data.aiMessage]);
      } else if (Array.isArray(data?.allMessages)) {
        setMessages(data.allMessages);
      } else throw new Error("Invalid chat response");
      if (data.title) setSessions(prev => prev.map(session => session.id === sessionId ? { ...session, title: data.title } : session));
    } catch (error) { if (version === contextVersion.current) { reportError(error); setInputQuery(query); } }
    finally { if (version === contextVersion.current) { sendBusy.current = false; setIsThinking(false); } }
  };

  const handleRegenerate = () => {
    const lastUserMsg = [...messages].reverse().find((m) => m.sender === "user");
    if (lastUserMsg) {
      handleSendMessage(undefined, lastUserMsg.text);
    }
  };

  const isStaff = user?.role && ["root", "admin", "doctor", "nurse", "receptionist"].includes(user.role);
  const activeSessionTitle = sessions.find((s) => s.id === activeSessionId)?.title || "Clinical Session";

  if (!permitted) return null;

  return (
    <>
      {/* Floating Trigger Button (Bottom Right - with clearance for mobile bottom nav) */}
      <div className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] md:bottom-6 right-4 sm:right-6 z-45">
        <div className="relative group">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className={`relative w-12 h-12 sm:w-13 sm:h-13 rounded-full flex items-center justify-center cursor-pointer transition-all duration-300 shadow-xl ${
              isOpen
                ? "bg-surface-hover text-text border border-border/80 shadow-md rotate-90 scale-105"
                : "bg-primary-600 hover:bg-primary-700 text-brand-mist shadow-lg hover:scale-108 active:scale-95"
            }`}
            title={isOpen ? "Close AI Copilot" : "Open Ekavyu AI Copilot"}
            aria-label="Toggle AI Copilot"
            aria-expanded={isOpen}
            aria-haspopup="dialog"
          >
            {isOpen ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <AISparkIcon className="w-5 h-5 sm:w-6 sm:h-6 text-brand-mist animate-pulse" />
            )}
          </button>
        </div>
      </div>

      {/* Shared responsive dialog with a fixed header and composer. */}
      {isOpen && (
        <Modal open={isOpen} onClose={() => setIsOpen(false)} ariaLabel="Ekavyu AI Copilot" size={isExpanded ? "2xl" : "lg"} showCloseButton={false} bodyClassName="!p-0 !overflow-hidden flex flex-col" contentClassName="flex flex-col flex-1 min-h-0" className={isExpanded ? "h-[min(48rem,100%)]" : "h-[min(38rem,100%)]"}>
          {/* Header Bar */}
          <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between shrink-0 bg-surface-alt/30 rounded-t-3xl sm:rounded-t-2xl">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-accent shrink-0">
                <AISparkIcon className="w-4 h-4" />
              </div>
              <div className="truncate">
                <div className="flex items-center gap-1.5">
                  <h3 className="text-xs font-bold text-text truncate">Ekavyu AI Copilot</h3>
                  <span className="w-1.5 h-1.5 rounded-full bg-success shrink-0" />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {/* New Chat Button */}
              <Button variant="ghost" size="sm"
                disabled={isThinking || isLoadingSession || !hasContext}
                onClick={() => handleNewChatSession()}
                title="New Chat Session"
                className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface-hover transition-colors cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </Button>

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
                  className={`flex items-center justify-between rounded-lg text-xs transition-colors overflow-hidden ${
                    s.id === activeSessionId
                      ? "bg-primary/10 text-accent font-medium"
                      : "hover:bg-surface-hover text-text-muted hover:text-text"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      loadSessionMessages(s.id);
                      setShowSessionSelector(false);
                    }}
                    className="flex-1 text-left px-2.5 py-1 truncate max-w-[240px] cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus-ring"
                  >
                    {s.title}
                  </button>
                  <Button variant="ghost" size="xs" loading={archivingId === s.id} disabled={isThinking || isLoadingSession}
                    type="button"
                    onClick={(e) => handleDeleteSession(s.id, e)}
                    title="Archive chat"
                    aria-label={`Archive ${s.title}`}
                    className="text-text-muted hover:text-danger p-1 mr-1 rounded transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-danger"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </Button>
                </div>
              ))}
            </div>
          )}

          {!hasContext && <div className="p-4"><Alert variant="info" title="Choose an organization">Select a healthcare organization before starting a clinical AI conversation.</Alert><Button variant="outline" className="mt-3" onClick={() => { setIsOpen(false); router.push("/dashboard/organizations"); }}>Choose organization</Button></div>}
          {chatError && <div className="p-3"><Alert variant="error" title="AI assistance unavailable" action={!activeSessionId ? <Button variant="outline" size="sm" onClick={() => loadSessions()} loading={isLoadingSession}>Try again</Button> : undefined}>{chatError}</Alert></div>}
          {/* Chat Stream */}
          <div className="flex-1 overflow-y-auto overscroll-contain p-3.5 space-y-3 min-h-0">
            {isLoadingSession ? (
              <div className="flex items-center justify-center h-28 text-xs text-text-muted">
<div role="status" className="space-y-3 w-full p-3"><span className="sr-only">Loading conversation</span><div className="h-12 rounded-xl bg-surface-alt animate-pulse motion-reduce:animate-none" /><div className="h-16 w-4/5 rounded-xl bg-surface-alt animate-pulse motion-reduce:animate-none" /></div>
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
                        ? "bg-primary text-brand-mist rounded-br-xs font-medium"
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
                            onClick={() => copyMessageText(msg.id, msg.text, true)}
                            className="text-accent hover:underline transition-colors flex items-center gap-1 cursor-pointer font-medium"
                          >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <span>{copiedId === `chart-${msg.id}` ? "Copied for chart" : "Copy for chart"}</span>
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
                            <svg className="w-3 h-3 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
              <div role="status" className="text-xs bg-surface-alt/40 px-3 py-2 rounded-xl text-text-muted w-fit">
                <span>Preparing your response…</span>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Quick Suggestions Chips */}
          <fieldset disabled={isThinking || isLoadingSession || !hasContext || !activeSessionId} className="min-w-0">
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

          </fieldset>
          {/* Unified Input Box (Pill Container) */}
          <div className="p-3 border-t border-border/40 shrink-0 bg-surface">
            {actionMessage && <p role="status" className="text-xs text-text-secondary pb-2">{actionMessage}</p>}
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
                aria-label="Message to AI Copilot"
                disabled={isLoadingSession || !hasContext || !activeSessionId}
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                placeholder={isVoiceActive ? "Listening..." : "Ask Ekavyu AI..."}
                className="min-w-0 flex-1 bg-transparent text-base sm:text-xs text-text placeholder:text-text-muted focus:outline-none px-2 py-1.5"
              />

              <Button type="submit" variant="ghost" size="sm" loading={isThinking} disabled={!inputQuery.trim() || isLoadingSession || !hasContext || !activeSessionId} aria-label={isThinking ? "Sending message" : "Send message"} icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>} />
            </form>
          </div>
        </Modal>
      )}
    </>
  );
}
