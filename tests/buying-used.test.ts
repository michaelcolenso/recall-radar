import test from 'node:test';
import assert from 'node:assert/strict';
import { buyingUsedCard } from '../src/templates/components/affiliate-box';
import { getPartner } from '../src/lib/affiliates';
test('buyer card leads with free VIN check and discloses tracked partner link', () => {
 const html=buyingUsedCard({make:'RAM',model:'1500',year:'2019',recallCount:30,partner:getPartner('dvh'),placement:'stats'});
 assert.match(html,/Buying a Used 2019 RAM 1500/);assert.match(html,/these 30 recall repairs/);
 assert.ok(html.indexOf('/vin-lookup')<html.indexOf('/go/dvh'));
 assert.match(html,/placement=stats/);assert.match(html,/Partner link — we may earn a commission/);
 assert.doesNotMatch(buyingUsedCard({make:'RAM',model:'1500',recallCount:2}),/\/go\//);
});
