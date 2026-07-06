"""
FastAPI wrapper around the Census Integrity Agent (Google ADK).

Run with:
    uvicorn main:app --host 0.0.0.0 --port 8001

The Node.js backend calls POST /verify/geospatial for each census
submission (see backend/lib/geoIntegrityClient.js).
"""

import os
from typing import List, Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from agent import run_integrity_check

app = FastAPI(title="Census Integrity Agent", version="1.0.0")


class RecentRecord(BaseModel):
    gps_latitude: Optional[float] = None
    gps_longitude: Optional[float] = None
    created_date: Optional[str] = None


class VerifyRequest(BaseModel):
    claimed_state: Optional[str] = None
    location_address: Optional[str] = None
    gps_latitude: Optional[float] = None
    gps_longitude: Optional[float] = None
    household_count: Optional[int] = 1
    submitted_at: Optional[str] = None
    recent_records: Optional[List[RecentRecord]] = []


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "gemini_configured": bool(os.environ.get("GEMINI_API_KEY", "").strip()),
    }


@app.post("/verify/geospatial")
async def verify_geospatial(req: VerifyRequest):
    try:
        record = req.model_dump()
        record["recent_records"] = [r for r in (req.recent_records or [])]
        record["recent_records"] = [r if isinstance(r, dict) else r.model_dump() for r in record["recent_records"]]
        result = await run_integrity_check(record)
        return result
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc)) from exc


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("AI_AGENT_PORT", "8001")))
