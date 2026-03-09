import { SeverityLevel } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";

const SEVERITY_CONFIG: Record<
  SeverityLevel,
  { label: string; className: string }
> = {
  CRITICAL: { label: "Critical Safety Issue", className: "bg-red-600 text-white" },
  HIGH: { label: "High Priority", className: "bg-orange-500 text-white" },
  MEDIUM: { label: "Moderate Concern", className: "bg-yellow-500 text-black" },
  LOW: { label: "Minor Issue", className: "bg-slate-400 text-white" },
  UNKNOWN: { label: "Under Review", className: "bg-gray-300 text-gray-700" },
};

interface SeverityBadgeProps {
  severity: SeverityLevel;
  className?: string;
}

export function SeverityBadge({ severity, className }: SeverityBadgeProps) {
  const config = SEVERITY_CONFIG[severity];
  return (
    <Badge className={cn(config.className, className)}>{config.label}</Badge>
  );
}
