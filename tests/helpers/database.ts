import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
export function fixtureDatabase() {
 const sqlite = new DatabaseSync(':memory:');
 for (const file of readdirSync('src/db/migrations').filter(f=>f.endsWith('.sql')).sort()) sqlite.exec(readFileSync('src/db/migrations/'+file,'utf8'));
 function prepare(sql:string,params:any[]=[]):any {
  return {bind:(...args:any[])=>prepare(sql,args),first:async()=>sqlite.prepare(sql).get(...params)??null,all:async()=>({results:sqlite.prepare(sql).all(...params),success:true,meta:{}}),run:async()=>({success:true,meta:sqlite.prepare(sql).run(...params)})};
 }
 const db={prepare,batch:async(statements:any[])=>{sqlite.exec('BEGIN');try {const results=[];for(const stmt of statements) results.push(await stmt.all());sqlite.exec('COMMIT');return results;}catch(e){sqlite.exec('ROLLBACK');throw e;}}} as unknown as D1Database;
 const now='2026-10-01T12:00:00.000Z';
 const make=(name:string,slug:string)=>Number(sqlite.prepare('INSERT INTO makes(name,slug,created_at,updated_at) VALUES(?,?,?,?)').run(name,slug,now,now).lastInsertRowid);
 const model=(makeId:number,name:string,slug:string)=>Number(sqlite.prepare('INSERT INTO models(make_id,name,slug,created_at,updated_at) VALUES(?,?,?,?,?)').run(makeId,name,slug,now,now).lastInsertRowid);
 const year=(modelId:number,year:number)=>Number(sqlite.prepare('INSERT INTO vehicle_years(model_id,year,created_at,updated_at,last_ingested_at,risk_grade,risk_score) VALUES(?,?,?,?,?,?,?)').run(modelId,year,now,now,now,'A+',81).lastInsertRowid);
 const recall=(vy:number,campaign:string,severity='CRITICAL',component='ELECTRICAL SYSTEM:WIRING')=>sqlite.prepare('INSERT INTO recalls(vehicle_year_id,nhtsa_campaign_number,component,summary_raw,consequence_raw,remedy_raw,severity_level,report_received_date,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)').run(vy,campaign,component,'A rearview camera can go blank.','An engine stall may cause a crash.','Dealers repair free. FCA recall #85B. Call 1-800-853-1403.',severity,'2024-01-01',now,now);
 const ram=make('RAM','ram'),dodge=make('DODGE','dodge'),chevy=make('CHEVROLET','chevrolet'),mercedes=make('MERCEDES-BENZ','mercedes-benz');
 const ramModel=model(ram,'1500','1500'),ram2019=year(ramModel,2019);
 for(let i=0;i<30;i++)recall(ram2019,i===0?'24V653000':`19V${String(i).padStart(6,'0')}`);
 year(ramModel,2008); // Previously synthetic empty year must never become a link.
 for(const y of [2020,2021,2022,2023,2024,2025,2026]) recall(year(model(ram,`RAM 1500 ${y}`,`raw-${y}`),y),`24V${y}00`); // Raw names corrected below.
 sqlite.exec("UPDATE models SET name='RAM 1500' WHERE slug LIKE 'raw-%'");
 recall(year(model(dodge,'RAM 1500','ram-1500'),2008),'08V123000');
 const malibu=year(model(chevy,'Malibu','malibu'),2023);recall(malibu,'23V111000','UNKNOWN');recall(malibu,'23V222000','UNKNOWN');
 for(const [raw,slug] of [['C300','c300'],['E350','e350'],['S580','s580'],['GLC300','glc300'],['GLE450','gle450'],['SPRINTER 2500','sprinter-2500']]) recall(year(model(mercedes,raw,slug),2023),`23V${slug.replace(/\D/g,'').padStart(6,'0')}`);
 for(const [name,slug,mod,modSlug] of [['HONDA','honda','Accord','accord'],['TOYOTA','toyota','Camry','camry'],['HYUNDAI','hyundai','Sonata','sonata']]) recall(year(model(make(name,slug),mod,modSlug),2023),'23V900000','LOW');
 return {db,sqlite,ramModel,ram2019,malibu,make,model,year,recall};
}
