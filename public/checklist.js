(()=>{
 function prepare(){const source=document.querySelector('.rr-print-checklist');if(!source||document.querySelector('.rr-print-copy'))return;const copy=source.cloneNode(true);copy.hidden=false;copy.classList.add('rr-print-copy');document.body.append(copy);document.body.classList.add('rr-printing');}
 function cleanup(){document.querySelector('.rr-print-copy')?.remove();document.body.classList.remove('rr-printing');}
 window.addEventListener('beforeprint',prepare);window.addEventListener('afterprint',cleanup);
})();
