(()=>{
 const $=id=>document.getElementById(id),make=$('vehicle-make'),model=$('vehicle-model'),year=$('vehicle-year');
 if(!make)return;
 const form=$('vehicle-panel'),submit=form.querySelector('button'),status=$('vehicle-status');
 const tabs=[$('vehicle-tab'),$('keyword-tab')],panels=[form,$('keyword-panel')];
 function activate(i){tabs.forEach((t,j)=>{t.setAttribute('aria-selected',String(i===j));t.tabIndex=i===j?0:-1;panels[j].hidden=i!==j;});}
 tabs.forEach((t,i)=>{t.onclick=()=>activate(i);t.onkeydown=e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const j=e.key==='Home'?0:e.key==='End'?1:1-i;activate(j);tabs[j].focus();}};});
 function reset(el,label){el.replaceChildren(new Option(label,''));el.disabled=true;submit.disabled=true;}
 let request=0;
 async function load(el,url,label){const token=++request;status.textContent='Loading…';try{const r=await fetch(url);if(!r.ok)throw Error();const d=await r.json();if(token!==request)return;d.options.forEach(o=>el.add(new Option(o.name,o.slug)));el.disabled=!d.options.length;status.textContent=d.options.length?'':`No ${label} with recall records found.`;}catch{if(token===request)status.textContent='Could not load vehicles. Try again or browse makes below.';}}
 make.onchange=()=>{++request;reset(model,'Select model');reset(year,'Select year');if(make.value)load(model,'/api/vehicles?make='+encodeURIComponent(make.value),'models');};
 model.onchange=()=>{++request;reset(year,'Select year');if(model.value)load(year,'/api/vehicles?make='+encodeURIComponent(make.value)+'&model='+encodeURIComponent(model.value),'years');};
 year.onchange=()=>{submit.disabled=!year.value;};
 form.onsubmit=e=>{e.preventDefault();if(make.value&&model.value&&year.value)location.href='/'+make.value+'/'+model.value+'/'+year.value;};
 $('keyword-panel').addEventListener('submit',e=>{const q=$('rr-global-search').value.trim().toUpperCase();if(/^[A-HJ-NPR-Z0-9]{17}$/.test(q)){e.preventDefault();location.href='/vin-lookup?vin='+encodeURIComponent(q);}});
})();
