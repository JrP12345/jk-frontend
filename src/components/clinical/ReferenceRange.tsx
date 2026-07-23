import { Badge } from "@/components/ui";

interface ReferenceRangeProps {
  value: string;
  unit?: string;
  normalRange?: string;
  isAbnormal?: boolean;
  interpretation?: string;
}

export function ReferenceRange({ value, unit, normalRange, isAbnormal, interpretation }: ReferenceRangeProps) {
  return (
    <div className="flex items-center gap-3 text-xs bg-surface-hover p-2.5 rounded-xl border border-border">
      <div className="flex-1">
        <div className="text-text-secondary font-medium">Result Value</div>
        <div className="font-bold text-sm text-text">
          {value} {unit ? <span className="text-xs text-text-muted font-normal">{unit}</span> : ""}
        </div>
      </div>

      {normalRange && (
        <div className="flex-1">
          <div className="text-text-secondary font-medium">Reference Range</div>
          <div className="text-xs text-text font-semibold">{normalRange}</div>
        </div>
      )}

      {isAbnormal !== undefined && (
        <div className="shrink-0">
          {isAbnormal ? (
            <Badge variant="error">{interpretation || "Abnormal"}</Badge>
          ) : (
            <Badge variant="success">{interpretation || "Normal"}</Badge>
          )}
        </div>
      )}
    </div>
  );
}
