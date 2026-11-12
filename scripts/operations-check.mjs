// node --import tsx scripts/operations-check.mjs [--expect-delta-after ISO] [--output FILE]
import {mkdirSync,writeFileSync} from 'node:fs';import {dirname} from 'node:path';
import {pipelineHealth} from '../src/lib/operations-health.ts';
import {cloudflareClient,remoteDatabase} from './lib/cloudflare.mjs';
const args=process.argv.slice(2),option=name=>args.includes(name)?args[args.indexOf(name)+1]:undefined;
let expected=option('--expect-delta-after');if(expected==='latest'){const day=new Date();day.setUTCHours(2,0,0,0);if(day>new Date())day.setUTCDate(day.getUTCDate()-1);expected=day.toISOString();}
const cf=await cloudflareClient();
try{const db=remoteDatabase(cf,process.env.CLOUDFLARE_ACCOUNT_ID,process.env.CLOUDFLARE_DATABASE_ID);const report=await pipelineHealth(db,expected);const output=option('--output');if(output){mkdirSync(dirname(output),{recursive:true});writeFileSync(output,JSON.stringify(report,null,2),{mode:0o600});}console.log(JSON.stringify(report));if(report.status==='unhealthy')process.exitCode=1;}finally{await cf.close();}
