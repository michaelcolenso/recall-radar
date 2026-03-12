import { escapeHtml } from "../lib/utils";

export function layout(title: string, body: string, jsonLd = ""): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${escapeHtml(title)}</title><link rel="stylesheet" href="/styles.css"/>${jsonLd}</head><body><main class="container"><h1><a href=\"/\">RecallRadar</a></h1>${body}</main></body></html>`;
}
