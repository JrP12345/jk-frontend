"use client";

import React, { useState } from "react";
import { Modal, Button, Badge } from "@/components/ui";

export interface ImagingStudyItem {
  id: string;
  studyInstanceUid: string;
  patientId: {
    id: string;
    userId?: { name: string; phone?: string };
  };
  clinicId?: { id: string; name: string };
  modality: "CR" | "DX" | "CT" | "MR" | "US" | "MG";
  studyDescription: string;
  dicomWebUrl?: string;
  radiologyReport?: string;
  radiologistId?: { name: string; specialization?: string };
  status: "requested" | "in_progress" | "completed" | "reported" | "cancelled";
  createdAt?: string;
}

interface DICOMViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  study: ImagingStudyItem | null;
}

export function DICOMViewerModal({ isOpen, onClose, study }: DICOMViewerModalProps) {
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [rotationAngle, setRotationAngle] = useState<number>(0);
  const [isInverted, setIsInverted] = useState<boolean>(false);
  const [selectedPreset, setSelectedPreset] = useState<string>("soft_tissue");

  if (!study) return null;

  const handleZoomIn = () => setZoomLevel((prev) => Math.min(250, prev + 25));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(50, prev - 25));
  const handleRotate = () => setRotationAngle((prev) => (prev + 90) % 360);
  const handleToggleInvert = () => setIsInverted((prev) => !prev);
  const handleReset = () => {
    setZoomLevel(100);
    setRotationAngle(0);
    setIsInverted(false);
    setSelectedPreset("soft_tissue");
  };

  const patientName = study.patientId?.userId?.name || "Patient";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`PACS DICOM Viewer — ${study.modality}`} size="xl">
      <div className="space-y-4 text-xs">
        {/* DICOM Header Metadata Bar */}
        <div className="p-3 bg-surface-alt rounded-2xl border border-border flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="font-bold text-text text-sm block">{study.studyDescription}</span>
            <div className="flex items-center gap-3 text-[11px] text-text-muted mt-0.5">
              <span>Patient: <b className="text-text">{patientName}</b></span>
              <span>Modality: <b className="font-mono text-primary-600 font-bold">{study.modality}</b></span>
              <span>UID: <b className="font-mono text-text truncate max-w-[140px] inline-block align-bottom">{study.studyInstanceUid}</b></span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge
              variant={
                study.status === "reported"
                  ? "success"
                  : study.status === "in_progress"
                  ? "warning"
                  : "neutral"
              }
              className="capitalize font-bold"
            >
              {study.status}
            </Badge>

            {study.dicomWebUrl && (
              <a
                href={study.dicomWebUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-bold transition-all"
              >
                <span>ðŸŒ WADO PACS</span>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            )}
          </div>
        </div>

        {/* Viewport Control Bar */}
        <div className="flex items-center justify-between flex-wrap gap-2 p-2.5 bg-surface border border-border/80 rounded-xl">
          {/* Window Level Presets */}
          <div className="flex items-center gap-1 text-[11px]">
            <span className="font-bold text-text-muted mr-1">Presets:</span>
            {[
              { id: "soft_tissue", label: "Soft Tissue" },
              { id: "lung", label: "Lung Window" },
              { id: "bone", label: "Bone Window" },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedPreset(p.id)}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                  selectedPreset === p.id
                    ? "bg-primary-500/10 text-primary-600 font-bold border border-primary-500/30"
                    : "bg-surface-alt text-text-muted hover:text-text"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Canvas Tools */}
          <div className="flex items-center gap-1.5">
            <Button size="xs" variant="outline" onClick={handleZoomOut} className="px-2 font-bold" title="Zoom Out">
              -
            </Button>
            <span className="font-mono font-bold text-text text-[11px] px-1">{zoomLevel}%</span>
            <Button size="xs" variant="outline" onClick={handleZoomIn} className="px-2 font-bold" title="Zoom In">
              +
            </Button>

            <Button
              size="xs"
              variant="outline"
              onClick={handleRotate}
              className="font-semibold text-[11px]"
              title="Rotate 90 Deg"
            >
              ðŸ”„ {rotationAngle}Â°
            </Button>

            <Button
              size="xs"
              variant={isInverted ? "primary" : "outline"}
              onClick={handleToggleInvert}
              className="font-semibold text-[11px]"
              title="Invert Grayscale"
            >
              â˜¯ Invert
            </Button>

            <Button size="xs" variant="outline" onClick={handleReset} className="font-semibold text-[11px]">
              Reset
            </Button>
          </div>
        </div>

        {/* Viewport DICOM Canvas Frame */}
        <div className="relative w-full h-80 bg-black rounded-2xl overflow-hidden flex items-center justify-center border border-border/80 shadow-inner group">
          <div className="absolute inset-0 z-20 flex items-center justify-center p-6 text-center">
            <div className="space-y-2 max-w-md">
              <p className="font-bold text-amber-300">DICOM image unavailable in this viewer</p>
              <p className="text-xs text-slate-300">The study metadata is available, but no rendered clinical image has been loaded. Use the configured PACS link to open the real study.</p>
            </div>
          </div>

        </div>

        {/* Radiology Report Card if available */}
        {study.radiologyReport && (
          <div className="p-3.5 bg-emerald-500/5 border border-emerald-500/30 rounded-2xl space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-emerald-700 dark:text-emerald-400 text-xs">
                ðŸ“ Signed Radiology Clinical Report
              </span>
              {study.radiologistId?.name && (
                <span className="text-[11px] text-text-muted">
                  Radiologist: <b>{study.radiologistId.name}</b>
                </span>
              )}
            </div>
            <p className="text-text text-xs leading-relaxed whitespace-pre-wrap font-sans pl-1 border-l-2 border-emerald-500">
              {study.radiologyReport}
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}


