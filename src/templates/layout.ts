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

export function layout({ title, description, canonical, body, jsonLd = "", noIndex, ogType, ogImage, googleVerification, analyticsToken }: LayoutOptions): string {
  const escapedTitle = escapeHtml(title);
  const escapedDesc = description ? escapeHtml(description) : "";
  const now = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const resolvedOgType = ogType || "website";
  const resolvedOgImage = resolveMetaImageUrl(canonical, ogImage || "/og-image.png");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${escapedTitle}</title>
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
  <link rel="dns-prefetch" href="https://fonts.googleapis.com"/>
  <link rel="dns-prefetch" href="https://fonts.gstatic.com"/>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Literata:ital,opsz,wght@0,7..72,400;0,7..72,500;0,7..72,600;1,7..72,400&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet"/>
  <link rel="stylesheet" href="/styles.css"/>
  ${jsonLd}
  ${analyticsToken ? `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon="{&quot;token&quot;: &quot;${analyticsToken}&quot;}"></script>` : ""}
</head>
<body class="rr-layout">
  <a href="#main" class="rr-skip-link">Skip to main content</a>
  <nav class="rr-nav">
    <div class="rr-nav__inner">
      <a href="/" class="rr-logo">
        <span class="rr-logo__mark" aria-hidden="true">!</span>
        <span>Recalled Rides</span>
      </a>
      <div class="rr-nav__links">
        <a href="/">Search</a>
        <a href="/about">About</a>
      </div>
    </div>
  </nav>
  <main id="main" class="rr-main rr-animate-in" tabindex="-1">
    ${body}
  </main>
  <footer class="rr-footer">
    <div class="rr-footer__inner">
      <p>Data sourced from the <a href="https://www.nhtsa.gov/" target="_blank" rel="noopener noreferrer">National Highway Traffic Safety Administration (NHTSA)</a>. Last updated ${now}.</p>
      <p>Recalled Rides is not affiliated with NHTSA or any vehicle manufacturer. <a href="/about">About</a> &middot; <a href="/sitemap.xml">Sitemap</a></p>
    </div>
  </footer>
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
