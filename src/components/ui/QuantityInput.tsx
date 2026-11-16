"use client";

import { forwardRef, type KeyboardEventHandler } from "react";
import { Minus, Plus } from "lucide-react";
import Button from "./Button";
import Input from "./Input";
import { cn } from "./utils";
import styles from "./QuantityInput.module.css";

export interface QuantityInputProps {
  value: string;
  onValueChange: (value: string) => void;
  label: string;
  decreaseLabel?: string;
  increaseLabel?: string;
  min?: number;
  max?: number;
  disabled?: boolean;
  className?: string;
  variant?: "pill" | "compact";
  onKeyDown?: KeyboardEventHandler<HTMLInputElement>;
}

/** Whole-unit editing with a draft-friendly input and bounded increment/decrement actions. */
const QuantityInput = forwardRef<HTMLInputElement, QuantityInputProps>(function QuantityInput({ value, onValueChange, label, decreaseLabel = `Decrease ${label.toLowerCase()}`, increaseLabel = `Increase ${label.toLowerCase()}`, min = 0, max = Number.MAX_SAFE_INTEGER, disabled = false, className, variant = "pill", onKeyDown }, ref) {
  const lower = Number.isSafeInteger(min) && min >= 0 ? min : 0;
  const upper = Number.isSafeInteger(max) && max >= lower ? max : Number.MAX_SAFE_INTEGER;
  const parsed = /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) ? Number(value) : null;
  const canDecrease = !disabled && parsed !== null && parsed > lower && parsed <= upper;
  const canIncrease = !disabled && (value === "" || parsed !== null && parsed >= lower && parsed < upper);
  function change(increase: boolean) {
    if (increase ? !canIncrease : !canDecrease) return;
    onValueChange(String(value === "" ? lower : parsed! + (increase ? 1 : -1)));
  }
  return <div role="group" aria-label={`${label} controls`} className={cn(styles.control, variant === "compact" && styles.compact, className)}>
    <Button variant="ghost" size="sm" className={styles.action} aria-label={decreaseLabel} disabled={!canDecrease} onClick={() => change(false)}><Minus size={16} aria-hidden="true" /></Button>
    <Input ref={ref} containerClassName={styles.value} aria-label={label} title={value || label} type="number" inputMode="numeric" min={lower} max={upper} step="1" value={value} disabled={disabled} onChange={event => onValueChange(event.target.value)} onKeyDown={event => {
      if (event.key === "ArrowUp" || event.key === "ArrowDown") { event.preventDefault(); change(event.key === "ArrowUp"); }
      else onKeyDown?.(event);
    }} />
    <Button variant="ghost" size="sm" className={styles.action} aria-label={increaseLabel} disabled={!canIncrease} onClick={() => change(true)}><Plus size={16} aria-hidden="true" /></Button>
  </div>;
});

export default QuantityInput;
