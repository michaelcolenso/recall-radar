export interface PipelineHealth {
  checkedAt: string;
  status: 'healthy' | 'awaiting-scheduled-run' | 'unhealthy';
  issues: string[];
  scheduledRun: { expectedAfter: string | null; latest: Record<string, unknown> | null; status: 'not-requested' | 'pending' | 'completed' | 'failed' | 'overdue' };
  enrichmentRun: Record<string,unknown>|null;
  integrity: { duplicateCampaignYears: number; brokenJoins: number; unsafeGrades: number };
}
/** Read-only checks: workflow success alone can hide caught per-vehicle errors. */
export async function pipelineHealth(db: D1Database, expectedAfter?: string, now=new Date()): Promise<PipelineHealth> {
  if(expectedAfter && !Number.isFinite(Date.parse(expectedAfter))) throw new Error('Invalid expected-after timestamp');
  const [duplicates,joins,grades,latest,enrichment]=await Promise.all([
    db.prepare('SELECT COUNT(*) AS n FROM (SELECT vehicle_year_id,nhtsa_campaign_number FROM recalls GROUP BY vehicle_year_id,nhtsa_campaign_number HAVING COUNT(*)>1)').first<{n:number}>(),
    db.prepare('SELECT COUNT(*) AS n FROM recalls r LEFT JOIN vehicle_years vy ON vy.id=r.vehicle_year_id LEFT JOIN models m ON m.id=vy.model_id LEFT JOIN makes mk ON mk.id=m.make_id WHERE vy.id IS NULL OR m.id IS NULL OR mk.id IS NULL').first<{n:number}>(),
    db.prepare(`SELECT COUNT(*) AS n FROM vehicle_years vy JOIN (SELECT vehicle_year_id,COUNT(*) AS total,SUM(severity_level='CRITICAL') AS critical,SUM(severity_level='UNKNOWN') AS unclassified FROM recalls GROUP BY vehicle_year_id) r ON r.vehicle_year_id=vy.id WHERE ((r.total>=10 OR r.critical>=2) AND (vy.risk_grade IS NULL OR vy.risk_grade NOT IN ('D','F'))) OR (r.total<=2 AND r.total=r.unclassified AND vy.risk_grade='F')`).first<{n:number}>(),
    db.prepare("SELECT status,records_saved,error_message,started_at,completed_at FROM ingestion_logs WHERE run_type='delta' ORDER BY started_at DESC LIMIT 1").first<Record<string,unknown>>(),
    db.prepare("SELECT status,records_saved,error_message,started_at,completed_at FROM ingestion_logs WHERE run_type='enrichment' ORDER BY started_at DESC LIMIT 1").first<Record<string,unknown>>(),
  ]);
  const integrity={duplicateCampaignYears:duplicates?.n??0,brokenJoins:joins?.n??0,unsafeGrades:grades?.n??0};
  const issues=Object.entries(integrity).filter(([,n])=>n>0).map(([key,n])=>`${key}: ${n}`);
  if(enrichment&&(enrichment.status!=='completed'||enrichment.error_message))issues.push('Latest enrichment completed with errors');
  let status:PipelineHealth['scheduledRun']['status']='not-requested';
  if(expectedAfter){
    const matching=latest && Date.parse(String(latest.started_at))>=Date.parse(expectedAfter);
    if(matching){status=latest.status==='completed'&&!latest.error_message?'completed':'failed';if(status==='failed')issues.push('Scheduled delta completed with errors');}
    else if(now.getTime()>Date.parse(expectedAfter)+90*60*1000){status='overdue';issues.push('No completed delta run after the expected schedule and 90-minute grace period');}
    else status='pending';
  }
  return {checkedAt:now.toISOString(),status:issues.length?'unhealthy':status==='pending'?'awaiting-scheduled-run':'healthy',issues,scheduledRun:{expectedAfter:expectedAfter??null,latest,status},enrichmentRun:enrichment,integrity};
}
export interface WorkflowHealth {name:string;id:string;status:string;createdAt:string}
export function includeWorkflowHealth(report:PipelineHealth,workflows:WorkflowHealth[],now=new Date()):PipelineHealth&{workflows:WorkflowHealth[]}{
 const issues=[...report.issues];
 for(const w of workflows){
  if(['errored','terminated'].includes(w.status))issues.push(`${w.name}: ${w.status}`);
  else if(w.status!=='complete'&&now.getTime()-Date.parse(w.createdAt)>4*60*60*1000)issues.push(`${w.name}: unfinished for more than four hours`);
 }
 return {...report,issues,status:issues.length?'unhealthy':report.status,workflows};
}
