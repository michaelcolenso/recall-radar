import test from 'node:test';
import assert from 'node:assert/strict';
import { fixtureDatabase } from './helpers/database';
import { calculateRawScore,scoreToGrade } from '../src/lib/risk-score';
import { scoreVehicleYearsBatch } from '../src/lib/risk-score-batch';
test('SQL score batches match weighted scoring for old, recent, unknown and future dates',async()=>{
 const {db,sqlite,ramModel,year,recall}=fixtureDatabase();
 const now=new Date('2026-11-08T12:00:00Z');
 const histories=[[],['LOW'],['UNKNOWN','UNKNOWN'],['HIGH','HIGH'],Array(5).fill('HIGH'),['CRITICAL',...Array(9).fill('LOW')],['CRITICAL','CRITICAL']];
 const expected=new Map<number,number>();let index=0;
 for(const date of ['2001-01-01','2026-10-01','2030-01-01','invalid',null])for(const severity of histories){
  const id=year(ramModel,1900+index++);
  severity.forEach((level,i)=>recall(id,`BATCH-${id}-${i}`,level));
  sqlite.prepare('UPDATE recalls SET report_received_date=? WHERE vehicle_year_id=?').run(date,id);
  expected.set(id,calculateRawScore(severity.map(severityLevel=>({severityLevel,reportReceivedDate:date})),now));
 }
 const ids=[...expected.keys()];assert.equal(await scoreVehicleYearsBatch(db,[...ids,...ids],now),ids.length);
 for(const [id,score] of expected){const row=sqlite.prepare('SELECT risk_score,risk_grade FROM vehicle_years WHERE id=?').get(id)!;assert.equal(row.risk_score,score,`year ${id}`);assert.equal(row.risk_grade,scoreToGrade(score,0));}
});
test('batch scoring respects the D1 parameter limit and rejects invalid IDs',async()=>{
 const {db,sqlite,ramModel,year}=fixtureDatabase();const ids=Array.from({length:101},(_,i)=>year(ramModel,1700+i));
 assert.equal(await scoreVehicleYearsBatch(db,ids),101);
 assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM vehicle_years WHERE year BETWEEN 1700 AND 1800 AND risk_grade='A+'").get()!.n,101);
 await assert.rejects(()=>scoreVehicleYearsBatch(db,[-1]),/Invalid/);
});
