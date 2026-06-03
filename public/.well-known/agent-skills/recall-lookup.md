# Skill: Recall Lookup

## Description

Look up vehicle safety recalls by make, model, and year. Returns recall details including severity level, affected component, summary, consequence, and remedy information.

## Usage

### Search Vehicles

```
GET /api/search?q={query}
```

Returns typeahead results for makes, models, and vehicle years.

### Browse Recalls by Vehicle

```
GET /{make-slug}/{model-slug}/{year}
```

Example: `GET /toyota/camry/2020`

Returns HTML page with all recalls for the specified vehicle. For programmatic access, use the same endpoints with `Accept: application/json`.

## Response Format

Recall objects include:

- `nhtsa_campaign_number`: The NHTSA campaign identifier
- `component`: Affected vehicle component
- `severity_level`: CRITICAL, HIGH, MEDIUM, LOW, or UNKNOWN
- `summary_raw` / `summary_enriched`: Raw or LLM-enriched recall summary
- `consequence_raw` / `consequence_enriched`: Safety consequences
- `remedy_raw` / `remedy_enriched`: Repair remedy information
- `report_received_date`: When NHTSA received the report
