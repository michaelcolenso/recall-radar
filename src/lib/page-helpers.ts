import type { Context } from "hono";
import { escapeHtml, acceptsMarkdown, htmlToMarkdown } from "./utils";

export const CACHE_CONTROL = "public, s-maxage=43200, stale-while-revalidate=86400";
export const HTML_HEADERS = { "content-type": "text/html; charset=utf-8" };
export const PAGE_CACHE_VERSION = "v10";

export function linkHeaders(siteUrl: string): Record<string, string> {
  return {
    link:
      `<${siteUrl}/.well-known/api-catalog>; rel="api-catalog", ` +
      `<${siteUrl}/.well-known/oauth-authorization-server>; rel="oauth-authorization-server", ` +
      `<${siteUrl}/.well-known/oauth-protected-resource>; rel="oauth-protected-resource", ` +
      `<${siteUrl}/.well-known/mcp/server-card.json>; rel="mcp-server-card", ` +
      `<${siteUrl}/.well-known/agent-skills/index.json>; rel="agent-skills", ` +
      `<${siteUrl}/auth.md>; rel="auth-md", ` +
      `<${siteUrl}/sitemap.xml>; rel="sitemap"`,
  };
}

export function maybeMarkdown(c: Context, html: string, status: 200 | 404 = 200): Response {
  if (acceptsMarkdown(c)) {
    const markdown = htmlToMarkdown(html);
    return c.body(markdown, status, {
      "content-type": "text/markdown; charset=utf-8",
      "x-markdown-tokens": String(markdown.split(/\s+/).length),
    });
  }
  return c.body(html, status, HTML_HEADERS);
}

export function notFoundBody(message: string, _siteUrl: string): string {
  return `
    <div class="rr-empty">
      <h1 class="rr-empty__title">Page Not Found</h1>
      <p class="rr-empty__text">${escapeHtml(message)}</p>
      <a href="/" class="rr-empty__action">Browse All Makes</a>
    </div>
  `;
}

export function withPageCacheVersion(key: string): string {
  return `${PAGE_CACHE_VERSION}:${key}`;
}
