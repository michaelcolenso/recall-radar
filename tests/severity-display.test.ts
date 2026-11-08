import test from 'node:test';
import assert from 'node:assert/strict';
import { severityBadge } from '../src/templates/components/severity-badge';
import { yearPageTemplate } from '../src/templates/year-page';
test('unclassified recalls are neutral and do not claim a highest severity', () => {
 assert.match(severityBadge('UNKNOWN'), /Standard NHTSA Filing/);
 const html = yearPageTemplate({make:'Chevrolet',makeSlug:'chevrolet',model:'Malibu',modelSlug:'malibu',year:'2023',recallCount:2,topSeverity:'UNKNOWN',riskGrade:'B',riskScore:4,cards:'',leadGen:''});
 assert.doesNotMatch(html,/Most severe issue|Under Review/);
 assert.match(html,/Risk Grade: B/);
});
