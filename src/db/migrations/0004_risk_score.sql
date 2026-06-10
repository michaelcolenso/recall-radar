-- Risk score foundation for Vehicle Intelligence Platform
-- Adds denormalized recall counts and computed risk grading to vehicle_years

ALTER TABLE vehicle_years ADD COLUMN recall_count INTEGER DEFAULT 0;
ALTER TABLE vehicle_years ADD COLUMN critical_recall_count INTEGER DEFAULT 0;
ALTER TABLE vehicle_years ADD COLUMN high_recall_count INTEGER DEFAULT 0;
ALTER TABLE vehicle_years ADD COLUMN medium_recall_count INTEGER DEFAULT 0;
ALTER TABLE vehicle_years ADD COLUMN low_recall_count INTEGER DEFAULT 0;
ALTER TABLE vehicle_years ADD COLUMN risk_score INTEGER;
ALTER TABLE vehicle_years ADD COLUMN risk_grade TEXT;
ALTER TABLE vehicle_years ADD COLUMN last_scored_at TEXT;

CREATE INDEX idx_vy_risk_score ON vehicle_years(risk_score);
CREATE INDEX idx_vy_risk_grade ON vehicle_years(risk_grade);
CREATE INDEX idx_vy_recall_count ON vehicle_years(recall_count);
