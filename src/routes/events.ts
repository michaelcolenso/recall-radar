import {Hono} from 'hono';import {bodyLimit} from 'hono/body-limit';
import {CLIENT_EVENTS,PAGE_TYPES,countConversion,privacyOptOut,type ConversionEvent,type PageType} from '../lib/conversions';
export const eventRoutes=new Hono<{Bindings:Env}>();
eventRoutes.post('/api/events',bodyLimit({maxSize:512,onError:c=>c.body(null,413)}),async c=>{
 c.header('Cache-Control','no-store');
 if(c.req.header('Origin')!==new URL(c.req.url).origin)return c.body(null,403);
 if(privacyOptOut(c.req.raw.headers))return c.body(null,204);
 if(!['application/json','text/plain'].includes((c.req.header('Content-Type')||'').split(';')[0]))return c.body(null,415);
 let data;try{data=await c.req.json();}catch(err){return c.body(null,err instanceof Error&&err.name==='BodyLimitError'?413:400);}
 if(!data||!CLIENT_EVENTS.includes(data.event)||!PAGE_TYPES.includes(data.page_type))return c.body(null,400);
 await countConversion(c.env.DB,data.event as ConversionEvent,data.page_type as PageType);
 return c.body(null,204);
});
