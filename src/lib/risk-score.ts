import type { SeverityLevel } from "../db/schema";
import type { D1Database } from "@cloudflare/workers-types";

// ─── Severity Weights ───────────────────────────────────────────
// These weights are proprietary and form part of the competitive moat.
const SEVERITY_WEIGHTS: Record<SeverityLevel, number> = {
  CRITICAL: 5.0,
  HIGH: 3.0,
  MEDIUM: 1.0,
  LOW: 0.3,
  UNKNOWN: 0.5,
};

// Temporal decay: each year reduces impact by 15%
const TEMPORAL_DECAY_BASE = 0.85;

// Recency bonus multiplier for recalls within 24 months
const RECENCY_BONUS_MONTHS = 24;
const RECENCY_MULTIPLIER = 1.5;

// Grade boundaries (percentile thresholds)
// Grade is assigned based on what % of vehicles have a LOWER (better) score
const GRADE_BOUNDARIES = [
  { grade: "A+", minPercentile: 95 },
  { grade: "A", minPercentile: 90 },
  { grade: "A-", minPercentile: 80 },
  { grade: "B+", minPercentile: 75 },
  { grade: "B", minPercentile: 70 },
  { grade: "B-", minPercentile: 60 },
  { grade: "C+", minPercentile: 55 },
  { grade: "C", minPercentile: 45 },
  { grade: "C-", minPercentile: 40 },
  { grade: "D+", minPercentile: 35 },
  { grade: "D", minPercentile: 25 },
  { grade: "D-", minPercentile: 20 },
  { grade: "F", minPercentile: 0 },
];

// ─── Types ──────────────────────────────────────────────────────
interface RecallForScoring {
  severityLevel: SeverityLevel;
  reportReceivedDate: string | null;
}

interface VehicleYearScore {
  id: number;
  modelId: number;
  year: number;
  riskScore: number | null;
}

// ─── Public API ─────────────────────────────────────────────────

/**
 * Calculate the raw risk score (0–100) for a single vehicle year
 * based on its recall history.
 */
export function calculateRawScore(recalls: RecallForScoring[], referenceDate = new Date()): number {
  if (recalls.length === 0) return 0;

  const referenceYear = referenceDate.getFullYear();
  const referenceMonth = referenceDate.getMonth();

  let weightedSum = 0;

  for (const recall of recalls) {
    const severityWeight = SEVERITY_WEIGHTS[recall.severityLevel] ?? SEVERITY_WEIGHTS.UNKNOWN;

    // Temporal decay based on years since recall report date
    let yearsSince = 0;
    if (recall.reportReceivedDate) {
      const reportDate = new Date(recall.reportReceivedDate);
      const reportYear = reportDate.getFullYear();
      const reportMonth = reportDate.getMonth();
      yearsSince = referenceYear - reportYear + (referenceMonth - reportMonth) / 12;
      if (yearsSince < 0) yearsSince = 0;
    }

    const decay = Math.pow(TEMPORAL_DECAY_BASE, yearsSince);

    // Recency bonus: recalls within last 24 months get extra weight
    let recencyMultiplier = 1.0;
    if (recall.reportReceivedDate) {
      const reportDate = new Date(recall.reportReceivedDate);
      const monthsSince = (referenceYear - reportDate.getFullYear()) * 12 + (referenceMonth - reportDate.getMonth());
      if (monthsSince >= 0 && monthsSince <= RECENCY_BONUS_MONTHS) {
        recencyMultiplier = RECENCY_MULTIPLIER;
      }
    }

    weightedSum += severityWeight * decay * recencyMultiplier;
  }

  // Add flat penalties for severe patterns
  const criticalCount = recalls.filter((r) => r.severityLevel === "CRITICAL").length;
  const highCount = recalls.filter((r) => r.severityLevel === "HIGH").length;
  const totalCount = recalls.length;

  let penalty = 0;
  if (criticalCount >= 1) penalty += 5;
  if (criticalCount >= 2) penalty += 5;
  if (criticalCount >= 3) penalty += 10;
  if (highCount >= 2) penalty += 3;
  if (highCount >= 4) penalty += 5;
  if (totalCount >= 4) penalty += 2;
  if (totalCount >= 7) penalty += 3;
  if (totalCount >= 10) penalty += 5;

  return Math.min(100, Math.round(weightedSum + penalty));
}

/**
 * Convert a raw score to a letter grade based on global percentiles.
 * Requires the total count of scored vehicles to compute percentile.
 */
export function scoreToGrade(rawScore: number, percentile: number): string {
  // Exact percentile lookup
  for (const boundary of GRADE_BOUNDARIES) {
    if (percentile >= boundary.minPercentile) {
      return boundary.grade;
    }
  }
  return "F";
}

/**
 * Compute percentile for a given raw score.
 * percentile = (% of vehicles with a strictly lower score) * 100
 */
export async function computePercentile(
  db: D1Database,
  rawScore: number,
): Promise<number> {
  const result = await db.prepare(
    `SELECT
      (SELECT COUNT(*) FROM vehicle_years WHERE risk_score IS NOT NULL AND risk_score < ?) * 100.0 /
      NULLIF((SELECT COUNT(*) FROM vehicle_years WHERE risk_score IS NOT NULL), 0) as percentile
    `
  )
    .bind(rawScore)
    .first<{ percentile: number | null }>();

  return result?.percentile ?? 50;
}

/**
 * Score a single vehicle year and persist the result.
 * Returns the computed score and grade.
 */
export async function scoreVehicleYear(
  db: D1Database,
  vehicleYearId: number,
): Promise<{ score: number; grade: string } | null> {
  // Fetch recalls for this vehicle year
  const recallsResult = await db.prepare(
    `SELECT severity_level, report_received_date
     FROM recalls
     WHERE vehicle_year_id = ?`
  )
    .bind(vehicleYearId)
    .all<{ severity_level: SeverityLevel; report_received_date: string | null }>();

  const recalls = recallsResult.results.map((r) => ({
    severityLevel: r.severity_level,
    reportReceivedDate: r.report_received_date,
  }));

  const score = calculateRawScore(recalls);

  // Count by severity for denormalized fields
  const criticalCount = recalls.filter((r) => r.severityLevel === "CRITICAL").length;
  const highCount = recalls.filter((r) => r.severityLevel === "HIGH").length;
  const mediumCount = recalls.filter((r) => r.severityLevel === "MEDIUM").length;
  const lowCount = recalls.filter((r) => r.severityLevel === "LOW").length;

  // Compute percentile and grade
  const percentile = await computePercentile(db, score);
  const grade = scoreToGrade(score, percentile);

  const now = new Date().toISOString();

  await db.prepare(
    `UPDATE vehicle_years
     SET recall_count = ?,
         critical_recall_count = ?,
         high_recall_count = ?,
         medium_recall_count = ?,
         low_recall_count = ?,
         risk_score = ?,
         risk_grade = ?,
         last_scored_at = ?,
         updated_at = ?
     WHERE id = ?`
  )
    .bind(
      recalls.length,
      criticalCount,
      highCount,
      mediumCount,
      lowCount,
      score,
      grade,
      now,
      now,
      vehicleYearId,
    )
    .run();

  return { score, grade };
}

/**
 * Batch score all vehicle years for a given make.
 * Used by admin API and ingestion workflow.
 */
export async function scoreAllVehicleYearsForMake(
  db: D1Database,
  makeSlug: string,
): Promise<{ scored: number; errors: string[] }> {
  const errors: string[] = [];

  const vehicleYearsResult = await db.prepare(
    `SELECT vy.id
     FROM vehicle_years vy
     JOIN models m ON m.id = vy.model_id
     JOIN makes mk ON mk.id = m.make_id
     WHERE mk.slug = ?`
  )
    .bind(makeSlug)
    .all<{ id: number }>();

  let scored = 0;
  for (const vy of vehicleYearsResult.results) {
    try {
      await scoreVehicleYear(db, vy.id);
      scored++;
    } catch (err) {
      errors.push(`vehicle_year ${vy.id}: ${String(err)}`);
    }
  }

  return { scored, errors };
}

/**
 * Batch score ALL vehicle years in the database.
 * Warning: can be slow for large databases. Use with care.
 */
export async function scoreAllVehicleYears(
  db: D1Database,
): Promise<{ scored: number; errors: string[] }> {
  const errors: string[] = [];

  const vehicleYearsResult = await db.prepare(
    `SELECT id FROM vehicle_years ORDER BY id`
  )
    .all<{ id: number }>();

  let scored = 0;
  for (const vy of vehicleYearsResult.results) {
    try {
      await scoreVehicleYear(db, vy.id);
      scored++;
    } catch (err) {
      errors.push(`vehicle_year ${vy.id}: ${String(err)}`);
    }
  }

  return { scored, errors };
}

/**
 * Map a risk grade to a 1-5 star rating for schema.org aggregateRating.
 */
export function gradeToStarRating(grade: string | null | undefined): number {
  if (!grade) return 3;
  const map: Record<string, number> = {
    "A+": 5, "A": 5, "A-": 4.5,
    "B+": 4, "B": 4, "B-": 3.5,
    "C+": 3, "C": 3, "C-": 2.5,
    "D+": 2, "D": 2, "D-": 1.5,
    "F": 1,
  };
  return map[grade] ?? 3;
}

/**
 * Get a human-readable description of what a risk grade means.
 */
export function gradeDescription(grade: string): string {
  const map: Record<string, string> = {
    "A+": "Excellent — very few recalls, none critical.",
    "A": "Very good — minimal recall history.",
    "A-": "Good — low recall frequency and severity.",
    "B+": "Above average — some recalls, mostly minor.",
    "B": "Average — typical recall history for its age.",
    "B-": "Slightly below average — moderate recall count.",
    "C+": "Below average — several recalls, some serious.",
    "C": "Poor — multiple recalls with safety concerns.",
    "C-": "Very poor — frequent or serious recalls.",
    "D+": "Bad — significant safety recall history.",
    "D": "Very bad — numerous serious recalls.",
    "D-": "Severe — extensive critical recall history.",
    "F": "Avoid — among the worst recall records.",
  };
  return map[grade] ?? "Risk grade pending.";
}
