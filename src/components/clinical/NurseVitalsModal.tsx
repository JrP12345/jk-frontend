"use client";

import React, { useState } from "react";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import Input from "../ui/Input";
import { useToast } from "../ui/Toast";
import api from "@/lib/api";

interface NurseVitalsModalProps {
  open: boolean;
  onClose: () => void;
  patientId: string;
  patientName: string;
  encounterId?: string;
  onSaved?: () => void;
}

export function NurseVitalsModal({
  open,
  onClose,
  patientId,
  patientName,
  encounterId,
  onSaved,
}: NurseVitalsModalProps) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const [bpSystolic, setBpSystolic] = useState("");
  const [bpDiastolic, setBpDiastolic] = useState("");
  const [pulseRate, setPulseRate] = useState("");
  const [spO2, setSpO2] = useState("");
  const [temperatureF, setTemperatureF] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [heightCm, setHeightCm] = useState("");

  const handleSaveVitals = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      // Post observations / vitals payload
      const payload = {
        patientId,
        encounterId,
        vitals: {
          bp: `${bpSystolic}/${bpDiastolic}`,
          pulse: Number(pulseRate),
          spO2: Number(spO2),
          temperature: Number(temperatureF),
          ...(weightKg ? { weight: Number(weightKg) } : {}),
          ...(heightCm ? { height: Number(heightCm) } : {}),
        },
      };

      if (encounterId) {
        await api.post(`/encounters/${encounterId}/evaluate-score`, payload);
      } else {
        await api.post("/clinical-notes", {
          patientId,
          subjective: { chiefComplaint: "Pre-consultation Nursing Vitals Check" },
          objective: {
            physicalExamination: `BP: ${bpSystolic}/${bpDiastolic} mmHg, Pulse: ${pulseRate} bpm, SpO2: ${spO2}%, Temp: ${temperatureF} °F, Wt: ${weightKg} kg, Ht: ${heightCm} cm`,
          },
          status: "draft",
        });
      }

      toast({
        title: "Nursing Vitals Recorded 🩺",
        description: `Pre-check vitals logged for ${patientName}`,
        variant: "success",
      });

      if (onSaved) onSaved();
      onClose();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.response?.data?.message || "Failed to record vitals",
        variant: "error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Nursing Vitals Pre-Check — ${patientName}`} size="md">
      <form onSubmit={handleSaveVitals} className="space-y-4">
        <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100 text-xs text-blue-900">
          Record pre-consultation vital signs. These will automatically populate in the doctor's SOAP note workspace.
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-text mb-1">Blood Pressure (Systolic / Diastolic)</label>
            <div className="flex gap-2">
              <Input placeholder="Systolic (120)" value={bpSystolic} onChange={(e) => setBpSystolic(e.target.value)} required />
              <Input placeholder="Diastolic (80)" value={bpDiastolic} onChange={(e) => setBpDiastolic(e.target.value)} required />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-text mb-1">Pulse Rate (bpm)</label>
            <Input type="number" placeholder="72" value={pulseRate} onChange={(e) => setPulseRate(e.target.value)} required />
          </div>

          <div>
            <label className="block text-xs font-bold text-text mb-1">Oxygen Saturation (SpO2 %)</label>
            <Input type="number" placeholder="98" value={spO2} onChange={(e) => setSpO2(e.target.value)} required />
          </div>

          <div>
            <label className="block text-xs font-bold text-text mb-1">Body Temp (°F)</label>
            <Input placeholder="98.6" value={temperatureF} onChange={(e) => setTemperatureF(e.target.value)} required />
          </div>

          <div>
            <label className="block text-xs font-bold text-text mb-1">Weight (kg)</label>
            <Input placeholder="70" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} />
          </div>

          <div>
            <label className="block text-xs font-bold text-text mb-1">Height (cm)</label>
            <Input placeholder="170" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-border">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm" loading={submitting}>
            🩺 Save Nursing Vitals
          </Button>
        </div>
      </form>
    </Modal>
  );
}
