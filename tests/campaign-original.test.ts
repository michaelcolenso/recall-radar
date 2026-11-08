import test from 'node:test';
import assert from 'node:assert/strict';
import { campaignPageTemplate } from '../src/templates/campaign-page';
test('campaign original text is inspectable and escaped', () => {
 const html=campaignPageTemplate({campaign:'24V653000',component:'BRAKES',manufacturer:'RAM',summary:'summary',consequence:'risk',remedy:'free fix',severity:'CRITICAL',reportReceivedDate:'2024-09-01',isEnriched:true,affectedVehicles:[],original:{summary:'<original>',consequence:'risk',remedy:'raw fix'}});
 assert.match(html,/<details/);assert.match(html,/&lt;original&gt;/);assert.match(html,/raw fix/);
});
