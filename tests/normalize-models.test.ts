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

test('Mercedes source aliases expand regardless of vPIC family casing', () => {
 const groups=canonicalModelGroups('MERCEDES-BENZ',[{Model_Name:'C-CLASS'}]);
 assert.equal(groups[0].name,'C-Class');
 assert.ok(groups[0].sources.includes('C300'));
});

test('historical Sprinter brand records join the Mercedes family', () => {
 for(const make of ['DODGE','FREIGHTLINER']) {
  const normalized=normalizeModel(make,'SPRINTER 2500');
  assert.equal(normalized.make,'MERCEDES-BENZ');
  assert.equal(normalized.model,'Sprinter');
 }
 const historical=recallSources('MERCEDES-BENZ','Sprinter',2008);
 assert.ok(historical.some(s=>s.make==='DODGE'&&s.model==='SPRINTER 2500'));
 assert.ok(historical.some(s=>s.make==='FREIGHTLINER'&&s.model==='SPRINTER 3500'));
 assert.ok(!recallSources('MERCEDES-BENZ','Sprinter',2024).some(s=>s.make==='DODGE'));
});

test('production scooter, touring and adventure variants stay out of consumer grids',()=>{
 for(const name of ['C 400 X','C Evolution','F 800 ST','M 1000 R','M 1000 RR','M 1000 XR','R 1200 ST','R 1250 GS Adventure','R 1300 GS Adventure','R 18 Transcontinental']) assert.equal(normalizeModel('BMW',name).vehicleType,'motorcycle',name);
 for(const name of ['CTX700','ST1300','ST1300P','ST1300PA','Silver Wing'])assert.equal(normalizeModel('HONDA',name).vehicleType,'motorcycle',name);
 for(const name of ['Accord','CR-Z','S2000'])assert.equal(normalizeModel('HONDA',name).vehicleType,'passenger',name);
});

test('BMW coupe and long-wheelbase trims resolve to their series without merging M3 or i3',()=>{
 for(const name of ['325Ci','328Ci','330Ci','335','M340i','ActiveHybrid 3'])assert.equal(normalizeModel('BMW',name).model,'3 Series',name);
 for(const name of ['740Li','745Le','750Li','750Lxi','760Li','M760Li'])assert.equal(normalizeModel('BMW',name).model,'7 Series',name);
 assert.equal(normalizeModel('BMW','M3').model,'M3');assert.equal(normalizeModel('BMW','i3').model,'i3');assert.equal(normalizeModel('BMW','2002').model,'2002');
});
