"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "./utils";

export interface ImageUploadProps {
  label?: string;
  value?: File | string | null;
  onChange: (value: File | string | null) => void;
  className?: string;
  uploading?: boolean;
  progress?: number;
  accept?: string;
  allowedTypes?: string[];
  helperText?: string;
  error?: string;
  disabled?: boolean;
}

export default function ImageUpload({
  label,
  value,
  onChange,
  className,
  uploading: externalUploading,
  progress: externalProgress,
  accept = "image/png, image/jpeg, image/webp",
  allowedTypes = ["image/"],
  helperText = "PNG, JPG, or WEBP (max. 5MB)",
  error,
  disabled = false,
}: ImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [simulatedProgress, setSimulatedProgress] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  useEffect(() => {
    if (value instanceof File) {
      const url = URL.createObjectURL(value);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else if (typeof value === "string" && value) {
      setPreviewUrl(value);
    } else {
      setPreviewUrl(null);
    }
  }, [value]);

  const isPdf =
    (typeof value === "string" && value.toLowerCase().endsWith(".pdf")) ||
    (value instanceof File && value.type === "application/pdf");

  const startSimulatedUpload = (file: File) => {
    if (disabled) return;
    setIsUploading(true);
    setSimulatedProgress(0);

    let currentProgress = 0;
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      currentProgress += Math.floor(Math.random() * 15) + 5;
      if (currentProgress >= 100) {
        currentProgress = 100;
        if (intervalRef.current) clearInterval(intervalRef.current);
        setTimeout(() => {
          setIsUploading(false);
          setSimulatedProgress(null);
          onChange(file);
        }, 200);
      }
      setSimulatedProgress(currentProgress);
    }, 80);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      startSimulatedUpload(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isUploading && !externalUploading && !disabled) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (isUploading || externalUploading || disabled) return;

    const file = e.dataTransfer.files?.[0];
    if (file) {
      const isAllowed = allowedTypes.some((type) => {
        if (type.endsWith("/")) {
          return file.type.startsWith(type);
        }
        return file.type === type;
      });
      if (isAllowed) {
        startSimulatedUpload(file);
      }
    }
  };

  const removeImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    onChange(null);
    setPreviewUrl(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (!currentUploading && !disabled) {
        fileInputRef.current?.click();
      }
    }
  };

  const currentUploading = externalUploading ?? isUploading;
  const currentProgress = externalProgress ?? simulatedProgress;

  return (
    <div className={cn("flex flex-col gap-1.5 w-full", className)}>
      {label && <label className="text-sm font-medium text-text select-none">{label}</label>}

      <div
        role="button"
        tabIndex={disabled || currentUploading ? -1 : 0}
        onKeyDown={handleKeyDown}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !currentUploading && !disabled && fileInputRef.current?.click()}
        className={cn(
          "relative min-h-[140px] w-full rounded-2xl border-2 border-dashed flex flex-col items-center justify-center p-6 text-center cursor-pointer transform-gpu transition-all duration-200 ease-smooth focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
          isDragging
            ? "border-primary-500 bg-primary-500/10 scale-[1.01]"
            : error
            ? "border-danger-500 bg-danger-500/5"
            : "border-border bg-surface hover:bg-surface-hover hover:border-primary-500/50",
          (currentUploading || disabled) && "pointer-events-none opacity-60 cursor-not-allowed"
        )}
      >
        {currentUploading ? (
          <div className="flex flex-col items-center w-full max-w-[200px] gap-3">
            <svg className="h-8 w-8 animate-spin text-primary-500 shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-20" />
              <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-80" />
            </svg>
            <div className="w-full bg-border rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-primary-500 h-full rounded-full transition-all duration-200 ease-smooth"
                style={{ width: `${currentProgress ?? 0}%` }}
              />
            </div>
            <span className="text-xs text-text-muted font-medium">
              Uploading... {currentProgress ?? 0}%
            </span>
          </div>
        ) : previewUrl ? (
          <div className="relative w-full h-32 rounded-xl overflow-hidden group shadow-xs flex items-center justify-center bg-surface-alt">
            {isPdf ? (
              <div className="flex flex-col items-center justify-center p-4">
                <svg className="w-10 h-10 text-danger-500 mb-1" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                  <path
                    fillRule="evenodd"
                    d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="text-xs font-semibold text-text max-w-[180px] truncate">
                  {value instanceof File ? value.name : value.split("/").pop() || "Report PDF"}
                </span>
              </div>
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={previewUrl} alt="Preview" className="w-full h-full object-cover animate-scale-in" />
            )}

            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-3">
              <button
                type="button"
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all transform-gpu scale-95 group-hover:scale-100 active:scale-90 duration-150 cursor-pointer"
                aria-label="Change file"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                  />
                </svg>
              </button>

              <button
                type="button"
                onClick={removeImage}
                className="p-2 rounded-full bg-danger-500/80 hover:bg-danger-500 text-white transition-all transform-gpu scale-95 group-hover:scale-100 active:scale-90 duration-150 cursor-pointer"
                aria-label="Remove file"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="bg-primary-500/10 p-3 rounded-2xl mb-1 text-primary-500 transition-transform duration-200 group-hover:scale-110">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
            <div>
              <span className="text-sm text-primary-600 dark:text-primary-400 font-semibold hover:underline">
                Click to upload
              </span>{" "}
              <span className="text-sm text-text-secondary">or drag and drop</span>
            </div>
            <span className="text-xs text-text-muted">{helperText}</span>
          </div>
        )}
      </div>

      {error && <p className="text-xs font-medium text-danger-500 animate-fade-in">{error}</p>}

      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        disabled={disabled}
        className="hidden"
      />
    </div>
  );
}


