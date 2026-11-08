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

test('NHTSA manufacturer-number wording appears in dealer and print checklists', async () => {
 const {printChecklist}=await import('../src/templates/components/print-checklist');
 const remedy="Owners may contact Chrysler customer service at 800-853-1403. Chrysler's number for this recall is 85B.";
 assert.deepEqual(recallServiceDetails(remedy),{phone:'800-853-1403',code:'85B'});
 assert.match(dealerPageTemplate('RAM','ram','24V653000',remedy),/85B/);
 assert.match(printChecklist('2019 RAM 1500',[{campaign:'24V653000',component:'BRAKES',remedy}]),/85B/);
 assert.equal(recallServiceDetails("MBUSA's number for this recall is 2024090001.").code,'2024090001');
 assert.equal(recallServiceDetails('The recall number is not available.').code,undefined);
});
