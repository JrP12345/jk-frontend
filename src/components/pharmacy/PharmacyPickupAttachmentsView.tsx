"use client";

import { useEffect, useState } from "react";
import { Download, Eye, FileText } from "lucide-react";
import { Button, Modal, Spinner } from "@/components/ui";
import type { PickupAttachment } from "@/lib/publicPharmacy";

type PreviewEntry = { url?: string; error?: string };

export function PharmacyPickupAttachmentsView({
  attachments,
  fetchBlob,
  compact = false,
}: {
  attachments: PickupAttachment[];
  fetchBlob: (attachmentId: string, download: boolean, signal?: AbortSignal) => Promise<Blob>;
  compact?: boolean;
}) {
  const [previews, setPreviews] = useState<Record<string, PreviewEntry>>({});
  const [zoomed, setZoomed] = useState<PickupAttachment | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const imageListKey = attachments.map(att => `${att.id}:${att.contentType}`).join(",");

  useEffect(() => {
    const controller = new AbortController();
    const createdUrls: string[] = [];
    const imageItems = attachments.filter(att => att.contentType.startsWith("image/"));
    if (!imageItems.length) return () => controller.abort();

    void Promise.all(
      imageItems.map(async att => {
        try {
          const blob = await fetchBlob(att.id, false, controller.signal);
          if (controller.signal.aborted) return;
          const url = URL.createObjectURL(blob);
          createdUrls.push(url);
          setPreviews(prev => ({ ...prev, [att.id]: { url } }));
        } catch (err) {
          if (controller.signal.aborted) return;
          setPreviews(prev => ({ ...prev, [att.id]: { error: err instanceof Error ? err.message : "Preview unavailable" } }));
        }
      })
    );

    return () => {
      controller.abort();
      for (const url of createdUrls) URL.revokeObjectURL(url);
    };
  }, [imageListKey]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleDownload(att: PickupAttachment) {
    setDownloadingId(att.id);
    try {
      const blob = await fetchBlob(att.id, true);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = att.name || "pickup-attachment";
      document.body.appendChild(link);
      try { link.click(); } finally {
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
      }
    } finally {
      setDownloadingId(null);
    }
  }

  if (!attachments.length) return null;

  return (
    <div className="space-y-2">
      <div className={compact ? "grid grid-cols-2 gap-2 sm:grid-cols-4" : "grid grid-cols-2 gap-2.5 sm:grid-cols-3"}>
        {attachments.map(att => {
          const isImage = att.contentType.startsWith("image/");
          const entry = previews[att.id];
          return (
            <div
              key={att.id}
              className="group relative flex flex-col overflow-hidden rounded-lg border border-border/70 bg-surface-alt/40"
            >
              {isImage ? (
                <button
                  type="button"
                  onClick={() => setZoomed(att)}
                  className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-ring"
                  aria-label={`View image ${att.name}`}
                >
                  {entry?.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={entry.url}
                      alt={att.name}
                      className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                    />
                  ) : entry?.error ? (
                    <span className="px-2 text-center text-[11px] text-text-secondary">Preview unavailable</span>
                  ) : (
                    <Spinner size="sm" />
                  )}
                  <span className="absolute right-1.5 bottom-1.5 inline-flex items-center gap-1 rounded-md bg-black/65 px-1.5 py-0.5 text-[10px] font-medium text-white">
                    <Eye size={11} aria-hidden="true" /> View
                  </span>
                </button>
              ) : (
                <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-1 bg-surface-alt px-2 text-center">
                  <FileText size={22} className="text-text-secondary" aria-hidden="true" />
                  <span className="text-[11px] font-medium text-text">PDF</span>
                </div>
              )}
              <div className="flex items-center justify-between gap-1.5 border-t border-border/60 bg-surface px-2 py-1.5">
                <span className="min-w-0 truncate text-[11px] text-text" title={att.name}>
                  {att.name}
                </span>
                <Button
                  size="xs"
                  variant="ghost"
                  className="shrink-0"
                  aria-label={`Download ${att.name}`}
                  loading={downloadingId === att.id}
                  onClick={() => { void handleDownload(att); }}
                >
                  <Download size={13} aria-hidden="true" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {zoomed && (
        <Modal
          open
          size="lg"
          title={zoomed.name}
          description={`${Math.max(1, Math.round(zoomed.size / 1024))} KB`}
          onClose={() => setZoomed(null)}
          footer={
            <div className="flex w-full justify-end gap-2">
              <Button
                size="sm"
                variant="outline"
                loading={downloadingId === zoomed.id}
                onClick={() => { void handleDownload(zoomed); }}
                icon={<Download size={14} aria-hidden="true" />}
              >
                Download
              </Button>
            </div>
          }
        >
          <div className="flex min-h-[220px] items-center justify-center rounded-lg bg-surface-alt/50 p-2">
            {previews[zoomed.id]?.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previews[zoomed.id].url}
                alt={zoomed.name}
                className="max-h-[72dvh] w-auto max-w-full rounded object-contain"
              />
            ) : previews[zoomed.id]?.error ? (
              <p className="text-xs text-error-text">{previews[zoomed.id].error}</p>
            ) : (
              <div role="status" className="flex items-center gap-2 text-xs text-text-secondary">
                <Spinner size="sm" />
                <span>Loading full image...</span>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
