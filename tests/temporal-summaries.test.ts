import test from 'node:test';
import assert from 'node:assert/strict';
import { anchorHistoricalRemedy } from '../src/etl/temporal-summaries';
test('historical timing remains qualified and preserves explicit dates', () => {
 const text = anchorHistoricalRemedy('Dealers replace the pump free. Letters will be mailed in October 2023, in the coming months.','2023-06-08','2026-11-08');
 assert.doesNotMatch(text,/will be mailed|in the coming months/);
 assert.match(text,/were scheduled to be mailed in October 2023/);
 assert.match(text,/replace the pump free/);
 assert.equal(anchorHistoricalRemedy(text,'2023-06-08'),text);
});
test('recent filings and unknown campaign dates are not rewritten blindly', () => {
 assert.equal(anchorHistoricalRemedy('Letters will be mailed.','2026-10-01'),'Letters will be mailed.');
 assert.equal(anchorHistoricalRemedy('Letters will be mailed.',null),'Letters will be mailed.');
});

test('historical summary repair is bounded, resumable and preserves raw filings', async () => {
 const {fixtureDatabase}=await import('./helpers/database');
 const {repairTemporalSummaries}=await import('../src/etl/temporal-summaries');
 const {db,sqlite,ram2019,recall}=fixtureDatabase();
 for(let i=0;i<102;i++) recall(ram2019,`OLD${i}`);
 sqlite.exec("UPDATE recalls SET report_received_date='2023-01-01',remedy_enriched='Dealers repair free. Letters will be mailed in October 2023.' WHERE nhtsa_campaign_number LIKE 'OLD%'");
 const first=await repairTemporalSummaries(db);
 assert.equal(first.patched,100);assert.ok(first.nextAfterId);
 const second=await repairTemporalSummaries(db,first.nextAfterId!);
 assert.equal(second.patched,2);assert.equal(second.nextAfterId,null);
 assert.equal((await repairTemporalSummaries(db)).patched,0);
 assert.equal(sqlite.prepare("SELECT COUNT(*) as n FROM recalls WHERE nhtsa_campaign_number LIKE 'OLD%' AND remedy_raw LIKE '%FCA recall #85B%'").get()!.n,102);
});
