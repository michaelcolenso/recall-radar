import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
test('make components group across models and deduplicate campaigns', () => {
 const source = readFileSync('src/routes/pages.ts','utf8');
 const sql = source.slice(source.indexOf('const [models, components]')).match(/`(SELECT UPPER[\s\S]*?LIMIT 12)`/)![1];
 const result = execFileSync('python3', ['-c', `import sqlite3,json
c=sqlite3.connect(':memory:')
c.executescript("CREATE TABLE models(id,make_id,name); CREATE TABLE vehicle_years(id,model_id); CREATE TABLE recalls(id,vehicle_year_id,component,nhtsa_campaign_number); INSERT INTO models VALUES(1,1,'1500'),(2,1,'2500'); INSERT INTO vehicle_years VALUES(1,1),(2,2); INSERT INTO recalls VALUES(1,1,'ELECTRICAL SYSTEM:WIRING','A'),(2,2,'Electrical System:BATTERY','A'),(3,2,'ELECTRICAL SYSTEM','B');")
print(json.dumps(c.execute(${JSON.stringify(sql)},(1,)).fetchall()))`],{encoding:'utf8'});
 assert.deepEqual(JSON.parse(result), [['ELECTRICAL SYSTEM',2]]);
});
