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
