"use client";

import { type ReactNode } from "react";
import { cn } from "./utils";

interface Step { label: string; description?: string; icon?: ReactNode }

interface StepperProps {
  steps: Step[];
  currentStep: number;
  variant?: "horizontal" | "vertical";
  className?: string;
}

/**
 * StepCircle — uses CSS variables (via Tailwind theme tokens) so it correctly
 * responds to data-mode="dark" on <html> without relying on the dark: prefix,
 * which only works with class-based dark mode (not attribute-based).
 */
function StepCircle({ step, index, status }: { step: Step; index: number; status: string }) {
  return (
    <div
      className={cn(
        "h-8 w-8 rounded-full flex items-center justify-center shrink-0 text-sm font-semibold transition-all duration-500 relative z-10 select-none",
        // Completed: solid primary fill
        status === "completed" && "bg-primary-600 text-white",
        // Active: light primary bg with ring — ring-offset matches surface
        status === "active" && "bg-primary-100 text-primary-700 ring-2 ring-primary-600 ring-offset-2",
        // Upcoming: use CSS variables so it adapts to theme (both modes)
        status === "upcoming" && "text-text-muted border border-border",
      )}
      style={status === "upcoming" ? { background: "var(--s-surface)", borderColor: "var(--s-border)" } : undefined}
    >
      {status === "completed" ? (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      ) : step.icon ? (
        <span className="[&>svg]:h-4 [&>svg]:w-4">{step.icon}</span>
      ) : (
        index + 1
      )}
    </div>
  );
}

/**
 * Progress connector line — uses CSS variable for the filled segment color
 * so it works with data-mode attribute dark mode.
 */
function ProgressLine({ filled, isVertical }: { filled: boolean; isVertical?: boolean }) {
  if (isVertical) {
    return (
      <div className="w-0.5 flex-1 min-h-[32px] my-1 rounded-full relative" style={{ background: "var(--s-border)" }}>
        <div
          className="absolute top-0 left-0 w-full rounded-full transition-all duration-500"
          style={{ height: filled ? "100%" : "0%", background: "var(--p-600)" }}
        />
      </div>
    );
  }
  return (
    <div className="absolute top-4 left-[50%] w-full h-0.5 -mt-[1px] px-4">
      <div className="w-full h-full rounded-full relative" style={{ background: "var(--s-border)" }}>
        <div
          className="absolute left-0 top-0 h-full rounded-full transition-all duration-500"
          style={{ width: filled ? "100%" : "0%", background: "var(--p-600)" }}
        />
      </div>
    </div>
  );
}

export default function Stepper({ steps, currentStep, variant = "horizontal", className = "" }: StepperProps) {
  const getStatus = (i: number) => i < currentStep ? "completed" : i === currentStep ? "active" : "upcoming";

  if (variant === "vertical") {
    return (
      <div className={cn("flex flex-col", className)}>
        {steps.map((step, i) => (
          <div key={i} className="flex gap-3 relative">
            <div className="flex flex-col items-center">
              <StepCircle step={step} index={i} status={getStatus(i)} />
              {i < steps.length - 1 && (
                <ProgressLine filled={i < currentStep} isVertical />
              )}
            </div>
            <div className="pb-8 pt-0.5">
              <p className={cn("text-sm font-semibold transition-colors duration-300", getStatus(i) === "upcoming" ? "text-text-muted" : "text-text")}>
                {step.label}
              </p>
              {step.description && <p className="text-xs text-text-secondary mt-0.5">{step.description}</p>}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={cn("flex items-start w-full", className)}>
      {steps.map((step, i) => (
        <div key={i} className="flex flex-col items-center flex-1 relative">
          <StepCircle step={step} index={i} status={getStatus(i)} />
          <p className={cn("text-xs font-semibold text-center mt-2 max-w-[90px] sm:max-w-none leading-tight transition-colors duration-300", getStatus(i) === "upcoming" ? "text-text-muted" : "text-text")}>
            {step.label}
          </p>
          {i < steps.length - 1 && (
            <ProgressLine filled={i < currentStep} />
          )}
        </div>
      ))}
    </div>
  );
}
