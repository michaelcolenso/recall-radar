import test from 'node:test';import assert from 'node:assert/strict';import {Hono} from 'hono';
import {disclosurePageTemplate} from '../src/templates/static-pages';import {goRoutes} from '../src/routes/go';import {fixtureDatabase} from './helpers/database';
test('no configured partners means an honest empty disclosure and disabled redirects',async()=>{
 const html=disclosurePageTemplate('');assert.match(html,/No affiliate partners are currently active/);assert.doesNotMatch(html,/<li>EpicVIN<\/li>/);
 const{db,sqlite}=fixtureDatabase();const app=new Hono().route('/',goRoutes);const r=await app.request('https://example.com/go/dvh',{}, {DB:db,AFFILIATE_PARTNERS:''});assert.equal(r.status,404);assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM affiliate_clicks').get()!.n,0);sqlite.close();
});
test('future enabled affiliate redirects do not persist full VIN referrers or query parameters',async()=>{
 const{db,sqlite}=fixtureDatabase();const app=new Hono().route('/',goRoutes),pending:Promise<unknown>[]=[];const vin='1FA6P8TH4F5410015';
 const r=await app.fetch(new Request('https://example.com/go/dvh?vin='+vin,{headers:{Referer:'https://example.com/vin-lookup?vin='+vin}}),{DB:db,AFFILIATE_PARTNERS:'dvh'},{waitUntil:p=>pending.push(p),passThroughOnException:()=>{}} as unknown as ExecutionContext);await Promise.all(pending);
 assert.equal(r.status,302);const row=sqlite.prepare('SELECT * FROM affiliate_clicks').get()!;assert.equal(row.referer,null);assert.equal(row.page_path,'/vin-lookup');assert.equal(row.vin_prefix,vin.slice(0,8));assert.ok(!JSON.stringify(row).includes(vin));sqlite.close();
});
