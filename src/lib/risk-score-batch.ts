import type { D1Database } from '@cloudflare/workers-types';

/** Recompute the same UTC month-based score as calculateRawScore in bounded SQL batches. */
export async function scoreVehicleYearsBatch(db: D1Database, ids: number[], referenceDate = new Date()): Promise<number> {
 const unique=[...new Set(ids)];
 if(unique.some(id=>!Number.isSafeInteger(id)||id<=0)) throw new Error('Invalid vehicle year ID');
 const timestamp=referenceDate.toISOString();
 for(let offset=0;offset<unique.length;offset+=90) {
  const batch=unique.slice(offset,offset+90);
  const sql=`WITH clock AS (SELECT CAST(strftime('%Y',?) AS INTEGER)*12+CAST(strftime('%m',?1) AS INTEGER) AS month),
  target AS (SELECT id FROM vehicle_years WHERE id IN (${batch.map(()=>'?').join(',')})),
  timed AS (SELECT r.*,clock.month-CAST(strftime('%Y',r.report_received_date) AS INTEGER)*12-CAST(strftime('%m',r.report_received_date) AS INTEGER) AS months_since FROM recalls r CROSS JOIN clock WHERE r.vehicle_year_id IN (SELECT id FROM target)),
  counts AS (SELECT t.id,COUNT(r.id) AS total,
   SUM(CASE WHEN r.severity_level='CRITICAL' THEN 1 ELSE 0 END) AS critical,
   SUM(CASE WHEN r.severity_level='HIGH' THEN 1 ELSE 0 END) AS high,
   SUM(CASE WHEN r.severity_level='MEDIUM' THEN 1 ELSE 0 END) AS medium,
   SUM(CASE WHEN r.severity_level='LOW' THEN 1 ELSE 0 END) AS low,
   SUM(CASE WHEN r.id IS NULL THEN 0 ELSE
    (CASE r.severity_level WHEN 'CRITICAL' THEN 5.0 WHEN 'HIGH' THEN 3.0 WHEN 'MEDIUM' THEN 1.0 WHEN 'LOW' THEN 0.3 ELSE 0.5 END)
    *pow(0.85,MAX(0,COALESCE(r.months_since,0)/12.0))
    *(CASE WHEN r.months_since BETWEEN 0 AND 24 THEN 1.5 ELSE 1.0 END) END) AS weighted
   FROM target t LEFT JOIN timed r ON r.vehicle_year_id=t.id GROUP BY t.id),
  scores AS (SELECT *,MIN(100,MAX(
   CASE WHEN critical>=2 OR total>=10 THEN 70 WHEN critical>=1 OR total>=6 THEN 35 WHEN total>=3 THEN 13 WHEN total>=2 OR high>=1 THEN 4 WHEN total>=1 THEN 1 ELSE 0 END,
   ROUND(weighted+(critical>=1)*5+(critical>=2)*5+(critical>=3)*10+(high>=2)*3+(high>=4)*5+(total>=4)*2+(total>=7)*3+(total>=10)*5))) AS score FROM counts)
  UPDATE vehicle_years AS vy SET recall_count=s.total,critical_recall_count=s.critical,high_recall_count=s.high,medium_recall_count=s.medium,low_recall_count=s.low,
   risk_score=s.score,risk_grade=CASE WHEN s.score=0 THEN 'A+' WHEN s.score<=3 THEN 'A' WHEN s.score<=12 THEN 'B' WHEN s.score<=34 THEN 'C' WHEN s.score<=69 THEN 'D' ELSE 'F' END,
   last_scored_at=?${batch.length+2},updated_at=?${batch.length+2} FROM scores s WHERE vy.id=s.id`;
  await db.prepare(sql).bind(timestamp,...batch,timestamp).run();
 }
 return unique.length;
}
