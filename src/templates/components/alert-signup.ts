import { escapeHtml } from "../../lib/utils";

interface AlertSignupOptions {
  make: string;
  makeSlug: string;
  model: string;
  modelSlug: string;
  year: string;
  /** Turnstile site key; when absent the widget is omitted (local dev). */
  turnstileSiteKey?: string;
  /** Analytics label for where the form was rendered (year-page, vin-page…). */
  source?: string;
}

/**
 * "Get notified if your {year} {make} {model} is recalled" signup card.
 * Posts to /api/alerts/subscribe; double opt-in happens by email.
 */
export function alertSignup({ make, makeSlug, model, modelSlug, year, turnstileSiteKey, source }: AlertSignupOptions): string {
  const vehicle = `${escapeHtml(year)} ${escapeHtml(make)} ${escapeHtml(model)}`;
  const formId = "rr-alert-form";

  const turnstileWidget = turnstileSiteKey
    ? `<div class="cf-turnstile" data-sitekey="${escapeHtml(turnstileSiteKey)}" data-size="flexible"></div>
       <script src="https://challenges.cloudflare.com/turnstile/api.js" async defer></script>`
    : "";

  return `
    <aside class="rr-alert" aria-labelledby="rr-alert-title">
      <div class="rr-alert__title" id="rr-alert-title">Get Notified of New Recalls</div>
      <p class="rr-alert__text">We check NHTSA weekly. If a new recall is issued for the ${vehicle}, we'll email you a plain-English explanation — free.</p>
      <form id="${formId}" class="rr-alert__form" method="post" action="/api/alerts/subscribe">
        <input type="hidden" name="makeSlug" value="${escapeHtml(makeSlug)}"/>
        <input type="hidden" name="modelSlug" value="${escapeHtml(modelSlug)}"/>
        <input type="hidden" name="year" value="${escapeHtml(year)}"/>
        <input type="hidden" name="source" value="${escapeHtml(source ?? "year-page")}"/>
        <div class="rr-alert__row">
          <label for="rr-alert-email" class="sr-only">Email address</label>
          <input type="email" id="rr-alert-email" name="email" class="rr-alert__input" placeholder="you@example.com" required autocomplete="email" maxlength="254"/>
          <button type="submit" class="rr-alert__submit">Notify Me</button>
        </div>
        ${turnstileWidget}
        <p class="rr-alert__status" id="rr-alert-status" role="status" aria-live="polite"></p>
        <p class="rr-alert__privacy">Double opt-in. One-click unsubscribe. Never sold or shared — see our <a href="/privacy">privacy policy</a>.</p>
      </form>
    </aside>
    <script>
      (function(){
        var form=document.getElementById(${JSON.stringify(formId)});
        if(!form)return;
        var status=document.getElementById('rr-alert-status');
        form.addEventListener('submit',function(e){
          e.preventDefault();
          var btn=form.querySelector('button[type=submit]');
          var tokenInput=form.querySelector('input[name="cf-turnstile-response"]');
          var payload={
            email:form.email.value.trim(),
            makeSlug:form.makeSlug.value,
            modelSlug:form.modelSlug.value,
            year:Number(form.year.value),
            source:form.source.value,
            turnstileToken:tokenInput?tokenInput.value:''
          };
          btn.disabled=true;
          status.textContent='Signing you up\\u2026';
          fetch('/api/alerts/subscribe',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)})
            .then(function(r){return r.json().then(function(d){return {ok:r.ok,d:d}})})
            .then(function(res){
              if(res.ok){
                status.textContent='Almost done \\u2014 check your inbox and click the confirmation link.';
                form.querySelector('.rr-alert__row').style.display='none';
              }else{
                status.textContent=(res.d&&res.d.error)||'Something went wrong. Please try again.';
                btn.disabled=false;
                if(window.turnstile&&typeof window.turnstile.reset==='function'){window.turnstile.reset();}
              }
            })
            .catch(function(){
              status.textContent='Network error. Please try again.';
              btn.disabled=false;
            });
        });
      })();
    </script>
  `;
}
