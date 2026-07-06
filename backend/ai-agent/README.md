# Census Integrity Agent

An AI agent — built with **Google's Agent Development Kit (ADK)** — that adds
geospatiotemporal and satellite-derived verification on top of the existing
rule-based census verification system (`backend/lib/censusVerify.js`).

## What it checks

| Check | What it does | "Satellite" angle |
|---|---|---|
| **State boundary geofence** | Confirms the GPS coordinates captured at submission actually fall inside the state the household claims to be in (approximate bounding boxes for all 36 states + FCT). | Catches GPS spoofing / mis-tagging. |
| **Satellite building-footprint density** | Queries OpenStreetMap's building footprint layer (digitized from satellite/aerial imagery) for the number of real structures within ~150m of the submitted point, and flags implausible household-to-building ratios. | This is the "satellite-based verification" — an area with a submitted household record but **zero mapped structures nearby** is a red flag (may be an unmapped rural area, or a fabricated record). |
| **Temporal-spatial clustering** | Flags bursts of records submitted from (almost) the same GPS point within a short time window — the classic signature of an enumerator inventing data at their desk instead of visiting households. | Geospatiotemporal fraud detection. |

Each check runs independently and cheaply (no LLM call required). The results
are then synthesized into one verdict:

- **Without a `GEMINI_API_KEY`**: a deterministic rule-based combiner produces
  the verdict (same graceful-degradation pattern as the existing Claude AI
  integration in `backend/routes/ai.js`).
- **With a `GEMINI_API_KEY`**: the raw signals are handed to a Gemini-powered
  ADK agent, which reasons over them and produces a richer natural-language
  summary + recommendation — and can weigh conflicting/ambiguous signals more
  intelligently than a fixed rule set.

## Running it

```bash
cd backend/ai-agent
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env            # optionally add your GEMINI_API_KEY
uvicorn main:app --host 0.0.0.0 --port 8001
```

The Node.js backend calls this service automatically for every census
submission (see `backend/lib/geoIntegrityClient.js`). If this service isn't
running, the Node backend degrades gracefully — the existing rule-based
verification still runs, geo-verification fields are just left null.

## Testing the agent directly

```bash
curl http://localhost:8001/health

curl -X POST http://localhost:8001/verify/geospatial \
  -H "Content-Type: application/json" \
  -d '{
    "claimed_state": "Lagos",
    "gps_latitude": 6.5244,
    "gps_longitude": 3.3792,
    "household_count": 4,
    "submitted_at": "2026-07-06T10:00:00Z",
    "recent_records": []
  }'
```

## Files

```
ai-agent/
├── main.py                  FastAPI server exposing POST /verify/geospatial
├── agent.py                 Google ADK agent definition + rule-based fallback
├── requirements.txt
├── .env.example
├── tools/
│   └── geo_tools.py          The 3 verification tools (pure functions, unit-testable)
└── data/
    └── nigeria_state_bounds.json   Approximate state bounding boxes for the geofence check
```

## Extending with real satellite imagery

The building-density check currently uses OpenStreetMap's Overpass API (free,
no key needed, data digitized from satellite/aerial imagery). To upgrade to
direct satellite imagery analysis later:

- **Google Earth Engine** — population density / land-use rasters, requires a
  GCP project with Earth Engine access approved.
- **Sentinel Hub** — direct Sentinel-2 imagery, requires an account + OAuth client.
- **NASA SEDAC (GPWv4)** — free gridded population-density data, good for
  cross-checking claimed population totals at the LGA/ward level.

Any of these can be dropped in as a new tool in `tools/geo_tools.py` and added
to the `tools=[...]` list in `agent.py` — the ADK agent will automatically be
able to call it.

## Roadmap ideas

- Add a scheduled batch job (`node-cron`, already a dependency) that re-runs
  geo-verification nightly across all records for a district, producing a
  supervisor summary report.
- Surface `geo_verification_status` / `geo_confidence_score` on the
  Verification Dashboard in the frontend, next to the existing rule-based results.
- Add an LGA/ward-level polygon dataset (instead of coarse state bounding
  boxes) for finer-grained geofencing.
