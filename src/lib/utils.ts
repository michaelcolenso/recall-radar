import { SeverityLevel } from "@prisma/client";

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function classifySeverity(component: string): SeverityLevel {
  const upper = component.toUpperCase();

  // CRITICAL — check first (highest priority)
  if (
    upper.includes("ENGINE") ||
    upper.includes("FUEL SYSTEM") ||
    upper.includes("BRAKES") ||
    upper.includes("BRAKE") ||
    upper.includes("STEERING") ||
    upper.includes("POWER TRAIN") ||
    upper.includes("POWERTRAIN")
  ) {
    return SeverityLevel.CRITICAL;
  }

  // HIGH
  if (
    upper.includes("AIR BAG") ||
    upper.includes("AIR BAGS") ||
    upper.includes("SEAT BELT") ||
    upper.includes("SEAT BELTS") ||
    upper.includes("CHILD SEAT") ||
    upper.includes("SUSPENSION") ||
    upper.includes("STRUCTURE")
  ) {
    return SeverityLevel.HIGH;
  }

  // MEDIUM
  if (
    upper.includes("ELECTRICAL") ||
    upper.includes("LIGHTING") ||
    upper.includes("VISIBILITY") ||
    upper.includes("WINDSHIELD") ||
    upper.includes("WIPERS") ||
    upper.includes("TIRES")
  ) {
    return SeverityLevel.MEDIUM;
  }

  // LOW
  if (
    upper.includes("LABELS") ||
    upper.includes("EQUIPMENT") ||
    upper.includes("EXTERIOR LIGHTING")
  ) {
    return SeverityLevel.LOW;
  }

  return SeverityLevel.UNKNOWN;
}

export function parseNhtsaDate(raw: string | null | undefined): Date | null {
  if (!raw) return null;

  // .NET JSON date format: /Date(1705276800000)/
  const dotNetMatch = raw.match(/\/Date\((\d+)\)\//);
  if (dotNetMatch) {
    return new Date(parseInt(dotNetMatch[1], 10));
  }

  // MM/DD/YYYY format
  const mmddyyyy = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (mmddyyyy) {
    const [, month, day, year] = mmddyyyy;
    return new Date(`${year}-${month}-${day}T00:00:00.000Z`);
  }

  // Fallback: try native Date parsing
  const parsed = new Date(raw);
  if (isNaN(parsed.getTime())) return null;
  return parsed;
}
