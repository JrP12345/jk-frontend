import { Badge } from "@/components/ui";

export type LabOrderStatus = "ordered" | "sample-collected" | "processing" | "result-uploaded" | "cancelled";

interface LabStatusBadgeProps {
  status: LabOrderStatus;
}

export function LabStatusBadge({ status }: LabStatusBadgeProps) {
  switch (status) {
    case "ordered":
      return <Badge variant="info">Ordered</Badge>;
    case "sample-collected":
      return <Badge variant="warning">Sample Collected</Badge>;
    case "processing":
      return <Badge variant="primary">Processing</Badge>;
    case "result-uploaded":
      return <Badge variant="success">Completed</Badge>;
    case "cancelled":
    default:
      return <Badge variant="error">Cancelled</Badge>;
  }
}
