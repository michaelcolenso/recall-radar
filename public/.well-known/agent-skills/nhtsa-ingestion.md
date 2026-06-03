# Skill: NHTSA Data Ingestion

## Description

Ingest and synchronize vehicle recall data from the U.S. National Highway Traffic Safety Administration (NHTSA) API.

## Usage

```
POST /api/admin/ingest
Authorization: Bearer {ADMIN_TOKEN}
Content-Type: application/json
```

### Request Body

```json
{
  "mode": "full" | "makes-only" | "single-make" | "delta" | "backfill",
  "targetMake": "HONDA",
  "yearStart": 2000,
  "yearEnd": 2025,
  "deltaThresholdHours": 144
}
```

### Modes

- `full`: Ingest all makes and all years
- `makes-only`: Update make list only
- `single-make`: Ingest one specific make (requires `targetMake`)
- `delta`: Ingest only recalls not checked within `deltaThresholdHours`
- `backfill`: Historical backfill for missing data

### Response

```json
{
  "workflowId": "...",
  "status": "started"
}
```

## Checking Status

```
GET /api/admin/ingest/{workflowId}
Authorization: Bearer {ADMIN_TOKEN}
```
