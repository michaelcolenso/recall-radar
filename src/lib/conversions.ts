export const CLIENT_EVENTS = ['page_view','vehicle_search','vin_lookup_started','vin_lookup_model_year','vin_lookup_vin','vin_lookup_failed','dealer_click','dealer_outbound','checklist_print'] as const;
export const PAGE_TYPES = ['home','vin','stats','dealers','campaign','symptoms','year','model','make','other'] as const;
export type PageType=typeof PAGE_TYPES[number];
export type ConversionEvent=typeof CLIENT_EVENTS[number]|'affiliate_click';
export function pageType(path:string):PageType {
 const p=path.split('?')[0].split('/').filter(Boolean);
 if(!p.length)return 'home';if(p[0]==='vin-lookup')return 'vin';
 if(p[0]==='stats')return 'stats';if(p[0]==='dealers')return 'dealers';if(p[0]==='recall')return 'campaign';if(p[0]==='symptoms')return 'symptoms';
 if(p.length===3&&/^\d{4}$/.test(p[2]))return 'year';if(p.length===2)return 'model';
 if(p.length===1&&!['privacy','disclosure','about','search','new'].includes(p[0]))return 'make';return 'other';
}
export function countConversion(db:D1Database,event:ConversionEvent,type:PageType,now=new Date()):Promise<D1Result> {
 return db.prepare(`INSERT INTO conversion_counts(day,event,page_type,count) VALUES(?,?,?,1) ON CONFLICT(day,event,page_type) DO UPDATE SET count=count+1`).bind(now.toISOString().slice(0,10),event,type).run();
}
export function privacyOptOut(headers:Headers):boolean{return headers.get('DNT')==='1'||headers.get('Sec-GPC')==='1';}
