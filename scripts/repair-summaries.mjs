// Repeatedly call the bounded historical-remedy repair endpoint until complete.
const site=process.env.WORKER_URL || 'https://recalledrides.com';
const token=process.env.ADMIN_TOKEN;
if(!token) throw new Error('Set ADMIN_TOKEN before repairing summaries');
let afterId=0,total=0;
do {
 const response=await fetch(new URL('/api/admin/repair-summaries',site),{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({afterId})});
 if(!response.ok) throw new Error(`Summary repair failed: HTTP ${response.status}`);
 const result=await response.json();
 if(!Number.isInteger(result.patched) || result.nextAfterId!==null && (!Number.isInteger(result.nextAfterId) || result.nextAfterId<=afterId)) throw new Error('Invalid repair cursor response');
 total+=result.patched;
 console.log(`Patched ${result.patched}; total ${total}`);
 afterId=result.nextAfterId;
} while(afterId!==null);
