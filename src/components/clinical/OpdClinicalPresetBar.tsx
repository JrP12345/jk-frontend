"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import { Button, Badge, Modal, Input, useToast, cn } from "@/components/ui";
import { Sparkles, Star, Plus, Trash2, Check, Bookmark, Zap } from "lucide-react";

export interface OpdPresetItem {
  id: string;
  title: string;
  specialty?: string;
  symptoms: string;
  diagnosis: string;
  prescriptions: Array<{
    name: string;
    dosage: string;
    duration: string;
    instructions?: string;
  }>;
  advice?: string;
  followUpRecommended?: boolean;
  followUpTimeline?: string;
  followUpNotes?: string;
  isSystem?: boolean;
}

const FALLBACK_SYSTEM_PRESETS: OpdPresetItem[] = [
  {
    id: "fb_viral",
    title: "Viral URI & Flu",
    symptoms: "Acute onset fever, runny nose, sore throat, dry cough, malaise x 3 days",
    diagnosis: "Acute Viral Upper Respiratory Infection (URI)",
    prescriptions: [
      { name: "Paracetamol 650mg", dosage: "1-0-1 (After Food)", duration: "3 days", instructions: "SOS for fever > 100°F" },
      { name: "Cetirizine 10mg", dosage: "0-0-1 (Night)", duration: "5 days", instructions: "Take before bedtime" },
      { name: "Pantoprazole 40mg", dosage: "1-0-0 (Before Food)", duration: "5 days", instructions: "30 mins before breakfast" },
    ],
    advice: "Warm water saline gargles 3x daily. Adequate oral hydration. Steam inhalation.",
    followUpRecommended: true,
    followUpTimeline: "1 week",
    followUpNotes: "Review SOS if fever persists or breathing difficulty occurs.",
    isSystem: true,
  },
  {
    id: "fb_ge",
    title: "Acute Gastroenteritis",
    symptoms: "Loose watery stools (4-5 episodes), mild cramping, nausea x 1-2 days",
    diagnosis: "Acute Gastroenteritis with Mild Dehydration",
    prescriptions: [
      { name: "ORS Sachet", dosage: "1 sachet in 1L water", duration: "3 days", instructions: "Sip continuously after loose stools" },
      { name: "Ofloxacin-Ornidazole 200/500mg", dosage: "1-0-1 (After Food)", duration: "3 days", instructions: "Antibacterial/antiprotozoal coverage" },
      { name: "Pantoprazole 40mg", dosage: "1-0-0 (Before Food)", duration: "5 days", instructions: "Empty stomach morning" },
    ],
    advice: "Strict light diet (khichdi, curd, banana). Avoid raw salads, milk, and spicy foods.",
    followUpRecommended: true,
    followUpTimeline: "1 week",
    followUpNotes: "Review immediately if high fever or blood in stool occurs.",
    isSystem: true,
  },
  {
    id: "fb_htn",
    title: "Hypertension Review",
    symptoms: "Asymptomatic routine follow-up. No headache, chest pain, or visual disturbance.",
    diagnosis: "Essential Primary Hypertension (Under Medical Management)",
    prescriptions: [
      { name: "Telmisartan 40mg", dosage: "1-0-0 (Morning)", duration: "1 month", instructions: "Take regularly after breakfast" },
      { name: "Amlodipine 5mg", dosage: "0-0-1 (Night)", duration: "1 month", instructions: "For dual-agent BP maintenance" },
    ],
    advice: "Strict low salt diet (< 5g/day). 30 mins brisk daily walk. Avoid pickles and papad.",
    followUpRecommended: true,
    followUpTimeline: "1 month",
    followUpNotes: "Review for regular BP log verification and serum creatinine check.",
    isSystem: true,
  },
  {
    id: "fb_dm",
    title: "Type 2 Diabetes Review",
    symptoms: "Routine diabetic check-up. No polyuria, polydipsia, or hypoglycemic spells.",
    diagnosis: "Type 2 Diabetes Mellitus (Glycemic Management)",
    prescriptions: [
      { name: "Metformin 500mg SR", dosage: "1-0-1 (With Food)", duration: "1 month", instructions: "Take with major meals" },
      { name: "Glimepiride 1mg", dosage: "1-0-0 (Before Food)", duration: "1 month", instructions: "15 mins before breakfast" },
    ],
    advice: "Daily foot inspection. Low carbohydrate, high fiber diet. Keep glucose sweets handy.",
    followUpRecommended: true,
    followUpTimeline: "1 month",
    followUpNotes: "Review with Fasting & PP Blood Sugar and HbA1c reports.",
    isSystem: true,
  },
  {
    id: "fb_gerd",
    title: "GERD & Dyspepsia",
    symptoms: "Epigastric burning sensation, retrosternal heartburn, acid regurgitation x 1 week",
    diagnosis: "Gastroesophageal Reflux Disease (GERD) & Acid Peptic Dyspepsia",
    prescriptions: [
      { name: "Pantoprazole 40mg + Domperidone 30mg SR", dosage: "1-0-0 (Before Food)", duration: "14 days", instructions: "Take 30 mins before breakfast" },
      { name: "Magaldrate + Simethicone Gel", dosage: "2 tsp (After Food)", duration: "7 days", instructions: "Take after meals SOS for heartburn" },
    ],
    advice: "Avoid late-night heavy meals. Maintain a 2-hour gap before sleep. Avoid coffee and citrus.",
    followUpRecommended: true,
    followUpTimeline: "2 weeks",
    followUpNotes: "Review after 2 weeks for symptom resolution.",
    isSystem: true,
  },
  {
    id: "fb_rhinitis",
    title: "Allergic Rhinitis",
    symptoms: "Morning paroxysmal sneezing, clear rhinorrhea, nasal congestion, eye itching x 2 weeks",
    diagnosis: "Allergic Rhinitis & Nasal Hyper-reactivity",
    prescriptions: [
      { name: "Montelukast 10mg + Levocetirizine 5mg", dosage: "0-0-1 (Night)", duration: "10 days", instructions: "Take at bedtime" },
      { name: "Fluticasone Furoate Nasal Spray", dosage: "2 sprays/nostril (Morning)", duration: "14 days", instructions: "Use once daily in morning" },
    ],
    advice: "Avoid dust, cold draughts, and pet exposure. Use mask in dusty environments.",
    followUpRecommended: true,
    followUpTimeline: "2 weeks",
    followUpNotes: "Review if nasal obstruction persists.",
    isSystem: true,
  },
  {
    id: "fb_uti",
    title: "Lower UTI",
    symptoms: "Burning micturition, increased urinary frequency, urgency, suprapubic ache x 2 days",
    diagnosis: "Acute Uncomplicated Lower Urinary Tract Infection",
    prescriptions: [
      { name: "Nitrofurantoin 100mg SR", dosage: "1-0-1 (After Food)", duration: "5 days", instructions: "Complete full 5-day course" },
      { name: "Disodium Hydrogen Citrate Syrup", dosage: "2 tsp in water (TDS)", duration: "5 days", instructions: "Take in 1 glass of water" },
    ],
    advice: "Consume 3 to 4 liters of water daily. Do not hold urine.",
    followUpRecommended: true,
    followUpTimeline: "1 week",
    followUpNotes: "Review with Urine Routine & Microscopy report.",
    isSystem: true,
  },
  {
    id: "fb_headache",
    title: "Headache / Migraine",
    symptoms: "Throbbing unilateral/bilateral headache, photophobia, mild nausea x 1 day",
    diagnosis: "Acute Tension Headache / Episodic Migraine",
    prescriptions: [
      { name: "Naproxen 500mg + Domperidone 10mg", dosage: "1 SOS (After Food)", duration: "3 days", instructions: "Take at onset of headache" },
      { name: "Pantoprazole 40mg", dosage: "1-0-0 (Before Food)", duration: "3 days", instructions: "Gastric safety" },
    ],
    advice: "Rest in a quiet, dark room during attacks. Stay well hydrated.",
    followUpRecommended: true,
    followUpTimeline: "1 week",
    followUpNotes: "Review if headache frequency increases.",
    isSystem: true,
  },
];

interface OpdClinicalPresetBarProps {
  onSelectPreset: (preset: OpdPresetItem) => void;
  currentSymptoms?: string;
  currentDiagnosis?: string;
  currentPrescriptions?: Array<{ name: string; dosage: string; duration: string }>;
  currentFollowUpRecommended?: boolean;
  currentFollowUpTimeline?: string;
  currentFollowUpNotes?: string;
  clinicId?: string;
}

export function OpdClinicalPresetBar({
  onSelectPreset,
  currentSymptoms = "",
  currentDiagnosis = "",
  currentPrescriptions = [],
  currentFollowUpRecommended = false,
  currentFollowUpTimeline = "1 week",
  currentFollowUpNotes = "",
  clinicId,
}: OpdClinicalPresetBarProps) {
  const { toast } = useToast();
  const [systemPresets, setSystemPresets] = useState<OpdPresetItem[]>(FALLBACK_SYSTEM_PRESETS);
  const [customPresets, setCustomPresets] = useState<OpdPresetItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [newPresetTitle, setNewPresetTitle] = useState("");
  const [savingPreset, setSavingPreset] = useState(false);
  const [activeAppliedPresetId, setActiveAppliedPresetId] = useState<string | null>(null);

  const fetchPresets = async () => {
    try {
      setLoading(true);
      const res = await api.get("/clinical/opd-templates");
      if (res.data?.data) {
        if (res.data.data.systemPresets && res.data.data.systemPresets.length > 0) {
          setSystemPresets(res.data.data.systemPresets);
        }
        if (res.data.data.customPresets) {
          setCustomPresets(res.data.data.customPresets);
        }
      }
    } catch {
      // Keep fallbacks
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPresets();
  }, []);

  const handleApplyPreset = (preset: OpdPresetItem) => {
    setActiveAppliedPresetId(preset.id);
    onSelectPreset(preset);
    toast({
      title: `${preset.title} Applied ⚡`,
      description: `Symptoms, diagnosis, ${preset.prescriptions.length} medication(s), advice, and follow-up auto-populated.`,
      variant: "success",
    });
  };

  const handleSaveCustomPreset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPresetTitle.trim()) {
      toast({ title: "Title Required", description: "Please enter a name for your custom preset.", variant: "error" });
      return;
    }

    const validRx = currentPrescriptions.filter((p) => p.name.trim());
    if (!currentDiagnosis.trim() && validRx.length === 0) {
      toast({
        title: "Preset Empty",
        description: "Please enter at least a diagnosis or medication before saving as a preset.",
        variant: "error",
      });
      return;
    }

    try {
      setSavingPreset(true);
      const res = await api.post("/clinical/opd-templates", {
        title: newPresetTitle.trim(),
        symptoms: currentSymptoms,
        diagnosis: currentDiagnosis,
        prescriptions: validRx,
        advice: currentFollowUpNotes,
        followUpRecommended: currentFollowUpRecommended,
        followUpTimeline: currentFollowUpTimeline,
        followUpNotes: currentFollowUpNotes,
        clinicId,
      });

      toast({
        title: "Custom Preset Saved ⭐",
        description: `"${newPresetTitle}" is now saved to your quick prescription presets.`,
        variant: "success",
      });

      setSaveModalOpen(false);
      setNewPresetTitle("");
      await fetchPresets();
    } catch (err: any) {
      toast({
        title: "Save Failed",
        description: err.response?.data?.message || "Failed to save custom preset",
        variant: "error",
      });
    } finally {
      setSavingPreset(false);
    }
  };

  const handleDeleteCustomPreset = async (e: React.MouseEvent, presetId: string, title: string) => {
    e.stopPropagation();
    try {
      await api.delete(`/clinical/opd-templates/${presetId}`);
      setCustomPresets((prev) => prev.filter((p) => p.id !== presetId));
      toast({
        title: "Preset Deleted",
        description: `"${title}" removed from your custom presets.`,
        variant: "default",
      });
    } catch {
      toast({ title: "Delete Failed", description: "Could not delete preset.", variant: "error" });
    }
  };

  return (
    <div className="p-2.5 rounded-2xl bg-primary-500/[0.04] border border-primary-500/20 space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs font-bold text-primary-700 dark:text-primary-300">
          <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
          <span>1-Click OPD Clinical Presets (Autofill 5-Sec Consultation)</span>
        </div>

        <button
          type="button"
          onClick={() => {
            setNewPresetTitle(currentDiagnosis ? `${currentDiagnosis} Combo` : "");
            setSaveModalOpen(true);
          }}
          className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-primary-600 hover:bg-primary-700 text-white shadow-2xs transition-colors flex items-center gap-1 cursor-pointer"
          title="Save current prescription as a custom reusable preset"
        >
          <Star className="w-3 h-3 text-amber-300 fill-amber-300" />
          <span>Save Current as Custom Preset</span>
        </button>
      </div>

      {/* Preset Chips Scroll Container */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
        {/* Custom Doctor Presets */}
        {customPresets.map((preset) => {
          const isApplied = activeAppliedPresetId === preset.id;
          return (
            <div
              key={preset.id}
              onClick={() => handleApplyPreset(preset)}
              className={cn(
                "group shrink-0 px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs",
                isApplied
                  ? "bg-amber-500/20 border-amber-500/50 text-amber-800 dark:text-amber-200 ring-2 ring-amber-500/20"
                  : "bg-surface border-amber-500/30 hover:border-amber-500/60 text-text hover:bg-amber-500/5"
              )}
            >
              <Star className="w-3 h-3 text-amber-500 fill-amber-500 shrink-0" />
              <span>{preset.title}</span>
              <Badge variant="warning" size="sm" className="text-[9px] px-1 py-0 font-mono">
                MY PRESET
              </Badge>
              <button
                type="button"
                onClick={(e) => handleDeleteCustomPreset(e, preset.id, preset.title)}
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-text-muted hover:text-danger-600 transition-opacity"
                title="Delete custom preset"
              >
                <Trash2 className="w-2.5 h-2.5" />
              </button>
            </div>
          );
        })}

        {/* System Standard Presets */}
        {systemPresets.map((preset) => {
          const isApplied = activeAppliedPresetId === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => handleApplyPreset(preset)}
              className={cn(
                "shrink-0 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs",
                isApplied
                  ? "bg-primary-600 border-primary-600 text-white shadow-xs"
                  : "bg-surface border-border/80 hover:border-primary-500/40 text-text hover:bg-primary-500/5"
              )}
            >
              <Sparkles className={cn("w-3 h-3 shrink-0", isApplied ? "text-white" : "text-primary-600")} />
              <span>{preset.title}</span>
            </button>
          );
        })}
      </div>

      {/* Save Custom Preset Modal */}
      <Modal
        open={saveModalOpen}
        onClose={() => !savingPreset && setSaveModalOpen(false)}
        title="⭐ Save as Custom OPD Clinical Preset"
        description="Save your current symptoms, diagnosis, and prescription medications as a reusable 1-click clinical template for your OPD shift."
        size="sm"
      >
        <form onSubmit={handleSaveCustomPreset} className="space-y-3.5 pt-2">
          <Input
            label="Preset Name *"
            placeholder="e.g. Dr. Verma Dengue / Viral Fever Protocol"
            value={newPresetTitle}
            onChange={(e) => setNewPresetTitle(e.target.value)}
            required
            autoFocus
          />

          <div className="p-3 rounded-xl bg-surface-alt border border-border/80 text-xs space-y-1">
            <div className="font-bold text-text flex items-center gap-1">
              <span>📋</span> Content to be Saved:
            </div>
            <p className="text-text-muted truncate">
              <strong>Diagnosis:</strong> {currentDiagnosis || "(None specified)"}
            </p>
            <p className="text-text-muted truncate">
              <strong>Medications:</strong>{" "}
              {currentPrescriptions.filter((p) => p.name.trim()).length > 0
                ? currentPrescriptions
                    .filter((p) => p.name.trim())
                    .map((p) => p.name)
                    .join(", ")
                : "(None)"}
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border/60">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSaveModalOpen(false)}
              disabled={savingPreset}
              className="rounded-xl font-semibold"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={savingPreset}
              className="bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl shadow-xs"
            >
              Save Custom Preset
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
