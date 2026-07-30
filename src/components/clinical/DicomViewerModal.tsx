"use client";

import React, { useState } from "react";
import { Modal, Button, Badge, Textarea } from "@/components/ui";
import api from "@/lib/api";

interface DicomStudy {
  id: string;
  studyInstanceUid: string;
  modality: string;
  studyDescription: string;
  dicomWebUrl?: string;
  radiologyReport?: string;
  status: string;
  patientId?: {
    userId?: { name: string; phone: string };
  };
  radiologistId?: {
    name: string;
  };
}

interface DicomModalProps {
  open: boolean;
  onClose: () => void;
  study: DicomStudy | null;
  onReportSigned?: () => void;
}

export function DicomViewerModal({ open, onClose, study, onReportSigned }: DicomModalProps) {
  const [reportText, setReportText] = useState(study?.radiologyReport || "");
  const [signing, setSigning] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);

  if (!study) return null;

  const handleSignReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportText.trim()) return;

    setSigning(true);
    try {
      await api.put(`/radiology/studies/${study.id}/report`, {
        radiologyReport: reportText,
      });
      if (onReportSigned) onReportSigned();
      onClose();
    } catch {
      // Handled by parent or toast
    } finally {
      setSigning(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`PACS DICOM Viewer • ${study.modality}: ${study.studyDescription}`} size="xl">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* DICOM Image Viewport */}
        <div className="lg:col-span-2 bg-black rounded-2xl border border-zinc-800 p-4 flex flex-col items-center justify-between min-h-[420px] relative overflow-hidden">
          {/* Controls Overlay */}
          <div className="w-full flex justify-between items-center text-xs text-zinc-400 border-b border-zinc-800 pb-2">
            <span>UID: {study.studyInstanceUid.slice(0, 24)}...</span>
            <div className="flex gap-2">
              <button onClick={() => setZoomLevel((z) => Math.min(z + 20, 200))} className="px-2 py-0.5 bg-zinc-800 rounded font-bold hover:text-white cursor-pointer">+</button>
              <button onClick={() => setZoomLevel((z) => Math.max(z - 20, 60))} className="px-2 py-0.5 bg-zinc-800 rounded font-bold hover:text-white cursor-pointer">-</button>
              <button onClick={() => { setZoomLevel(100); setBrightness(100); setContrast(100); }} className="px-2 py-0.5 bg-zinc-800 rounded font-bold hover:text-white cursor-pointer">Reset</button>
            </div>
          </div>

          {/* Simulated DICOM Radiography Canvas / Viewport */}
          <div className="my-auto flex flex-col items-center justify-center p-6 text-center transition-all" style={{ transform: `scale(${zoomLevel / 100})`, filter: `brightness(${brightness}%) contrast(${contrast}%)` }}>
            <div className="w-48 h-48 rounded-full border-4 border-dashed border-zinc-700 flex items-center justify-center text-zinc-600 font-mono text-4xl shadow-2xl bg-zinc-950">
              {study.modality}
            </div>
            <p className="text-xs text-zinc-500 mt-4 font-mono">DICOM WADO-RS Rendering Engine Active</p>
          </div>

          {/* Windowing Sliders */}
          <div className="w-full flex justify-around items-center text-[10px] text-zinc-400 border-t border-zinc-800 pt-2">
            <label className="flex items-center gap-1.5">
              <span>Window Brightness:</span>
              <input type="range" min="50" max="150" value={brightness} onChange={(e) => setBrightness(Number(e.target.value))} className="w-20 accent-primary" />
            </label>
            <label className="flex items-center gap-1.5">
              <span>Contrast Window:</span>
              <input type="range" min="50" max="150" value={contrast} onChange={(e) => setContrast(Number(e.target.value))} className="w-20 accent-primary" />
            </label>
          </div>
        </div>

        {/* Radiologist Interpretation & Sign-Off Panel */}
        <div className="space-y-4 flex flex-col justify-between">
          <div className="p-3 bg-surface-alt rounded-xl border border-border text-xs space-y-1">
            <p className="font-bold text-text">Patient: {study.patientId?.userId?.name || "Patient"}</p>
            <p className="text-text-secondary">Modality: <Badge variant="info">{study.modality}</Badge></p>
            <p className="text-text-secondary">Status: <Badge variant={study.status === "reported" ? "success" : "warning"}>{study.status}</Badge></p>
            {study.radiologistId && <p className="text-text-secondary">Reported By: Dr. {study.radiologistId.name}</p>}
          </div>

          <form onSubmit={handleSignReport} className="space-y-3 flex-1 flex flex-col justify-between">
            <Textarea
              label="Radiologist Impression & Impression Notes *"
              placeholder="Describe radiological findings, bone structure integrity, lung opacity, etc..."
              rows={6}
              value={reportText}
              onChange={(e) => setReportText(e.target.value)}
              disabled={study.status === "reported"}
              required
            />

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button variant="outline" type="button" onClick={onClose}>Close</Button>
              {study.status !== "reported" && (
                <Button type="submit" loading={signing}>
                  Sign & Attach Report
                </Button>
              )}
            </div>
          </form>
        </div>
      </div>
    </Modal>
  );
}
