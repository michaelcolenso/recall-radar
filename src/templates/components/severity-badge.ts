import type { SeverityLevel } from "../../db/schema";

const SEVERITY_CLASS: Record<SeverityLevel, string> = {
  CRITICAL: "rr-severity--critical",
  HIGH: "rr-severity--high",
  MEDIUM: "rr-severity--medium",
  LOW: "rr-severity--low",
  UNKNOWN: "rr-severity--unknown",
};

const SEVERITY_LABEL: Record<SeverityLevel, string> = {
  CRITICAL: "CRITICAL_RISK",
  HIGH: "HIGH_PRIORITY",
  MEDIUM: "MODERATE_RISK",
  LOW: "LOW_PRIORITY",
  UNKNOWN: "UNDER_REVIEW",
};

export function severityBadge(severity: SeverityLevel): string {
  const cls = SEVERITY_CLASS[severity] ?? SEVERITY_CLASS.UNKNOWN;
  const label = SEVERITY_LABEL[severity] ?? SEVERITY_LABEL.UNKNOWN;
  return `<span class="rr-severity ${cls}" role="status" aria-label="Severity: ${label}">${label}</span>`;
}
