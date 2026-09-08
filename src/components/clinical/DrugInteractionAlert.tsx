"use client";

import React, { useState, useMemo } from "react";
import { AlertTriangle, AlertCircle, ShieldAlert, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import { Badge, Button, cn } from "@/components/ui";

export interface DrugInteractionWarning {
  id: string;
  type: "duplicate" | "interaction";
  severity: "critical" | "warning";
  drugs: [string, string];
  title: string;
  description: string;
  clinicalGuidance: string;
}

interface PrescriptionInput {
  name: string;
  dosage?: string;
  duration?: string;
}

interface DrugInteractionAlertProps {
  prescriptions: PrescriptionInput[];
  onOverrideChange?: (acknowledged: boolean) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Clinical Drug Classes & Matrices
// ─────────────────────────────────────────────────────────────────────────────
const DRUG_CLASSES = {
  PPI: ["pantoprazole", "omeprazole", "rabeprazole", "esomeprazole", "lansoprazole", "pan 40", "pantocid", "rabekind", "omez"],
  NSAID: ["ibuprofen", "diclofenac", "aceclofenac", "naproxen", "ketorolac", "combiflam", "voveran", "zerodol", "piroxicam", "indomethacin"],
  ANTIHISTAMINE: ["cetirizine", "levocetirizine", "bilastine", "fexofenadine", "loratadine", "allegra", "cetzine"],
  STATIN: ["atorvastatin", "rosuvastatin", "simvastatin", "atorva", "rosuvas"],
  ANTICOAGULANT_ANTIPLATELET: ["aspirin", "clopidogrel", "warfarin", "apixaban", "rivaroxaban", "dabigatran", "ecosprin", "plavix", "eliquis", "xarelto"],
  FLUOROQUINOLONE: ["ciprofloxacin", "levofloxacin", "ofloxacin", "norfloxacin", "moxifloxacin", "ciplox", "levoquine", "oflox"],
  ANTACID_CATION: ["antacid", "sucralfate", "calcium", "iron", "ferrous", "zinc", "gelusil", "digene", "mucaine"],
  ACEI_ARB: ["telmisartan", "ramipril", "enalapril", "losartan", "olmesartan", "telma", "cardace", "losar"],
  POTASSIUM_SPARING: ["spironolactone", "aldactone", "eplerenone", "potassium", "k-bind", "potklor"],
  MACROLIDE: ["azithromycin", "clarithromycin", "erythromycin", "azithral", "zady", "claribid"],
};

function matchClass(name: string, list: string[]): boolean {
  const lower = name.toLowerCase();
  return list.some((k) => lower.includes(k));
}

export function evaluateDrugInteractions(prescriptions: PrescriptionInput[]): DrugInteractionWarning[] {
  const validMeds = prescriptions.filter((p) => p.name && p.name.trim().length > 1);
  if (validMeds.length < 2) return [];

  const warnings: DrugInteractionWarning[] = [];

  // 1. Duplicate Class Checks
  const classesToCheck: Array<{ key: keyof typeof DRUG_CLASSES; label: string; classDesc: string }> = [
    { key: "PPI", label: "Proton Pump Inhibitors (PPI)", classDesc: "Dual acid-suppression therapy offers no additive efficacy while increasing hypomagnesemia and infection risks." },
    { key: "NSAID", label: "Non-Steroidal Anti-Inflammatory Drugs (NSAID)", classDesc: "Concurrent dual NSAID therapy drastically amplifies gastrointestinal ulceration, bleeding, and nephrotoxicity without additional analgesia." },
    { key: "ANTIHISTAMINE", label: "H1-Antihistamines", classDesc: "Duplicate antihistamine therapy increases excessive sedation, anticholinergic toxicity, and dry mouth." },
    { key: "STATIN", label: "HMG-CoA Reductase Inhibitors (Statins)", classDesc: "Duplicate statin administration drastically escalates myopathy, rhabdomyolysis, and liver enzyme elevations." },
  ];

  for (const item of classesToCheck) {
    const matching = validMeds.filter((m) => matchClass(m.name, DRUG_CLASSES[item.key]));
    if (matching.length >= 2) {
      warnings.push({
        id: `dup_${item.key}_${matching[0].name}_${matching[1].name}`,
        type: "duplicate",
        severity: item.key === "NSAID" ? "critical" : "warning",
        drugs: [matching[0].name, matching[1].name],
        title: `Duplicate Therapy Detected: Two ${item.label}`,
        description: `Prescribed medications "${matching[0].name}" and "${matching[1].name}" belong to the same drug class (${item.label}).`,
        clinicalGuidance: item.classDesc,
      });
    }
  }

  // 2. High-Severity Cross-Class Drug-Drug Interactions
  for (let i = 0; i < validMeds.length; i++) {
    for (let j = i + 1; j < validMeds.length; j++) {
      const medA = validMeds[i].name;
      const medB = validMeds[j].name;

      // Interaction A: NSAID + Anticoagulant / Antiplatelet
      if (
        (matchClass(medA, DRUG_CLASSES.NSAID) && matchClass(medB, DRUG_CLASSES.ANTICOAGULANT_ANTIPLATELET)) ||
        (matchClass(medB, DRUG_CLASSES.NSAID) && matchClass(medA, DRUG_CLASSES.ANTICOAGULANT_ANTIPLATELET))
      ) {
        warnings.push({
          id: `ddi_nsaid_anticoag_${medA}_${medB}`,
          type: "interaction",
          severity: "critical",
          drugs: [medA, medB],
          title: "Major Bleed Alert: NSAID + Anticoagulant / Antiplatelet",
          description: `Combination of "${medA}" and "${medB}" causes synergistic platelet inhibition and gastric mucosal injury.`,
          clinicalGuidance: "High risk of life-threatening gastrointestinal hemorrhage. If co-administration is clinically mandatory, ensure concurrent high-dose PPI gastroprotection and monitor hemoglobin.",
        });
      }

      // Interaction B: Fluoroquinolone + Antacid / Cation
      if (
        (matchClass(medA, DRUG_CLASSES.FLUOROQUINOLONE) && matchClass(medB, DRUG_CLASSES.ANTACID_CATION)) ||
        (matchClass(medB, DRUG_CLASSES.FLUOROQUINOLONE) && matchClass(medA, DRUG_CLASSES.ANTACID_CATION))
      ) {
        warnings.push({
          id: `ddi_quinolone_antacid_${medA}_${medB}`,
          type: "interaction",
          severity: "warning",
          drugs: [medA, medB],
          title: "Chelation Hazard: Fluoroquinolone + Cation / Antacid",
          description: `Multivalent cations in "${medB}" chelate with fluoroquinolone "${medA}", reducing antibiotic absorption by up to 90%.`,
          clinicalGuidance: "Administer the fluoroquinolone at least 2 hours before or 4 hours after oral antacids, calcium, or iron preparations to avert therapeutic failure.",
        });
      }

      // Interaction C: ACE-Inhibitor / ARB + Potassium / Potassium-sparing Diuretic
      if (
        (matchClass(medA, DRUG_CLASSES.ACEI_ARB) && matchClass(medB, DRUG_CLASSES.POTASSIUM_SPARING)) ||
        (matchClass(medB, DRUG_CLASSES.ACEI_ARB) && matchClass(medA, DRUG_CLASSES.POTASSIUM_SPARING))
      ) {
        warnings.push({
          id: `ddi_arb_potassium_${medA}_${medB}`,
          type: "interaction",
          severity: "critical",
          drugs: [medA, medB],
          title: "Critical Alert: Severe Hyperkalemia Risk",
          description: `Dual RAAS blockade ("${medA}" + "${medB}") sharply impairs renal potassium excretion.`,
          clinicalGuidance: "Can cause sudden fatal cardiac arrhythmias. Baseline and 1-week follow-up serum potassium and creatinine monitoring is mandatory.",
        });
      }

      // Interaction D: Macrolide + Fluoroquinolone (Dual QT Prolongation)
      if (
        (matchClass(medA, DRUG_CLASSES.MACROLIDE) && matchClass(medB, DRUG_CLASSES.FLUOROQUINOLONE)) ||
        (matchClass(medB, DRUG_CLASSES.MACROLIDE) && matchClass(medA, DRUG_CLASSES.FLUOROQUINOLONE))
      ) {
        warnings.push({
          id: `ddi_macrolide_quinolone_${medA}_${medB}`,
          type: "interaction",
          severity: "warning",
          drugs: [medA, medB],
          title: "Cardiac Warning: Additive QT Prolongation",
          description: `Co-prescribing macrolide "${medA}" and fluoroquinolone "${medB}" causes additive cardiac repolarization delay.`,
          clinicalGuidance: "Elevated risk of Torsades de Pointes, especially in patients with bradycardia, hypokalemia, or heart failure. Substitute one antimicrobial if feasible.",
        });
      }
    }
  }

  return warnings;
}

export function DrugInteractionAlert({ prescriptions, onOverrideChange }: DrugInteractionAlertProps) {
  const [acknowledged, setAcknowledged] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const warnings = useMemo(() => evaluateDrugInteractions(prescriptions), [prescriptions]);

  const hasCritical = warnings.some((w) => w.severity === "critical");

  const handleToggleAcknowledge = () => {
    const next = !acknowledged;
    setAcknowledged(next);
    if (onOverrideChange) {
      onOverrideChange(next);
    }
  };

  if (warnings.length === 0) return null;

  return (
    <div
      className={cn(
        "rounded-2xl border-2 p-3.5 transition-all text-xs space-y-3",
        hasCritical
          ? acknowledged
            ? "bg-rose-500/[0.04] border-rose-500/30 text-rose-950 dark:text-rose-100"
            : "bg-rose-500/10 border-rose-500/60 shadow-md ring-2 ring-rose-500/20 text-rose-950 dark:text-rose-100 animate-pulse-subtle"
          : "bg-amber-500/10 border-amber-500/40 text-amber-950 dark:text-amber-100"
      )}
    >
      {/* Header Strip */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div
            className={cn(
              "w-7 h-7 rounded-xl flex items-center justify-center shrink-0 shadow-xs font-bold text-white",
              hasCritical ? "bg-rose-600" : "bg-amber-500"
            )}
          >
            {hasCritical ? <ShieldAlert className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-extrabold text-sm">
                Clinical Safety Warning: {warnings.length} Drug-Drug Interaction{warnings.length === 1 ? "" : "s"} Detected
              </span>
              <Badge variant={hasCritical ? "danger" : "warning"} size="sm" className="font-bold uppercase text-[9.5px]">
                {hasCritical ? "High Severity" : "Moderate Warning"}
              </Badge>
            </div>
            <p className="text-[11px] opacity-85 leading-tight">
              Evaluation based on standard pharmacological contraindications and duplicated therapeutic classes.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-current opacity-70 transition-colors"
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Warning Items List */}
      {expanded && (
        <div className="space-y-2 pt-1">
          {warnings.map((w) => (
            <div
              key={w.id}
              className={cn(
                "p-2.5 rounded-xl border space-y-1 bg-surface/90 text-text",
                w.severity === "critical" ? "border-rose-500/30" : "border-amber-500/30"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-xs flex items-center gap-1.5 text-rose-700 dark:text-rose-400">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {w.title}
                </span>
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-surface-alt border border-border">
                  {w.drugs.join(" ⚡ ")}
                </span>
              </div>
              <p className="text-[11px] text-text-muted">{w.description}</p>
              <div className="p-2 rounded-lg bg-surface-alt text-[10.5px] leading-relaxed text-text-secondary border border-border/60">
                <strong className="text-text font-semibold">Clinical Action: </strong>
                {w.clinicalGuidance}
              </div>
            </div>
          ))}

          {/* Doctor Clinical Override Checkbox */}
          <div className="pt-2 border-t border-border/60 flex items-center justify-between gap-3 flex-wrap">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={handleToggleAcknowledge}
                className="w-4 h-4 rounded text-primary-600 focus:ring-primary-500 border-border"
              />
              <span className="font-bold text-xs">
                I have reviewed these pharmacological interactions and acknowledge clinical responsibility
              </span>
            </label>

            {acknowledged && (
              <Badge variant="success" size="sm" className="font-bold text-[10px] flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Clinical Override Active
              </Badge>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
