import { normalizeModel } from './normalize-models';
import { scoreAllVehicleYears } from '../lib/risk-score';
/** Idempotent repair. Raw government text and original model metadata survive merges. */
export async function repairCanonicalModels(db: D1Database, options: {sourceModelId?:number; sourceYear?:number; rescore?:boolean} = {}): Promise<{ merged: number; scored: number }> {
 const rows = await db.prepare('SELECT m.id, m.name, m.slug, mk.name as make_name FROM models m JOIN makes mk ON mk.id=m.make_id'+(options.sourceModelId !== undefined ? ' WHERE m.id=?' : '')).bind(...(options.sourceModelId !== undefined ? [options.sourceModelId] : [])).all<{id:number;name:string;slug:string;make_name:string}>();
 let merged = 0;
 for (const row of rows.results) {
  if(options.sourceModelId !== undefined && row.id !== options.sourceModelId) continue;
  const n = normalizeModel(row.make_name,row.name);
  await db.prepare('UPDATE models SET vehicle_type=? WHERE id=?').bind(n.vehicleType,row.id).run();
  if (n.vehicleType !== 'passenger' || (n.make === row.make_name && n.slug === row.slug)) continue;
  const make = await db.prepare('SELECT id FROM makes WHERE UPPER(name)=?').bind(n.make).first<{id:number}>();
  if (!make) continue;
  const now = new Date().toISOString();
  await db.prepare('INSERT INTO models(make_id,name,slug,created_at,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(make_id,slug) DO NOTHING').bind(make.id,n.model,n.slug,now,now).run();
  const model = await db.prepare('SELECT id FROM models WHERE make_id=? AND slug=?').bind(make.id,n.slug).first<{id:number}>();
  if (!model || model.id === row.id) continue;
  const years = await db.prepare('SELECT id,year,last_ingested_at FROM vehicle_years WHERE model_id=? AND (EXISTS(SELECT 1 FROM recalls r WHERE r.vehicle_year_id=vehicle_years.id) OR EXISTS(SELECT 1 FROM alert_subscriptions s WHERE s.vehicle_year_id=vehicle_years.id))').bind(row.id).all<{id:number;year:number;last_ingested_at:string|null}>();
  for (const year of years.results) {
   if(options.sourceYear !== undefined && year.year !== options.sourceYear) continue;
   await db.prepare('INSERT INTO vehicle_years(model_id,year,created_at,updated_at,last_ingested_at) VALUES(?,?,?,?,?) ON CONFLICT(model_id,year) DO UPDATE SET last_ingested_at=MAX(COALESCE(vehicle_years.last_ingested_at,\'\'),COALESCE(excluded.last_ingested_at,\'\'))').bind(model.id,year.year,now,now,year.last_ingested_at).run();
   const target = await db.prepare('SELECT id FROM vehicle_years WHERE model_id=? AND year=?').bind(model.id,year.year).first<{id:number}>();
   if (!target) continue;
   await db.prepare('INSERT INTO vehicle_year_aliases(source_id,canonical_id) VALUES(?,?) ON CONFLICT(source_id) DO UPDATE SET canonical_id=excluded.canonical_id').bind(year.id,target.id).run();
   // Preserve aliases even on overlapping campaigns before merging them.
   const recalls = await db.prepare('SELECT id,nhtsa_campaign_number,source_models FROM recalls WHERE vehicle_year_id=?').bind(year.id).all<{id:number;nhtsa_campaign_number:string;source_models:string|null}>();
   const existing=await db.prepare('SELECT id,nhtsa_campaign_number,source_models FROM recalls WHERE vehicle_year_id=?').bind(target.id).all<{id:number;nhtsa_campaign_number:string;source_models:string|null}>();
   const byCampaign=new Map(existing.results.map(recall=>[recall.nhtsa_campaign_number,recall]));
   const statements:D1PreparedStatement[]=[];
   for (const recall of recalls.results) {
    const duplicate = byCampaign.get(recall.nhtsa_campaign_number);
    const sources = JSON.stringify([...new Set([`${row.make_name} ${row.name}`, ...JSON.parse(recall.source_models || '[]'), ...JSON.parse(duplicate?.source_models || '[]')])]);
    if (!duplicate) {
     statements.push(db.prepare('UPDATE recalls SET vehicle_year_id=?,source_models=? WHERE id=?').bind(target.id,sources,recall.id));
    } else {
     statements.push(
      db.prepare('UPDATE recalls SET source_models=?, summary_enriched=COALESCE(summary_enriched,(SELECT summary_enriched FROM recalls WHERE id=?)), consequence_enriched=COALESCE(consequence_enriched,(SELECT consequence_enriched FROM recalls WHERE id=?)), remedy_enriched=COALESCE(remedy_enriched,(SELECT remedy_enriched FROM recalls WHERE id=?)), enriched_at=COALESCE(enriched_at,(SELECT enriched_at FROM recalls WHERE id=?)) WHERE id=?').bind(sources,recall.id,recall.id,recall.id,recall.id,duplicate.id),
      db.prepare('UPDATE OR IGNORE alert_sends SET recall_id=? WHERE recall_id=?').bind(duplicate.id,recall.id),
      db.prepare('UPDATE OR IGNORE enrichment_failures SET recall_id=? WHERE recall_id=?').bind(duplicate.id,recall.id),
      db.prepare('DELETE FROM recalls WHERE id=?').bind(recall.id),
     );
    }
   }
   for(let offset=0;offset<statements.length;offset+=90) await db.batch(statements.slice(offset,offset+90));
   // Keep subscription IDs, confirmation and unsubscribe tokens unchanged.
   // Digest joins resolve historical vehicle IDs through vehicle_year_aliases.
  }
  merged++;
 }
 const scores = options.rescore === false ? {scored:0,errors:[]} : await scoreAllVehicleYears(db);
 if (scores.errors.length) throw new Error(scores.errors.join('; '));
 return {merged,scored:scores.scored};
}
