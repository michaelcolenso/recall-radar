import test from 'node:test';
import assert from 'node:assert/strict';
import { Hono } from 'hono';
import { fixtureDatabase } from './helpers/database';
import { repairCanonicalModels } from '../src/etl/repair-models';
import { pageRoutes } from '../src/routes/pages';
import { apiRoutes } from '../src/routes/api';
test('migrated SQLite supports canonical repairs and real audited page routes', async () => {
 const {db,sqlite}=fixtureDatabase();
 const before=sqlite.prepare('SELECT COUNT(*) as n FROM recalls').get()!.n;
 await repairCanonicalModels(db);await repairCanonicalModels(db);
 assert.equal(sqlite.prepare('SELECT COUNT(*) as n FROM recalls').get()!.n,before);
 const app=new Hono().route('/api',apiRoutes).route('/',pageRoutes);
 const env={DB:db,SITE_URL:'https://example.com',ADMIN_TOKEN:'test'};
 const get=async(path:string)=>{const res=await app.request(path,{},env);assert.equal(res.status,200,path);return res.text();};
 const ram=await get('/ram/1500/2019');assert.match(ram,/Risk Grade: F/);assert.doesNotMatch(ram,/Risk Grade: A\+/);
 const malibu=await get('/chevrolet/malibu/2023');assert.doesNotMatch(malibu,/Most severe issue:|Under Review|Grade F/);assert.match(malibu,/honda\/accord\/2023/);
 const make=await get('/ram');assert.equal((make.match(/rr-card__title">ELECTRICAL SYSTEM</g)||[]).length,1);
 const mercedes=await get('/mercedes-benz');for(const family of ['C-Class','E-Class','S-Class','GLC-Class','GLE-Class','Sprinter'])assert.ok(mercedes.includes(family),family);
 const model=await get('/ram/1500');for(const year of [2008,2020,2026])assert.ok(model.includes(`/ram/1500/${year}`));
 const campaign=await get('/recall/24V653000');assert.match(campaign,/<title>Recall #24V653000: 2019 RAM 1500/);assert.match(campaign,/Show original NHTSA language/);
 const schemas=[...ram.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m=>JSON.parse(m[1]));assert.ok(schemas.some(s=>s['@type']==='WebPage'&&s.dateModified==='2026-10-01T12:00:00.000Z'));
 const auth=await app.request('/api/admin/repair-models',{method:'POST'},env);assert.equal(auth.status,401);
 const options=await get('/api/vehicles?make=ram&model=1500');assert.ok(options.includes('2026'));
 const search=JSON.parse(await get('/api/search?q=2023%20Chevrolet%20Malibu'));assert.ok(search.results.some((r:any)=>r.href==='/chevrolet/malibu/2023'));
 const alias=await app.request('/dodge/ram-1500/2008',{},env);assert.equal(alias.status,301);assert.equal(alias.headers.get('location'),'/ram/1500/2008');
 await get('/stats/ram/1500');await get('/symptoms?q=backup%20camera%20blank');await get('/dealers/ram?campaign=24V653000');
});

test('duplicate canonical campaigns retain enrichment and both source aliases', async () => {
 const {db,sqlite,model,year,recall}=fixtureDatabase();
 await repairCanonicalModels(db);
 const mercedes=Number(sqlite.prepare("SELECT id FROM makes WHERE slug='mercedes-benz'").get()!.id);
 const sourceYear=year(model(mercedes,'C350','c350'),2023);
 recall(sourceYear,'23V000300');
 sqlite.prepare("UPDATE recalls SET summary_enriched='Readable text',consequence_enriched='Readable risk',remedy_enriched='Readable fix',enriched_at='2024-01-01' WHERE vehicle_year_id=?").run(sourceYear);
 await repairCanonicalModels(db);
 const row=sqlite.prepare("SELECT r.source_models,r.summary_enriched FROM recalls r JOIN vehicle_years vy ON vy.id=r.vehicle_year_id JOIN models m ON m.id=vy.model_id WHERE m.slug='c-class' AND r.nhtsa_campaign_number='23V000300'").get()!;
 assert.equal(row.summary_enriched,'Readable text');assert.match(String(row.source_models),/C350/);assert.match(String(row.source_models),/C300/);
 assert.equal(sqlite.prepare("SELECT COUNT(*) as n FROM recalls r JOIN vehicle_years vy ON vy.id=r.vehicle_year_id JOIN models m ON m.id=vy.model_id WHERE m.slug='c-class' AND nhtsa_campaign_number='23V000300'").get()!.n,1);
});

test('canonical merges preserve historical alert opt-ins and unsubscribe tokens', async () => {
 const {db,sqlite}=fixtureDatabase();
 const oldYear=sqlite.prepare("SELECT vy.id FROM vehicle_years vy JOIN models m ON m.id=vy.model_id JOIN makes mk ON mk.id=m.make_id WHERE mk.slug='dodge' AND m.slug='ram-1500'").get()!.id;
 sqlite.prepare("INSERT INTO alert_subscriptions(email,vehicle_year_id,status,confirm_token,unsub_token,created_at) VALUES(?,?,'active',?,?,?)").run('driver@example.com',oldYear,'confirm-original','unsubscribe-original','2024-01-01');
 await repairCanonicalModels(db);
 const sub=sqlite.prepare('SELECT vehicle_year_id,unsub_token FROM alert_subscriptions').get()!;
 assert.equal(sub.vehicle_year_id,oldYear);assert.equal(sub.unsub_token,'unsubscribe-original');
 const matched=sqlite.prepare("SELECT r.nhtsa_campaign_number FROM recalls r JOIN alert_subscriptions s ON COALESCE((SELECT canonical_id FROM vehicle_year_aliases WHERE source_id=s.vehicle_year_id),s.vehicle_year_id)=r.vehicle_year_id WHERE s.status='active'").all();
 assert.ok(matched.some(row=>row.nhtsa_campaign_number==='08V123000'));
});

test('model freshness includes valid same-day ISO timestamps', async () => {
 const {db,sqlite,ramModel}=fixtureDatabase();
 const timestamp=new Date(Date.now()-1000).toISOString();
 sqlite.prepare('UPDATE vehicle_years SET last_ingested_at=? WHERE model_id=?').run(timestamp,ramModel);
 const app=new Hono().route('/',pageRoutes);
 const res=await app.request('/ram/1500',{}, {DB:db,SITE_URL:'https://example.com'});
 assert.equal(res.status,200);
 const html=await res.text();
 const schemas=[...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m=>JSON.parse(m[1]));
 assert.equal(schemas.find(s=>s['@type']==='WebPage').dateModified,timestamp);
});

test('every audited page emits matching breadcrumbs and campaign freshness uses all affected years', async () => {
 const {db,sqlite,ramModel,year,recall}=fixtureDatabase();
 const older=year(ramModel,2018);recall(older,'24V653000');
 sqlite.prepare("UPDATE vehicle_years SET last_ingested_at='2026-11-03T12:00:00.000Z' WHERE id=?").run(older);
 const app=new Hono().route('/',pageRoutes), env={DB:db,SITE_URL:'https://example.com'};
 for(const path of ['/ram','/ram/1500','/ram/1500/2019','/recall/24V653000']) {
  const res=await app.request(path,{},env);assert.equal(res.status,200);
  const html=await res.text();
  const schemas=[...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m=>JSON.parse(m[1]));
  const crumbs=schemas.find(s=>s['@type']==='BreadcrumbList');
  const nav=html.match(/<nav class="rr-breadcrumb"[^>]*>([\s\S]*?)<\/nav>/)![1];
  const labels=[...nav.matchAll(/<a[^>]*>(.*?)<\/a>|<span class="rr-breadcrumb__current">(.*?)<\/span>/g)].map(m=>m[1]??m[2]);
  assert.deepEqual(crumbs.itemListElement.map((item:any)=>item.name),labels,path);
  const web=schemas.find(s=>s['@type']==='WebPage');assert.ok(web.dateModified,path);
  if(path==='/recall/24V653000') assert.equal(web.dateModified,'2026-11-03T12:00:00.000Z');
  if(path==='/ram/1500'||path==='/ram/1500/2019') assert.ok(schemas.some(s=>s['@type']==='FAQPage'));
 }
});

test('canonical aliases also redirect stats pages and empty models stay noindex',async()=>{
 const {db,ramModel,make,model,year}=fixtureDatabase();
 const app=new Hono().route('/',pageRoutes),env={DB:db,SITE_URL:'https://example.com'};
 for(const [from,to] of [['/stats/dodge/ram-1500','/stats/ram/1500'],['/stats/mercedes-benz/c300','/stats/mercedes-benz/c-class'],['/bmw/330i','/bmw/3-series']]){
  const r=await app.request(from,{},env);assert.equal(r.status,301);assert.equal(r.headers.get('location'),to);
 }
 year(model(make('TEST MAKE','test-make'),'Empty','empty'),2020);
 const empty=await app.request('/test-make/empty',{},env);assert.equal(empty.status,200);assert.match(await empty.text(),/name="robots" content="noindex, follow"/);
});
