"use client";

import React, { useState, useRef, useId, memo, useCallback } from "react";
import { cn } from "../utils";

export interface AreaSeries {
  key: string;
  name: string;
  color?: string;
  strokeWidth?: number;
}

export interface AreaDataPoint {
  label: string;
  [key: string]: string | number;
}

export interface AreaChartProps {
  data: AreaDataPoint[];
  series: AreaSeries[];
  height?: number;
  valueFormatter?: (val: number) => string;
  showGrid?: boolean;
  showLegend?: boolean;
  showDots?: boolean;
  curve?: "smooth" | "linear";
  className?: string;
}

const DEFAULT_COLORS = [
  "var(--s-chart-1, #3b82f6)",
  "var(--s-chart-2, #10b981)",
  "var(--s-chart-3, #f59e0b)",
  "var(--s-chart-4, #8b5cf6)",
  "var(--s-chart-5, #ec4899)",
];

function createSmoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let path = `M ${points[0].x} ${points[0].y}`;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? 0 : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2 < points.length ? i + 2 : points.length - 1];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    path += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }

  return path;
}

export const AreaChart = memo(function AreaChart({
  data,
  series,
  height = 220,
  valueFormatter = (v) => `${v}`,
  showGrid = true,
  showLegend = true,
  showDots = true,
  curve = "smooth",
  className = "",
}: AreaChartProps) {
  const chartId = useId().replace(/:/g, "");
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const padding = { top: 16, right: 14, bottom: 28, left: 42 };
  const viewBoxWidth = 600;
  const viewBoxHeight = height;

  const chartWidth = viewBoxWidth - padding.left - padding.right;
  const chartHeight = viewBoxHeight - padding.top - padding.bottom;

  const getX = useCallback((index: number) => {
    if (data.length <= 1) return padding.left + chartWidth / 2;
    return padding.left + (index / (data.length - 1)) * chartWidth;
  }, [data.length, chartWidth, padding.left]);

  if (!data || data.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center text-xs text-text-muted">
        No chart data available
      </div>
    );
  }

  const allValues = data.flatMap((d) =>
    series.map((s) => (typeof d[s.key] === "number" ? (d[s.key] as number) : 0))
  );
  const rawMax = Math.max(...allValues, 10);
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawMax)));
  const yMax = Math.ceil((rawMax * 1.15) / (magnitude / 2 || 1)) * (magnitude / 2 || 1);
  const yMin = 0;

  const getY = (val: number) => {
    const clamped = Math.max(yMin, Math.min(yMax, val));
    const ratio = (clamped - yMin) / (yMax - yMin || 1);
    return padding.top + chartHeight - ratio * chartHeight;
  };

  const seriesPaths = series.map((s, sIdx) => {
    const color = s.color || DEFAULT_COLORS[sIdx % DEFAULT_COLORS.length];
    const points = data.map((d, i) => ({
      x: getX(i),
      y: getY(typeof d[s.key] === "number" ? (d[s.key] as number) : 0),
    }));

    const linePath =
      curve === "smooth"
        ? createSmoothPath(points)
        : `M ${points.map((p) => `${p.x} ${p.y}`).join(" L ")}`;

    const areaPath = `${linePath} L ${points[points.length - 1].x} ${padding.top + chartHeight} L ${points[0].x} ${padding.top + chartHeight} Z`;

    return { series: s, color, points, linePath, areaPath };
  });

  const yTicks = [0, 0.33, 0.66, 1].map((r) => Math.round(yMin + r * (yMax - yMin)));

  const handlePointerPos = (clientX: number) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const xPos = ((clientX - rect.left) / rect.width) * viewBoxWidth;

    let closestIdx = 0;
    let minDiff = Infinity;
    data.forEach((_, i) => {
      const diff = Math.abs(getX(i) - xPos);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = i;
      }
    });

    setHoverIndex(closestIdx);
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    handlePointerPos(e.clientX);
  };

  const handleTouchMove = (e: React.TouchEvent<SVGSVGElement>) => {
    if (e.touches.length > 0) {
      handlePointerPos(e.touches[0].clientX);
    }
  };

  const activeDataPoint = hoverIndex !== null ? data[hoverIndex] : null;

  // Clamped percentage position for tooltip so it stays inside mobile screens
  const rawPct = hoverIndex !== null ? (getX(hoverIndex) / viewBoxWidth) * 100 : 50;
  const clampedPct = Math.min(84, Math.max(16, rawPct));

  return (
    <div className={cn("w-full flex flex-col space-y-2 select-none", className)}>
      <div className="relative w-full overflow-visible">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
          className="w-full h-auto overflow-visible cursor-crosshair touch-none"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverIndex(null)}
          onTouchStart={handleTouchMove}
          onTouchMove={handleTouchMove}
          onTouchEnd={() => setHoverIndex(null)}
        >
          <defs>
            {seriesPaths.map(({ series: s, color }, idx) => (
              <linearGradient
                key={idx}
                id={`area-grad-${chartId}-${s.key}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor={color} stopOpacity="0.38" />
                <stop offset="70%" stopColor={color} stopOpacity="0.06" />
                <stop offset="100%" stopColor={color} stopOpacity="0.0" />
              </linearGradient>
            ))}
            {/* Filter glow */}
            <filter id={`glow-${chartId}`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

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

          {/* X Axis Labels */}
          <g className="x-axis-labels">
            {data.map((d, i) => {
              const skip = data.length > 10 ? Math.ceil(data.length / 7) : 1;
              if (i % skip !== 0 && i !== data.length - 1) return null;

              const x = getX(i);
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

          {/* Area Gradients */}
          {seriesPaths.map(({ series: s, areaPath }, idx) => (
            <path
              key={idx}
              d={areaPath}
              fill={`url(#area-grad-${chartId}-${s.key})`}
              className="pointer-events-none transition-opacity duration-300"
            />
          ))}

          {/* Line Stroke Paths with Draw-in animation */}
          {seriesPaths.map(({ series: s, color, linePath }, idx) => (
            <path
              key={idx}
              d={linePath}
              fill="none"
              stroke={color}
              strokeWidth={s.strokeWidth || 2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="pointer-events-none animate-chart-draw"
              style={{
                filter: `drop-shadow(0 2px 8px ${color}35)`,
              }}
            />
          ))}

          {/* Hover Laser Guide & Pulsing Beacons */}
          {hoverIndex !== null && (
            <g className="hover-guide pointer-events-none">
              <line
                x1={getX(hoverIndex)}
                y1={padding.top}
                x2={getX(hoverIndex)}
                y2={padding.top + chartHeight}
                stroke="var(--color-primary-500, #3b82f6)"
                strokeWidth="1.5"
                strokeDasharray="3 3"
                className="opacity-75"
              />

              {seriesPaths.map(({ series: s, color, points }, idx) => {
                const pt = points[hoverIndex];
                if (!pt) return null;
                return (
                  <g key={idx}>
                    {/* Concentric expanding wave */}
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r="9"
                      fill={color}
                      className="opacity-20 animate-ping"
                    />
                    {/* Outer glow ring */}
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r="6.5"
                      fill={color}
                      opacity="0.35"
                    />
                    {/* Core illuminated center */}
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r="4"
                      fill={color}
                      stroke="var(--color-surface, #0f172a)"
                      strokeWidth="2"
                      className="shadow-sm"
                    />
                  </g>
                );
              })}
            </g>
          )}

          {/* Static dots when idle */}
          {showDots && hoverIndex === null && data.length <= 14 && (
            <g className="static-dots pointer-events-none">
              {seriesPaths.map(({ series: s, color, points }, sIdx) =>
                points.map((pt, pIdx) => (
                  <circle
                    key={`${sIdx}-${pIdx}`}
                    cx={pt.x}
                    cy={pt.y}
                    r="2.5"
                    fill={color}
                    stroke="var(--color-surface, #0f172a)"
                    strokeWidth="1.5"
                    className="opacity-80"
                  />
                ))
              )}
            </g>
          )}
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
              {/* Tooltip top light stripe */}
              <div
                className="absolute top-0 inset-x-0 h-[2px] opacity-90"
                style={{
                  backgroundColor: series[0]?.color || DEFAULT_COLORS[0],
                }}
              />
              <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-1">
                <span className="text-[11px] font-extrabold text-text tracking-tight">{activeDataPoint.label}</span>
                <span className="text-[9px] font-mono text-text-muted uppercase">Period</span>
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

export default AreaChart;
