export function anchorHistoricalRemedy(text: string, campaignDate: string | null, currentDate = new Date().toISOString().slice(0,10)): string {
 if (!campaignDate || campaignDate >= '2026-01-01' || campaignDate >= currentDate) return text;
 if (!/in the coming months|will be mailed|\bsoon\b/i.test(text)) return text;
 const patched = text.replace(/in the coming months/gi, 'on the schedule in the original filing')
  .replace(/will be mailed/gi, 'were scheduled to be mailed')
  .replace(/as soon as you (?:get|receive) the recall notice/gi, 'after checking repair availability with your dealer')
  .replace(/\bsoon\b/gi, 'after confirming availability with your dealer');
 return `${patched} This timing describes the original ${campaignDate.slice(0,4)} filing; contact your dealer now to confirm the free repair is available.`;
}
export const STALE_REMEDY_SCAN = `SELECT id,remedy_enriched,report_received_date FROM recalls WHERE report_received_date < '2026-01-01' AND (LOWER(remedy_enriched) LIKE '%in the coming months%' OR LOWER(remedy_enriched) LIKE '%will be mailed%' OR LOWER(remedy_enriched) LIKE '%soon%')`;
export async function repairTemporalSummaries(db: D1Database): Promise<number> {
 const rows = await db.prepare(STALE_REMEDY_SCAN).all<{id:number;remedy_enriched:string;report_received_date:string}>();
 let count=0;
 for (const row of rows.results) {
  const text=anchorHistoricalRemedy(row.remedy_enriched,row.report_received_date);
  if(text === row.remedy_enriched) continue;
  await db.prepare('UPDATE recalls SET remedy_enriched=?,updated_at=? WHERE id=?').bind(text,new Date().toISOString(),row.id).run();
  count++;
 }
 return count;
}
