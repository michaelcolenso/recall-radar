(()=>{
 if(navigator.doNotTrack==='1'||navigator.globalPrivacyControl){window.rrTrack=()=>{};window.rrEventQueue=[];return;}
 const p=location.pathname.split('/').filter(Boolean);
 const type=!p.length?'home':p[0]==='vin-lookup'?'vin':p[0]==='stats'?'stats':p[0]==='dealers'?'dealers':p[0]==='recall'?'campaign':p[0]==='symptoms'?'symptoms':p.length===3&&/^\d{4}$/.test(p[2])?'year':p.length===2?'model':p.length===1&&!['privacy','disclosure','about','search','new'].includes(p[0])?'make':'other';
 function send(event){if(!/^(page_view|vehicle_search|vin_lookup_(started|model_year|vin|failed)|dealer_(click|outbound)|checklist_print)$/.test(event))return;const body=JSON.stringify({event,page_type:type});if(navigator.sendBeacon&&navigator.sendBeacon('/api/events',new Blob([body],{type:'application/json'})))return;fetch('/api/events',{method:'POST',headers:{'Content-Type':'application/json'},body,keepalive:true}).catch(()=>{});}
 window.rrTrack=send;(window.rrEventQueue||[]).forEach(send);window.rrEventQueue=[];send('page_view');
 document.addEventListener('submit',e=>{if(e.target.id==='vehicle-panel'&&e.target.checkValidity())send('vehicle_search');},true);
 document.addEventListener('click',e=>{const link=e.target.closest('a');if(!link)return;const url=new URL(link.href,location.href);if(url.origin===location.origin&&url.pathname.startsWith('/dealers/'))send('dealer_click');else if(type==='dealers'&&url.origin!==location.origin)send('dealer_outbound');if(link.closest('#rr-global-search-results')&&url.origin===location.origin)send('vehicle_search');});
 window.addEventListener('beforeprint',()=>{if(document.querySelector('.rr-print-checklist'))send('checklist_print');});
})();
