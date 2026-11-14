import test from 'node:test';import assert from 'node:assert/strict';import {Hono} from 'hono';
import {fixtureDatabase} from './helpers/database';import {eventRoutes} from '../src/routes/events';import {countConversion,pageType} from '../src/lib/conversions';
test('events aggregate into daily counters and discard extra identifying input',async()=>{
 const{db,sqlite}=fixtureDatabase(),app=new Hono().route('/',eventRoutes),env={DB:db};
 const post=(data:unknown,headers:Record<string,string>={})=>app.request('https://example.com/api/events',{method:'POST',headers:{Origin:'https://example.com','Content-Type':'application/json',...headers},body:JSON.stringify(data)},env);
 for(let i=0;i<2;i++)assert.equal((await post({event:'vehicle_search',page_type:'home',vin:'1FA6P8TH4F5410015',query:'private'})).status,204);
 const rows=sqlite.prepare('SELECT * FROM conversion_counts').all();assert.equal(rows.length,1);assert.equal(rows[0].count,2);assert.deepEqual(Object.keys(rows[0]).sort(),['count','day','event','page_type']);
 assert.equal((await post({event:'vin_lookup_started',page_type:'vin'},{DNT:'1'})).status,204);
 assert.equal((await post({event:'vin_lookup_started',page_type:'vin'},{'Sec-GPC':'1'})).status,204);
 assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM conversion_counts').get()!.n,1);
 assert.equal((await post({event:'arbitrary',page_type:'home'})).status,400);
 assert.equal((await post({event:'page_view',page_type:'VIN-value'})).status,400);
 assert.equal((await post({event:'page_view',page_type:'home'},{Origin:'https://evil.example'})).status,403);
 assert.equal((await post({event:'page_view',page_type:'home',padding:'x'.repeat(1000)})).status,413);sqlite.close();
});
test('VIN scope, dealer and print events remain distinct and bounded',async()=>{
 const{db,sqlite}=fixtureDatabase();for(const event of ['vin_lookup_started','vin_lookup_model_year','vin_lookup_vin','vin_lookup_failed','dealer_click','checklist_print','affiliate_click'] as const)await countConversion(db,event,'vin',new Date('2026-11-12T12:00:00Z'));
 assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM conversion_counts').get()!.n,7);
 assert.equal(pageType('/vin-lookup?vin=1FA6P8TH4F5410015'),'vin');assert.equal(pageType('/ram/1500/2019'),'year');sqlite.close();
});
test('client counters never transmit the VIN URL or queued arbitrary values and respect privacy signals',async()=>{
 const{readFileSync}=await import('node:fs');const{runInNewContext}=await import('node:vm');const script=readFileSync('public/events.js','utf8');
 for(const optOut of [false,true]){
  const sent:Blob[]=[];const window={rrEventQueue:['vin_lookup_started','vin_lookup_model_year','1FA6P8TH4F5410015'],addEventListener:()=>{}};
  runInNewContext(script,{window,navigator:{globalPrivacyControl:optOut,sendBeacon:(_url:string,body:Blob)=>{sent.push(body);return true;}},location:{pathname:'/vin-lookup',href:'https://example.com/vin-lookup?vin=1FA6P8TH4F5410015'},document:{addEventListener:()=>{}},Blob,URL});
  if(optOut){assert.equal(sent.length,0);continue;}
  const bodies=await Promise.all(sent.map(b=>b.text()));assert.equal(bodies.length,3);assert.ok(!bodies.join('').includes('1FA6P8TH4F5410015'));for(const body of bodies)assert.deepEqual(Object.keys(JSON.parse(body)).sort(),['event','page_type']);
 }
});
