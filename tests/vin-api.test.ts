import test from 'node:test';import assert from 'node:assert/strict';import {Hono} from 'hono';import {apiRoutes} from '../src/routes/api';
const app=new Hono().route('/api',apiRoutes),path='/api/vin-lookup?vin=1FA6P8TH4F5410015';
test('VIN service failure returns labeled model-year records and an official VIN check',async()=>{
 const original=globalThis.fetch;globalThis.fetch=async input=>{
  const url=String(input);
  if(url.includes('recallsByVin')) return Response.json({error:'missing'},{status:404});
  if(url.includes('decodevinvalues'))return Response.json({Count:1,Results:[{Make:'FORD',Model:'Mustang',ModelYear:'2015',ErrorCode:'0',ErrorText:''}]});
  return Response.json({Count:1,results:[{NHTSACampaignNumber:'24V653000',Component:'BRAKES',Summary:'source',Consequence:'risk',Remedy:"Ford's number for this recall is 24S01.",ReportReceivedDate:'2024-01-01'}]});
 };
 try{const r=await app.request(path);assert.equal(r.status,200);const d=await r.json();assert.equal(d.scope,'model-year');assert.equal(d.count,1);assert.equal(d.vehicle.model,'Mustang');assert.equal(d.officialVinUrl,'https://www.nhtsa.gov/recalls');assert.match(d.checklistHtml,/24S01/);}finally{globalThis.fetch=original;}
});
test('unavailable VIN and decoder data never become a clean recall result',async()=>{
 const original=globalThis.fetch;globalThis.fetch=async input=>String(input).includes('recallsByVin') ? Response.json({}, {status:404}) : Response.json({Count:0,Results:[]});
 try{const r=await app.request(path);assert.equal(r.status,502);const d=await r.json();assert.ok(d.error);assert.equal(d.count,undefined);assert.equal(d.officialVinUrl,'https://www.nhtsa.gov/recalls');}finally{globalThis.fetch=original;}
});
test('a successful VIN-specific response is distinguishable from model-year fallback',async()=>{
 const original=globalThis.fetch;globalThis.fetch=async()=>Response.json({Count:0,results:[]});
 try{const r=await app.request(path);const d=await r.json();assert.equal(d.scope,'vin');assert.equal(d.count,0);}finally{globalThis.fetch=original;}
});
