"use client";

import { type ReactNode, memo } from "react";
import { cn } from "./utils";

export interface Step {
  label: string;
  description?: string;
  icon?: ReactNode;
}

export interface StepperProps {
  steps: Step[];
  currentStep: number;
  variant?: "horizontal" | "vertical";
  onStepClick?: (stepIndex: number) => void;
  className?: string;
}

function StepCircle({ step, index, status }: { step: Step; index: number; status: string }) {
  return (
    <div
      className={cn(
        "h-8 w-8 rounded-full flex items-center justify-center shrink-0 text-sm font-semibold transform-gpu transition-all duration-200 ease-smooth relative z-10 select-none",
        status === "completed" && "bg-primary-600 text-white shadow-xs",
        status === "active" &&
          "bg-primary-500/10 text-primary-600 dark:text-primary-400 ring-2 ring-primary-600 ring-offset-2 ring-offset-surface font-bold",
        status === "upcoming" && "text-text-muted border border-border bg-surface"
      )}
    >
      {status === "completed" ? (
        <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      ) : step.icon ? (
        <span className="[&>svg]:h-4 [&>svg]:w-4 shrink-0">{step.icon}</span>
      ) : (
        index + 1
      )}
    </div>
  );
}

function ProgressLine({ filled, isVertical }: { filled: boolean; isVertical?: boolean }) {
  if (isVertical) {
    return (
      <div className="w-0.5 flex-1 min-h-[32px] my-1 rounded-full relative bg-border">
        <div
          className="absolute top-0 left-0 w-full rounded-full bg-primary-600 transform-gpu transition-all duration-300 ease-smooth"
          style={{ height: filled ? "100%" : "0%" }}
        />
      </div>
    );
  }
  return (
    <div className="absolute top-4 left-[50%] w-full h-0.5 -mt-[1px] px-4">
      <div className="w-full h-full rounded-full relative bg-border">
        <div
          className="absolute left-0 top-0 h-full rounded-full bg-primary-600 transform-gpu transition-all duration-300 ease-smooth"
          style={{ width: filled ? "100%" : "0%" }}
        />
      </div>
    </div>
  );
}

const Stepper = memo(function Stepper({ steps, currentStep, variant = "horizontal", onStepClick, className = "" }: StepperProps) {
  const getStatus = (i: number) => (i < currentStep ? "completed" : i === currentStep ? "active" : "upcoming");

  if (variant === "vertical") {
    return (
      <nav aria-label="Progress steps" className={cn("flex flex-col", className)}>
        {steps.map((step, i) => {
          const status = getStatus(i);
          const isClickable = !!onStepClick && status === "completed";

          return (
            <div
              key={i}
              role={isClickable ? "button" : undefined}
              tabIndex={isClickable ? 0 : undefined}
              className={cn("flex gap-3 relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded-lg p-1", isClickable && "cursor-pointer group")}
              onClick={isClickable ? () => onStepClick(i) : undefined}
              onKeyDown={isClickable ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onStepClick(i);
                }
              } : undefined}
            >
              <div className="flex flex-col items-center">
                <StepCircle step={step} index={i} status={status} />
                {i < steps.length - 1 && <ProgressLine filled={i < currentStep} isVertical />}
              </div>
              <div className="pb-8 pt-0.5 select-none">
                <p
                  className={cn(
                    "text-sm font-semibold transition-colors duration-150",
                    status === "upcoming" ? "text-text-muted" : "text-text",
                    isClickable && "group-hover:text-primary-600"
                  )}
                  aria-current={status === "active" ? "step" : undefined}
                >
                  {step.label}
                </p>
                {step.description && <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">{step.description}</p>}
              </div>
            </div>
          );
        })}
      </nav>
    );
  }

  return (
    <nav aria-label="Progress steps" className={cn("flex items-start w-full select-none", className)}>
      {steps.map((step, i) => {
        const status = getStatus(i);
        const isClickable = !!onStepClick && status === "completed";

        return (
          <div
            key={i}
            role={isClickable ? "button" : undefined}
            tabIndex={isClickable ? 0 : undefined}
            className={cn("flex flex-col items-center flex-1 relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded-lg p-1", isClickable && "cursor-pointer group")}
            onClick={isClickable ? () => onStepClick(i) : undefined}
            onKeyDown={isClickable ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onStepClick(i);
              }
            } : undefined}
          >
            <StepCircle step={step} index={i} status={status} />
            <p
              className={cn(
                "text-xs font-semibold text-center mt-2 max-w-[90px] sm:max-w-none leading-tight transition-colors duration-150",
                status === "upcoming" ? "text-text-muted" : "text-text",
                isClickable && "group-hover:text-primary-600"
              )}
              aria-current={status === "active" ? "step" : undefined}
            >
              {step.label}
            </p>
            {i < steps.length - 1 && <ProgressLine filled={i < currentStep} />}
          </div>
        );
      })}
    </nav>
  );
});

export default Stepper;


