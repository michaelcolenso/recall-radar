import test from 'node:test';
import assert from 'node:assert/strict';
import { Hono } from 'hono';
import { fixtureDatabase } from './helpers/database';
import { pageRoutes } from '../src/routes/pages';

test('make-component pages resolve instead of falling through to the model route', async () => {
 const {db,ramModel,year,recall}=fixtureDatabase();
 // One campaign filed against two model-years must count once.
 recall(year(ramModel,2018),'24V653000');
 const app=new Hono().route('/',pageRoutes), env={DB:db,SITE_URL:'https://example.com'};
 const res=await app.request('/ram/electrical-system-recalls',{},env);
 assert.equal(res.status,200);
 const html=await res.text();
 assert.match(html,/<h1[^>]*>Ram Electrical System Recalls<\/h1>/);
 assert.match(html,/<title>Ram Electrical System Recalls by Model &amp; Year \| Recalled Rides<\/title>/);
 assert.match(html,/rr-breadcrumb__current">Electrical System Recalls</);
 const total=html.match(/rr-stat-card__value">(\d+)<\/div>\s*<div class="rr-stat-card__label">Recall Campaigns/);
 assert.ok(total,'campaign total rendered');
 assert.equal(Number(total![1]),37); // 30 (2019) + 7 (2020-2026) distinct campaigns; 24V653000 counted once.
 assert.equal((html.match(/href="\/recall\/24V653000"/g)||[]).length,1);
 assert.match(html,/href="\/ram\/1500\/2018"/);
 assert.match(html,/href="\/ram\/1500\/2019"/);
 assert.equal((await app.request('/ram/brakes-recalls',{},env)).status,404);
 assert.equal((await app.request('/ram/1500',{},env)).status,200);
});
