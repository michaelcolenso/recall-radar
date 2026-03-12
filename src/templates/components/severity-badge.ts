import type { Severity } from "../../env";

export const severityBadge = (severity: Severity): string =>
  `<span class="badge badge-${severity}">${severity.toUpperCase()}</span>`;
