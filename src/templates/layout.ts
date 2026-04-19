import { escapeHtml } from "../lib/utils";

interface LayoutOptions {
  title: string;
  description?: string;
  canonical?: string;
  body: string;
  jsonLd?: string;
}

export function layout({ title, description, canonical, body, jsonLd = "" }: LayoutOptions): string {
  const escapedTitle = escapeHtml(title);
  const escapedDesc = description ? escapeHtml(description) : "";
  const now = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${escapedTitle}</title>
  ${escapedDesc ? `<meta name="description" content="${escapedDesc}"/>` : ""}
  ${canonical ? `<link rel="canonical" href="${canonical}"/>` : ""}
  ${canonical ? `<meta property="og:url" content="${canonical}"/>` : ""}
  ${escapedTitle ? `<meta property="og:title" content="${escapedTitle}"/>` : ""}
  ${escapedDesc ? `<meta property="og:description" content="${escapedDesc}"/>` : ""}
  <meta property="og:type" content="article"/>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Rajdhani:wght@500;600;700&family=Source+Sans+3:wght@400;500;600;700&display=swap" rel="stylesheet"/>
  <link rel="stylesheet" href="/styles.css"/>
  ${jsonLd}
</head>
<body class="rr-layout">
  <nav class="rr-nav">
    <div class="rr-nav__inner">
      <a href="/" class="rr-logo">
        <span class="rr-logo__mark">!</span>
        <span>RecallRadar</span>
      </a>
      <div class="rr-nav__links">
        <a href="/">Search</a>
        <a href="/sitemap.xml">Sitemap</a>
      </div>
    </div>
  </nav>
  <main class="rr-main">
    ${body}
  </main>
  <footer class="rr-footer">
    <p>Data sourced from the <a href="https://www.nhtsa.gov/">National Highway Traffic Safety Administration (NHTSA)</a>. Last updated ${now}.</p>
    <p>RecallRadar is not affiliated with NHTSA or any vehicle manufacturer.</p>
  </footer>
</body>
</html>`;
}
