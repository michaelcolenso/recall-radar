import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeModel, canonicalModelGroups, recallSources, filingAliases } from '../src/etl/normalize-models';
test('Mercedes trims map to parent families without swallowing unrelated models', () => {
 for (const [raw,parent] of [['C300','C-Class'],['C43 AMG','C-Class'],['E350','E-Class'],['S580','S-Class'],['GLC300','GLC-Class'],['GLE450','GLE-Class'],['SPRINTER 2500','Sprinter']]) assert.equal(normalizeModel('MERCEDES-BENZ',raw).model,parent);
 assert.equal(normalizeModel('MERCEDES-BENZ','CLE').model,'CLE');
 assert.equal(canonicalModelGroups('MERCEDES-BENZ',[{Model_Name:'C300'},{Model_Name:'C63 AMG'}]).length,1);
});
test('historical Dodge and current RAM aliases reach same canonical model', () => {
 assert.equal(normalizeModel('DODGE','RAM 1500').make,'RAM');
 assert.equal(normalizeModel('RAM','RAM 1500').slug,'1500');
 assert.ok(recallSources('RAM','1500',2008).some(s=>s.make==='DODGE'));
 assert.ok(!recallSources('RAM','1500',2024).some(s=>s.make==='DODGE'));
 assert.ok(canonicalModelGroups('RAM',[]).some(m=>m.slug==='1500'));
});
test('non-passenger models are excluded from consumer model groups', () => {
 for (const [make,model] of [['HONDA','CBR600RR'],['HONDA','Gold Wing'],['BMW','R1250GS'],['MERCEDES-BENZ','L1013'],['MERCEDES-BENZ','Tourrider']]) assert.equal(canonicalModelGroups(make,[{Model_Name:model}]).length,0);
 assert.equal(normalizeModel('BMW','X5').vehicleType,'passenger');
});

test('parent vPIC models expand to real NHTSA trim filing aliases', () => {
 assert.ok(filingAliases('MERCEDES-BENZ','C-Class').includes('C300'));
 assert.ok(canonicalModelGroups('MERCEDES-BENZ',[{Model_Name:'C-Class'}])[0].sources.includes('C63 AMG'));
 assert.equal(normalizeModel('MERCEDES-BENZ','AMG C43').model,'C-Class');
 assert.equal(normalizeModel('MERCEDES-BENZ','C300 4MATIC').model,'C-Class');
});

test('plain Mercedes families and BMW trim designations normalize consistently', () => {
 assert.equal(normalizeModel('MERCEDES-BENZ','GLC').model,'GLC-Class');
 assert.equal(normalizeModel('BMW','330i xDrive').model,'3 Series');
 assert.equal(normalizeModel('BMW','i3').model,'i3');
});
