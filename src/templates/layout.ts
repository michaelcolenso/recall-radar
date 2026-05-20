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
          <span class="rr-logo__tagline">Every Recall. Every VIN.</span>
        </span>
      </a>
      <div class="rr-nav__links">
        <a href="/#makes">Browse All Makes</a>
        <a href="/about">About</a>
      </div>
    </div>
  </nav>
  <main id="main" class="rr-main rr-animate-in" tabindex="-1">
    ${body}
  </main>
  <footer class="rr-footer">
    <p>Data sourced from the <a href="https://www.nhtsa.gov/" target="_blank" rel="noopener noreferrer">National Highway Traffic Safety Administration (NHTSA)</a>. Last refreshed <span id="rr-footer-date">recently</span>.</p>
    <nav class="rr-footer__makes" aria-label="Browse recalls by make">
      <a href="/toyota">Toyota</a> &middot;
      <a href="/ford">Ford</a> &middot;
      <a href="/honda">Honda</a> &middot;
      <a href="/chevrolet">Chevrolet</a> &middot;
      <a href="/nissan">Nissan</a> &middot;
      <a href="/jeep">Jeep</a> &middot;
      <a href="/bmw">BMW</a> &middot;
      <a href="/dodge">Dodge</a> &middot;
      <a href="/hyundai">Hyundai</a> &middot;
      <a href="/kia">Kia</a>
    </nav>
    <p><a href="/about">About</a> &middot; Recalled Rides is not affiliated with NHTSA or any vehicle manufacturer.</p>
  </footer>
  <script>document.getElementById("rr-footer-date").textContent=new Date().toLocaleDateString("en-US",{month:"long",year:"numeric"})</script>
  <script>
    document.addEventListener("click",function(e){var b=e.target.closest(".rr-share-btn");if(!b)return;var u=b.getAttribute("data-share-url");if(!u)return;var a=u;if(!/^https?:/.test(u))a=location.origin+u;if(navigator.share){navigator.share({url:a}).catch(function(){})}else{navigator.clipboard.writeText(a).then(function(){b.setAttribute("data-shared","1");b.querySelector(".rr-share-btn__icon").innerHTML='<path d="M4 8l3 3 5-6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>';setTimeout(function(){b.removeAttribute("data-shared");b.querySelector(".rr-share-btn__icon").innerHTML='<path d="M12 10.5c-.5 0-.9.2-1.2.5L5.5 8.3c0-.1.1-.2.1-.3 0-.1 0-.2-.1-.3l5.3-2.7c.3.3.7.5 1.2.5a1.5 1.5 0 1 0-1.5-1.5c0 .1 0 .2.1.3L5.4 7.3c-.3-.3-.7-.5-1.2-.5a1.5 1.5 0 0 0 0 3c.5 0 .9-.2 1.2-.5l5.3 2.7c0 .1-.1.2-.1.3a1.5 1.5 0 1 0 1.5-1.5z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>'},1500)}})});
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
