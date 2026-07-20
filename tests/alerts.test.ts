import assert from "node:assert/strict";
import { test } from "node:test";
import { alertSignup } from "../src/templates/components/alert-signup.ts";
import { confirmEmailTemplate, digestEmailTemplate, unsubscribeHeaders, RESEND_BATCH_LIMIT } from "../src/lib/email.ts";
import { yearPageTemplate } from "../src/templates/year-page.ts";

test("signup form posts the payload shape /api/alerts/subscribe expects", () => {
  const html = alertSignup({
    make: "Ford",
    makeSlug: "ford",
    model: "F-150",
    modelSlug: "f-150",
    year: "2019",
    turnstileSiteKey: "0xSITEKEY",
    source: "year-page",
  });

  assert.match(html, /action="\/api\/alerts\/subscribe"/);
  assert.match(html, /name="makeSlug" value="ford"/);
  assert.match(html, /name="modelSlug" value="f-150"/);
  assert.match(html, /name="year" value="2019"/);
  assert.match(html, /type="email"/);
  // JSON body keys used by the inline submit handler
  for (const key of ["email:", "makeSlug:", "modelSlug:", "year:", "turnstileToken:"]) {
    assert.ok(html.includes(key), `payload key ${key} missing`);
  }
  // Turnstile widget present when a site key is configured
  assert.match(html, /class="cf-turnstile" data-sitekey="0xSITEKEY"/);
  assert.match(html, /challenges\.cloudflare\.com\/turnstile/);
  assert.match(html, /href="\/privacy"/);
});

test("signup form omits Turnstile entirely without a site key", () => {
  const html = alertSignup({ make: "Ford", makeSlug: "ford", model: "F-150", modelSlug: "f-150", year: "2019" });
  assert.doesNotMatch(html, /class="cf-turnstile"/);
  assert.doesNotMatch(html, /challenges\.cloudflare\.com/);
});

test("year page renders the alert signup in both recall and all-clear branches", () => {
  const base = {
    make: "Ford", makeSlug: "ford", model: "F-150", modelSlug: "f-150", year: "2019",
    topSeverity: "HIGH" as const, riskGrade: null, riskScore: null,
    cards: "", leadGen: "",
    alertSignupHtml: alertSignup({ make: "Ford", makeSlug: "ford", model: "F-150", modelSlug: "f-150", year: "2019" }),
  };
  assert.match(yearPageTemplate({ ...base, recallCount: 3 }), /rr-alert__form|rr-alert/);
  assert.match(yearPageTemplate({ ...base, recallCount: 0 }), /rr-alert__form|rr-alert/);
});

test("RFC 8058 one-click unsubscribe headers", () => {
  const headers = unsubscribeHeaders("https://recalledrides.com/api/alerts/unsubscribe?t=tok");
  assert.equal(headers["List-Unsubscribe"], "<https://recalledrides.com/api/alerts/unsubscribe?t=tok>");
  assert.equal(headers["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click");
});

test("confirm email contains the confirm link, unsubscribe link, and postal address", () => {
  const tpl = confirmEmailTemplate({
    vehicleLabel: "2019 Ford F-150",
    confirmUrl: "https://recalledrides.com/api/alerts/confirm?t=CONFIRM",
    unsubUrl: "https://recalledrides.com/api/alerts/unsubscribe?t=UNSUB",
    postalAddress: "PO Box 123, Anytown, ST 00000",
    siteUrl: "https://recalledrides.com",
  });
  for (const body of [tpl.html, tpl.text]) {
    assert.ok(body.includes("https://recalledrides.com/api/alerts/confirm?t=CONFIRM"));
    assert.ok(body.includes("https://recalledrides.com/api/alerts/unsubscribe?t=UNSUB"));
    assert.ok(body.includes("PO Box 123, Anytown, ST 00000"));
  }
  assert.match(tpl.subject, /2019 Ford F-150/);
});

test("digest email prefers enriched copy passed in, links campaign + year pages", () => {
  const tpl = digestEmailTemplate({
    vehicleLabel: "2019 Ford F-150",
    recallItems: [
      {
        campaignNumber: "24V123000",
        component: "FUEL SYSTEM, GASOLINE",
        severity: "CRITICAL",
        summary: "The fuel pump can fail.",
        consequence: "The engine may stall while driving.",
        remedy: "Dealers will replace the fuel pump for free.",
      },
    ],
    yearPageUrl: "https://recalledrides.com/ford/f-150/2019",
    unsubUrl: "https://recalledrides.com/api/alerts/unsubscribe?t=UNSUB",
    postalAddress: "PO Box 123, Anytown, ST 00000",
    siteUrl: "https://recalledrides.com",
    affiliateHtml: "<table><tr><td>AFF-BLOCK</td></tr></table>",
  });

  assert.match(tpl.subject, /New recall for your 2019 Ford F-150/);
  assert.ok(tpl.html.includes("https://recalledrides.com/recall/24V123000"));
  assert.ok(tpl.html.includes("https://recalledrides.com/ford/f-150/2019"));
  assert.ok(tpl.html.includes("The fuel pump can fail."));
  assert.ok(tpl.html.includes("AFF-BLOCK"));
  assert.ok(tpl.html.includes("PO Box 123, Anytown, ST 00000"));
  assert.ok(tpl.text.includes("Unsubscribe instantly"));
});

test("Resend batch limit matches the API contract", () => {
  assert.equal(RESEND_BATCH_LIMIT, 100);
});
