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
