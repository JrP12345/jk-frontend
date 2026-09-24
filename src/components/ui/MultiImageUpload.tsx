"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "./utils";
import { Plus, X, Image as ImageIcon, Sparkles } from "lucide-react";

export interface MultiImageUploadProps {
  label?: string;
  helperText?: string;
  values: (File | string)[];
  onChange: (values: (File | string)[]) => void;
  maxImages?: number;
  accept?: string;
  allowedTypes?: string[];
  className?: string;
  disabled?: boolean;
  error?: string;
}

export default function MultiImageUpload({
  label,
  helperText = "Add up to 8 photos (PNG, JPG, WEBP)",
  values = [],
  onChange,
  maxImages = 8,
  accept = "image/png, image/jpeg, image/webp",
  allowedTypes = ["image/"],
  className,
  disabled = false,
  error,
}: MultiImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [previews, setPreviews] = useState<{ id: string; url: string; original: File | string }[]>([]);

  useEffect(() => {
    const activeUrls: string[] = [];
    const newPreviews = values.map((val, idx) => {
      if (val instanceof File) {
        const objectUrl = URL.createObjectURL(val);
        activeUrls.push(objectUrl);
        return { id: `file-${idx}-${val.name}`, url: objectUrl, original: val };
      } else {
        return { id: `url-${idx}-${val}`, url: val, original: val };
      }
    });

    setPreviews(newPreviews);

    return () => {
      activeUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [values]);

  const handleFiles = (files: FileList | null) => {
    if (!files || disabled) return;
    const incoming: File[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const isAllowed = allowedTypes.some((type) => {
        if (type.endsWith("/")) return file.type.startsWith(type);
        return file.type === type;
      });
      if (isAllowed) {
        incoming.push(file);
      }
    }

    const availableSlots = maxImages - values.length;
    if (availableSlots <= 0) return;

    const accepted = incoming.slice(0, availableSlots);
    if (accepted.length > 0) {
      onChange([...values, ...accepted]);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleRemove = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    const updated = [...values];
    updated.splice(index, 1);
    onChange(updated);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && values.length < maxImages) {
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
    if (disabled || values.length >= maxImages) return;
    handleFiles(e.dataTransfer.files);
  };

  const canAddMore = values.length < maxImages && !disabled;

  return (
    <div className={cn("flex flex-col gap-2 w-full", className)}>
      <div className="flex items-center justify-between">
        {label && <label className="text-sm font-semibold text-text select-none">{label}</label>}
        <span className="text-xs text-text-muted font-medium">
          {values.length} / {maxImages} uploaded
        </span>
      </div>

      {helperText && <p className="text-xs text-text-muted">{helperText}</p>}

      {/* Grid of uploaded images + Add Button */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 gap-3 p-3 rounded-2xl border transition-all duration-200",
          isDragging
            ? "border-primary-500 bg-primary-500/10 ring-2 ring-primary-500/30"
            : error
            ? "border-danger-500/60 bg-danger-500/5"
            : "border-border/80 bg-surface-alt/40 hover:border-border"
        )}
      >
        {previews.map((item, index) => (
          <div
            key={item.id}
            className="group relative aspect-4/3 rounded-xl overflow-hidden border border-border/80 bg-surface shadow-xs transition-all hover:shadow-md"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.url}
              alt={`Facility photo ${index + 1}`}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />

            {/* Badge for Cover/Primary on first image */}
            {index === 0 && (
              <span className="absolute top-1.5 left-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary-600 text-white shadow-xs backdrop-blur-xs">
                <Sparkles className="w-2.5 h-2.5" />
                Featured
              </span>
            )}

            {/* Hover Actions */}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={(e) => handleRemove(index, e)}
                disabled={disabled}
                className="p-1.5 rounded-full bg-danger-500 text-white shadow-md hover:bg-danger-600 active:scale-95 transition-transform cursor-pointer"
                title="Remove photo"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}

        {/* Add More Tile */}
        {canAddMore && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "aspect-4/3 rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center p-3 text-center cursor-pointer transition-all duration-200",
              "hover:border-primary-500/70 hover:bg-primary-500/5 active:scale-98 group bg-surface/50"
            )}
          >
            <div className="w-8 h-8 rounded-full bg-primary-500/10 text-primary-600 dark:text-primary-400 flex items-center justify-center mb-1 group-hover:scale-110 transition-transform">
              <Plus className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold text-text group-hover:text-primary-600 transition-colors">
              Add Photo
            </span>
            <span className="text-[10px] text-text-muted mt-0.5">Click or drop</span>
          </button>
        )}

        {values.length === 0 && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => fileInputRef.current?.click()}
            className="col-span-full py-8 flex flex-col items-center justify-center text-center rounded-xl cursor-pointer hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="w-12 h-12 rounded-2xl bg-primary-500/10 text-primary-500 flex items-center justify-center mb-2">
              <ImageIcon className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-text">No facility photos added yet</p>
            <p className="text-xs text-text-muted mt-1 max-w-xs">
              Upload photos of your hospital/clinic reception, consultation rooms, operation theaters, and labs.
            </p>
          </button>
        )}
      </div>

      {error && <p className="text-xs font-medium text-danger-500">{error}</p>}

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={accept}
        onChange={handleInputChange}
        disabled={disabled}
        className="hidden"
      />
    </div>
  );
}
