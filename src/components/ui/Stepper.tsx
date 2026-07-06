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

function StepCircle({ step, index, status }: { step: Step; index: number; status: string }) {
  return (
    <div className={cn(
      "h-8 w-8 rounded-full flex items-center justify-center shrink-0 text-sm font-semibold transition-all duration-500 ease-spring relative z-10 select-none",
      status === "completed" && "bg-primary-600 text-white dark:bg-primary-500",
      status === "active" && "bg-primary-100 text-primary-700 ring-2 ring-primary-600 ring-offset-2 ring-offset-surface dark:bg-primary-950/40 dark:text-primary-400 dark:ring-primary-500",
      status === "upcoming" && "bg-surface text-text-muted border-2 border-border",
    )}>
      {status === "completed" ? (
        <svg className="h-4 w-4 animate-scale-in" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
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
                <div className="w-0.5 flex-1 min-h-[32px] my-1 bg-border rounded-full relative">
                  <div
                    className="absolute top-0 left-0 w-full bg-primary-600 dark:bg-primary-500 rounded-full transition-all duration-500 ease-out-expo"
                    style={{ height: i < currentStep ? "100%" : "0%" }}
                  />
                </div>
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
            <div className="absolute top-4 left-[50%] w-full h-0.5 -mt-[1px] px-4">
              <div className="w-full h-full bg-border rounded-full relative">
                <div
                  className="absolute left-0 top-0 h-full bg-primary-600 dark:bg-primary-500 rounded-full transition-all duration-500 ease-out-expo"
                  style={{ width: i < currentStep ? "100%" : "0%" }}
                />
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

