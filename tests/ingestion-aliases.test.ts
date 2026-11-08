import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchCanonicalRecalls } from '../src/lib/nhtsa-client';
test('NHTSA alias requests retain source models and deduplicate campaign IDs', async () => {
 const original=globalThis.fetch, sources:string[]=[];
 globalThis.fetch=async input=>{
  const url=new URL(String(input));sources.push(url.searchParams.get('make')+' '+url.searchParams.get('model'));
  return Response.json({Count:1,results:[{NHTSACampaignNumber:'08V123000',Component:'BRAKES',Summary:'source',Consequence:'risk',Remedy:'free',ReportReceivedDate:'2008-01-01'}]});
 };
 try {
  const recalls=await fetchCanonicalRecalls('RAM','1500',2008);
  assert.equal(recalls.length,1);assert.ok(sources.includes('DODGE RAM 1500'));
  assert.deepEqual(new Set(recalls[0].SourceModels),new Set(sources));
 }finally{globalThis.fetch=original;}
});

test('an unregistered Mercedes family alias does not discard valid trim recalls',async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=async input=>{
  const model=new URL(String(input)).searchParams.get('model');
  if(model!=='C300')return Response.json({Count:0,Message:'Results returned successfully',results:[]},{status:400});
  return Response.json({Count:1,results:[{NHTSACampaignNumber:'23V462000',Component:'STEERING',Summary:'source',Consequence:'risk',Remedy:'free',ReportReceivedDate:'2023-07-01'}]});
 };
 try{const recalls=await fetchCanonicalRecalls('MERCEDES-BENZ','C-Class',2023);assert.equal(recalls.length,1);assert.deepEqual(recalls[0].SourceModels,['MERCEDES-BENZ C300']);}finally{globalThis.fetch=original;}
});

test('temporary NHTSA HTTP failures retry instead of creating empty coverage',async()=>{
 const {fetchModelsForMake}=await import('../src/lib/nhtsa-client');
 const original=globalThis.fetch;let calls=0;
 globalThis.fetch=async()=>++calls===1 ? Response.json({error:'busy'},{status:503}) : Response.json({Count:1,Results:[{Make_ID:1,Make_Name:'RAM',Model_ID:1,Model_Name:'1500'}]});
 try{assert.equal((await fetchModelsForMake(1))[0].Model_Name,'1500');assert.equal(calls,2);}finally{globalThis.fetch=original;}
});
