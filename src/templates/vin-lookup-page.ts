import { escapeHtml } from "../lib/utils";

export function vinLookupPageTemplate(siteUrl: string, affiliateCtaHtml?: string): string {
  return `
    <section class="rr-section-header">
      <h1 class="rr-section-header__title">Free VIN Recall Check</h1>
      <p class="rr-section-header__subtitle">Enter your 17-character Vehicle Identification Number (VIN) to check for open safety recalls.</p>
    </section>

    <section style="max-width: 640px; margin: 0 auto var(--space-20);">
      <form class="rr-vin-form" id="vin-form" action="/api/vin-lookup" method="GET">
        <label for="vin-input" class="sr-only">Vehicle Identification Number (VIN)</label>
        <div class="rr-vin-input-wrap">
          <input
            type="text"
            id="vin-input"
            name="vin"
            class="rr-vin-input"
            placeholder="Enter 17-character VIN"
            maxlength="17"
            minlength="17"
            pattern="[A-HJ-NPR-Z0-9]{17}"
            required
            autocomplete="off"
            style="text-transform: uppercase;"
          />
          <button type="submit" class="rr-btn rr-btn--primary">Check Recalls</button>
        </div>
        <p class="rr-vin-helper">VINs are 17 characters and do not include the letters I, O, or Q.</p>
      </form>

      <div id="vin-results" class="rr-vin-results" hidden></div>
      ${affiliateCtaHtml ? `<div id="vin-aff-cta" hidden>${affiliateCtaHtml}</div>` : ""}
    </section>

    <section style="margin-bottom: var(--space-16);">
      <h2 class="rr-label" style="margin-bottom: var(--space-6);">What is a VIN?</h2>
      <div class="rr-prose">
        <p>Your Vehicle Identification Number (VIN) is a unique 17-character code assigned to every vehicle manufactured. It's stamped on the driver's side dashboard (visible through the windshield) and on the driver's side door jamb.</p>
        <p>We check your VIN directly against NHTSA's official recall database — no personal information is stored.</p>
      </div>
    </section>

    <section style="margin-bottom: var(--space-16);">
      <h2 class="rr-label" style="margin-bottom: var(--space-6);">Sample VINs</h2>
      <div class="rr-grid rr-grid--years">
        <button type="button" class="rr-card rr-card--year rr-card--clickable" data-vin="5TDZK3EH5CS044883" onclick="document.getElementById('vin-input').value=this.dataset.vin">
          <div class="rr-card__title">5TDZK3EH5CS044883</div>
          <div class="rr-card__meta">2012 Toyota Sienna</div>
        </button>
        <button type="button" class="rr-card rr-card--year rr-card--clickable" data-vin="1FA6P8TH4F5410015" onclick="document.getElementById('vin-input').value=this.dataset.vin">
          <div class="rr-card__title">1FA6P8TH4F5410015</div>
          <div class="rr-card__meta">2015 Ford Mustang</div>
        </button>
        <button type="button" class="rr-card rr-card--year rr-card--clickable" data-vin="3VW2K7AJ7FM200000" onclick="document.getElementById('vin-input').value=this.dataset.vin">
          <div class="rr-card__title">3VW2K7AJ7FM200000</div>
          <div class="rr-card__meta">2015 Volkswagen Jetta</div>
        </button>
      </div>
    </section>

    <section style="margin-bottom: var(--space-16);">
      <h2 class="rr-label" style="margin-bottom: var(--space-6);">Privacy Notice</h2>
      <div class="rr-prose">
        <p>Your VIN is checked directly against the NHTSA API. We do not log, store, or share your VIN. This is a free, anonymous lookup service.</p>
      </div>
    </section>

    <script>
      (function(){
        var form=document.getElementById('vin-form');
        var results=document.getElementById('vin-results');
        if(!form||!results)return;
        form.addEventListener('submit',function(e){
          e.preventDefault();
          var vin=form.vin.value.toUpperCase().trim();
          if(vin.length!==17)return;
          results.hidden=false;
          results.innerHTML='<p class="rr-body">Checking NHTSA database…</p>';
          fetch('/api/vin-lookup?vin='+encodeURIComponent(vin))
            .then(function(r){return r.json()})
            .then(function(data){
              if(data.error){
                results.innerHTML='<p class="rr-body rr-body--error">'+escHtml(data.error)+'</p>';
                return;
              }
              // Reveal the affiliate CTA after a successful lookup, deep-linking the typed VIN
              var aff=document.getElementById('vin-aff-cta');
              if(aff){
                var link=aff.querySelector('[data-aff-cta]');
                if(link){
                  var base=link.getAttribute('data-base-href')||link.getAttribute('href');
                  link.setAttribute('data-base-href',base);
                  link.setAttribute('href',base+(base.indexOf('?')>=0?'&':'?')+'vin='+encodeURIComponent(vin));
                }
                aff.hidden=false;
              }
              if(!data.recalls||data.recalls.length===0){
                results.innerHTML='<div class="rr-empty"><h2 class="rr-empty__title">No Open Recalls</h2><p class="rr-empty__text">Good news — NHTSA shows no open recalls for this VIN.</p></div>';
                return;
              }
              var html='<div class="rr-readout-list"><h2 class="rr-label" style="margin-bottom:var(--space-6)">'+data.recalls.length+' Open Recall'+((data.recalls.length!==1)?'s':'')+'</h2>';
              data.recalls.forEach(function(r){
                html+='<article class="rr-readout"><div class="rr-readout__header"><div class="rr-readout__meta"><span class="rr-readout__title-link">'+escHtml(r.component)+'</span><span class="rr-readout__date">Campaign '+escHtml(r.campaign)+'</span></div></div><div class="rr-readout__body"><p>'+escHtml(r.summary)+'</p></div></article>';
              });
              html+='</div>';
              results.innerHTML=html;
            })
            .catch(function(){
              results.innerHTML='<p class="rr-body rr-body--error">Unable to check VIN. Please try again later.</p>';
            });
        });
        function escHtml(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
      })();
    </script>
  `;
}
