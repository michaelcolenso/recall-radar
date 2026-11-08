import test from 'node:test';
import assert from 'node:assert/strict';
import { modelStatsPageTemplate } from '../src/templates/model-stats-page';
test('zero-recall years are labels, never thin page links', () => {
 const html = modelStatsPageTemplate({make:'RAM',makeSlug:'ram',model:'1500',modelSlug:'1500',yearStats:[{year:2008,recall_count:0,risk_grade:null,critical_count:0,high_count:0}],componentStats:[],mostSevereRecalls:[],bestYears:[],worstYears:[],brandAvgRecalls:0,totalRecalls:0});
 assert.match(html,/<span class="rr-year-bar__label">2008<\/span>/);
 assert.doesNotMatch(html,/href="\/ram\/1500\/2008"/);
});
