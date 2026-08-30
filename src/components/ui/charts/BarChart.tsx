"use client";

import React, { useState, useRef, memo } from "react";
import { cn } from "../utils";

export interface BarSeries {
  key: string;
  name: string;
  color?: string;
}

export interface BarDataPoint {
  label: string;
  [key: string]: string | number;
}

export interface BarChartProps {
  data: BarDataPoint[];
  series: BarSeries[];
  height?: number;
  layout?: "grouped" | "stacked";
  valueFormatter?: (val: number) => string;
  showGrid?: boolean;
  showLegend?: boolean;
  benchmark?: { value: number; label: string; color?: string };
  className?: string;
}

const DEFAULT_COLORS = [
  "var(--s-chart-1, #3b82f6)",
  "var(--s-chart-2, #10b981)",
  "var(--s-chart-3, #f59e0b)",
  "var(--s-chart-4, #8b5cf6)",
  "var(--s-chart-5, #ec4899)",
];

export const BarChart = memo(function BarChart({
  data,
  series,
  height = 220,
  layout = "grouped",
  valueFormatter = (v) => `${v}`,
  showGrid = true,
  showLegend = true,
  benchmark,
  className = "",
}: BarChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const padding = { top: 16, right: 14, bottom: 28, left: 42 };
  const viewBoxWidth = 600;
  const viewBoxHeight = height;

  const chartWidth = viewBoxWidth - padding.left - padding.right;
  const chartHeight = viewBoxHeight - padding.top - padding.bottom;

  if (!data || data.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center text-xs text-text-muted">
        No chart data available
      </div>
    );
  }

  let rawMax = 10;
  if (layout === "stacked") {
    rawMax = Math.max(
      ...data.map((d) =>
        series.reduce((sum, s) => sum + (typeof d[s.key] === "number" ? (d[s.key] as number) : 0), 0)
      ),
      10
    );
  } else {
    rawMax = Math.max(
      ...data.flatMap((d) =>
        series.map((s) => (typeof d[s.key] === "number" ? (d[s.key] as number) : 0))
      ),
      10
    );
  }

  if (benchmark && benchmark.value > rawMax) {
    rawMax = benchmark.value;
  }

  const magnitude = Math.pow(10, Math.floor(Math.log10(rawMax)));
  const yMax = Math.ceil((rawMax * 1.15) / (magnitude / 2 || 1)) * (magnitude / 2 || 1);
  const yMin = 0;

  const getY = (val: number) => {
    const clamped = Math.max(yMin, Math.min(yMax, val));
    const ratio = (clamped - yMin) / (yMax - yMin || 1);
    return padding.top + chartHeight - ratio * chartHeight;
  };

  const groupWidth = chartWidth / data.length;
  const barGap = 3.5;
  const totalBarWidthInGroup = Math.min(groupWidth * 0.72, 48);

  const yTicks = [0, 0.33, 0.66, 1].map((r) => Math.round(yMin + r * (yMax - yMin)));

  const handlePointerPos = (clientX: number) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const xPos = ((clientX - rect.left) / rect.width) * viewBoxWidth;

    const idx = Math.floor((xPos - padding.left) / groupWidth);
    if (idx >= 0 && idx < data.length) {
      setHoverIndex(idx);
    }
  };

  const activeDataPoint = hoverIndex !== null ? data[hoverIndex] : null;

  const rawPct = hoverIndex !== null
    ? ((padding.left + hoverIndex * groupWidth + groupWidth / 2) / viewBoxWidth) * 100
    : 50;
  const clampedPct = Math.min(84, Math.max(16, rawPct));

  return (
    <div className={cn("w-full flex flex-col space-y-2 select-none", className)}>
      <div className="relative w-full overflow-visible">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
          className="w-full h-auto overflow-visible cursor-pointer touch-none"
          onMouseMove={(e) => handlePointerPos(e.clientX)}
          onMouseLeave={() => setHoverIndex(null)}
          onTouchStart={(e) => e.touches.length > 0 && handlePointerPos(e.touches[0].clientX)}
          onTouchMove={(e) => e.touches.length > 0 && handlePointerPos(e.touches[0].clientX)}
          onTouchEnd={() => setHoverIndex(null)}
        >
          {/* Grid lines */}
          {showGrid && (
            <g className="grid-lines">
              {yTicks.map((val, idx) => {
                const y = getY(val);
                return (
                  <g key={idx}>
                    <line
                      x1={padding.left}
                      y1={y}
                      x2={padding.left + chartWidth}
                      y2={y}
                      stroke="var(--color-border, #334155)"
                      strokeDasharray="4 4"
                      strokeWidth="1"
                      className="opacity-35"
                    />
                    <text
                      x={padding.left - 8}
                      y={y + 3.5}
                      textAnchor="end"
                      fontSize="9"
                      fill="var(--color-text-muted, #94a3b8)"
                      className="font-mono font-medium text-[9px]"
                    >
                      {valueFormatter(val)}
                    </text>
                  </g>
                );
              })}
            </g>
          )}

          {/* Benchmark Reference Line */}
          {benchmark && (
            <g className="benchmark-line">
              <line
                x1={padding.left}
                y1={getY(benchmark.value)}
                x2={padding.left + chartWidth}
                y2={getY(benchmark.value)}
                stroke={benchmark.color || "var(--color-danger-500, #ef4444)"}
                strokeWidth="1.5"
                strokeDasharray="3 3"
                className="opacity-80"
              />
              <text
                x={padding.left + chartWidth}
                y={getY(benchmark.value) - 4}
                textAnchor="end"
                fontSize="9"
                fill={benchmark.color || "var(--color-danger-500, #ef4444)"}
                className="font-bold uppercase tracking-wider text-[8.5px]"
              >
                {benchmark.label} ({valueFormatter(benchmark.value)})
              </text>
            </g>
          )}

          {/* Bars Rendering with Staggered Entrance Animation */}
          {data.map((d, dIdx) => {
            const groupX = padding.left + dIdx * groupWidth + (groupWidth - totalBarWidthInGroup) / 2;
            const isHovered = hoverIndex === dIdx;

            if (layout === "stacked") {
              let currentYBottom = padding.top + chartHeight;
              return (
                <g
                  key={dIdx}
                  className="transition-opacity duration-200"
                  opacity={hoverIndex !== null && !isHovered ? 0.35 : 1}
                >
                  <rect
                    x={padding.left + dIdx * groupWidth}
                    y={padding.top}
                    width={groupWidth}
                    height={chartHeight}
                    fill="transparent"
                  />

                  {series.map((s, sIdx) => {
                    const val = typeof d[s.key] === "number" ? (d[s.key] as number) : 0;
                    const barHeight = (val / (yMax - yMin || 1)) * chartHeight;
                    const barY = currentYBottom - barHeight;
                    currentYBottom = barY;
                    const color = s.color || DEFAULT_COLORS[sIdx % DEFAULT_COLORS.length];
                    const isTopSegment = sIdx === series.length - 1;

                    return (
                      <rect
                        key={s.key}
                        x={groupX}
                        y={barY}
                        width={totalBarWidthInGroup}
                        height={Math.max(barHeight, 0)}
                        fill={color}
                        rx={isTopSegment ? 4 : 0}
                        className="animate-chart-bar transition-all duration-200"
                        style={{
                          animationDelay: `${dIdx * 35 + sIdx * 15}ms`,
                          filter: isHovered ? `brightness(1.15) drop-shadow(0 2px 8px ${color}40)` : undefined,
                        }}
                      />
                    );
                  })}
                </g>
              );
            }

            // Grouped Layout
            const singleBarWidth = Math.max(
              (totalBarWidthInGroup - (series.length - 1) * barGap) / series.length,
              4
            );

            return (
              <g
                key={dIdx}
                className="transition-opacity duration-200"
                opacity={hoverIndex !== null && !isHovered ? 0.35 : 1}
              >
                <rect
                  x={padding.left + dIdx * groupWidth}
                  y={padding.top}
                  width={groupWidth}
                  height={chartHeight}
                  fill="transparent"
                />

                {series.map((s, sIdx) => {
                  const val = typeof d[s.key] === "number" ? (d[s.key] as number) : 0;
                  const barX = groupX + sIdx * (singleBarWidth + barGap);
                  const barY = getY(val);
                  const barHeight = padding.top + chartHeight - barY;
                  const color = s.color || DEFAULT_COLORS[sIdx % DEFAULT_COLORS.length];

                  return (
                    <rect
                      key={s.key}
                      x={barX}
                      y={barY}
                      width={singleBarWidth}
                      height={Math.max(barHeight, 0)}
                      fill={color}
                      rx={3.5}
                      className="animate-chart-bar transition-all duration-200"
                      style={{
                        animationDelay: `${dIdx * 35 + sIdx * 20}ms`,
                        filter: isHovered ? `brightness(1.18) drop-shadow(0 2px 8px ${color}40)` : undefined,
                      }}
                    />
                  );
                })}
              </g>
            );
          })}

          {/* X Axis Labels */}
          <g className="x-axis-labels">
            {data.map((d, i) => {
              const skip = data.length > 10 ? Math.ceil(data.length / 7) : 1;
              if (i % skip !== 0 && i !== data.length - 1) return null;

              const x = padding.left + i * groupWidth + groupWidth / 2;
              return (
                <text
                  key={i}
                  x={x}
                  y={viewBoxHeight - 6}
                  textAnchor="middle"
                  fontSize="9.5"
                  fill="var(--color-text-muted, #94a3b8)"
                  className="font-semibold text-[9px] tracking-tight"
                >
                  {d.label}
                </text>
              );
            })}
          </g>
        </svg>

        {/* Ultra-Luxury Frosted Glass Tooltip */}
        {activeDataPoint && hoverIndex !== null && (
          <div
            style={{
              left: `${clampedPct}%`,
              top: "-8px",
            }}
            className="absolute pointer-events-none z-30 animate-chart-tooltip"
          >
            <div className="px-3.5 py-2.5 rounded-2xl bg-surface/95 dark:bg-surface/90 border border-border/80 shadow-2xl shadow-black/35 backdrop-blur-xl text-xs space-y-1.5 min-w-[140px] relative overflow-hidden">
              <div
                className="absolute top-0 inset-x-0 h-[2px] opacity-90"
                style={{
                  backgroundColor: series[0]?.color || DEFAULT_COLORS[0],
                }}
              />
              <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-1">
                <span className="text-[11px] font-extrabold text-text tracking-tight">{activeDataPoint.label}</span>
                <span className="text-[9px] font-mono text-text-muted uppercase">Details</span>
              </div>
              <div className="space-y-1 pt-0.5">
                {series.map((s, idx) => {
                  const val = activeDataPoint[s.key];
                  const color = s.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length];
                  return (
                    <div key={s.key} className="flex items-center justify-between gap-3 text-[11px]">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="w-2 h-2 rounded-full shrink-0 shadow-xs" style={{ backgroundColor: color }} />
                        <span className="text-text-secondary truncate font-medium">{s.name}</span>
                      </div>
                      <span className="font-mono font-bold text-text shrink-0">
                        {typeof val === "number" ? valueFormatter(val) : val}
                      </span>
                    </div>
                  );
                })}

                {layout === "stacked" && series.length > 1 && (
                  <div className="flex items-center justify-between gap-3 text-[11px] pt-1.5 border-t border-border/50 font-bold">
                    <span className="text-text-secondary">Combined Total:</span>
                    <span className="font-mono text-primary-600 dark:text-primary-400">
                      {valueFormatter(
                        series.reduce(
                          (sum, s) =>
                            sum + (typeof activeDataPoint[s.key] === "number" ? (activeDataPoint[s.key] as number) : 0),
                          0
                        )
                      )}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Legend Footer */}
      {showLegend && series.length > 1 && (
        <div className="flex items-center justify-center gap-4 pt-1 flex-wrap text-xs">
          {series.map((s, idx) => {
            const color = s.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length];
            return (
              <div key={s.key} className="flex items-center gap-1.5 bg-surface-alt/60 px-2 py-0.5 rounded-lg border border-border/40">
                <span className="w-2 h-2 rounded-full shrink-0 shadow-xs" style={{ backgroundColor: color }} />
                <span className="text-text-secondary text-[11px] font-medium">{s.name}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});

export default BarChart;
