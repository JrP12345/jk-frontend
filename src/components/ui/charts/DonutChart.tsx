"use client";

import React, { useState, memo } from "react";
import { cn } from "../utils";

export interface DonutDataItem {
  name: string;
  value: number;
  color?: string;
  sublabel?: string;
}

export interface DonutChartProps {
  data: DonutDataItem[];
  height?: number;
  centerLabel?: string;
  centerValue?: string | number;
  valueFormatter?: (val: number) => string;
  showLegend?: boolean;
  innerRadiusRatio?: number;
  className?: string;
}

const DEFAULT_COLORS = [
  "var(--s-chart-1, #3b82f6)",
  "var(--s-chart-2, #10b981)",
  "var(--s-chart-3, #f59e0b)",
  "var(--s-chart-4, #8b5cf6)",
  "var(--s-chart-5, #ec4899)",
  "#06b6d4",
  "#f97316",
  "#14b8a6",
];

export const DonutChart = memo(function DonutChart({
  data,
  height = 220,
  centerLabel,
  centerValue,
  valueFormatter = (v) => `${v}`,
  showLegend = true,
  innerRadiusRatio = 0.72,
  className = "",
}: DonutChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const total = data.reduce((acc, curr) => acc + (curr.value > 0 ? curr.value : 0), 0);

  if (!data || data.length === 0 || total === 0) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center text-xs text-text-muted py-6">
        <span>No distribution data recorded</span>
      </div>
    );
  }

  const size = 180;
  const strokeWidth = (size / 2) * (1 - innerRadiusRatio);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let accumulatedAngle = -90;
  const segments = data.map((item, idx) => {
    const color = item.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length];
    const pct = total > 0 ? item.value / total : 0;
    const strokeDasharray = `${pct * circumference} ${circumference}`;
    const startAngle = accumulatedAngle;
    accumulatedAngle += pct * 360;

    return {
      item,
      color,
      pct,
      strokeDasharray,
      startAngle,
    };
  });

  const activeItem = hoverIndex !== null ? data[hoverIndex] : null;
  const activeColor = hoverIndex !== null ? segments[hoverIndex]?.color : null;
  const displayValue = activeItem
    ? valueFormatter(activeItem.value)
    : centerValue !== undefined
    ? centerValue
    : valueFormatter(total);

  const displayLabel = activeItem
    ? activeItem.name
    : centerLabel || "Total Distribution";

  const displayPct = activeItem && total > 0 ? `${Math.round((activeItem.value / total) * 100)}%` : null;

  return (
    <div className={cn("w-full flex flex-col sm:flex-row items-center justify-center gap-5 sm:gap-7 py-2 select-none", className)}>
      {/* SVG Donut Ring */}
      <div className="relative shrink-0 flex items-center justify-center group">
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="transform -rotate-90 overflow-visible"
        >
          {/* Ambient Outer Track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--color-surface-alt, #1e293b)"
            strokeWidth={strokeWidth}
            className="opacity-40"
          />

          {/* Animated Slices with Spring Hover Scale */}
          {segments.map((seg, idx) => {
            const isHovered = hoverIndex === idx;
            return (
              <circle
                key={idx}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={seg.color}
                strokeWidth={isHovered ? strokeWidth + 5 : strokeWidth}
                strokeDasharray={seg.strokeDasharray}
                strokeDashoffset={-((seg.startAngle + 90) / 360) * circumference}
                strokeLinecap="round"
                onMouseEnter={() => setHoverIndex(idx)}
                onMouseLeave={() => setHoverIndex(null)}
                className={cn(
                  "cursor-pointer transition-all duration-300 ease-out origin-center",
                  hoverIndex !== null && !isHovered && "opacity-35"
                )}
                style={{
                  filter: isHovered ? `drop-shadow(0 0 10px ${seg.color}80)` : undefined,
                }}
              />
            );
          })}
        </svg>

        {/* Central Summary KPI */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-3">
          {displayPct ? (
            <span
              className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full mb-0.5 animate-scale-in shadow-xs border"
              style={{
                backgroundColor: activeColor ? `${activeColor}20` : undefined,
                borderColor: activeColor ? `${activeColor}40` : undefined,
                color: activeColor || undefined,
              }}
            >
              {displayPct} Share
            </span>
          ) : (
            <span className="text-[9.5px] font-bold uppercase tracking-wider text-text-muted mb-0.5">
              Overview
            </span>
          )}
          <span className="text-xl sm:text-2xl font-black text-text tracking-tight font-mono leading-none">
            {displayValue}
          </span>
          <span className="text-[11px] font-semibold text-text-secondary mt-1 max-w-[105px] truncate leading-tight">
            {displayLabel}
          </span>
        </div>
      </div>

      {/* Interactive Legend List */}
      {showLegend && (
        <div className="flex-1 w-full max-w-xs space-y-1.5">
          {data.map((item, idx) => {
            const color = item.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length];
            const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
            const isHovered = hoverIndex === idx;

            return (
              <div
                key={idx}
                onMouseEnter={() => setHoverIndex(idx)}
                onMouseLeave={() => setHoverIndex(null)}
                className={cn(
                  "flex items-center justify-between px-2.5 py-1.5 rounded-xl border transition-all duration-200 cursor-pointer text-xs",
                  isHovered
                    ? "bg-surface border-border shadow-xs scale-[1.02] translate-x-1"
                    : "border-transparent hover:bg-surface-alt/70"
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-text font-semibold truncate">{item.name}</span>
                </div>

                <div className="flex items-center gap-2 shrink-0 font-mono text-[11px]">
                  <span className="text-text-muted font-normal text-[10px] bg-surface-alt px-1.5 py-0.2 rounded-md">{pct}%</span>
                  <span className="font-bold text-text">{valueFormatter(item.value)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});

export default DonutChart;
