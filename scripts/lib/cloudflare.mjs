/** Keep credentials outside the repository. Prefer an explicitly configured MCP helper. */
export async function cloudflareClient(){
 if(process.env.CF_MCP_HELPER){const {connect}=await import(process.env.CF_MCP_HELPER);const cf=await connect();return {request:cf.request,close:()=>cf.client.close()};}
 const token=process.env.CLOUDFLARE_API_TOKEN;if(!token)throw Error('Set CF_MCP_HELPER to an authenticated helper, or CLOUDFLARE_API_TOKEN');
 return {request:async options=>{const url=new URL('https://api.cloudflare.com/client/v4'+options.path);for(const [key,value] of Object.entries(options.query||{}))url.searchParams.set(key,String(value));const r=await fetch(url,{method:options.method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(options.body?{body:JSON.stringify(options.body)}:{})});const body=await r.json();if(!r.ok||body.success===false)throw Error(`Cloudflare request failed (HTTP ${r.status})`);return body;},close:async()=>{}};
}
export function remoteDatabase(cf,account,database){
 const path=`/accounts/${account}/d1/database/${database}/query`;
 function prepare(sql,params=[]){const run=async()=>{const r=await cf.request({method:'POST',path,body:{sql,params:params.map(String)}});if(!r.success||!r.result?.[0]?.success)throw Error('D1 query failed');return r.result[0];};return {bind:(...p)=>prepare(sql,p),first:async()=> (await run()).results[0]??null,all:run};}
 return {prepare};
}
