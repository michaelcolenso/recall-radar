import test from 'node:test';
import assert from 'node:assert/strict';
import { symptomQuery, symptomTerms } from '../src/lib/symptom-search';
import { printChecklist } from '../src/templates/components/print-checklist';
import { DatabaseSync } from 'node:sqlite';
test('symptom examples find filings across plain English and component fields', () => {
 const db=new DatabaseSync(':memory:');
 db.exec(`CREATE TABLE recalls(nhtsa_campaign_number,vehicle_year_id,component,summary_raw,summary_enriched,consequence_raw,consequence_enriched,report_received_date); INSERT INTO recalls VALUES('A',1,'VISIBILITY:REARVIEW CAMERA','Display goes black',NULL,'risk',NULL,'2024-01-01');`);
 const query=symptomQuery('backup camera blank');assert.equal(db.prepare(query.sql).all(...query.params).length,1);
 assert.ok(symptomTerms('engine stalls at stop').includes('STALL'));
 assert.ok(symptomTerms('steering wheel shakes').includes('STEERING'));
 assert.ok(!symptomQuery("%_' OR 1=1").sql.includes("OR 1=1"));
});
test('print checklist preserves NHTSA and OEM campaign IDs with escaped fields', () => {
 const html=printChecklist('2019 RAM 1500',[{campaign:'24V653000',component:'BRAKES<script>',remedy:'FCA recall #85B.'}]);
 assert.match(html,/Download \/ Print Recall Checklist/);assert.match(html,/24V653000/);assert.match(html,/85B/);
 assert.match(html,/BRAKES&lt;script&gt;/);assert.match(html,/Model-year records do not confirm VIN eligibility/);
});
