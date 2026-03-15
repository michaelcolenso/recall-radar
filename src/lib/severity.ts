import type { SeverityLevel } from "../db/schema";

const SEVERITY_MAP: Record<string, SeverityLevel> = {
  // CRITICAL — life-threatening
  "ENGINE": "CRITICAL",
  "FUEL SYSTEM": "CRITICAL",
  "BRAKE": "CRITICAL",
  "STEERING": "CRITICAL",
  "POWER TRAIN": "CRITICAL",

  // HIGH — serious safety concern
  "AIR BAG": "HIGH",
  "SEAT BELT": "HIGH",
  "SUSPENSION": "HIGH",
  "TIRE": "HIGH",
  "WHEEL": "HIGH",

  // MEDIUM — reduced visibility/control
  "ELECTRICAL": "MEDIUM",
  "LIGHTING": "MEDIUM",
  "VISIBILITY": "MEDIUM",
  "WINDSHIELD WIPER": "MEDIUM",

  // LOW — cosmetic or minor
  "LABEL": "LOW",
  "SEAT": "LOW",
  "EXTERIOR LIGHTING": "LOW",
};

export function classifySeverity(component: string): SeverityLevel {
  const upper = component.toUpperCase();
  for (const [keyword, level] of Object.entries(SEVERITY_MAP)) {
    if (upper.includes(keyword)) return level;
  }
  return "UNKNOWN";
}
