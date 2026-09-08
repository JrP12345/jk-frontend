"use client";

import { useState } from "react";
import { AlertTriangle, ShieldAlert, Check, X } from "lucide-react";
import { Badge, Button, cn } from "@/components/ui";

interface AllergyClass {
  allergenKeywords: string[];
  crossReactiveDrugs: string[];
  className: string;
  severity: "high" | "critical";
  description: string;
}

const ALLERGY_CLASSES: AllergyClass[] = [
  {
    className: "Penicillin & Beta-Lactams",
    allergenKeywords: ["penicillin", "amoxicillin", "ampicillin", "augmentin", "beta-lactam", "betalactam"],
    crossReactiveDrugs: [
      "penicillin", "amoxicillin", "ampicillin", "augmentin", "amox-clav", "amox/clav",
      "cloxacillin", "piperacillin", "tazobactam", "ampiclox", "moxikind", "novamox",
      "cefalexin", "cephalexin", "ceftriaxone", "cefixime", "cefuroxime", "cefotaxime", "cefpodoxime"
    ],
    severity: "critical",
    description: "Beta-lactam antibiotic cross-reactivity. High risk of acute hypersensitivity, severe rash, or anaphylaxis.",
  },
  {
    className: "Cephalosporins",
    allergenKeywords: ["cephalosporin", "cefalexin", "ceftriaxone", "cefixime", "cefuroxime"],
    crossReactiveDrugs: [
      "cefalexin", "cephalexin", "ceftriaxone", "cefixime", "cefuroxime", "cefotaxime", "cefpodoxime", "cefprozil",
      "penicillin", "amoxicillin", "augmentin"
    ],
    severity: "critical",
    description: "Cephalosporin class cross-reactivity with potential beta-lactam overlap.",
  },
  {
    className: "Sulfonamides (Sulfa)",
    allergenKeywords: ["sulfa", "sulfonamide", "bactrim", "septra", "cotrimoxazole", "sulfamethoxazole"],
    crossReactiveDrugs: [
      "sulfa", "sulfonamide", "bactrim", "septra", "cotrimoxazole", "sulfamethoxazole", "dapsone", "sulfasalazine"
    ],
    severity: "critical",
    description: "Sulfa antibiotic hypersensitivity. Risk of severe cutaneous adverse reactions (SCARs/Stevens-Johnson).",
  },
  {
    className: "Nonsteroidal Anti-inflammatory Drugs (NSAIDs)",
    allergenKeywords: ["nsaid", "nsaids", "aspirin", "ibuprofen", "diclofenac", "naproxen", "combiflam"],
    crossReactiveDrugs: [
      "aspirin", "ibuprofen", "diclofenac", "naproxen", "piroxicam", "aceclofenac", "ketorolac",
      "mefenamic", "etoricoxib", "celecoxib", "combiflam", "voveran", "brufen"
    ],
    severity: "high",
    description: "COX-1/COX-2 inhibitor cross-reactivity. Risk of bronchospasm, severe gastritis, or angioedema.",
  },
  {
    className: "Fluoroquinolones",
    allergenKeywords: ["quinolone", "fluoroquinolone", "ciprofloxacin", "levofloxacin", "ofloxacin", "norfloxacin"],
    crossReactiveDrugs: [
      "ciprofloxacin", "levofloxacin", "ofloxacin", "norfloxacin", "moxifloxacin", "cipro", "levoflox", "zanocin"
    ],
    severity: "high",
    description: "Fluoroquinolone class hypersensitivity and tendinopathy risk.",
  },
  {
    className: "Macrolides",
    allergenKeywords: ["macrolide", "azithromycin", "erythromycin", "clarithromycin"],
    crossReactiveDrugs: [
      "azithromycin", "erythromycin", "clarithromycin", "roxythromycin", "azithral", "zithromax"
    ],
    severity: "high",
    description: "Macrolide antibiotic class reaction.",
  },
  {
    className: "Paracetamol / Acetaminophen",
    allergenKeywords: ["paracetamol", "acetaminophen", "calpol", "crocin", "dolo"],
    crossReactiveDrugs: [
      "paracetamol", "acetaminophen", "calpol", "crocin", "dolo", "pacimol"
    ],
    severity: "high",
    description: "Acetaminophen/paracetamol sensitivity.",
  }
];

export interface AllergyConflict {
  medicineName: string;
  matchedAllergen: string;
  className: string;
  severity: "high" | "critical";
  description: string;
}

interface DrugAllergyAlertProps {
  allergies?: string[];
  prescriptions: Array<{ name: string; dosage?: string; duration?: string }>;
  onOverrideChange?: (isOverridden: boolean) => void;
}

export function DrugAllergyAlert({
  allergies = [],
  prescriptions,
  onOverrideChange,
}: DrugAllergyAlertProps) {
  const [acknowledgedOverrides, setAcknowledgedOverrides] = useState<Record<string, boolean>>({});

  if (!allergies || allergies.length === 0) return null;

  // Detect conflicts
  const conflicts: AllergyConflict[] = [];

  for (const rx of prescriptions) {
    if (!rx.name || !rx.name.trim()) continue;
    const medLower = rx.name.toLowerCase().trim();

    for (const allergy of allergies) {
      if (!allergy || !allergy.trim()) continue;
      const allergyLower = allergy.toLowerCase().trim();

      // 1. Direct match check
      if (medLower.includes(allergyLower) || allergyLower.includes(medLower.split(/\s+/)[0])) {
        conflicts.push({
          medicineName: rx.name,
          matchedAllergen: allergy,
          className: "Direct Allergen Match",
          severity: "critical",
          description: `Direct match with documented allergy "${allergy}". High probability of adverse allergic reaction.`,
        });
        continue;
      }

      // 2. Class cross-reactivity check
      for (const cls of ALLERGY_CLASSES) {
        const isAllergyInClass = cls.allergenKeywords.some((k) => allergyLower.includes(k) || k.includes(allergyLower));
        if (isAllergyInClass) {
          const isDrugInClass = cls.crossReactiveDrugs.some((d) => medLower.includes(d));
          if (isDrugInClass) {
            conflicts.push({
              medicineName: rx.name,
              matchedAllergen: allergy,
              className: cls.className,
              severity: cls.severity,
              description: cls.description,
            });
            break;
          }
        }
      }
    }
  }

  if (conflicts.length === 0) return null;

  const toggleOverride = (key: string) => {
    setAcknowledgedOverrides((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      const allOverridden = conflicts.every((c) => next[`${c.medicineName}_${c.matchedAllergen}`]);
      if (onOverrideChange) onOverrideChange(allOverridden);
      return next;
    });
  };

  return (
    <div className="rounded-2xl border border-danger-500/30 bg-danger-500/10 p-3.5 space-y-2.5 animate-pulse-once shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-danger-700 dark:text-danger-400 font-bold text-xs">
          <ShieldAlert className="w-4 h-4 text-danger-600 dark:text-danger-400 shrink-0" />
          <span className="uppercase tracking-wider">Clinical Decision Support: Drug-Allergy Warning</span>
        </div>
        <Badge variant="danger" size="sm" className="font-bold">
          {conflicts.length} Conflict{conflicts.length > 1 ? "s" : ""} Detected
        </Badge>
      </div>

      <div className="space-y-2">
        {conflicts.map((conflict, idx) => {
          const key = `${conflict.medicineName}_${conflict.matchedAllergen}`;
          const isOverridden = Boolean(acknowledgedOverrides[key]);

          return (
            <div
              key={idx}
              className={cn(
                "p-2.5 rounded-xl border text-xs transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2.5",
                isOverridden
                  ? "bg-surface/80 border-border/80 text-text-muted opacity-80"
                  : "bg-surface border-danger-500/40 text-text shadow-2xs"
              )}
            >
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-danger-700 dark:text-danger-300 text-sm">
                    {conflict.medicineName}
                  </span>
                  <span className="text-text-muted">&bull;</span>
                  <span className="font-semibold text-text">
                    Allergen: <strong>{conflict.matchedAllergen}</strong>
                  </span>
                  <Badge
                    variant={conflict.severity === "critical" ? "danger" : "warning"}
                    size="sm"
                    className="text-[10px]"
                  >
                    {conflict.className}
                  </Badge>
                </div>
                <p className="text-[11px] text-text-secondary">
                  {conflict.description}
                </p>
              </div>

              <div className="shrink-0 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleOverride(key)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1",
                    isOverridden
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                      : "bg-danger-600 hover:bg-danger-700 text-white shadow-xs"
                  )}
                >
                  {isOverridden ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Risk Acknowledged</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-3.5 h-3.5 text-white" />
                      <span>Acknowledge Risk</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
