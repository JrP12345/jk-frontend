"use client";

import LoadingImage from "@/components/ui/LoadingImage";
import { useEffect, useState } from "react";
import api from "@/lib/api";
import { externalServiceUrl } from "@/lib/externalServiceUrl";
import { Modal, Button, Badge, Alert } from "@/components/ui";

export interface ImagingStudyItem {
  id: string;
  studyInstanceUid: string;
  patientId: { id: string; userId?: { name: string; phone?: string } };
  clinicId?: { id: string; name: string };
  modality: "CR" | "DX" | "CT" | "MR" | "US" | "MG";
  studyDescription: string;
  dicomWebUrl?: string;
  radiologyReport?: string;
  radiologistId?: { name: string; specialization?: string };
  status: "requested" | "in_progress" | "completed" | "reported" | "cancelled";
  createdAt?: string;
}
interface DicomInstance { seriesUid: string; instanceUid: string; frames: number; number: number; }
interface DICOMViewerModalProps { isOpen: boolean; onClose: () => void; study: ImagingStudyItem | null; }

export function DICOMViewerModal({ isOpen, onClose, study }: DICOMViewerModalProps) {
  const [manifest, setManifest] = useState<{ studyId: string; instances: DicomInstance[]; limited: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [instanceIndex, setInstanceIndex] = useState(0);
  const [frame, setFrame] = useState(1);
  const [loadedImage, setLoadedImage] = useState<{ key: string; url: string } | null>(null);
  const [imageError, setImageError] = useState(false);
  const [imageRetry, setImageRetry] = useState(0);
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [inverted, setInverted] = useState(false);
  const studyId = study?.id;
  const currentManifest = manifest?.studyId === studyId ? manifest : null;
  const instance = currentManifest?.instances[instanceIndex];
  const imageKey = `${studyId}-${instance?.instanceUid}-${frame}`;
  const image = loadedImage?.key === imageKey ? loadedImage.url : null;

  useEffect(() => {
    if (!isOpen || !studyId) return;
    const controller = new AbortController();
    setLoading(true); setError(false); setManifest(null);
    setInstanceIndex(0); setFrame(1); setZoom(100); setRotation(0); setInverted(false);
    api.get(`/radiology/studies/${studyId}/preview`, { signal: controller.signal })
      .then(response => {
        if (controller.signal.aborted) return;
        const data = response.data?.data;
        if (!Array.isArray(data?.instances)) throw new Error("Invalid preview metadata");
        setManifest({ studyId, instances: data.instances, limited: Boolean(data.limited) });
      }).catch(() => { if (!controller.signal.aborted) setError(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [isOpen, studyId, retry]);

  useEffect(() => {
    setLoadedImage(null); setImageError(false);
    if (!isOpen || !studyId || !instance) return;
    const controller = new AbortController();
    let objectUrl: string | null = null;
    const query = new URLSearchParams({ seriesUid: instance.seriesUid, instanceUid: instance.instanceUid, frame: String(frame) });
    api.get(`/radiology/studies/${studyId}/preview?${query}`, { signal: controller.signal, responseType: "blob" })
      .then(response => {
        if (controller.signal.aborted) return;
        if (!(response.data instanceof Blob) || response.data.type !== "image/png") throw new Error("Unsupported preview");
        objectUrl = URL.createObjectURL(response.data);
        setLoadedImage({ key: imageKey, url: objectUrl });
      }).catch(() => { if (!controller.signal.aborted) setImageError(true); });
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [isOpen, studyId, instance, frame, imageRetry, imageKey]);

  if (!study) return null;
  const pacsUrl = externalServiceUrl(study.dicomWebUrl);
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Imaging study — ${study.modality}`} size="xl">
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border bg-surface-alt p-3">
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-text break-words">{study.studyDescription}</h2>
            <p className="text-sm text-text-secondary">Patient: {study.patientId?.userId?.name || "Patient"}</p>
            <p className="text-xs text-text-muted break-all">Study UID: {study.studyInstanceUid}</p>
          </div>
          <Badge variant={study.status === "reported" ? "success" : "neutral"}>{study.status}</Badge>
          {pacsUrl && <a href={pacsUrl} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" className="text-accent underline min-h-11 inline-flex items-center text-sm">Open PACS</a>}
        </div>
        {loading ? <p role="status">Loading study images...</p> : error ? (
          <Alert title="Study images unavailable" action={<Button variant="outline" onClick={() => setRetry(value => value + 1)}>Retry images</Button>}>
            Images could not be loaded. Your clinic can check whether this study has been received by its imaging service.
          </Alert>
        ) : currentManifest && currentManifest.instances.length === 0 ? <Alert title="No images received">This study has no image instances available yet.</Alert> : instance ? <>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-0 flex-1">
              <label htmlFor="dicom-instance" className="block text-sm font-medium mb-1">Image instance</label>
              <select id="dicom-instance" value={instanceIndex} onChange={event => { setInstanceIndex(Number(event.target.value)); setFrame(1); }} className="w-full min-h-11 rounded-xl border border-border bg-surface px-3 text-sm">
                {currentManifest?.instances.map((item, index) => <option key={`${item.seriesUid}-${item.instanceUid}`} value={index}>Image {index + 1}{item.number ? ` · Instance ${item.number}` : ""}</option>)}
              </select>
            </div>
            <Button variant="outline" disabled={frame <= 1} onClick={() => setFrame(value => value - 1)}>Previous frame</Button>
            <span className="text-sm py-3">Frame {frame} of {instance.frames}</span>
            <Button variant="outline" disabled={frame >= instance.frames} onClick={() => setFrame(value => value + 1)}>Next frame</Button>
          </div>
          {currentManifest?.limited && <Alert>Showing the first 500 instances. Open PACS to review the complete study.</Alert>}
          <div className="relative h-72 sm:h-96 rounded-xl bg-black overflow-auto flex items-center justify-center">
            {imageError ? <div className="p-5 text-white text-center space-y-3"><p>This image could not be loaded.</p><Button onClick={() => setImageRetry(value => value + 1)}>Retry frame</Button></div> : image ? (
              <LoadingImage src={image} alt={`Study preview, image ${instanceIndex + 1}, frame ${frame}`} onError={() => setImageError(true)} className="max-w-full max-h-full object-contain" style={{ transform: `rotate(${rotation}deg) scale(${zoom / 100})`, filter: inverted ? "invert(1)" : undefined }} />
            ) : <p role="status" className="text-white">Loading frame...</p>}
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <Button variant="outline" disabled={!image || zoom <= 50} onClick={() => setZoom(value => value - 25)}>Zoom out</Button>
            <span className="text-sm">{zoom}%</span>
            <Button variant="outline" disabled={!image || zoom >= 250} onClick={() => setZoom(value => value + 25)}>Zoom in</Button>
            <Button variant="outline" disabled={!image} onClick={() => setRotation(value => (value + 90) % 360)}>Rotate</Button>
            <Button variant="outline" disabled={!image} aria-pressed={inverted} onClick={() => setInverted(value => !value)}>Invert</Button>
            <Button variant="outline" onClick={() => { setZoom(100); setRotation(0); setInverted(false); }}>Reset view</Button>
          </div>
          <p className="text-xs text-text-muted">Rendered image preview. Display adjustments do not change the study. Use the clinical PACS viewer for diagnostic interpretation and window-level controls.</p>
        </> : null}
        {study.radiologyReport && <section className="rounded-xl border border-border p-4 space-y-2">
          <h2 className="font-semibold text-text">Radiology report</h2>
          {study.radiologistId?.name && <p className="text-sm text-text-muted">Radiologist: {study.radiologistId.name}</p>}
          <p className="text-sm text-text whitespace-pre-wrap">{study.radiologyReport}</p>
        </section>}
      </div>
    </Modal>
  );
}
