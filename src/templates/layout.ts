import { escapeHtml } from "../lib/utils";

interface LayoutOptions {
  title: string;
  description?: string;
  canonical?: string;
  body: string;
  jsonLd?: string;
  noIndex?: boolean;
  ogType?: string;
  ogImage?: string;
  googleVerification?: string;
  analyticsToken?: string;
  lastUpdated?: string;
}

export function layout({
  title,
  description,
  canonical,
  body,
  jsonLd = "",
  noIndex,
  ogType,
  ogImage,
  googleVerification,
  analyticsToken,
  lastUpdated,
}: LayoutOptions): string {
  const escapedTitle = escapeHtml(title);
  const escapedDesc = description ? escapeHtml(description) : "";
  const resolvedOgType = ogType || "website";
  const resolvedOgImage = resolveMetaImageUrl(canonical, ogImage || "/og-image.png");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${escapedTitle}</title>
  <link rel="icon" type="image/svg+xml" href="/favicon.svg"/>
  <link rel="apple-touch-icon" href="/apple-touch-icon.png"/>
  <link rel="manifest" href="/site.webmanifest"/>
  <link rel="search" type="application/opensearchdescription+xml" title="Recalled Rides" href="/opensearch.xml"/>
  <meta name="theme-color" content="#f8f8f7" media="(prefers-color-scheme: light)"/>
  <meta name="theme-color" content="#0a0a0c" media="(prefers-color-scheme: dark)"/>
  ${escapedDesc ? `<meta name="description" content="${escapedDesc}"/>` : ""}
  ${noIndex ? `<meta name="robots" content="noindex, nofollow"/>` : ""}
  ${googleVerification ? `<meta name="google-site-verification" content="${googleVerification}"/>` : ""}
  ${canonical ? `<link rel="canonical" href="${canonical}"/>` : ""}
  ${canonical ? `<meta property="og:url" content="${canonical}"/>` : ""}
  ${escapedTitle ? `<meta property="og:title" content="${escapedTitle}"/>` : ""}
  ${escapedDesc ? `<meta property="og:description" content="${escapedDesc}"/>` : ""}
  <meta property="og:type" content="${resolvedOgType}"/>
  <meta property="og:site_name" content="Recalled Rides"/>
  <meta property="og:image" content="${resolvedOgImage}"/>
  <meta property="og:image:width" content="1200"/>
  <meta property="og:image:height" content="630"/>
  <meta property="og:image:alt" content="Recalled Rides — vehicle recall information"/>
  <meta name="twitter:card" content="summary_large_image"/>
  ${escapedTitle ? `<meta name="twitter:title" content="${escapedTitle}"/>` : ""}
  ${escapedDesc ? `<meta name="twitter:description" content="${escapedDesc}"/>` : ""}
  <meta name="twitter:image" content="${resolvedOgImage}"/>
  <link rel="preload" href="/fonts/space-grotesk.woff2" as="font" type="font/woff2" crossorigin/>
  <link rel="preload" href="/fonts/literata.woff2" as="font" type="font/woff2" crossorigin/>
  <link rel="stylesheet" href="/styles.css"/>
  ${jsonLd}
  ${analyticsToken ? `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon="{&quot;token&quot;: &quot;${analyticsToken}&quot;}"></script>` : ""}
</head>
<body class="rr-layout">
  <a href="#main" class="rr-skip-link">Skip to main content</a>
    <nav class="rr-nav">
    <div class="rr-nav__inner">
      <a href="/" class="rr-logo" aria-label="Recalled Rides home">
        <span class="rr-logo__mark" aria-hidden="true"></span>
        <span class="rr-logo__wordmark-wrap">
          <span class="rr-logo__wordmark">Recalled Rides</span>
          <span class="rr-logo__tagline">Data Source: NHTSA</span>
        </span>
      </a>
      <div class="rr-nav__links">
        <a href="/#makes">Browse</a>
        <a href="/toyota">Toyota</a>
        <a href="/honda">Honda</a>
        <a href="/ford">Ford</a>
        <a href="/about">About</a>
      </div>
    </div>
  </nav>
  <main id="main" class="rr-main rr-animate-in" tabindex="-1">
    ${body}
  </main>
  <footer class="rr-footer">
    <div class="rr-footer__inner">
      <p>Source: <a href="https://www.nhtsa.gov/" target="_blank" rel="noopener noreferrer">National Highway Traffic Safety Administration</a>. Updated <span id="rr-footer-date">${escapeHtml(lastUpdated || "recently")}</span>.</p>
      <p>Independent repository. Not affiliated with NHTSA or manufacturers. &middot; <a href="/about">Learn More</a></p>
    </div>
  </footer>
  ${!lastUpdated ? `<script>document.getElementById("rr-footer-date").textContent=new Date().toLocaleDateString("en-US",{month:"long",year:"numeric"})</script>` : ""}
  <!-- Chat widget -->
  <button id="rr-chat-toggle" class="rr-chat-toggle" aria-label="Chat about recalls">
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
    <span class="rr-chat-toggle__label">Ask AI</span>
  </button>
  <div id="rr-chat-panel" class="rr-chat-panel" hidden>
    <div class="rr-chat-panel__header">
      <span class="rr-chat-panel__title">Symptom Matcher</span>
      <button id="rr-chat-close" class="rr-chat-panel__close" aria-label="Close chat">×</button>
    </div>
    <div id="rr-chat-messages" class="rr-chat-messages">
      <div class="rr-chat-msg rr-chat-msg--bot">
        <div class="rr-chat-msg__text">Describe what's going on with your car — include the year, make, and model. I'll match your symptoms to known recalls.</div>
      </div>
    </div>
    <form id="rr-chat-form" class="rr-chat-form">
      <input type="text" id="rr-chat-input" class="rr-chat-input" placeholder="e.g. My 2020 Camry stalls at stoplights..." autocomplete="off"/>
      <button type="submit" id="rr-chat-send" class="rr-chat-send" aria-label="Send">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
      </button>
    </form>
  </div>
  <script>
    // Prefill search from ?q= param
    (function(){
      var p=new URLSearchParams(location.search);
      var q=p.get("q");
      if(q){
        var input=document.getElementById("rr-global-search");
        if(input){input.value=q;input.dispatchEvent(new Event("input",{bubbles:true}))}
      }
    })();
  </script>
  <script>
    // Vehicle search typeahead
    (function(){
      var input=document.getElementById("rr-global-search");
      var results=document.getElementById("rr-global-search-results");
      if(!input||!results)return;
      var timer=null;
      input.addEventListener("input",function(){
        clearTimeout(timer);
        var q=input.value.trim();
        if(q.length<2){results.hidden=true;results.innerHTML="";return}
        timer=setTimeout(function(){
          fetch("/api/search?q="+encodeURIComponent(q))
            .then(function(r){return r.json()})
            .then(function(d){
              if(!d.results||!d.results.length){results.hidden=true;results.innerHTML="";return}
              results.innerHTML=d.results.map(function(r){
                return '<a href="'+r.href+'"><strong>'+escHtml(r.label)+'</strong> <span style="opacity:0.5;font-size:10px">'+escHtml(r.sublabel)+'</span></a>'
              }).join("");
              results.hidden=false
            })
            .catch(function(){results.hidden=true})
        },200)
      });
      document.addEventListener("click",function(e){if(!input.contains(e.target)&&!results.contains(e.target)){results.hidden=true}});
      input.addEventListener("keydown",function(e){if(e.key==="Escape"){results.hidden=true;input.blur()}});
      function escHtml(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}
    })();
  </script>
  <script>
    document.addEventListener("click",function(e){var b=e.target.closest(".rr-share-btn");if(!b)return;var u=b.getAttribute("data-share-url");if(!u)return;var a=u;if(!/^https?:/.test(u))a=location.origin+u;if(navigator.share){navigator.share({url:a}).catch(function(){})}else{navigator.clipboard.writeText(a).then(function(){b.setAttribute("data-shared","1");b.querySelector(".rr-share-btn__icon").innerHTML='<path d="M4 8l3 3 5-6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>';setTimeout(function(){b.removeAttribute("data-shared");b.querySelector(".rr-share-btn__icon").innerHTML='<path d="M12 10.5c-.5 0-.9.2-1.2.5L5.5 8.3c0-.1.1-.2.1-.3 0-.1 0-.2-.1-.3l5.3-2.7c.3.3.7.5 1.2.5a1.5 1.5 0 1 0-1.5-1.5c0 .1 0 .2.1.3L5.4 7.3c-.3-.3-.7-.5-1.2-.5a1.5 1.5 0 0 0 0 3c.5 0 .9-.2 1.2-.5l5.3 2.7c0 .1-.1.2-.1.3a1.5 1.5 0 1 0 1.5-1.5z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>'},1500)}})});
  </script>
  <!-- Chat widget JS -->
  <script>
    (function(){
      var toggle=document.getElementById("rr-chat-toggle");
      var panel=document.getElementById("rr-chat-panel");
      var close=document.getElementById("rr-chat-close");
      var form=document.getElementById("rr-chat-form");
      var input=document.getElementById("rr-chat-input");
      var messages=document.getElementById("rr-chat-messages");
      if(!toggle||!panel)return;

      toggle.addEventListener("click",function(){
        var isOpen=!panel.hidden;
        panel.hidden=isOpen;
        toggle.setAttribute("aria-expanded",String(!isOpen));
        if(!isOpen){input.focus()}
      });
      close.addEventListener("click",function(){
        panel.hidden=true;
        toggle.setAttribute("aria-expanded","false");
      });

      function addMsg(text,role,url){
        var div=document.createElement("div");
        div.className="rr-chat-msg rr-chat-msg--"+role;
        var body='<div class="rr-chat-msg__text">'+escHtml(text)+'</div>';
        if(url){
          body+='<a href="'+url+'" class="rr-chat-msg__link">View recall details →</a>';
        }
        div.innerHTML=body;
        messages.appendChild(div);
        messages.scrollTop=messages.scrollHeight;
      }

      function setLoading(v){
        var btn=document.getElementById("rr-chat-send");
        input.disabled=v;
        btn.disabled=v;
        btn.style.opacity=v?"0.5":"1";
      }

      form.addEventListener("submit",function(e){
        e.preventDefault();
        var msg=input.value.trim();
        if(!msg)return;
        addMsg(msg,"user");
        input.value="";
        setLoading(true);

        var loadingDiv=document.createElement("div");
        loadingDiv.className="rr-chat-msg rr-chat-msg--bot rr-chat-msg--loading";
        loadingDiv.innerHTML='<div class="rr-chat-msg__text">Analyzing symptoms<span class="rr-chat-dots"><span>.</span><span>.</span><span>.</span></span></div>';
        messages.appendChild(loadingDiv);
        messages.scrollTop=messages.scrollHeight;

        fetch("/api/chat",{
          method:"POST",
          headers:{"content-type":"application/json"},
          body:JSON.stringify({message:msg})
        })
        .then(function(r){return r.json()})
        .then(function(d){
          loadingDiv.remove();
          addMsg(d.reply,"bot",d.vehicle?d.vehicle.url:null);
        })
        .catch(function(){
          loadingDiv.remove();
          addMsg("Sorry, I couldn't connect. Try again?","bot");
        })
        .finally(function(){setLoading(false)});
      });

      function escHtml(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}
    })();
  </script>
</body>
</html>`;
}

function resolveMetaImageUrl(canonical: string | undefined, image: string): string {
  if (/^https?:\/\//.test(image)) {
    return image;
  }
  if (!canonical) {
    return image;
  }
  try {
    return new URL(image, canonical).toString();
  } catch {
    return image;
  }
}
