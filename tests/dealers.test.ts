import test from 'node:test';
import assert from 'node:assert/strict';
import { recallServiceDetails, officialRecallUrl } from '../src/lib/dealers';
import { dealerPageTemplate } from '../src/templates/dealer-page';
test('service helper exposes source phone, OEM code and manufacturer link', () => {
 const raw="Owners may contact Chrysler at 1-800-853-1403. FCA recall #85B.";
 assert.deepEqual(recallServiceDetails(raw),{phone:'1-800-853-1403',code:'85B'});
 const html=dealerPageTemplate('RAM','ram','24V653000',raw);
 assert.match(html,/mopar.com/);assert.match(html,/tel:18008531403/);assert.match(html,/85B/);
 assert.equal(officialRecallUrl('toyota'),'https://www.toyota.com/recall/');
});
