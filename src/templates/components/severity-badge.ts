import type { SeverityLevel } from "../../db/schema";

const SEVERITY_CONFIG: Record<
  SeverityLevel,
  { label: string; bg: string; text: string }
> = {
  CRITICAL: { label: "Critical Safety Issue", bg: "bg-red-600",    text: "text-white" },
  HIGH:     { label: "High Priority",         bg: "bg-orange-500", text: "text-white" },
  MEDIUM:   { label: "Moderate Concern",      bg: "bg-yellow-500", text: "text-black" },
  LOW:      { label: "Minor Issue",           bg: "bg-slate-400",  text: "text-white" },
  UNKNOWN:  { label: "Under Review",          bg: "bg-gray-300",   text: "text-gray-700" },
};

export function severityBadge(severity: SeverityLevel): string {
  const config = SEVERITY_CONFIG[severity] ?? SEVERITY_CONFIG.UNKNOWN;
  return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${config.bg} ${config.text}">${config.label}</span>`;
}
