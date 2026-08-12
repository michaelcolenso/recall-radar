import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpAgent } from "agents/mcp";
import { z } from "zod";

type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

type VehicleSearchRow = {
  make: string;
  make_slug: string;
  model: string;
  model_slug: string;
  year: number;
  recall_count: number;
  risk_score: number | null;
  risk_grade: string | null;
};

type RecallRow = {
  campaign_number: string;
  report_received_date: string | null;
  component: string;
  manufacturer: string | null;
  severity: string;
  summary: string;
  consequence: string;
  remedy: string;
};

function jsonResult(value: unknown): ToolResult {
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] };
}

function errorResult(message: string): ToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

/** Public, read-only MCP server for the Recalled Rides recall database. */
export class RecallMcp extends McpAgent<Env> {
  server = new McpServer({ name: "recalled-rides", version: "1.0.0" });

  async init(): Promise<void> {
    this.server.registerTool(
      "search_vehicles",
      {
        title: "Search vehicles",
        description: "Search recalled vehicle make/model/year combinations in the Recalled Rides database.",
        inputSchema: {
          query: z.string().trim().min(2).max(100).describe("Vehicle text such as '2020 Honda Civic'"),
          limit: z.number().int().min(1).max(20).default(10),
        },
      },
      async ({ query, limit }) => {
        const pattern = `%${query.replace(/[%_]/g, "\\$&")}%`;
        const result = await this.env.DB.prepare(
          `SELECT mk.name AS make, mk.slug AS make_slug, m.name AS model, m.slug AS model_slug,
                  vy.year, COUNT(r.id) AS recall_count, vy.risk_score, vy.risk_grade
           FROM vehicle_years vy
           JOIN models m ON m.id = vy.model_id
           JOIN makes mk ON mk.id = m.make_id
           JOIN recalls r ON r.vehicle_year_id = vy.id
           WHERE (CAST(vy.year AS TEXT) || ' ' || mk.name || ' ' || m.name) LIKE ? ESCAPE '\\'
           GROUP BY vy.id
           ORDER BY vy.year DESC, mk.name, m.name
           LIMIT ?`,
        ).bind(pattern, limit).all<VehicleSearchRow>();

        return jsonResult({ query, count: result.results.length, vehicles: result.results });
      },
    );

    this.server.registerTool(
      "list_models",
      {
        title: "List models",
        description: "List recalled vehicle models and available model years for a manufacturer.",
        inputSchema: { make: z.string().trim().min(1).max(80).describe("Manufacturer name or URL slug") },
      },
      async ({ make }) => {
        const result = await this.env.DB.prepare(
          `SELECT mk.name AS make, mk.slug AS make_slug, m.name AS model, m.slug AS model_slug,
                  MIN(vy.year) AS first_year, MAX(vy.year) AS latest_year,
                  COUNT(DISTINCT vy.year) AS year_count, COUNT(r.id) AS recall_count
           FROM makes mk
           JOIN models m ON m.make_id = mk.id
           JOIN vehicle_years vy ON vy.model_id = m.id
           JOIN recalls r ON r.vehicle_year_id = vy.id
           WHERE lower(mk.name) = lower(?) OR lower(mk.slug) = lower(?)
           GROUP BY m.id
           ORDER BY m.name`,
        ).bind(make, make).all();

        if (result.results.length === 0) return errorResult(`No recalled models found for make: ${make}`);
        return jsonResult({ make, count: result.results.length, models: result.results });
      },
    );

    this.server.registerTool(
      "get_vehicle_recalls",
      {
        title: "Get vehicle recalls",
        description: "Get recall notices and plain-English safety guidance for an exact make, model, and model year.",
        inputSchema: {
          make: z.string().trim().min(1).max(80).describe("Manufacturer name or URL slug"),
          model: z.string().trim().min(1).max(100).describe("Model name or URL slug"),
          year: z.number().int().min(1900).max(2100),
        },
      },
      async ({ make, model, year }) => {
        const result = await this.env.DB.prepare(
          `SELECT r.nhtsa_campaign_number AS campaign_number,
                  r.report_received_date, r.component, r.manufacturer,
                  r.severity_level AS severity,
                  COALESCE(r.summary_enriched, r.summary_raw) AS summary,
                  COALESCE(r.consequence_enriched, r.consequence_raw) AS consequence,
                  COALESCE(r.remedy_enriched, r.remedy_raw) AS remedy
           FROM recalls r
           JOIN vehicle_years vy ON vy.id = r.vehicle_year_id
           JOIN models m ON m.id = vy.model_id
           JOIN makes mk ON mk.id = m.make_id
           WHERE (lower(mk.name) = lower(?) OR lower(mk.slug) = lower(?))
             AND (lower(m.name) = lower(?) OR lower(m.slug) = lower(?))
             AND vy.year = ?
           ORDER BY CASE r.severity_level
             WHEN 'CRITICAL' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3
             WHEN 'LOW' THEN 4 ELSE 5 END, r.report_received_date DESC`,
        ).bind(make, make, model, model, year).all<RecallRow>();

        if (result.results.length === 0) {
          return errorResult(`No recalls found for ${year} ${make} ${model}. Check the spelling or use search_vehicles first.`);
        }
        const siteUrl = this.env.SITE_URL || "https://recalledrides.com";
        return jsonResult({
          vehicle: { year, make, model },
          recall_count: result.results.length,
          recalls: result.results,
          source_url: `${siteUrl}/${encodeURIComponent(make.toLowerCase())}/${encodeURIComponent(model.toLowerCase())}/${year}`,
          disclaimer: "Recall applicability can depend on VIN. Confirm open recalls with NHTSA or a manufacturer dealer.",
        });
      },
    );

    this.server.registerTool(
      "get_recall_campaign",
      {
        title: "Get recall campaign",
        description: "Look up an NHTSA recall campaign and the vehicles in the Recalled Rides database that it affects.",
        inputSchema: {
          campaignNumber: z.string().trim().min(3).max(30).describe("NHTSA campaign number, for example 24V123000"),
        },
      },
      async ({ campaignNumber }) => {
        const campaign = campaignNumber.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
        const detail = await this.env.DB.prepare(
          `SELECT nhtsa_campaign_number AS campaign_number, report_received_date, component, manufacturer,
                  severity_level AS severity, COALESCE(summary_enriched, summary_raw) AS summary,
                  COALESCE(consequence_enriched, consequence_raw) AS consequence,
                  COALESCE(remedy_enriched, remedy_raw) AS remedy
           FROM recalls WHERE upper(replace(nhtsa_campaign_number, '-', '')) = ? LIMIT 1`,
        ).bind(campaign).first<RecallRow>();
        if (!detail) return errorResult(`Recall campaign not found: ${campaignNumber}`);

        const vehicles = await this.env.DB.prepare(
          `SELECT DISTINCT vy.year, mk.name AS make, m.name AS model
           FROM recalls r
           JOIN vehicle_years vy ON vy.id = r.vehicle_year_id
           JOIN models m ON m.id = vy.model_id
           JOIN makes mk ON mk.id = m.make_id
           WHERE upper(replace(r.nhtsa_campaign_number, '-', '')) = ?
           ORDER BY vy.year DESC, mk.name, m.name LIMIT 100`,
        ).bind(campaign).all();

        return jsonResult({ ...detail, affected_vehicles: vehicles.results, affected_vehicles_truncated: vehicles.results.length === 100 });
      },
    );
  }
}

