import {mkdirSync,writeFileSync} from 'node:fs';
const base=process.env.WORKER_URL||'https://recalledrides.com';
async function xml(url){const r=await fetch(url,{signal:AbortSignal.timeout(60000)});if(!r.ok)throw Error(`Sitemap HTTP ${r.status}`);return r.text();}
const first=await xml(base+'/sitemap.xml');const locations=s=>[...s.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1].replace(/&amp;/g,'&'));
const docs=first.includes('<sitemapindex')?await Promise.all(locations(first).map(async url=>({url,body:await xml(url)}))):[{url:base+'/sitemap.xml',body:first}];
const urls=docs.flatMap(d=>locations(d.body));const set=new Set(urls),issues=[];
if(set.size!==urls.length)issues.push(`Duplicate sitemap URLs: ${urls.length-set.size}`);
if(urls.some(u=>new URL(u).origin!==new URL(base).origin))issues.push('Noncanonical sitemap origin');
for(const d of docs){if(locations(d.body).length>50000)issues.push('Oversized sitemap: '+d.url);for(const m of d.body.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)){if(!Number.isFinite(Date.parse(m[1]))||Date.parse(m[1])>Date.now())issues.push('Invalid or future lastmod: '+m[1]);}}
const checks=[];
for(const path of ['/mercedes-benz/c-class','/ram/1500/2019','/chevrolet/malibu/2023','/mercedes-benz/cle/2000','/mercedes-benz/slr-mclaren/2027','/dodge/ram-1500/2008']){const r=await fetch(base+path,{redirect:'manual',signal:AbortSignal.timeout(30000)});const body=await r.text();const noindex=/name="robots"[^>]*content="[^"]*noindex/.test(body)||/noindex/.test(r.headers.get('x-robots-tag')||'');const row={path,status:r.status,canonical:body.match(/rel="canonical" href="([^"]+)"/)?.[1],noindex,location:r.headers.get('location'),inSitemap:set.has(base+path)};checks.push(row);if((noindex||r.status>=300)&&row.inSitemap)issues.push('Nonindexable URL in sitemap: '+path);}
mkdirSync('artifacts/operations',{recursive:true});const report={checkedAt:new Date().toISOString(),sitemaps:docs.length,urls:urls.length,issues,checks};writeFileSync('artifacts/operations/sitemap-audit.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));if(issues.length)process.exitCode=1;
