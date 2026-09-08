"use client";

import React, { useState, useEffect, useMemo } from "react";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import Input from "../ui/Input";
import Badge from "../ui/Badge";
import { useToast } from "../ui/Toast";
import api from "@/lib/api";
import { AlertTriangle, Flame, HeartPulse, Stethoscope } from "lucide-react";

export interface VitalsRecord {
  bpSystolic?: number;
  bpDiastolic?: number;
  pulse?: number;
  temperature?: number;
  temperatureUnit?: "F" | "C";
  spO2?: number;
  weight?: number;
  height?: number;
  bmi?: number;
  bloodSugar?: number;
  bloodSugarType?: "fasting" | "post_prandial" | "random";
  allergies?: string[];
  triageNotes?: string;
  recordedAt?: string;
  recordedByName?: string;
}

interface NurseVitalsModalProps {
  open: boolean;
  onClose: () => void;
  appointmentId?: string;
  patientId?: string;
  patientName: string;
  encounterId?: string;
  initialVitals?: VitalsRecord | null;
  onSaved?: () => void;
}

export function NurseVitalsModal({
  open,
  onClose,
  appointmentId,
  patientId,
  patientName,
  encounterId,
  initialVitals,
  onSaved,
}: NurseVitalsModalProps) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const [bpSystolic, setBpSystolic] = useState("");
  const [bpDiastolic, setBpDiastolic] = useState("");
  const [pulseRate, setPulseRate] = useState("");
  const [spO2, setSpO2] = useState("");
  const [temperature, setTemperature] = useState("98.6");
  const [tempUnit, setTempUnit] = useState<"F" | "C">("F");
  const [weightKg, setWeightKg] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [bloodSugar, setBloodSugar] = useState("");
  const [bloodSugarType, setBloodSugarType] = useState<"random" | "fasting" | "post_prandial">("random");
  const [allergiesInput, setAllergiesInput] = useState("");
  const [triageNotes, setTriageNotes] = useState("");

  // Sync initial vitals if provided
  useEffect(() => {
    if (initialVitals) {
      if (initialVitals.bpSystolic) setBpSystolic(String(initialVitals.bpSystolic));
      if (initialVitals.bpDiastolic) setBpDiastolic(String(initialVitals.bpDiastolic));
      if (initialVitals.pulse) setPulseRate(String(initialVitals.pulse));
      if (initialVitals.spO2) setSpO2(String(initialVitals.spO2));
      if (initialVitals.temperature) setTemperature(String(initialVitals.temperature));
      if (initialVitals.temperatureUnit) setTempUnit(initialVitals.temperatureUnit);
      if (initialVitals.weight) setWeightKg(String(initialVitals.weight));
      if (initialVitals.height) setHeightCm(String(initialVitals.height));
      if (initialVitals.bloodSugar) setBloodSugar(String(initialVitals.bloodSugar));
      if (initialVitals.bloodSugarType) setBloodSugarType(initialVitals.bloodSugarType);
      if (initialVitals.allergies && initialVitals.allergies.length > 0) {
        setAllergiesInput(initialVitals.allergies.join(", "));
      }
      if (initialVitals.triageNotes) setTriageNotes(initialVitals.triageNotes);
    } else {
      setBpSystolic("");
      setBpDiastolic("");
      setPulseRate("");
      setSpO2("");
      setTemperature("98.6");
      setTempUnit("F");
      setWeightKg("");
      setHeightCm("");
      setBloodSugar("");
      setBloodSugarType("random");
      setAllergiesInput("");
      setTriageNotes("");
    }
  }, [initialVitals, open]);

  // Live BMI calculation
  const bmiInfo = useMemo(() => {
    const w = parseFloat(weightKg);
    const h = parseFloat(heightCm);
    if (!w || !h || w <= 0 || h <= 0) return null;
    const heightM = h / 100;
    const val = parseFloat((w / (heightM * heightM)).toFixed(1));
    let category = "Normal";
    let variant: "success" | "warning" | "danger" | "info" = "success";
    if (val < 18.5) {
      category = "Underweight";
      variant = "warning";
    } else if (val >= 18.5 && val < 25) {
      category = "Normal Weight";
      variant = "success";
    } else if (val >= 25 && val < 30) {
      category = "Overweight";
      variant = "warning";
    } else {
      category = "Obese";
      variant = "danger";
    }
    return { val, category, variant };
  }, [weightKg, heightCm]);

  // Clinical Safety Alerts
  const isHighBp = useMemo(() => {
    const sys = parseInt(bpSystolic, 10);
    const dia = parseInt(bpDiastolic, 10);
    return (sys && sys >= 140) || (dia && dia >= 90);
  }, [bpSystolic, bpDiastolic]);

  const isHypoxic = useMemo(() => {
    const o2 = parseInt(spO2, 10);
    return o2 && o2 > 0 && o2 < 95;
  }, [spO2]);

  const isFever = useMemo(() => {
    const temp = parseFloat(temperature);
    if (!temp) return false;
    if (tempUnit === "F") return temp >= 100.4;
    return temp >= 38.0;
  }, [temperature, tempUnit]);

  const handleSaveVitals = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);

      const parsedAllergies = allergiesInput
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean);

      const payload = {
        bpSystolic: bpSystolic ? parseInt(bpSystolic, 10) : undefined,
        bpDiastolic: bpDiastolic ? parseInt(bpDiastolic, 10) : undefined,
        pulse: pulseRate ? parseInt(pulseRate, 10) : undefined,
        temperature: temperature ? parseFloat(temperature) : undefined,
        temperatureUnit: tempUnit,
        spO2: spO2 ? parseInt(spO2, 10) : undefined,
        weight: weightKg ? parseFloat(weightKg) : undefined,
        height: heightCm ? parseFloat(heightCm) : undefined,
        bmi: bmiInfo?.val,
        bloodSugar: bloodSugar ? parseFloat(bloodSugar) : undefined,
        bloodSugarType: bloodSugar ? bloodSugarType : undefined,
        allergies: parsedAllergies.length > 0 ? parsedAllergies : undefined,
        triageNotes: triageNotes.trim() || undefined,
      };

      if (appointmentId) {
        await api.post(`/queue/${appointmentId}/vitals`, payload);
      } else if (encounterId) {
        await api.post(`/encounters/${encounterId}/evaluate-score`, {
          patientId,
          encounterId,
          vitals: {
            bp: `${bpSystolic}/${bpDiastolic}`,
            pulse: Number(pulseRate),
            spO2: Number(spO2),
            temperature: Number(temperature),
            ...(weightKg ? { weight: Number(weightKg) } : {}),
            ...(heightCm ? { height: Number(heightCm) } : {}),
          },
        });
      } else if (patientId) {
        await api.post("/clinical-notes", {
          patientId,
          subjective: { chiefComplaint: "Pre-consultation Nursing Vitals Check" },
          objective: {
            physicalExamination: `BP: ${bpSystolic}/${bpDiastolic} mmHg, Pulse: ${pulseRate} bpm, SpO2: ${spO2}%, Temp: ${temperature} °${tempUnit}`,
          },
          status: "draft",
        });
      }

      const alertHighlights: string[] = [];
      if (isHighBp) alertHighlights.push("Stage 2 HTN");
      if (isHypoxic) alertHighlights.push("Hypoxia (<95%)");
      if (isFever) alertHighlights.push("Fever");

      toast({
        title: "Triage Vitals Saved 🩺",
        description: alertHighlights.length > 0
          ? `Vitals recorded with clinical flags: ${alertHighlights.join(", ")}`
          : `Pre-check vitals logged successfully for ${patientName}`,
        variant: alertHighlights.length > 0 ? "warning" : "success",
      });

      if (onSaved) onSaved();
      onClose();
    } catch (err: any) {
      toast({
        title: "Error Recording Vitals",
        description: err.response?.data?.message || "Failed to record patient vitals",
        variant: "error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Nurse Triage & Vitals Station — ${patientName}`} size="lg">
      <form onSubmit={handleSaveVitals} className="space-y-4 pt-1 max-h-[80vh] overflow-y-auto pr-1">
        {/* Realtime Safety Alerts Bar */}
        {(isHighBp || isHypoxic || isFever) && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl space-y-1 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-red-600 dark:text-red-400">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Clinical Triage Alert — Critical Vitals Detected:</span>
            </div>
            <ul className="list-disc list-inside space-y-0.5 text-text-secondary pl-1 font-medium">
              {isHighBp && <li className="text-red-600 dark:text-red-400">Blood Pressure elevated: {bpSystolic}/{bpDiastolic} mmHg (Stage 2 Hypertension risk)</li>}
              {isHypoxic && <li className="text-red-600 dark:text-red-400">Low Oxygen Saturation: {spO2}% (Hypoxia threshold &lt;95%)</li>}
              {isFever && <li className="text-amber-600 dark:text-amber-400">Fever Present: {temperature} °{tempUnit} (Pyrexia)</li>}
            </ul>
          </div>
        )}

        <div className="p-3 bg-primary-500/5 rounded-xl border border-primary-500/20 text-xs text-text-secondary flex items-start gap-2">
          <Stethoscope className="w-4 h-4 text-primary-500 shrink-0 mt-0.5" />
          <span>
            Logged vitals auto-sync to the doctor&apos;s queue card, consultation SOAP note, and patient&apos;s mobile live tracker.
          </span>
        </div>

        {/* Section 1: Core Hemodynamics */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
            <HeartPulse className="w-3.5 h-3.5 text-primary-500" />
            Hemodynamics & Oxygenation
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-text mb-1">
                BP (Systolic / Diastolic) <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="120"
                  value={bpSystolic}
                  onChange={(e) => setBpSystolic(e.target.value)}
                  required
                />
                <span className="self-center font-bold text-text-muted">/</span>
                <Input
                  type="number"
                  placeholder="80"
                  value={bpDiastolic}
                  onChange={(e) => setBpDiastolic(e.target.value)}
                  required
                />
              </div>
              <span className="text-[10px] text-text-muted mt-0.5 block">mmHg</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-text mb-1">
                Pulse / Heart Rate <span className="text-red-500">*</span>
              </label>
              <Input
                type="number"
                placeholder="72"
                value={pulseRate}
                onChange={(e) => setPulseRate(e.target.value)}
                required
              />
              <span className="text-[10px] text-text-muted mt-0.5 block">beats / min (bpm)</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-text mb-1">
                SpO2 Saturation <span className="text-red-500">*</span>
              </label>
              <Input
                type="number"
                placeholder="98"
                min="50"
                max="100"
                value={spO2}
                onChange={(e) => setSpO2(e.target.value)}
                required
              />
              <span className="text-[10px] text-text-muted mt-0.5 block">% Oxygen (Norm &ge;95%)</span>
            </div>
          </div>
        </div>

        {/* Section 2: Temperature & Anthropometrics */}
        <div className="space-y-3 border-t border-border/60 pt-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-amber-500" />
            Temperature & Anthropometrics
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-text mb-1">Body Temperature</label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  step="0.1"
                  placeholder="98.6"
                  value={temperature}
                  onChange={(e) => setTemperature(e.target.value)}
                />
                <div className="flex border border-border rounded-xl overflow-hidden shrink-0">
                  <button
                    type="button"
                    onClick={() => setTempUnit("F")}
                    className={`px-3 py-1 text-xs font-bold transition-colors ${
                      tempUnit === "F" ? "bg-primary-500 text-white" : "bg-surface-alt text-text-secondary hover:bg-surface"
                    }`}
                  >
                    °F
                  </button>
                  <button
                    type="button"
                    onClick={() => setTempUnit("C")}
                    className={`px-3 py-1 text-xs font-bold transition-colors ${
                      tempUnit === "C" ? "bg-primary-500 text-white" : "bg-surface-alt text-text-secondary hover:bg-surface"
                    }`}
                  >
                    °C
                  </button>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-text mb-1">Weight (kg)</label>
              <Input
                type="number"
                step="0.1"
                placeholder="68.5"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-text mb-1">Height (cm)</label>
              <Input
                type="number"
                step="0.5"
                placeholder="172"
                value={heightCm}
                onChange={(e) => setHeightCm(e.target.value)}
              />
            </div>
          </div>

          {/* Live BMI Output */}
          {bmiInfo && (
            <div className="flex items-center gap-2 p-2 rounded-xl bg-surface-alt border border-border/60 text-xs">
              <span className="font-semibold text-text">Calculated BMI:</span>
              <span className="font-mono font-bold text-sm text-text">{bmiInfo.val} kg/m²</span>
              <Badge variant={bmiInfo.variant as any} size="sm">
                {bmiInfo.category}
              </Badge>
            </div>
          )}
        </div>

        {/* Section 3: Metabolic & Clinical Allergies */}
        <div className="space-y-3 border-t border-border/60 pt-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-text-muted">Metabolic & Safety Flags</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-text mb-1">Blood Sugar (mg/dL)</label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="110"
                  value={bloodSugar}
                  onChange={(e) => setBloodSugar(e.target.value)}
                />
                <select
                  value={bloodSugarType}
                  onChange={(e) => setBloodSugarType(e.target.value as any)}
                  className="rounded-xl border border-border bg-surface text-text text-xs px-2.5 py-1.5 focus:outline-hidden focus:ring-2 focus:ring-primary-500"
                >
                  <option value="random">Random (RBS)</option>
                  <option value="fasting">Fasting (FBS)</option>
                  <option value="post_prandial">Post-Prandial (PPBS)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-text mb-1">Known Drug Allergies</label>
              <Input
                placeholder="e.g. Penicillin, Sulfa, Aspirin"
                value={allergiesInput}
                onChange={(e) => setAllergiesInput(e.target.value)}
              />
              <span className="text-[10px] text-text-muted mt-0.5 block">Separate multiple allergies with commas</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-text mb-1">Nursing Triage Notes</label>
            <Input
              placeholder="e.g. Patient feels lightheaded; seated comfortably in triage bay 1"
              value={triageNotes}
              onChange={(e) => setTriageNotes(e.target.value)}
            />
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex justify-end gap-2.5 pt-3 border-t border-border">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm" loading={submitting} className="font-bold">
            <Stethoscope className="w-3.5 h-3.5 mr-1" />
            Save Triage Vitals
          </Button>
        </div>
      </form>
    </Modal>
  );
}
