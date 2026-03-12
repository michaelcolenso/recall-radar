import type { Severity } from "../env";

const HIGH = ["air bag", "brake", "fuel", "fire", "steering", "seat belt"];
const MEDIUM = ["engine", "electrical", "power train", "transmission"];

export const classifySeverity = (component: string): Severity => {
  const c = component.toLowerCase();
  if (HIGH.some((k) => c.includes(k))) return "high";
  if (MEDIUM.some((k) => c.includes(k))) return "medium";
  return "low";
};
