import test from 'node:test';import assert from 'node:assert/strict';
import {fixtureDatabase} from './helpers/database';import {runEnrichment} from '../src/lib/enrichment-runner';import {withAiTimeout} from '../src/lib/enrichment';
function steps(){const sleeps:string[]=[];const timeouts:string[]=[];return {sleeps,timeouts,step:{do:async(name:string,...args:any[])=>{if(typeof args[0]==='object')timeouts.push(args[0].timeout);return args.at(-1)();},sleep:async(name:string)=>{sleeps.push(name);}} as any};}
test('enrichment uses durable sleeps and completes bounded batches without modifying raw language',async()=>{
 const{db,sqlite}=fixtureDatabase();const s=steps();const before=sqlite.prepare('SELECT summary_raw FROM recalls').all();
 const enrich=async()=>({summary:'Plain explanation of the affected part.',consequence:'The vehicle may lose braking performance.',remedy:'Your dealer will repair the part for free.',model:'test',score:1});
 const r=await runEnrichment({DB:db} as Env,{targetMake:'CHEVROLET',batchSize:1,maxBatches:2},s.step,enrich);
 assert.equal(r.enriched,2);assert.equal(r.batchLimitReached,true);assert.deepEqual(s.sleeps,['enrichment-pause-1']);assert.ok(s.timeouts.every(x=>x==='30 minutes'));
 assert.deepEqual(sqlite.prepare('SELECT summary_raw FROM recalls').all(),before);assert.equal(sqlite.prepare("SELECT status FROM ingestion_logs WHERE run_type='enrichment'").get()!.status,'completed');sqlite.close();
});
test('thrown enrichment attempts are recorded and cannot loop forever',async()=>{
 const{db,sqlite}=fixtureDatabase(),s=steps();const r=await runEnrichment({DB:db} as Env,{targetMake:'CHEVROLET',batchSize:1,maxBatches:3},s.step,async()=>{throw Error('AI unavailable');});
 assert.equal(r.failures,3);assert.equal(r.ok,false);assert.equal(sqlite.prepare('SELECT attempts FROM enrichment_failures').get()!.attempts,3);assert.equal(sqlite.prepare("SELECT status FROM ingestion_logs WHERE run_type='enrichment'").get()!.status,'completed-with-errors');sqlite.close();
});
test('AI deadlines reject hung calls and release timers on success and failure',async()=>{
 assert.equal(await withAiTimeout(async()=>42,1000),42);
 await assert.rejects(withAiTimeout(async()=>{throw Error('provider error');},1000),/provider error/);
 await assert.rejects(withAiTimeout(()=>new Promise(()=>{}),5),/AI_CALL_TIMEOUT/);
});
