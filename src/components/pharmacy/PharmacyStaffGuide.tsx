"use client";
import { useState } from "react";
import { ArrowRight, CheckCircle2, Download, Keyboard, LifeBuoy } from "lucide-react";
import { Alert, Badge, Button, Card, Select, Tabs } from "@/components/ui";
import type { PharmacyCapabilities } from "@/lib/pharmacyCapabilities";
import { pharmacyGuideOpening, pharmacyGuideRecovery, pharmacyStaffGuide, pharmacyStaffGuideText } from "@/lib/pharmacyStaffGuide";

const topicLabels: Record<string, string> = {
  drawer: "Cash drawer", counter: "Counter sale", purchase: "Purchases", expiry: "Expiry returns", outage: "Connection issues", closing: "Day closing",
};
const shortcuts = [{ key: "F1", label: "Search" }, { key: "F2", label: "New bill" }, { key: "F4", label: "Hold" }, { key: "F6", label: "Discount" }, { key: "F8", label: "Payment" }, { key: "F10", label: "Save" }];

export function PharmacyStaffGuide({ capabilities, onNavigate }: { capabilities: PharmacyCapabilities; onNavigate: (tab: string) => void }) {
  const tasks = pharmacyStaffGuide(capabilities), [error, setError] = useState(""), [selectedId, setSelectedId] = useState("");
  // Permissions can change while the guide is open. Never retain a hidden task.
  const task = tasks.find(item => item.id === selectedId) || tasks[0];
  if (!task) return null;
  function download() {
    let url: string | undefined;
    const anchor = document.createElement("a");
    try {
      url = URL.createObjectURL(new Blob([pharmacyStaffGuideText(capabilities)], { type: "text/plain;charset=utf-8" }));
      anchor.href = url; anchor.download = "ekavyu-pharmacy-staff-guide.txt"; document.body.appendChild(anchor); anchor.click(); setError("");
    } catch { setError("The staff guide could not be downloaded. The same instructions are available below."); }
    finally { anchor.remove(); if (url) { const completed = url; setTimeout(() => URL.revokeObjectURL(completed), 1000); } }
  }
  return <section aria-label="Pharmacy daily staff guide" className="min-w-0 space-y-3">
    <Card padding="none" className="shadow-none" contentClassName="gap-0">
      <header className="flex items-start justify-between gap-3 border-b border-border/70 p-3 md:px-4">
        <div className="min-w-0"><h2 className="text-sm font-semibold text-text md:text-base">Staff guide</h2><p className="mt-1 text-xs text-text-secondary">Practical steps for your role, from opening to closing.</p></div>
        <Button size="xs" variant="outline" aria-label="Download your daily staff guide" title="Download your daily staff guide" onClick={download} icon={<Download size={15} aria-hidden="true" />}><span className="hidden sm:inline">Download</span></Button>
      </header>
      <div className="hidden md:block"><Tabs variant="underline" scrollActiveIntoView={false} activeTab={task.id} onChange={setSelectedId} tabs={tasks.map(item => ({ id: item.id, label: topicLabels[item.id] || item.title }))} /></div>
      <div className="border-b border-border/60 p-3 md:hidden"><Select size="sm" label="Guide topic" value={task.id} onChange={event => setSelectedId(event.target.value)} options={tasks.map(item => ({ value: item.id, label: topicLabels[item.id] || item.title }))} /></div>
      {error && <div className="px-3 pt-3 md:px-4"><Alert variant="error" title="Guide download unavailable">{error}</Alert></div>}
      <div className="p-3 md:p-4">
        <details className="mb-4 border-b border-border/60 pb-3 text-xs text-text-secondary"><summary className="w-fit cursor-pointer py-1 font-medium text-text focus-visible:outline-2 focus-visible:outline-focus-ring">Before you start</summary><p className="mt-2 max-w-3xl leading-relaxed">{pharmacyGuideOpening}</p></details>
        <article aria-label={topicLabels[task.id] || task.title}>
          <div className="mb-4 flex flex-wrap items-start justify-between gap-2"><h3 className="min-w-0 flex-1 text-sm font-semibold text-text">{task.title}</h3><Badge variant="neutral">{task.steps.length} steps</Badge></div>
          <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-6">
            <ol className="list-decimal space-y-3 pl-5 text-sm leading-relaxed text-text-secondary marker:font-semibold marker:text-accent">{task.steps.map(step => <li className="pl-1" key={step}>{step}</li>)}</ol>
            <aside aria-label="Task final check" className="space-y-3 rounded-lg border border-border/70 bg-surface-alt p-3">
              <h4 className="flex items-center gap-2 text-xs font-semibold text-text"><CheckCircle2 size={15} className="shrink-0 text-accent" aria-hidden="true" />Check before finishing</h4>
              <p className="text-xs leading-relaxed text-text-secondary">{task.check}</p>
              {task.tab && task.action && <Button size="sm" fullWidth onClick={() => onNavigate(task.tab!)} iconRight={<ArrowRight size={14} aria-hidden="true" />}>{task.action}</Button>}
            </aside>
          </div>
        </article>
      </div>
      {capabilities.actions.sell && <div className="hidden border-t border-border/60 px-4 py-3 md:block" aria-label="Counter keyboard shortcuts"><div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-text-secondary"><span className="flex items-center gap-1.5 font-medium text-text"><Keyboard size={15} aria-hidden="true" />Counter keys</span>{shortcuts.map(item => <span key={item.key} className="inline-flex items-center gap-1.5"><kbd className="rounded border border-border bg-surface px-1.5 py-0.5 text-[11px] font-medium">{item.key}</kbd>{item.label}</span>)}</div><p className="mt-2 text-[11px] text-text-secondary">Check the visible shortcut bar on your PC; a browser or scanner can intercept a key.</p></div>}
    </Card>
    <aside aria-label="Save recovery guidance" className="flex items-start gap-2 rounded-lg border border-border/70 bg-surface px-3 py-3 md:px-4"><LifeBuoy size={16} className="mt-0.5 shrink-0 text-text-secondary" aria-hidden="true" /><div><h3 className="text-xs font-semibold text-text">If a result is uncertain</h3><p className="mt-1 text-xs leading-relaxed text-text-secondary">{pharmacyGuideRecovery}</p></div></aside>
  </section>;
}
