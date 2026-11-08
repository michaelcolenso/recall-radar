import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateRawScore, scoreToGrade, gradeForCounts } from '../src/lib/risk-score';
const grade = (n: number, severityLevel: 'CRITICAL' | 'LOW' | 'UNKNOWN') => scoreToGrade(calculateRawScore(Array.from({length:n}, () => ({severityLevel, reportReceivedDate:'2001-01-01'})), new Date('2026-11-08')), 99);
test('risk polarity and age-independent safety floors', () => {
  assert.equal(grade(30, 'CRITICAL'), 'F');
  assert.equal(grade(2, 'UNKNOWN'), 'B');
  assert.equal(grade(1, 'LOW'), 'A');
  assert.equal(grade(2, 'CRITICAL'), 'F');
  assert.equal(gradeForCounts(30, 4), 'F');
  assert.equal(gradeForCounts(2), 'B');
});

test('malformed dates never produce a NaN score', () => {
 assert.ok(Number.isFinite(calculateRawScore([{severityLevel:'CRITICAL',reportReceivedDate:'invalid'}])));
});

test('weighted year grades agree with model and stats count grades across histories', () => {
 const reference=new Date('2026-11-08T12:00:00Z');
 for(const date of ['2001-01-01','2026-11-01','2030-01-01','invalid',null]) {
  for(let count=0;count<=30;count++) for(let critical=0;critical<=count;critical++) for(let high=0;high<=count-critical;high++) {
   const recalls=Array.from({length:count},(_,i)=>({severityLevel:i<critical ? 'CRITICAL' as const : i<critical+high ? 'HIGH' as const : 'MEDIUM' as const,reportReceivedDate:date}));
   assert.equal(scoreToGrade(calculateRawScore(recalls,reference),0),gradeForCounts(count,critical,high),`${count} recalls, ${critical} critical, ${high} high, ${date}`);
  }
 }
});
