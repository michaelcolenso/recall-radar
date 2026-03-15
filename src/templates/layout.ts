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
  <script src="https://cdn.tailwindcss.com"></script>
  ${jsonLd}
</head>
<body class="bg-slate-50 text-slate-900 min-h-screen">
  <nav class="bg-white border-b border-slate-200 px-4 py-3">
    <div class="max-w-5xl mx-auto flex items-center justify-between">
      <a href="/" class="text-xl font-bold text-blue-700 hover:text-blue-900">🚗 RecallRadar</a>
      <a href="/sitemap.xml" class="text-sm text-slate-500 hover:text-slate-700">Sitemap</a>
    </div>
  </nav>
  <main class="max-w-5xl mx-auto px-4 py-8">
    ${body}
  </main>
  <footer class="mt-16 border-t border-slate-200 py-8 text-center text-sm text-slate-500">
    <p>Data sourced from the <a href="https://www.nhtsa.gov/" class="underline hover:text-slate-700">National Highway Traffic Safety Administration (NHTSA)</a>. Last updated ${now}.</p>
    <p class="mt-2">RecallRadar is not affiliated with NHTSA or any vehicle manufacturer.</p>
  </footer>
</body>
</html>`;
}
