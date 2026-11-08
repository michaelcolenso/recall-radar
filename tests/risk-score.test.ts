import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateRawScore, scoreToGrade, gradeForCounts } from '../src/lib/risk-score';
const grade = (n: number, severityLevel: 'CRITICAL' | 'LOW' | 'UNKNOWN') => scoreToGrade(calculateRawScore(Array.from({length:n}, () => ({severityLevel, reportReceivedDate:'2001-01-01'})), new Date('2026-11-08')), 99);
test('risk polarity and age-independent safety floors', () => {
  assert.equal(grade(30, 'CRITICAL'), 'F');
  assert.equal(grade(2, 'UNKNOWN'), 'B');
  assert.equal(grade(1, 'LOW'), 'A+');
  assert.equal(grade(2, 'CRITICAL'), 'F');
  assert.equal(gradeForCounts(30, 4), 'F');
  assert.equal(gradeForCounts(2), 'B');
});
