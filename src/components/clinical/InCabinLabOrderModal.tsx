"use client";

import { useState } from "react";
import api from "@/lib/api";
import { Modal, Button, Badge, Input, useToast, cn } from "@/components/ui";
import {
  FlaskConical,
  Plus,
  X,
  Sparkles,
  Check,
  AlertTriangle,
  Clock,
  Send,
} from "lucide-react";

interface InCabinLabOrderModalProps {
  open: boolean;
  onClose: () => void;
  appointmentId: string;
  patientName: string;
  tokenNumber?: number;
  onSuccess?: () => void;
}

const COMMON_CABIN_LAB_TESTS = [
  "Complete Blood Count (CBC)",
  "Random Blood Sugar (RBS)",
  "Standard 12-Lead ECG",
  "Lipid Profile",
  "Serum Creatinine",
  "Urine Routine",
  "Chest X-Ray PA View",
  "Liver Function Test (LFT)",
  "HbA1c Glycated Hemoglobin",
  "Serum Electrolytes",
  "Thyroid (TSH)",
];

export function InCabinLabOrderModal({
  open,
  onClose,
  appointmentId,
  patientName,
  tokenNumber,
  onSuccess,
}: InCabinLabOrderModalProps) {
  const { toast } = useToast();
  const [selectedTests, setSelectedTests] = useState<string[]>([
    "Complete Blood Count (CBC)",
  ]);
  const [customTestInput, setCustomTestInput] = useState("");
  const [clinicalNotes, setClinicalNotes] = useState("");
  const [priority, setPriority] = useState<"routine" | "urgent">("urgent");
  const [submitting, setSubmitting] = useState(false);

  const toggleTest = (testName: string) => {
    setSelectedTests((prev) =>
      prev.includes(testName)
        ? prev.filter((t) => t !== testName)
        : [...prev, testName]
    );
  };

  const handleAddCustomTest = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = customTestInput.trim();
    if (!clean) return;
    if (!selectedTests.includes(clean)) {
      setSelectedTests((prev) => [...prev, clean]);
    }
    setCustomTestInput("");
  };

  const removeTest = (testName: string) => {
    setSelectedTests((prev) => prev.filter((t) => t !== testName));
  };

  const handleSubmitOrder = async () => {
    if (selectedTests.length === 0) {
      toast({
        title: "No Tests Selected",
        description: "Please select or add at least one diagnostic test to order.",
        variant: "error",
      });
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.post(`/queue/${appointmentId}/order-investigations`, {
        testNames: selectedTests,
        notes: clinicalNotes.trim() || undefined,
        priority,
      });

      toast({
        title: "Lab Requisition Placed 🔬",
        description:
          res.data?.message ||
          `${selectedTests.length} diagnostic test(s) ordered for ${patientName}. Patient placed in Standby.`,
        variant: "success",
      });

      onClose();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      toast({
        title: "Order Failed",
        description:
          err.response?.data?.message ||
          "Could not place laboratory requisition. Please try again.",
        variant: "error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="In-Cabin Diagnostic Lab Requisition"
      description={`Order laboratory investigations for ${patientName} (Token #${tokenNumber}). Patient will be held in Standby for report review.`}
      size="lg"
    >
      <div className="space-y-4 pt-1 max-h-[75vh] overflow-y-auto pr-1">
        {/* Quick Test Chips Picker */}
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
            <FlaskConical className="w-3.5 h-3.5 text-secondary-500" />
            Select Diagnostic Investigations
          </label>
          <div className="flex flex-wrap gap-1.5">
            {COMMON_CABIN_LAB_TESTS.map((test) => {
              const isSelected = selectedTests.includes(test);
              return (
                <button
                  key={test}
                  type="button"
                  onClick={() => toggleTest(test)}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 border shadow-2xs",
                    isSelected
                      ? "bg-secondary-500/15 border-secondary-500/40 text-secondary-800 dark:text-secondary-200 font-bold ring-1 ring-secondary-500/30"
                      : "bg-surface border-border/80 text-text-secondary hover:bg-surface-hover hover:text-text"
                  )}
                >
                  {isSelected && <Check className="w-3 h-3 text-secondary-600" />}
                  <span>{test}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom Test Search / Add */}
        <form onSubmit={handleAddCustomTest} className="flex gap-2">
          <Input
            placeholder="Type other test name (e.g. Vitamin D3, Serum Ferritin, USG)..."
            value={customTestInput}
            onChange={(e) => setCustomTestInput(e.target.value)}
            className="flex-1"
          />
          <Button
            type="submit"
            variant="outline"
            size="sm"
            disabled={!customTestInput.trim()}
            className="shrink-0 font-bold rounded-xl"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Add Test
          </Button>
        </form>

        {/* Selected Tests Requisition Summary */}
        <div className="p-3 rounded-2xl bg-surface-alt border border-border/80 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-text">
              Requisition Worklist ({selectedTests.length} tests selected)
            </span>
            {selectedTests.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedTests([])}
                className="text-[11px] text-danger-600 dark:text-danger-400 hover:underline cursor-pointer"
              >
                Clear all
              </button>
            )}
          </div>
          {selectedTests.length === 0 ? (
            <p className="text-xs text-text-muted italic py-1">
              No tests selected yet. Click the chips above or add custom investigations.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {selectedTests.map((test) => (
                <span
                  key={test}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-700 dark:text-purple-300 font-bold text-xs"
                >
                  <FlaskConical className="w-3 h-3 text-purple-600" />
                  <span>{test}</span>
                  <button
                    type="button"
                    onClick={() => removeTest(test)}
                    className="p-0.5 rounded-full hover:bg-purple-500/20 text-purple-600 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Priority and Indication */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-bold text-text block mb-1">
              Order Priority
            </label>
            <div className="flex rounded-xl border border-border/80 p-1 bg-surface-alt gap-1">
              <button
                type="button"
                onClick={() => setPriority("urgent")}
                className={cn(
                  "flex-1 py-1 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer",
                  priority === "urgent"
                    ? "bg-rose-600 text-white shadow-xs"
                    : "text-text-muted hover:text-text"
                )}
              >
                🚨 Urgent / STAT
              </button>
              <button
                type="button"
                onClick={() => setPriority("routine")}
                className={cn(
                  "flex-1 py-1 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer",
                  priority === "routine"
                    ? "bg-primary-600 text-white shadow-xs"
                    : "text-text-muted hover:text-text"
                )}
              >
                Routine
              </button>
            </div>
          </div>
          <div className="md:col-span-2">
            <Input
              label="Clinical Indication / Notes"
              placeholder="e.g. Evaluate persistent fever and elevated serum creatinine..."
              value={clinicalNotes}
              onChange={(e) => setClinicalNotes(e.target.value)}
            />
          </div>
        </div>

        {/* Standby Workflow Explanation Alert */}
        <div className="p-3 rounded-2xl bg-secondary-500/10 border border-secondary-500/20 text-secondary-900 dark:text-secondary-200 text-xs flex items-center gap-2.5">
          <Sparkles className="w-4 h-4 text-secondary-600 shrink-0" />
          <span>
            Placing this order automatically moves Token #{tokenNumber} to the <strong>Standby</strong> queue without queue penalty, dispatches electronic orders to the clinic laboratory desk, and sends a WhatsApp alert to the patient.
          </span>
        </div>

        {/* Footer Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSubmitOrder}
            loading={submitting}
            disabled={selectedTests.length === 0}
            className="bg-secondary-600 hover:bg-secondary-700 text-white font-bold rounded-xl shadow-xs"
          >
            <FlaskConical className="w-4 h-4 mr-1.5" />
            Order & Move Patient to Standby
          </Button>
        </div>
      </div>
    </Modal>
  );
}
