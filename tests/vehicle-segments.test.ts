import test from 'node:test';
import assert from 'node:assert/strict';
import { relatedLinks } from '../src/templates/components/related-links';
import { segmentCompetitors } from '../src/lib/vehicle-segments';
test('Malibu gets three sedan peers for the same year and adjacent own years', () => {
 const html=relatedLinks({make:'Chevrolet',makeSlug:'chevrolet',model:'Malibu',modelSlug:'malibu',year:'2023'});
 for(const path of ['/honda/accord/2023','/toyota/camry/2023','/hyundai/sonata/2023','/chevrolet/malibu/2022','/chevrolet/malibu/2024']) assert.ok(html.includes(path));
 assert.doesNotMatch(html,/f-150|ram\/1500/);
 assert.equal(segmentCompetitors('unknown','unknown').length,0);
});
