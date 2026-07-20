// Minimal Resend client + alert email templates.
//
// All commercial email compliance lives here:
//  - RFC 8058 one-click unsubscribe (List-Unsubscribe + List-Unsubscribe-Post)
//  - CAN-SPAM physical postal address in every footer
//  - plain-text alternative part on every message
//
// If Resend is ever swapped (e.g. for AWS SES), this module is the only thing
// that changes — callers deal in SendEmailInput objects.

import { escapeHtml } from "./utils";
import type { SeverityLevel } from "../db/schema";

const RESEND_API_URL = "https://api.resend.com";
/** Resend batch endpoint accepts at most 100 emails per HTTP call. */
export const RESEND_BATCH_LIMIT = 100;

export interface SendEmailInput {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  headers?: Record<string, string>;
}

interface ResendSendResponse {
  id?: string;
  message?: string;
}

interface ResendBatchResponse {
  data?: Array<{ id: string }>;
  message?: string;
}

export async function sendEmail(apiKey: string, email: SendEmailInput): Promise<{ ok: boolean; id?: string; error?: string }> {
  const res = await fetch(`${RESEND_API_URL}/emails`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(email),
  });
  const data = (await res.json().catch(() => ({}))) as ResendSendResponse;
  if (!res.ok) {
    return { ok: false, error: data.message ?? `Resend HTTP ${res.status}` };
  }
  return { ok: true, id: data.id };
}

export async function sendEmailBatch(
  apiKey: string,
  emails: SendEmailInput[],
): Promise<{ ok: boolean; ids: (string | null)[]; error?: string }> {
  if (emails.length === 0) return { ok: true, ids: [] };
  if (emails.length > RESEND_BATCH_LIMIT) {
    return { ok: false, ids: [], error: `batch too large: ${emails.length} > ${RESEND_BATCH_LIMIT}` };
  }
  const res = await fetch(`${RESEND_API_URL}/emails/batch`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(emails),
  });
  const data = (await res.json().catch(() => ({}))) as ResendBatchResponse;
  if (!res.ok) {
    return { ok: false, ids: [], error: data.message ?? `Resend HTTP ${res.status}` };
  }
  return { ok: true, ids: emails.map((_, i) => data.data?.[i]?.id ?? null) };
}

/** RFC 8058 one-click unsubscribe headers — required by Gmail/Yahoo bulk-sender rules. */
export function unsubscribeHeaders(unsubUrl: string): Record<string, string> {
  return {
    "List-Unsubscribe": `<${unsubUrl}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

// ─── Templates ──────────────────────────────────────────────────

interface ConfirmEmailOptions {
  vehicleLabel: string; // e.g. "2019 Ford F-150"
  confirmUrl: string;
  unsubUrl: string;
  postalAddress: string;
  siteUrl: string;
}

export function confirmEmailTemplate({ vehicleLabel, confirmUrl, unsubUrl, postalAddress, siteUrl }: ConfirmEmailOptions): {
  subject: string;
  html: string;
  text: string;
} {
  const vehicle = escapeHtml(vehicleLabel);
  const subject = `Confirm your recall alerts for your ${vehicleLabel}`;
  const html = emailShell(`
    <h1 style="margin:0 0 16px;font-size:22px;color:#18181b;">Confirm your recall alerts</h1>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#3f3f46;">
      You (or someone using your email address) asked to be notified when a new safety recall
      is issued for the <strong>${vehicle}</strong>. Click the button below to confirm —
      we never send alerts to unconfirmed addresses.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
      <tr><td style="background:#c2410c;border-radius:4px;">
        <a href="${confirmUrl}" style="display:inline-block;padding:12px 28px;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;">Confirm My Alerts</a>
      </td></tr>
    </table>
    <p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#71717a;">
      If you didn't request this, ignore this email — nothing will be sent to you again.
    </p>
  `, { unsubUrl, postalAddress, siteUrl });

  const text = [
    `Confirm your recall alerts for your ${vehicleLabel}`,
    "",
    `You (or someone using your email address) asked to be notified when a new safety recall is issued for the ${vehicleLabel}.`,
    "",
    `Confirm here: ${confirmUrl}`,
    "",
    "If you didn't request this, ignore this email — nothing will be sent to you again.",
    "",
    textFooter(unsubUrl, postalAddress),
  ].join("\n");

  return { subject, html, text };
}

export interface DigestRecallItem {
  campaignNumber: string;
  component: string;
  severity: SeverityLevel;
  summary: string;
  consequence: string;
  remedy: string;
}

interface DigestEmailOptions {
  vehicleLabel: string;
  recallItems: DigestRecallItem[];
  yearPageUrl: string;
  unsubUrl: string;
  postalAddress: string;
  siteUrl: string;
  /** Optional pre-rendered affiliate block (Phase 1 registry, variant "email"). */
  affiliateHtml?: string;
}

const SEVERITY_COLORS: Record<SeverityLevel, string> = {
  CRITICAL: "#dc2626",
  HIGH: "#ea580c",
  MEDIUM: "#ca8a04",
  LOW: "#16a34a",
  UNKNOWN: "#71717a",
};

export function digestEmailTemplate({ vehicleLabel, recallItems, yearPageUrl, unsubUrl, postalAddress, siteUrl, affiliateHtml }: DigestEmailOptions): {
  subject: string;
  html: string;
  text: string;
} {
  const vehicle = escapeHtml(vehicleLabel);
  const count = recallItems.length;
  const subject =
    count === 1
      ? `New recall for your ${vehicleLabel}: ${titleCaseComponent(recallItems[0].component)}`
      : `${count} new recalls for your ${vehicleLabel}`;

  const items = recallItems
    .map((r) => {
      const color = SEVERITY_COLORS[r.severity] ?? SEVERITY_COLORS.UNKNOWN;
      return `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;border:1px solid #e4e4e7;border-radius:6px;">
        <tr><td style="padding:16px 20px;">
          <p style="margin:0 0 8px;font-size:12px;">
            <span style="display:inline-block;padding:2px 8px;border-radius:3px;background:${color};color:#ffffff;font-weight:bold;">${escapeHtml(r.severity)}</span>
            <span style="color:#71717a;">&nbsp;Campaign ${escapeHtml(r.campaignNumber)}</span>
          </p>
          <p style="margin:0 0 10px;font-size:16px;font-weight:bold;color:#18181b;">${escapeHtml(titleCaseComponent(r.component))}</p>
          <p style="margin:0 0 10px;font-size:14px;line-height:1.6;color:#3f3f46;"><strong>What happened:</strong> ${escapeHtml(r.summary)}</p>
          <p style="margin:0 0 10px;font-size:14px;line-height:1.6;color:#3f3f46;"><strong>The risk:</strong> ${escapeHtml(r.consequence)}</p>
          <p style="margin:0 0 10px;font-size:14px;line-height:1.6;color:#3f3f46;"><strong>The fix (free at your dealer):</strong> ${escapeHtml(r.remedy)}</p>
          <p style="margin:0;font-size:13px;"><a href="${siteUrl}/recall/${encodeURIComponent(r.campaignNumber)}" style="color:#c2410c;font-weight:bold;">Full details →</a></p>
        </td></tr>
      </table>`;
    })
    .join("");

  const html = emailShell(`
    <h1 style="margin:0 0 8px;font-size:22px;color:#18181b;">${count === 1 ? "New safety recall" : `${count} new safety recalls`} for your ${vehicle}</h1>
    <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#3f3f46;">
      NHTSA issued the following since our last check. Recall repairs are <strong>always free</strong> at franchised dealers — even out of warranty.
    </p>
    ${items}
    <p style="margin:0;font-size:14px;"><a href="${yearPageUrl}" style="color:#c2410c;font-weight:bold;">See every recall for this vehicle →</a></p>
    ${affiliateHtml ?? ""}
  `, { unsubUrl, postalAddress, siteUrl });

  const text = [
    subject,
    "",
    ...recallItems.flatMap((r) => [
      `— ${titleCaseComponent(r.component)} [${r.severity}] (Campaign ${r.campaignNumber})`,
      `  What happened: ${r.summary}`,
      `  The risk: ${r.consequence}`,
      `  The fix (free at your dealer): ${r.remedy}`,
      `  Details: ${siteUrl}/recall/${encodeURIComponent(r.campaignNumber)}`,
      "",
    ]),
    `All recalls for this vehicle: ${yearPageUrl}`,
    "",
    textFooter(unsubUrl, postalAddress),
  ].join("\n");

  return { subject, html, text };
}

function emailShell(content: string, { unsubUrl, postalAddress, siteUrl }: { unsubUrl: string; postalAddress: string; siteUrl: string }): string {
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f4f4f5;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 0;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;">
  <tr><td style="padding:20px 28px;border-bottom:2px solid #18181b;font-family:Arial,Helvetica,sans-serif;">
    <a href="${siteUrl}" style="font-size:16px;font-weight:bold;color:#18181b;text-decoration:none;">⚠ Recalled Rides</a>
    <span style="font-size:11px;color:#71717a;">&nbsp;· Data source: NHTSA</span>
  </td></tr>
  <tr><td style="padding:28px;font-family:Arial,Helvetica,sans-serif;">
    ${content}
  </td></tr>
  <tr><td style="padding:20px 28px;border-top:1px solid #e4e4e7;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#71717a;">
    You're receiving this because this address subscribed to recall alerts at Recalled Rides and confirmed by email.
    <a href="${unsubUrl}" style="color:#71717a;">Unsubscribe instantly</a> — no login needed.<br/>
    Recalled Rides · ${escapeHtml(postalAddress)}<br/>
    Recall data is sourced from the U.S. National Highway Traffic Safety Administration. Recalled Rides is not affiliated with NHTSA or any vehicle manufacturer.
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

function textFooter(unsubUrl: string, postalAddress: string): string {
  return [
    "----",
    `Unsubscribe instantly (no login needed): ${unsubUrl}`,
    `Recalled Rides · ${postalAddress}`,
    "Data source: U.S. National Highway Traffic Safety Administration (NHTSA).",
  ].join("\n");
}

function titleCaseComponent(component: string): string {
  const primary = component.split(":")[0].trim();
  return primary
    .toLowerCase()
    .replace(/(?:^|\s|-|\/)\S/g, (c) => c.toUpperCase());
}
