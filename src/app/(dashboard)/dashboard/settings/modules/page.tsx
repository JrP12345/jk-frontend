"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Card, CardHeader, CardTitle, CardContent, CardDescription,
  Button, Input, useToast, Spinner, Toggle
} from "@/components/ui";
import { useModuleStore, type ModuleInfo } from "@/store/moduleStore";

const PRIORITY_CONFIG = {
  P1: {
    label: "Clinic Essentials",
    color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    dot: "bg-emerald-500",
    description: "Core modules required for day-to-day clinic operations",
  },
  P2: {
    label: "Important",
    color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    dot: "bg-amber-500",
    description: "Valuable modules for enhanced clinical workflows",
  },
  P3: {
    label: "Hospital / Specialty",
    color: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20",
    dot: "bg-slate-400",
    description: "Advanced modules for hospital-grade or specialty operations",
  },
} as const;

export default function ModulesSettingsPage() {
  const { modules, isLoaded, isLoading, fetchModules, toggleModule, bulkToggleModules } = useModuleStore();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [togglingKeys, setTogglingKeys] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded && !isLoading) {
      fetchModules();
    }
  }, [isLoaded, isLoading, fetchModules]);

  // Group modules by priority
  const grouped = useMemo(() => {
    const filtered = modules.filter(
      (m) =>
        m.label.toLowerCase().includes(search.toLowerCase()) ||
        m.moduleKey.toLowerCase().includes(search.toLowerCase()) ||
        (m.description || "").toLowerCase().includes(search.toLowerCase())
    );

    const groups: Record<string, ModuleInfo[]> = { P1: [], P2: [], P3: [] };
    for (const mod of filtered) {
      if (groups[mod.priority]) {
        groups[mod.priority].push(mod);
      }
    }
    return groups;
  }, [modules, search]);

  const handleToggle = async (moduleKey: string, enabled: boolean) => {
    setTogglingKeys((prev) => new Set(prev).add(moduleKey));
    try {
      await toggleModule(moduleKey, enabled);
      toast({
        title: enabled ? "Module Enabled" : "Module Disabled",
        description: `${modules.find((m) => m.moduleKey === moduleKey)?.label || moduleKey} has been ${enabled ? "enabled" : "disabled"}.`,
        variant: enabled ? "success" : "default",
      });
    } catch (err: any) {
      toast({
        title: "Failed to toggle module",
        description: err?.response?.data?.message || err.message || "Something went wrong",
        variant: "error",
      });
      // Refetch to reset state
      await fetchModules();
    } finally {
      setTogglingKeys((prev) => {
        const next = new Set(prev);
        next.delete(moduleKey);
        return next;
      });
    }
  };

  const handleBulkToggle = async (priority: "P1" | "P2" | "P3", enabled: boolean) => {
    const target = modules.filter(
      (m) => m.priority === priority && !m.alwaysOn && m.enabled !== enabled
    );
    if (target.length === 0) return;

    setBulkLoading(priority);
    try {
      await bulkToggleModules(
        target.map((m) => ({ moduleKey: m.moduleKey, enabled }))
      );
      toast({
        title: `${PRIORITY_CONFIG[priority].label} — Bulk ${enabled ? "Enabled" : "Disabled"}`,
        description: `${target.length} module(s) ${enabled ? "enabled" : "disabled"}.`,
        variant: "success",
      });
    } catch (err: any) {
      toast({
        title: "Bulk toggle failed",
        description: err?.response?.data?.message || err.message || "Something went wrong",
        variant: "error",
      });
      await fetchModules();
    } finally {
      setBulkLoading(null);
    }
  };

  // Stats
  const totalEnabled = modules.filter((m) => m.enabled).length;
  const totalModules = modules.length;

  if (isLoading && !isLoaded) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" label="Loading modules..." />
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-surface rounded-xl border border-border/80 p-3.5 shadow-xs">
          <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Total Modules</p>
          <p className="text-2xl font-black text-text mt-0.5">{totalModules}</p>
        </div>
        <div className="bg-surface rounded-xl border border-border/80 p-3.5 shadow-xs">
          <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Active</p>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">{totalEnabled}</p>
        </div>
        <div className="bg-surface rounded-xl border border-border/80 p-3.5 shadow-xs">
          <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Disabled</p>
          <p className="text-2xl font-black text-text-muted mt-0.5">{totalModules - totalEnabled}</p>
        </div>
        <div className="bg-surface rounded-xl border border-border/80 p-3.5 shadow-xs">
          <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Always On</p>
          <p className="text-2xl font-black text-primary mt-0.5">{modules.filter((m) => m.alwaysOn).length}</p>
        </div>
      </div>

      {/* Search */}
      <div className="max-w-md">
        <Input
          placeholder="Search modules by name or description..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          size="sm"
        />
      </div>

      {/* Priority Groups */}
      {(["P1", "P2", "P3"] as const).map((priority) => {
        const config = PRIORITY_CONFIG[priority];
        const group = grouped[priority] || [];
        const enabledInGroup = group.filter((m) => m.enabled).length;
        const allEnabled = group.every((m) => m.enabled || m.alwaysOn);
        const allDisabled = group.filter((m) => !m.alwaysOn).every((m) => !m.enabled);

        if (group.length === 0 && search) return null;

        return (
          <Card key={priority}>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${config.color}`}>
                    <span className={`w-2 h-2 rounded-full ${config.dot}`} />
                    {priority}
                  </span>
                  <div>
                    <CardTitle className="text-base">{config.label}</CardTitle>
                    <CardDescription className="text-xs">{config.description}</CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-muted font-medium">
                    {enabledInGroup}/{group.length} active
                  </span>
                  {priority !== "P1" && (
                    <>
                      <Button
                        size="sm"
                        variant={allEnabled ? "ghost" : "outline"}
                        disabled={allEnabled || bulkLoading === priority}
                        onClick={() => handleBulkToggle(priority, true)}
                      >
                        {bulkLoading === priority ? <Spinner size="sm" /> : "Enable All"}
                      </Button>
                      <Button
                        size="sm"
                        variant={allDisabled ? "ghost" : "outline"}
                        disabled={allDisabled || bulkLoading === priority}
                        onClick={() => handleBulkToggle(priority, false)}
                      >
                        Disable All
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {group.length === 0 ? (
                <p className="text-sm text-text-muted py-4 text-center">No modules match your search.</p>
              ) : (
                <div className="grid gap-1">
                  {group.map((mod) => (
                    <div
                      key={mod.moduleKey}
                      className={`flex items-center justify-between gap-4 px-4 py-3 rounded-xl border transition-all duration-200 ${
                        mod.enabled
                          ? "bg-surface border-border/60 hover:border-primary/30"
                          : "bg-surface-alt/50 border-border/30 opacity-75 hover:opacity-100"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-2 h-2 rounded-full shrink-0 transition-colors duration-300 ${
                            mod.enabled ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"
                          }`}
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-text truncate">{mod.label}</p>
                          {mod.description && (
                            <p className="text-[11px] text-text-muted truncate mt-0.5">{mod.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {mod.alwaysOn && (
                          <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">
                            ALWAYS ON
                          </span>
                        )}
                        <Toggle
                          checked={mod.enabled}
                          onChange={(checked) => handleToggle(mod.moduleKey, checked)}
                          disabled={mod.alwaysOn || togglingKeys.has(mod.moduleKey)}
                          size="sm"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
