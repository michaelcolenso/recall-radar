# Skill: Recall Enrichment

## Description

Enrich raw NHTSA recall descriptions using LLM to generate plain-English summaries, consequences, and remedies that are easier for vehicle owners to understand.

## Usage

```
POST /api/admin/enrich
Authorization: Bearer {ADMIN_TOKEN}
Content-Type: application/json
```

### Request Body

```json
{
  "batchSize": 50,
  "concurrency": 3,
  "targetMake": "HONDA"
}
```

### Parameters

- `batchSize`: Number of recalls to process per batch (default: 50)
- `concurrency`: Parallel enrichment workers (default: 3)
- `targetMake`: Optional — limit to a specific make

### Response

```json
{
  "workflowId": "...",
  "status": "started"
}
```

## Checking Status

```
GET /api/admin/enrich/{workflowId}
Authorization: Bearer {ADMIN_TOKEN}
```

## Retry Failed Enrichment

```
POST /api/admin/enrich/retry/{recallId}
Authorization: Bearer {ADMIN_TOKEN}
```
