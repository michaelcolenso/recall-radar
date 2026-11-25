import test from 'node:test';
import assert from 'node:assert/strict';
import { displayMakeName, withDisplayMake } from '../src/lib/utils';
import { POPULAR_MAKES } from '../src/lib/constants';

test('make names render in brand casing', () => {
 const expected: Record<string,string> = {TOYOTA:'Toyota','MERCEDES-BENZ':'Mercedes-Benz','LAND ROVER':'Land Rover',RAM:'Ram',BMW:'BMW',GMC:'GMC',MINI:'MINI',KIA:'Kia',VOLKSWAGEN:'Volkswagen'};
 for (const [raw,shown] of Object.entries(expected)) assert.equal(displayMakeName(raw),shown);
 for (const raw of POPULAR_MAKES) assert.equal(displayMakeName(raw).toUpperCase(),raw,'display form must round-trip to the stored NHTSA name');
});

test('withDisplayMake prefers make_name on joined rows and leaves model names alone', () => {
 assert.deepEqual(withDisplayMake({name:'CAMRY',make_name:'TOYOTA'}),{name:'CAMRY',make_name:'Toyota'});
 assert.deepEqual(withDisplayMake({id:1,name:'HONDA'}),{id:1,name:'Honda'});
 assert.equal(withDisplayMake(null),null);
});

import { caseCanonicalPath } from '../src/lib/utils';
test('uppercase vehicle paths canonicalize to lowercase; campaign, VIN and asset paths do not', () => {
 assert.equal(caseCanonicalPath('/TOYOTA/Camry'),'/toyota/camry');
 assert.equal(caseCanonicalPath('/Toyota/Camry/2020/Air-Bags'),'/toyota/camry/2020/air-bags');
 assert.equal(caseCanonicalPath('/Ford/Air-Bags-Recalls'),'/ford/air-bags-recalls');
 assert.equal(caseCanonicalPath('/toyota/camry'),null);
 assert.equal(caseCanonicalPath('/recall/20V682000'),null);
 assert.equal(caseCanonicalPath('/vin/1HGCM82633A004352'),null);
 assert.equal(caseCanonicalPath('/RECALL/20V682000'),null);
 assert.equal(caseCanonicalPath('/4A6FBBD516C148A7BABE7EB68C9F40F0.txt'),null);
 assert.equal(caseCanonicalPath('/og/TOYOTA/camry/2020.svg'),null);
});
