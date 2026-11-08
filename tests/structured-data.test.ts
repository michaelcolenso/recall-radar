import test from 'node:test';
import assert from 'node:assert/strict';
import { verifiedTimestamp } from '../src/lib/freshness';
import { webPageJsonLd, faqPageJsonLd, visibleFaq } from '../src/templates/components/json-ld';
test('WebPage carries actual source freshness and rejects clock skew', () => {
 assert.equal(verifiedTimestamp('2099-01-01'),undefined);
 assert.equal(verifiedTimestamp('invalid'),undefined);
 const script=webPageJsonLd('https://example.com/ram','RAM','2024-01-01');
 const data=JSON.parse(script.replace(/^<script[^>]+>|<\/script>$/g,''));
 assert.equal(data['@type'],'WebPage');assert.equal(data.dateModified,'2024-01-01T00:00:00.000Z');
 assert.doesNotMatch(webPageJsonLd('https://example.com','x','2099-01-01'),/dateModified/);
});
test('year FAQ schema is rendered as identical visible answers', () => {
 const script=faqPageJsonLd([{campaign:'A',component:'BRAKES',make:'RAM',model:'1500',year:'2019',summary:'<source>',consequence:'risk',remedy:'free'}]);
 const html=visibleFaq(script);assert.match(html,/Frequently Asked Questions/);assert.match(html,/&lt;source&gt;/);
});
