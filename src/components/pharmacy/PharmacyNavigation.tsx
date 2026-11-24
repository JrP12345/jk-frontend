"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { useWorkspacePageNavigation } from "@/components/dashboard/WorkspacePageNavigation";
import { Button, Dropdown, Tabs } from "@/components/ui";
import type { TabsProps } from "@/components/ui/Tabs";
import { ChevronDown, Wallet } from "lucide-react";
import Modal from "@/components/queue/QueueDialog";
import styles from "./PharmacyWorkspace.module.css";

/** Keep clinical navigation intact; put occasional standalone pharmacy tools in More. */
export function PharmacyNavigation({ compact, toolbarContext, toolbarActions, tabs, activeTab, onChange, ...props }: TabsProps & { compact: boolean; toolbarContext?: ReactNode; toolbarActions?: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const navigation = useWorkspacePageNavigation();
  const publish = navigation?.publish;
  const change = useRef(onChange);
  useEffect(() => { change.current = onChange; }, [onChange]);
  const entries = JSON.stringify(tabs.map(({ id, label }) => ({ id, label: String(label) })));
  useEffect(() => {
    if (!publish) return;
    publish({ items: JSON.parse(entries), active: activeTab || "", select: id => change.current?.(id) });
    return () => publish(null);
  }, [publish, entries, activeTab]);
  if (navigation) {
    const selected = tabs.find(tab => tab.id === activeTab);
    return <div className={styles.counterNavigation} data-no-toolbar={!toolbarContext && !toolbarActions || undefined}>
      {(toolbarContext || toolbarActions) && <div className={styles.counterToolbar}><div className={styles.toolbarContext}>{toolbarContext}</div><div className="ml-auto">{toolbarActions}</div></div>}
      <section aria-label={selected?.label} className="min-w-0">{selected?.content}</section>
    </div>;
  }
  if (!compact) return <Tabs {...props} tabs={tabs} activeTab={activeTab} onChange={onChange} />;
  const primaryIds = ["counter", "inventory", "sales", "dispensing"];
  const primary = primaryIds.flatMap(id => tabs.find(tab => tab.id === id) || []);
  const extra = tabs.filter(tab => !primaryIds.includes(tab.id));
  const selected = tabs.find(tab => tab.id === activeTab);
  const drawer = tabs.find(tab => tab.id === "till");
  const counterToolbar = Boolean(toolbarContext);
  const visible = selected && !primaryIds.includes(selected.id) ? [...primary, selected] : primary;
  const billingTabs = primary.filter(tab => ["counter", "sales"].includes(tab.id));
  const toolbarTabs = counterToolbar ? billingTabs.length ? billingTabs : primary.length ? primary : tabs.filter(tab => tab.id !== "till") : visible;
  // Desktop already has a drawer button; mobile exposes it in its own More menu.
  const moreTabs = (counterToolbar ? tabs.filter(tab => !toolbarTabs.some(visibleTab => visibleTab.id === tab.id)) : extra).filter(tab => tab.id !== "till");
  const toolLabel = selected && !toolbarTabs.some(tab => tab.id === selected.id) ? selected.label : "More";
  const toolName = toolLabel === "More" ? undefined : `More tools, current: ${toolLabel}`;
  const mobileTabs = [...moreTabs, ...(drawer && selected?.id !== "till" ? [drawer] : [])];
  return <div className={counterToolbar ? styles.counterNavigation : "min-w-0 space-y-5"}>
    <div className={counterToolbar ? styles.counterToolbar : "flex min-w-0 items-center gap-1 rounded-2xl border border-border bg-surface p-1 sm:gap-2"}>
      {counterToolbar && <div className={styles.toolbarContext}>{toolbarContext}</div>}
      <Tabs {...props} className={`${styles.primaryNav} ${counterToolbar ? styles.toolbarTabs : "min-w-0 flex-1"}`} tabs={toolbarTabs.map(tab => ({ ...tab, content: undefined }))} activeTab={activeTab} onChange={onChange} />
      <div className="hidden md:flex items-center gap-1" role="group" aria-label="Pharmacy tools">
        {drawer && selected?.id !== "till" && <Button size="sm" variant="ghost" aria-label="Open cash drawer" onClick={() => setDrawerOpen(true)}><Wallet size={16} aria-hidden="true" /><span className="hidden lg:inline">Cash drawer</span></Button>}
        {moreTabs.length > 0 && <Dropdown align="right" width="w-56" trigger={<Button size="sm" variant="ghost" className={styles.toolTrigger} data-active={toolLabel !== "More" || undefined} aria-label={toolName}><span className={styles.toolLabel}>{toolLabel}</span><ChevronDown size={15} aria-hidden="true" /></Button>} items={moreTabs.map(tab => ({ label: tab.label, active: activeTab === tab.id, onClick: () => onChange?.(tab.id) }))} />}
      </div>
      {mobileTabs.length > 0 && <div className={`${styles.mobileMore} md:hidden`} role="group" aria-label="Mobile pharmacy tools"><Dropdown align="right" width="w-56" trigger={<Button size="sm" variant="ghost" className={styles.toolTrigger} data-active={toolLabel !== "More" || undefined} aria-label={toolName}><span className={styles.toolLabel}>{toolLabel}</span><ChevronDown size={15} aria-hidden="true" /></Button>} items={mobileTabs.map(tab => ({ label: tab.label, active: activeTab === tab.id, onClick: () => tab.id === "till" ? setDrawerOpen(true) : onChange?.(tab.id) }))} /></div>}
      {counterToolbar && <div className={styles.toolbarRefresh}>{toolbarActions}</div>}
    </div>
    <section aria-label={selected?.label} className="min-w-0">{selected?.content}</section>
    {drawerOpen && drawer && selected?.id !== "till" && <Modal open title="Cash drawer" size="md" onClose={() => setDrawerOpen(false)}>{drawer.content}</Modal>}
  </div>;
}
