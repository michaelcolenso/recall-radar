import { SeverityLevel } from "@prisma/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { SeverityBadge } from "./severity-badge";

interface RecallCardProps {
  nhtsaCampaignNumber: string;
  component: string;
  reportReceivedDate: Date | null;
  severityLevel: SeverityLevel;
  summaryEnriched: string | null;
  consequenceEnriched: string | null;
  remedyEnriched: string | null;
  summaryRaw: string;
  consequenceRaw: string;
  remedyRaw: string;
}

export function RecallCard({
  nhtsaCampaignNumber,
  component,
  reportReceivedDate,
  severityLevel,
  summaryEnriched,
  consequenceEnriched,
  remedyEnriched,
  summaryRaw,
  consequenceRaw,
  remedyRaw,
}: RecallCardProps) {
  const isEnriched = !!(summaryEnriched && consequenceEnriched && remedyEnriched);

  const summary = summaryEnriched ?? summaryRaw;
  const consequence = consequenceEnriched ?? consequenceRaw;
  const remedy = remedyEnriched ?? remedyRaw;

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start gap-3">
          <SeverityBadge severity={severityLevel} />
          {!isEnriched && (
            <span className="text-xs text-gray-400 italic">
              Original NHTSA language
            </span>
          )}
        </div>
        <div className="mt-2 space-y-1">
          <p className="text-sm font-medium text-gray-700">{component}</p>
          <p className="text-xs text-gray-400">
            Campaign #{nhtsaCampaignNumber}
            {reportReceivedDate && (
              <>
                {" "}
                &middot; Reported{" "}
                {new Date(reportReceivedDate).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </>
            )}
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">
            What&apos;s the issue?
          </p>
          <p className="text-sm text-gray-800">{summary}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">
            What could happen?
          </p>
          <p className="text-sm text-gray-800">{consequence}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">
            What&apos;s the fix?
          </p>
          <p className="text-sm text-gray-800">{remedy}</p>
        </div>
      </CardContent>
    </Card>
  );
}
