import { escapeHtml } from "../lib/utils";
import { ASSET_VERSION } from "../lib/constants";

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
  <link rel="stylesheet" href="/styles.css?v=${ASSET_VERSION}"/>
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
      var timer=null,activeIndex=-1;
      input.addEventListener("input",function(){
        clearTimeout(timer);
        activeIndex=-1;
        var q=input.value.trim();
        if(q.length<2){results.hidden=true;results.innerHTML="";return}
        timer=setTimeout(function(){
          fetch("/api/search?q="+encodeURIComponent(q))
            .then(function(r){return r.json()})
            .then(function(d){
              if(!d.results||!d.results.length){results.hidden=true;results.innerHTML="";return}
              results.innerHTML=d.results.map(function(r,i){
                return '<a href="'+r.href+'" data-index="'+i+'"><strong>'+escHtml(r.label)+'</strong> <span class="rr-search-result__sublabel">'+escHtml(r.sublabel)+'</span></a>'
              }).join("");
              results.hidden=false
            })
            .catch(function(){results.hidden=true})
        },200)
      });
      document.addEventListener("click",function(e){if(!input.contains(e.target)&&!results.contains(e.target)){results.hidden=true;activeIndex=-1}});
      input.addEventListener("keydown",function(e){
        var items=results.querySelectorAll("a");
        if(e.key==="Escape"){results.hidden=true;input.blur();activeIndex=-1;return}
        if(!items.length||results.hidden)return;
        if(e.key==="ArrowDown"){e.preventDefault();activeIndex=(activeIndex+1)%items.length;updateActive(items)}
        else if(e.key==="ArrowUp"){e.preventDefault();activeIndex=(activeIndex-1+items.length)%items.length;updateActive(items)}
        else if(e.key==="Enter"){e.preventDefault();if(activeIndex>=0&&items[activeIndex]){location.href=items[activeIndex].href}}
      });
      function updateActive(items){items.forEach(function(item,i){item.classList.toggle("rr-search-result--active",i===activeIndex)})}
      function escHtml(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}
    })();
  </script>
  <script>
    document.addEventListener("click",function(e){var b=e.target.closest(".rr-share-btn");if(!b)return;var u=b.getAttribute("data-share-url");if(!u)return;var a=u;if(!/^https?:/.test(u))a=location.origin+u;var showToast=function(msg){var t=document.getElementById("rr-toast");if(!t)return;t.textContent=msg;t.classList.add("is-visible");setTimeout(function(){t.classList.remove("is-visible")},2200)};if(navigator.share){navigator.share({url:a}).then(function(){showToast("Shared successfully")}).catch(function(){})}else{navigator.clipboard.writeText(a).then(function(){b.setAttribute("data-shared","1");var icon=b.querySelector("svg");if(icon){var orig=icon.innerHTML;icon.innerHTML='<path d="M4 8l3 3 5-6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>';setTimeout(function(){b.removeAttribute("data-shared");icon.innerHTML=orig},1500)}showToast("Link copied to clipboard")})}});
  </script>
  <script>
    // WebMCP — expose site tools to AI agents
    (function(){
      var mc = document.modelContext || navigator.modelContext;
      if(!mc || !mc.registerTool)return;
      var ctrl=new AbortController();
      var site=location.origin;
      var tools=[
        {
          name:"search_vehicles",
          title:"Search Vehicles",
          description:"Search for vehicle makes, models, and years on Recalled Rides.",
          inputSchema:{
            type:"object",
            properties:{query:{type:"string",description:"Search query (e.g., Toyota Camry 2020)"}},
            required:["query"]
          },
          execute:function(args){return fetch(site+"/api/search?q="+encodeURIComponent(args.query)).then(function(r){return r.json()});},
          annotations:{readOnlyHint:true}
        },
        {
          name:"get_recalls",
          title:"Get Recalls",
          description:"Get safety recalls for a specific make, model, and year.",
          inputSchema:{
            type:"object",
            properties:{
              make:{type:"string",description:"Vehicle make slug (e.g., toyota)"},
              model:{type:"string",description:"Vehicle model slug (e.g., camry)"},
              year:{type:"integer",description:"Model year (e.g., 2020)"}
            },
            required:["make","model","year"]
          },
          execute:function(args){return fetch(site+"/"+encodeURIComponent(args.make)+"/"+encodeURIComponent(args.model)+"/"+args.year,{headers:{"Accept":"text/markdown"}}).then(function(r){return r.text()});},
          annotations:{readOnlyHint:true}
        },
        {
          name:"browse_makes",
          title:"Browse Makes",
          description:"List all available vehicle makes.",
          inputSchema:{type:"object",properties:{}},
          execute:function(){return Promise.resolve({url:site+"/",description:"Browse all vehicle makes and models"});},
          annotations:{readOnlyHint:true}
        }
      ];
      tools.forEach(function(t){mc.registerTool(t,{signal:ctrl.signal});});
      window.addEventListener("beforeunload",function(){ctrl.abort();});
    })();
  </script>
  <div id="rr-toast" class="rr-toast" role="status" aria-live="polite"></div>
  <script>
    // Scroll-triggered reveal animation
    (function(){
      if(window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;
      var groups=document.querySelectorAll(".rr-grid, .rr-readout-list");
      groups.forEach(function(g){Array.from(g.children).forEach(function(c){c.classList.add("rr-reveal")})});
      var observer=new IntersectionObserver(function(entries){entries.forEach(function(entry){if(entry.isIntersecting){var children=Array.from(entry.target.children).filter(function(c){return c.classList.contains("rr-reveal")&&c.classList.contains("is-visible")===false});
      children.forEach(function(c,i){setTimeout(function(){c.classList.add("is-visible")},Math.min(i*60,400))});
      if(entry.target.children.length===0||children.length===0)observer.unobserve(entry.target)}})},{threshold:0.05,rootMargin:"0px 0px -40px 0px"});
      groups.forEach(function(g){observer.observe(g)});
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
