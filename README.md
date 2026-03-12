# RecallRadar (Cloudflare Workers Edition)

Cloudflare-native RecallRadar app using Hono SSR, D1, Workflows, Agents, and KV.

## Commands
- `npm run dev` – local worker
- `npm run typecheck` – TypeScript checks
- `npm run db:generate` – generate SQL migrations from Drizzle schema
- `npm run db:migrate` – apply local D1 migrations

## Architecture
- Worker entrypoint and routes in `src/index.ts`
- D1 schema in `src/db/schema.ts`
- Durable workflows in `src/workflows`
- Agent Durable Object in `src/agents/pipeline-agent.ts`
- SEO and HTML templates in `src/templates`
