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
