import { Badge } from "@/components/ui";

export type MARStatus = "scheduled" | "administered" | "refused" | "held" | "missed";

interface MedicationChipProps {
  status: MARStatus;
  administeredAt?: string;
  notes?: string;
}

export function MedicationChip({ status, administeredAt, notes }: MedicationChipProps) {
  switch (status) {
    case "scheduled":
      return <Badge variant="info">Scheduled</Badge>;
    case "administered":
      return (
        <Badge variant="success" title={administeredAt ? `Administered at ${new Date(administeredAt).toLocaleTimeString()}` : undefined}>
          Administered
        </Badge>
      );
    case "refused":
      return <Badge variant="warning" title={notes || "Refused by patient"}>Refused</Badge>;
    case "held":
      return <Badge variant="neutral" title={notes || "Clinical hold"}>Held</Badge>;
    case "missed":
    default:
      return <Badge variant="error" title={notes || "Missed dose"}>Missed</Badge>;
  }
}
