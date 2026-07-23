"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { Modal, Badge, Spinner, EmptyState } from "@/components/ui";

export interface SearchResultItem {
  id: string;
  category: string;
  resourceType: "ClinicalNote" | "Observation" | "MedicationAdministration" | "LabOrder" | "DischargeDocument";
  title: string;
  snippet: string;
  score: number;
  occurredAt: string;
  resourceRef: {
    resourceId: string;
    link: string;
  };
}

interface PatientSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientId?: string; // Optional patient ID filter for patient-specific search
}

export function PatientSearchModal({ isOpen, onClose, patientId }: PatientSearchModalProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const router = useRouter();

  // Execute debounced clinical search API call
  const performSearch = useCallback(async (searchTerm: string, cat: string) => {
    if (!searchTerm.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      // If patientId is provided, search specific patient; otherwise fallback to query
      const url = patientId
        ? `/patients/${patientId}/search?q=${encodeURIComponent(searchTerm)}&category=${cat}`
        : `/patients/search?q=${encodeURIComponent(searchTerm)}&category=${cat}`;
      const res = await api.get(url);
      const items = res.data?.data?.items || res.data?.items || [];
      setResults(items);
      setSelectedIndex(0);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (isOpen && query) {
        performSearch(query, category);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query, category, isOpen, performSearch]);

  // Keyboard navigation inside search modal
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (results.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results[selectedIndex]) {
        handleSelectResult(results[selectedIndex]);
      }
    }
  };

  const handleSelectResult = (item: SearchResultItem) => {
    onClose();
    if (item.resourceRef?.link) {
      router.push(item.resourceRef.link);
    }
  };

  const getResourceTypeBadge = (type: string) => {
    switch (type) {
      case "ClinicalNote":
        return <Badge variant="primary">Clinical Note</Badge>;
      case "MedicationAdministration":
        return <Badge variant="warning">MAR</Badge>;
      case "LabOrder":
        return <Badge variant="info">Lab Order</Badge>;
      case "DischargeDocument":
        return <Badge variant="success">Discharge</Badge>;
      case "Observation":
      default:
        return <Badge variant="neutral">Vital</Badge>;
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Clinical Record Search (Cmd+K)" size="lg">
      <div className="space-y-4" onKeyDown={handleKeyDown}>
        {/* Search input bar */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search notes, medications, lab orders, or diagnoses..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full px-4 py-2.5 bg-surface-hover border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 text-text"
            autoFocus
          />
          {loading && (
            <div className="absolute right-3 top-3">
              <Spinner size="sm" />
            </div>
          )}
        </div>

        {/* Category filter pills */}
        <div className="flex gap-2 text-xs">
          {["all", "notes", "medication", "lab", "discharge"].map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`px-3 py-1 rounded-full capitalize font-medium transition-colors ${
                category === cat
                  ? "bg-primary-600 text-white"
                  : "bg-surface-hover text-text-secondary hover:text-text"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search Results List */}
        <div className="max-h-96 overflow-y-auto space-y-2 pt-2">
          {results.length > 0 ? (
            results.map((item, idx) => (
              <div
                key={item.id}
                onClick={() => handleSelectResult(item)}
                className={`p-3 rounded-xl border transition-all cursor-pointer ${
                  selectedIndex === idx
                    ? "bg-primary-50 dark:bg-primary-900/20 border-primary-500 shadow-sm"
                    : "bg-surface border-border hover:bg-surface-hover"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    {getResourceTypeBadge(item.resourceType)}
                    <span className="font-semibold text-sm text-text">{item.title}</span>
                  </div>
                  <span className="text-xs text-text-muted">
                    {new Date(item.occurredAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-xs text-text-secondary line-clamp-2">{item.snippet}</p>
              </div>
            ))
          ) : query ? (
            !loading && <EmptyState title="No clinical records found" description={`No search results matching "${query}"`} />
          ) : (
            <div className="text-center py-6 text-xs text-text-muted">
              Type keywords such as &quot;amoxicillin&quot;, &quot;bronchitis&quot;, or &quot;SPO2&quot; to search.
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
