import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { Hono } from 'hono';
import { fixtureDatabase } from './database';
import { repairCanonicalModels } from '../../src/etl/repair-models';
import { pageRoutes } from '../../src/routes/pages';
import { apiRoutes } from '../../src/routes/api';
const {db}=fixtureDatabase();await repairCanonicalModels(db);
const app=new Hono().route('/api',apiRoutes).route('/',pageRoutes);
createServer(async(req,res)=>{
 try {
 const url=new URL(req.url!,'http://127.0.0.1:8799');
 const file='public'+url.pathname;
 if(!url.pathname.includes('..')&&existsSync(file)&&/\.(css|js|svg|woff2|png)$/.test(file)){
 const types:Record<string,string>={css:'text/css',js:'text/javascript',svg:'image/svg+xml',woff2:'font/woff2',png:'image/png'};
 res.setHeader('Content-Type',types[file.split('.').at(-1)!]);res.end(readFileSync(file));return;
 }
 const result=await app.request(url.toString(),{method:req.method},{DB:db,SITE_URL:'http://127.0.0.1:8799',ADMIN_TOKEN:'fixture',AFFILIATE_PARTNERS:'dvh'});
 res.writeHead(result.status,Object.fromEntries(result.headers));res.end(await result.text());
 } catch(e){res.writeHead(500);res.end(String(e));}
}).listen(8799,'127.0.0.1',()=>console.log('Audit fixture preview: http://127.0.0.1:8799'));
