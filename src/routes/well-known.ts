import { Hono } from "hono";

export const wellKnownRoutes = new Hono<{ Bindings: Env }>();

const API_VERSION = "1.0.0";

// OpenAPI specification stub for service-desc discovery
wellKnownRoutes.get("/openapi.json", (c) => {
  const siteUrl = c.env.SITE_URL || "https://recalledrides.com";
  return c.json(
    {
      openapi: "3.1.0",
      info: {
        title: "Recalled Rides API",
        version: API_VERSION,
        description: "Vehicle safety recall lookup and admin pipeline API",
      },
      servers: [{ url: `${siteUrl}/api` }],
      paths: {
        "/search": {
          get: {
            summary: "Vehicle search typeahead",
            parameters: [{ name: "q", in: "query", required: true, schema: { type: "string" } }],
            responses: {
              "200": {
                description: "Search results",
                content: { "application/json": { schema: { type: "object" } } },
              },
            },
          },
        },
        "/admin/ingest": {
          post: {
            summary: "Trigger ingestion workflow",
            security: [{ bearerAuth: [] }],
            requestBody: {
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      mode: { type: "string", enum: ["full", "makes-only", "single-make", "delta", "backfill"] },
                      targetMake: { type: "string" },
                      yearStart: { type: "integer" },
                      yearEnd: { type: "integer" },
                      deltaThresholdHours: { type: "integer" },
                    },
                  },
                },
              },
            },
            responses: {
              "200": { description: "Workflow started" },
              "401": { description: "Unauthorized" },
            },
          },
        },
        "/admin/enrich": {
          post: {
            summary: "Trigger enrichment workflow",
            security: [{ bearerAuth: [] }],
            requestBody: {
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      batchSize: { type: "integer" },
                      concurrency: { type: "integer" },
                      targetMake: { type: "string" },
                    },
                  },
                },
              },
            },
            responses: {
              "200": { description: "Workflow started" },
              "401": { description: "Unauthorized" },
            },
          },
        },
        "/admin/stats": {
          get: {
            summary: "Database statistics",
            security: [{ bearerAuth: [] }],
            responses: {
              "200": { description: "Stats JSON" },
              "401": { description: "Unauthorized" },
            },
          },
        },
      },
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
          },
        },
      },
    },
    200,
    { "content-type": "application/vnd.oai.openapi+json;version=3.1.0" },
  );
});

// RFC 9727 API Catalog
// GET /.well-known/api-catalog
wellKnownRoutes.get("/api-catalog", (c) => {
  const siteUrl = c.env.SITE_URL || "https://recalledrides.com";
  return c.json(
    {
      linkset: [
        {
          anchor: `${siteUrl}/api`,
          "service-desc": {
            href: `${siteUrl}/.well-known/openapi.json`,
            title: "Recalled Rides API OpenAPI Specification",
            type: "application/vnd.oai.openapi+json;version=3.1.0",
          },
          "service-doc": {
            href: `${siteUrl}/about`,
            title: "Recalled Rides API Documentation",
            type: "text/html",
          },
          status: {
            href: `${siteUrl}/api/admin/status`,
            title: "Pipeline Agent Status",
            type: "application/json",
          },
          auth: {
            href: `${siteUrl}/auth.md`,
            title: "Authentication Documentation",
            type: "text/markdown",
          },
        },
      ],
    },
    200,
    { "content-type": "application/linkset+json" },
  );
});

// OAuth 2.0 Authorization Server Metadata (RFC 8414)
// GET /.well-known/oauth-authorization-server
wellKnownRoutes.get("/oauth-authorization-server", (c) => {
  const siteUrl = c.env.SITE_URL || "https://recalledrides.com";
  return c.json(
    {
      issuer: siteUrl,
      authorization_endpoint: `${siteUrl}/api/auth/authorize`,
      token_endpoint: `${siteUrl}/api/auth/token`,
      jwks_uri: `${siteUrl}/.well-known/jwks.json`,
      grant_types_supported: ["client_credentials"],
      response_types_supported: ["token"],
      token_endpoint_auth_methods_supported: ["private_key_jwt", "client_secret_basic"],
      scopes_supported: ["admin:read", "admin:write", "recalls:read"],
      agent_auth: {
        skill: `${siteUrl}/.well-known/agent-skills/index.json`,
        register_uri: `${siteUrl}/api/auth/register`,
        identity_types_supported: ["anonymous"],
        anonymous: {
          credential_types_supported: ["bearer_token"],
          claim_uri: `${siteUrl}/auth.md#claims`,
        },
      },
    },
    200,
    { "content-type": "application/json" },
  );
});

// OAuth Protected Resource Metadata (RFC 9728)
// GET /.well-known/oauth-protected-resource
wellKnownRoutes.get("/oauth-protected-resource", (c) => {
  const siteUrl = c.env.SITE_URL || "https://recalledrides.com";
  return c.json(
    {
      resource: `${siteUrl}/api`,
      authorization_servers: [`${siteUrl}`],
      scopes_supported: ["admin:read", "admin:write", "recalls:read"],
      bearer_methods_supported: ["header"],
    },
    200,
    { "content-type": "application/json" },
  );
});

// MCP Server Card (SEP-1649)
// GET /.well-known/mcp/server-card.json
wellKnownRoutes.get("/mcp/server-card.json", (c) => {
  const siteUrl = c.env.SITE_URL || "https://recalledrides.com";
  return c.json(
    {
      schema: "https://schemas.modelcontextprotocol.io/server-card/2025-03-25",
      serverInfo: {
        name: "recalled-rides",
        version: API_VERSION,
        vendor: "Recalled Rides",
      },
      transports: [
        {
          type: "streamable-http",
          endpoint: `${siteUrl}/mcp`,
          supportedVersions: ["2025-03-26"],
        },
      ],
      capabilities: {
        tools: {
          listChanged: true,
        },
        resources: {
          listChanged: true,
        },
        prompts: {},
      },
    },
    200,
    { "content-type": "application/json" },
  );
});

// Agent Skills Discovery Index
// GET /.well-known/agent-skills/index.json
wellKnownRoutes.get("/agent-skills/index.json", (c) => {
  const siteUrl = c.env.SITE_URL || "https://recalledrides.com";
  return c.json(
    {
      $schema: "https://schemas.agentskills.io/discovery/0.2.0/schema.json",
      skills: [
        {
          name: "recall-lookup",
          type: "skill-md",
          description: "Look up vehicle safety recalls by make, model, and year. Returns recall details including severity, component, summary, consequence, and remedy.",
          url: `${siteUrl}/.well-known/agent-skills/recall-lookup.md`,
          digest:
            "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        },
        {
          name: "nhtsa-ingestion",
          type: "skill-md",
          description: "Ingest and synchronize vehicle recall data from the NHTSA API. Supports full, delta, and single-make ingestion modes.",
          url: `${siteUrl}/.well-known/agent-skills/nhtsa-ingestion.md`,
          digest:
            "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        },
        {
          name: "recall-enrichment",
          type: "skill-md",
          description: "Enrich raw NHTSA recall descriptions using LLM to generate plain-English summaries, consequences, and remedies.",
          url: `${siteUrl}/.well-known/agent-skills/recall-enrichment.md`,
          digest:
            "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        },
      ],
    },
    200,
    { "content-type": "application/json" },
  );
});

// GET /auth.md
wellKnownRoutes.get("/auth.md", (c) => {
  const siteUrl = c.env.SITE_URL || "https://recalledrides.com";
  const markdown = `# auth.md — Agent Authentication for Recalled Rides

## Overview

Recalled Rides provides read-only public APIs and authenticated admin APIs for managing recall data ingestion and enrichment.

## Public APIs (No Authentication Required)

- \`GET ${siteUrl}/api/search?q={query}\` — Vehicle search typeahead

## Admin APIs (Authentication Required)

Admin endpoints require a Bearer token:

\`\`\`
Authorization: Bearer {ADMIN_TOKEN}
\`\`\`

### Available Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | \`${siteUrl}/api/admin/ingest\` | Trigger NHTSA data ingestion |
| GET | \`${siteUrl}/api/admin/ingest/:id\` | Check ingestion status |
| POST | \`${siteUrl}/api/admin/enrich\` | Trigger LLM enrichment |
| GET | \`${siteUrl}/api/admin/enrich/:id\` | Check enrichment status |
| GET | \`${siteUrl}/api/admin/status\` | Pipeline agent status |
| GET | \`${siteUrl}/api/admin/stats\` | Database statistics |

## Registration

To obtain an admin token, contact the site operator or set \`ADMIN_TOKEN\` in the environment configuration.

## Claims {#claims}

Admin tokens carry the following implicit claims:

- \`scope\`: \`admin:read admin:write\`
- \`aud\`: \`${siteUrl}/api\`

## Revocation

Tokens are revoked by rotating the \`ADMIN_TOKEN\` environment variable and redeploying the worker.

## OAuth Metadata

- Authorization Server: \`${siteUrl}/.well-known/oauth-authorization-server\`
- Protected Resource: \`${siteUrl}/.well-known/oauth-protected-resource\`
`;

  return c.text(markdown, 200, {
    "content-type": "text/markdown; charset=utf-8",
  });
});
