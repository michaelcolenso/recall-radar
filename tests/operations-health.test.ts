import test from 'node:test';import assert from 'node:assert/strict';
import {fixtureDatabase} from './helpers/database';import {repairCanonicalModels} from '../src/etl/repair-models';import {pipelineHealth} from '../src/lib/operations-health';
test('pipeline monitor detects grade corruption and caught ingestion errors',async()=>{
 const {db,sqlite,ram2019}=fixtureDatabase();await repairCanonicalModels(db);
 const clean=await pipelineHealth(db);assert.equal(clean.status,'healthy');
 sqlite.prepare("UPDATE vehicle_years SET risk_grade='A+' WHERE id=?").run(ram2019);
 const broken=await pipelineHealth(db);assert.equal(broken.integrity.unsafeGrades,1);assert.equal(broken.status,'unhealthy');
 sqlite.prepare("INSERT INTO ingestion_logs(run_type,status,records_saved,records_found,error_message,started_at,completed_at) VALUES('delta','completed-with-errors',0,0,'NHTSA failed','2026-11-09T02:01:00Z','2026-11-09T02:03:00Z')").run();
 const failed=await pipelineHealth(db,'2026-11-09T02:00:00Z',new Date('2026-11-09T03:00:00Z'));assert.equal(failed.scheduledRun.status,'failed');
 sqlite.close();
});
test('monitor distinguishes the future scheduled cycle from successful manual repair',async()=>{
 const {db,sqlite}=fixtureDatabase();await repairCanonicalModels(db);
 assert.equal((await pipelineHealth(db,'2026-11-09T02:00:00Z',new Date('2026-11-08T23:00:00Z'))).status,'awaiting-scheduled-run');
 assert.equal((await pipelineHealth(db,'2026-11-09T02:00:00Z',new Date('2026-11-09T04:00:00Z'))).scheduledRun.status,'overdue');
 sqlite.prepare("INSERT INTO ingestion_logs(run_type,status,records_found,records_saved,started_at,completed_at) VALUES('delta','completed',0,0,'2026-11-09T02:01:00Z','2026-11-09T02:03:00Z')").run();
 assert.equal((await pipelineHealth(db,'2026-11-09T02:00:00Z',new Date('2026-11-09T04:00:00Z'))).status,'healthy');sqlite.close();
});
test('a successful ingestion cannot hide a failed or stalled summary workflow',async()=>{
 const{includeWorkflowHealth}=await import('../src/lib/operations-health');const {db,sqlite}=fixtureDatabase();await repairCanonicalModels(db);const base=await pipelineHealth(db);
 const failed=includeWorkflowHealth(base,[{name:'enrichment-workflow',id:'broken',status:'errored',createdAt:'2026-11-12T02:00:00Z'}]);assert.equal(failed.status,'unhealthy');assert.match(failed.issues[0],/enrichment-workflow/);
 const stalled=includeWorkflowHealth(base,[{name:'enrichment-workflow',id:'stalled',status:'running',createdAt:'2026-11-12T02:00:00Z'}],new Date('2026-11-12T07:00:00Z'));assert.equal(stalled.status,'unhealthy');sqlite.close();
});
test('summary quality failures remain unhealthy even if the workflow itself completed',async()=>{
 const{db,sqlite}=fixtureDatabase();await repairCanonicalModels(db);
 sqlite.prepare("INSERT INTO ingestion_logs(run_type,status,records_found,records_saved,error_message,started_at,completed_at) VALUES('enrichment','completed-with-errors',2,1,'1 failed attempt','2026-11-12T07:00:00Z','2026-11-12T07:01:00Z')").run();
 const report=await pipelineHealth(db);assert.equal(report.status,'unhealthy');assert.match(report.issues[0],/enrichment/);sqlite.close();
});
