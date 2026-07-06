"""
Census Integrity Agent — built with Google's Agent Development Kit (ADK).

Purpose: geospatiotemporally-aware verification of census records, using
satellite/aerial-imagery-derived building footprint data (OpenStreetMap),
state-boundary geofencing, and temporal-spatial fraud-pattern detection —
then a Gemini-powered reasoning pass that synthesizes those raw signals
into a human-readable integrity assessment with a confidence score.

Design mirrors the existing Claude AI integration in this repo
(backend/routes/ai.js): if no GEMINI_API_KEY is configured, every tool
still runs and a rule-based combiner produces the verdict. When a key IS
configured, Gemini (via ADK) additionally reasons over the same signals
for a richer natural-language explanation and can catch patterns the
fixed rules miss.
"""

import asyncio
import os
from typing import Optional

from tools.geo_tools import (
    check_state_boundary_consistency,
    check_building_density_via_osm,
    check_temporal_spatial_clustering,
)

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "").strip()
MODEL_NAME = os.environ.get("ADK_MODEL", "gemini-2.5-flash")

_adk_agent = None
_adk_runner = None
_ADK_APP_NAME = "census_integrity_agent"


def _build_adk_agent():
    """Lazily builds the Google ADK Agent + Runner. Only called if a Gemini key is present."""
    global _adk_agent, _adk_runner
    if _adk_agent is not None:
        return _adk_agent, _adk_runner

    from google.adk.agents import Agent
    from google.adk.runners import InMemoryRunner

    agent = Agent(
        name=_ADK_APP_NAME,
        model=MODEL_NAME,
        description=(
            "Geospatiotemporally-aware census data integrity agent. Verifies household "
            "census submissions against geographic boundaries, satellite-derived building "
            "footprint density, and temporal-spatial submission patterns to flag likely "
            "fraudulent, mis-tagged, or low-confidence records for human supervisor review."
        ),
        instruction=(
            "You are a census data integrity auditor for a Nigerian national census system. "
            "You are given the raw outputs of three verification tools already run against a "
            "single household census record: a state-boundary geofence check, a satellite/aerial "
            "building-footprint density check (via OpenStreetMap), and a temporal-spatial "
            "clustering check for duplicate/fabricated submissions. "
            "Your job is to synthesize these signals into ONE overall verdict. "
            "Always respond in this exact format:\n"
            "VERDICT: <PASS|WARN|FAIL>\n"
            "CONFIDENCE: <0-100>\n"
            "SUMMARY: <one or two sentence plain-English explanation for a supervisor>\n"
            "RECOMMENDATION: <what the supervisor should do next>\n"
            "Be conservative: only FAIL when there is a CRITICAL severity signal or multiple "
            "WARNING signals reinforcing each other. A single WARNING alone should usually be WARN, not FAIL."
        ),
        tools=[check_state_boundary_consistency, check_building_density_via_osm, check_temporal_spatial_clustering],
    )
    runner = InMemoryRunner(agent=agent, app_name=_ADK_APP_NAME)
    _adk_agent, _adk_runner = agent, runner
    return agent, runner


def _rule_based_verdict(geo_result: dict, density_result: dict, cluster_result: dict) -> dict:
    """Fallback synthesis used when no Gemini API key is configured, or the ADK call fails."""
    signals = [geo_result, density_result, cluster_result]
    severities = [s.get("severity") for s in signals]

    if "CRITICAL" in severities:
        verdict, confidence = "FAIL", 35
    elif severities.count("WARNING") >= 2:
        verdict, confidence = "FAIL", 55
    elif "WARNING" in severities:
        verdict, confidence = "WARN", 70
    else:
        verdict, confidence = "PASS", 92

    notes = [s.get("note") or s.get("distance_note") for s in signals if (s.get("note") or s.get("distance_note"))]
    summary = " ".join(notes) if notes else "All geospatiotemporal checks passed with no anomalies detected."

    if verdict == "FAIL":
        recommendation = "Escalate to supervisor for manual field re-verification before final acceptance."
    elif verdict == "WARN":
        recommendation = "Flag for supervisor spot-check on next review cycle; not urgent."
    else:
        recommendation = "No action needed."

    return {
        "verdict": verdict,
        "confidence": confidence,
        "summary": summary,
        "recommendation": recommendation,
        "reasoning_engine": "rule-based-fallback",
    }


def _parse_adk_text_response(text: str) -> dict:
    result = {"verdict": "WARN", "confidence": 50, "summary": text.strip(), "recommendation": "Manual review advised."}
    for line in text.splitlines():
        line = line.strip()
        if line.upper().startswith("VERDICT:"):
            result["verdict"] = line.split(":", 1)[1].strip().upper()
        elif line.upper().startswith("CONFIDENCE:"):
            try:
                result["confidence"] = int("".join(ch for ch in line.split(":", 1)[1] if ch.isdigit()) or "50")
            except ValueError:
                pass
        elif line.upper().startswith("SUMMARY:"):
            result["summary"] = line.split(":", 1)[1].strip()
        elif line.upper().startswith("RECOMMENDATION:"):
            result["recommendation"] = line.split(":", 1)[1].strip()
    result["reasoning_engine"] = f"google-adk:{MODEL_NAME}"
    return result


async def _run_adk_reasoning(geo_result: dict, density_result: dict, cluster_result: dict) -> Optional[dict]:
    try:
        from google.genai import types

        agent, runner = _build_adk_agent()
        session = await runner.session_service.create_session(app_name=_ADK_APP_NAME, user_id="census-backend")

        prompt = (
            f"State boundary check: {geo_result}\n"
            f"Satellite/building-footprint density check: {density_result}\n"
            f"Temporal-spatial clustering check: {cluster_result}\n"
            "Synthesize these into a verdict following your instructions."
        )
        message = types.Content(role="user", parts=[types.Part(text=prompt)])

        final_text = ""
        async for event in runner.run_async(user_id="census-backend", session_id=session.id, new_message=message):
            if event.content and event.content.parts:
                for part in event.content.parts:
                    if getattr(part, "text", None):
                        final_text += part.text

        if not final_text.strip():
            return None
        return _parse_adk_text_response(final_text)
    except Exception as exc:  # noqa: BLE001 — any ADK/Gemini failure degrades to rule-based
        print(f"[census-integrity-agent] ADK reasoning failed, falling back to rules: {exc}")
        return None


async def run_integrity_check(record: dict) -> dict:
    """
    Main entry point. Runs all geospatiotemporal verification tools against a
    census record, then synthesizes a verdict (via Gemini/ADK if configured,
    else rule-based).

    Expected `record` keys: claimed_state (str), gps_latitude (float),
    gps_longitude (float), household_count (int, optional), submitted_at (ISO str),
    recent_records (list[dict], optional) — other nearby-in-time records for
    clustering comparison.
    """
    claimed_state = record.get("claimed_state") or record.get("location_address") or ""
    lat = record.get("gps_latitude")
    lon = record.get("gps_longitude")
    household_count = record.get("household_count") or 1
    submitted_at = record.get("submitted_at") or record.get("created_date") or ""
    recent_records = record.get("recent_records") or []

    geo_result = check_state_boundary_consistency(claimed_state, lat, lon)
    density_result = check_building_density_via_osm(lat, lon, household_count)
    cluster_result = check_temporal_spatial_clustering(lat, lon, submitted_at, recent_records)

    verdict = None
    if GEMINI_API_KEY:
        verdict = await _run_adk_reasoning(geo_result, density_result, cluster_result)
    if verdict is None:
        verdict = _rule_based_verdict(geo_result, density_result, cluster_result)

    return {
        "checks": {
            "state_boundary": geo_result,
            "satellite_building_density": density_result,
            "temporal_spatial_clustering": cluster_result,
        },
        **verdict,
    }


def run_integrity_check_sync(record: dict) -> dict:
    """Sync wrapper for callers that aren't already in an event loop."""
    return asyncio.run(run_integrity_check(record))
