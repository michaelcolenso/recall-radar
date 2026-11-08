const SYMPTOMS: [RegExp,string[]][] = [
 [/steering.*shak|wheel.*shak|vibrat/i,['STEERING','SUSPENSION','VIBRAT']],
 [/backup.*(?:blank|black)|rear.*camera|camera.*(?:blank|black)/i,['REARVIEW','BACKUP CAMERA','REAR VIEW','REAR-VIEW']],
 [/engine.*stall|stall.*stop|los(?:e|s).*power/i,['STALL','LOSS OF PROPULSION','ENGINE SHUT']],
 [/brake.*(?:fail|soft|loss)/i,['BRAKE','BRAKING']],
 [/smoke|burning|fire/i,['FIRE','OVERHEAT','SMOKE']],
];
export function symptomTerms(query:string): string[] {
 for(const [pattern,terms] of SYMPTOMS) if(pattern.test(query)) return terms;
 return query.toUpperCase().trim().split(/\s+/).filter(w=>w.length>2).slice(0,6);
}
export function symptomQuery(query:string): {sql:string;params:string[]} {
 const terms=symptomTerms(query);
 const text="UPPER(COALESCE(r.summary_enriched,r.summary_raw)||' '||COALESCE(r.consequence_enriched,r.consequence_raw)||' '||r.component)";
 return {sql:`SELECT r.nhtsa_campaign_number as campaign, MIN(r.component) as component, MIN(COALESCE(r.summary_enriched,r.summary_raw)) as summary, COUNT(DISTINCT r.vehicle_year_id) as vehicles FROM recalls r WHERE ${terms.length ? terms.map(()=>`${text} LIKE ? ESCAPE '\\'`).join(' OR ') : '0'} GROUP BY r.nhtsa_campaign_number ORDER BY MAX(r.report_received_date) DESC LIMIT 30`,params:terms.map(t=>'%'+t.replace(/[\\%_]/g,'\\$&')+'%')};
}
