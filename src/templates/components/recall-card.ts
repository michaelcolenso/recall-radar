import { escapeHtml } from "../../lib/utils";
import { severityBadge } from "./severity-badge";

interface RecallView {
  campaignNumber: string;
  component: string;
  summary: string;
  consequence: string;
  remedy: string;
  severity: "high" | "medium" | "low";
}

export const recallCard = (recall: RecallView): string => `
<article class="card">
  <p>${severityBadge(recall.severity)} Campaign ${escapeHtml(recall.campaignNumber)}</p>
  <p><strong>Component:</strong> ${escapeHtml(recall.component)}</p>
  <p>${escapeHtml(recall.summary)}</p>
  <p><strong>Risk:</strong> ${escapeHtml(recall.consequence)}</p>
  <p><strong>Fix:</strong> ${escapeHtml(recall.remedy)}</p>
</article>`;
