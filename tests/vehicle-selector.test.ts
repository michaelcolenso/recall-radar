import test from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { vehicleSelector } from '../src/templates/components/vehicle-selector';
import { layout } from '../src/templates/layout';
test('hero offers labeled cascading selector and VIN search with a small script budget', () => {
 const html=vehicleSelector([{slug:'ram',name:'RAM'}]);
 assert.match(html,/By Vehicle/);assert.match(html,/By VIN or Keyword/);assert.match(html,/vehicle-year/);
 const inline=[...layout({title:'Test',body:html}).matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('');
 assert.ok(gzipSync(inline).length+gzipSync(readFileSync('public/vehicle-selector.js','utf8')).length+gzipSync(readFileSync('public/checklist.js','utf8')).length+gzipSync(readFileSync('public/events.js','utf8')).length<4096);
});
