import { z } from "zod";
import { WorkflowEntrypoint, WorkflowEvent, WorkflowStep } from "cloudflare:workers";
import {
  sendEmailBatch,
  digestEmailTemplate,
  unsubscribeHeaders,
  RESEND_BATCH_LIMIT,
  type SendEmailInput,
  type DigestRecallItem,
} from "../lib/email";
import { primaryPartner } from "../lib/affiliates";
import { vinReportEmailCta } from "../templates/components/affiliate-box";
import type { SeverityLevel } from "../db/schema";

const AlertDigestParamsSchema = z.object({
  // Render + count everything but skip the Resend calls (for prod smoke tests).
  dryRun: z.boolean().optional(),
});

export type AlertDigestParams = z.infer<typeof AlertDigestParamsSchema>;

/** Max recalls listed per email — beyond this the year page is the reference. */
const RECALLS_PER_EMAIL = 5;
/** Subscriptions handled per workflow step = one Resend batch call per step. */
const SUBS_PER_STEP = RESEND_BATCH_LIMIT;

interface WorkRow {
  sub_id: number;
  email: string;
  unsub_token: string;
  recall_id: number;
  nhtsa_campaign_number: string;
  component: string;
  severity_level: SeverityLevel;
  summary: string;
  consequence: string;
  remedy: string;
  make_name: string;
  make_slug: string;
  model_name: string;
  model_slug: string;
  year: number;
}

/**
 * Weekly recall-alert digest (cron: Tuesday 02:00 UTC — the day after Monday's
 * ingestion + enrichment run, so new recalls carry plain-English text).
 *
 * Delta detection: recalls.created_at > watermark, where the watermark is the
 * last completed run's completed_at. Idempotency: alert_sends UNIQUE
 * (subscription_id, recall_id) + the LEFT JOIN exclusion below — manual reruns
 * and overlapping windows cannot double-send.
 */
export class AlertDigestWorkflow extends WorkflowEntrypoint<Env, AlertDigestParams> {
  async run(event: WorkflowEvent<AlertDigestParams>, step: WorkflowStep) {
    const params = AlertDigestParamsSchema.safeParse(event.payload ?? {});
    const dryRun = params.success ? (params.data.dryRun ?? false) : false;

    const init = await step.do("init-run", async () => {
      const startedAt = new Date().toISOString();
      const watermarkRow = await this.env.DB.prepare(
        "SELECT MAX(completed_at) AS watermark FROM alert_digest_runs WHERE status = 'completed'",
      ).first<{ watermark: string | null }>();
      // First run ever: look back 7 days instead of alerting on the entire history.
      const watermark =
        watermarkRow?.watermark ?? new Date(Date.now() - 7 * 24 * 3_600_000).toISOString();

      const inserted = await this.env.DB.prepare(
        "INSERT INTO alert_digest_runs (started_at, status) VALUES (?, 'running') RETURNING id",
      )
        .bind(startedAt)
        .first<{ id: number }>();

      return { runId: inserted!.id, watermark, startedAt };
    });

    try {
      // Expired double-opt-in attempts: pending for > 7 days never receive
      // anything and are dropped so the table stays clean.
      await step.do("cleanup-stale-pending", async () => {
        const cutoff = new Date(Date.now() - 7 * 24 * 3_600_000).toISOString();
        await this.env.DB.prepare(
          "DELETE FROM alert_subscriptions WHERE status = 'pending' AND created_at < ?",
        )
          .bind(cutoff)
          .run();
      });

      // Only subscription IDs cross step boundaries — row payloads are
      // re-queried per send step to stay under workflow state size limits.
      const work = await step.do("find-subscriptions", async () => {
        const result = await this.env.DB.prepare(
          `SELECT DISTINCT s.id AS sub_id
           FROM recalls r
           JOIN alert_subscriptions s ON s.vehicle_year_id = r.vehicle_year_id AND s.status = 'active'
           LEFT JOIN alert_sends sent ON sent.subscription_id = s.id AND sent.recall_id = r.id
           WHERE r.created_at > ? AND sent.id IS NULL
           ORDER BY s.id`,
        )
          .bind(init.watermark)
          .all<{ sub_id: number }>();
        return { subIds: result.results.map((row) => row.sub_id) };
      });

      let totalEmails = 0;
      let totalRecalls = 0;

      for (let offset = 0; offset < work.subIds.length; offset += SUBS_PER_STEP) {
        const chunk = work.subIds.slice(offset, offset + SUBS_PER_STEP);
        const stepResult = await step.do(
          `send-batch-${offset / SUBS_PER_STEP}`,
          { retries: { limit: 2, delay: "10 seconds", backoff: "exponential" }, timeout: "2 minutes" },
          () => this._sendChunk(chunk, init.watermark, init.runId, dryRun),
        );
        totalEmails += stepResult.emailsSent;
        totalRecalls += stepResult.recallsMatched;
      }

      await step.do("complete-run", async () => {
        // The watermark the NEXT run reads is completed_at. Use this run's
        // start time, not the finish time: recalls ingested while this run was
        // executing were not queried and must be picked up next week.
        await this.env.DB.prepare(
          `UPDATE alert_digest_runs
           SET status = 'completed', completed_at = ?, recalls_matched = ?, emails_sent = ?
           WHERE id = ?`,
        )
          .bind(init.startedAt, totalRecalls, totalEmails, init.runId)
          .run();
      });

      return { ok: true, runId: init.runId, emailsSent: totalEmails, recallsMatched: totalRecalls, dryRun };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await step.do("mark-run-failed", async () => {
        await this.env.DB.prepare(
          "UPDATE alert_digest_runs SET status = 'failed', error = ? WHERE id = ?",
        )
          .bind(message.slice(0, 1024), init.runId)
          .run();
      });
      return { ok: false, runId: init.runId, error: message };
    }
  }

  private async _sendChunk(
    subIds: number[],
    watermark: string,
    runId: number,
    dryRun: boolean,
  ): Promise<{ emailsSent: number; recallsMatched: number }> {
    if (subIds.length === 0) return { emailsSent: 0, recallsMatched: 0 };

    const siteUrl = this.env.SITE_URL || "https://recalledrides.com";
    const placeholders = subIds.map(() => "?").join(",");
    const rowsResult = await this.env.DB.prepare(
      `SELECT s.id AS sub_id, s.email, s.unsub_token,
              r.id AS recall_id, r.nhtsa_campaign_number, r.component, r.severity_level,
              COALESCE(r.summary_enriched, r.summary_raw) AS summary,
              COALESCE(r.consequence_enriched, r.consequence_raw) AS consequence,
              COALESCE(r.remedy_enriched, r.remedy_raw) AS remedy,
              mk.name AS make_name, mk.slug AS make_slug,
              m.name AS model_name, m.slug AS model_slug,
              vy.year
       FROM recalls r
       JOIN vehicle_years vy ON vy.id = r.vehicle_year_id
       JOIN models m ON m.id = vy.model_id
       JOIN makes mk ON mk.id = m.make_id
       JOIN alert_subscriptions s ON s.vehicle_year_id = vy.id AND s.status = 'active'
       LEFT JOIN alert_sends sent ON sent.subscription_id = s.id AND sent.recall_id = r.id
       WHERE r.created_at > ? AND sent.id IS NULL AND s.id IN (${placeholders})
       ORDER BY s.id, r.report_received_date DESC`,
    )
      .bind(watermark, ...subIds)
      .all<WorkRow>();

    const bySub = new Map<number, WorkRow[]>();
    for (const row of rowsResult.results) {
      const list = bySub.get(row.sub_id) ?? [];
      if (list.length < RECALLS_PER_EMAIL) list.push(row);
      bySub.set(row.sub_id, list);
    }
    if (bySub.size === 0) return { emailsSent: 0, recallsMatched: 0 };

    const partner = primaryPartner(this.env.AFFILIATE_PARTNERS);
    const affiliateHtml = partner ? vinReportEmailCta(partner, siteUrl) : undefined;
    const from = this.env.ALERT_FROM_ADDRESS || "Recalled Rides Alerts <alerts@alerts.recalledrides.com>";
    const postalAddress = this.env.EMAIL_POSTAL_ADDRESS || "Address on file with our email provider";

    const emails: SendEmailInput[] = [];
    const sendRows: Array<{ subId: number; recallId: number }> = [];

    for (const [subId, rows] of bySub) {
      const first = rows[0];
      const vehicleLabel = `${first.year} ${first.make_name} ${first.model_name}`;
      const yearPageUrl = `${siteUrl}/${first.make_slug}/${first.model_slug}/${first.year}`;
      const unsubUrl = `${siteUrl}/api/alerts/unsubscribe?t=${first.unsub_token}`;
      const recallItems: DigestRecallItem[] = rows.map((r) => ({
        campaignNumber: r.nhtsa_campaign_number,
        component: r.component,
        severity: r.severity_level,
        summary: r.summary,
        consequence: r.consequence,
        remedy: r.remedy,
      }));

      const tpl = digestEmailTemplate({
        vehicleLabel,
        recallItems,
        yearPageUrl,
        unsubUrl,
        postalAddress,
        siteUrl,
        affiliateHtml,
      });

      emails.push({
        from,
        to: first.email,
        subject: tpl.subject,
        html: tpl.html,
        text: tpl.text,
        headers: unsubscribeHeaders(unsubUrl),
      });
      for (const r of rows) sendRows.push({ subId, recallId: r.recall_id });
    }

    let resendIds: (string | null)[] = emails.map(() => null);
    if (!dryRun) {
      if (!this.env.RESEND_API_KEY) {
        throw new Error("RESEND_API_KEY is not configured");
      }
      const result = await sendEmailBatch(this.env.RESEND_API_KEY, emails);
      if (!result.ok) {
        throw new Error(`Resend batch failed: ${result.error}`);
      }
      resendIds = result.ids;
    }

    const now = new Date().toISOString();
    const subIdToResendId = new Map<number, string | null>();
    let i = 0;
    for (const subId of bySub.keys()) {
      subIdToResendId.set(subId, resendIds[i++] ?? null);
    }

    if (!dryRun) {
      const statements = sendRows.map(({ subId, recallId }) =>
        this.env.DB.prepare(
          `INSERT INTO alert_sends (subscription_id, recall_id, digest_run, resend_id, status, sent_at)
           VALUES (?, ?, ?, ?, 'sent', ?)
           ON CONFLICT (subscription_id, recall_id) DO NOTHING`,
        ).bind(subId, recallId, String(runId), subIdToResendId.get(subId) ?? null, now),
      );
      statements.push(
        this.env.DB.prepare(
          `UPDATE alert_subscriptions SET last_sent_at = ? WHERE id IN (${[...bySub.keys()].map(() => "?").join(",")})`,
        ).bind(now, ...bySub.keys()),
      );
      await this.env.DB.batch(statements);
    }

    return { emailsSent: dryRun ? 0 : emails.length, recallsMatched: sendRows.length };
  }
}
