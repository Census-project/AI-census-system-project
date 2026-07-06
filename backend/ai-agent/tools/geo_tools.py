"""
Geospatiotemporal verification tools for the Census Integrity Agent.

These are plain Python functions (no LLM calls) — they get wrapped as
Google ADK tools in agent.py. Keeping them as standalone functions means
they can also be unit-tested or called directly by the rule-based
fallback path when no Gemini API key is configured.
"""

import json
import math
import os
import time
from datetime import datetime, timezone
from typing import Optional

import requests

_DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
_BOUNDS_PATH = os.path.join(_DATA_DIR, "nigeria_state_bounds.json")

with open(_BOUNDS_PATH, "r") as f:
    _RAW_BOUNDS = json.load(f)
_STATE_BOUNDS = {k: v for k, v in _RAW_BOUNDS.items() if not k.startswith("_")}

OVERPASS_URL = "https://overpass-api.de/api/interpreter"

# Simple in-process cache to avoid hammering Overpass for repeated/nearby queries
_osm_cache: dict[str, tuple[float, dict]] = {}
_OSM_CACHE_TTL_SECONDS = 3600


def _normalize_state_name(name: str) -> Optional[str]:
    if not name:
        return None
    name = name.strip()
    for key in _STATE_BOUNDS.keys():
        if key.lower() == name.lower():
            return key
    # loose contains match, e.g. "Lagos State" -> "Lagos"
    for key in _STATE_BOUNDS.keys():
        if key.lower() in name.lower():
            return key
    return None


def check_state_boundary_consistency(claimed_state: str, gps_latitude: float, gps_longitude: float) -> dict:
    """
    Checks whether GPS coordinates fall within the approximate bounding box
    of the state the enumerator/respondent claimed for the household.

    Args:
        claimed_state: The state name recorded on the census form.
        gps_latitude: Latitude captured at submission.
        gps_longitude: Longitude captured at submission.

    Returns:
        dict with keys: consistent (bool), matched_state (str|None),
        claimed_state_normalized (str|None), distance_note (str), severity (str)
    """
    if gps_latitude is None or gps_longitude is None:
        return {
            "consistent": None,
            "matched_state": None,
            "claimed_state_normalized": _normalize_state_name(claimed_state),
            "distance_note": "No GPS coordinates provided — cannot verify geographic consistency.",
            "severity": "INFO",
        }

    normalized = _normalize_state_name(claimed_state)
    if not normalized:
        return {
            "consistent": None,
            "matched_state": None,
            "claimed_state_normalized": None,
            "distance_note": f"Unrecognized state name: '{claimed_state}'.",
            "severity": "WARNING",
        }

    # Find which state(s) the coordinates actually fall inside
    matches = []
    for state, (min_lat, max_lat, min_lon, max_lon) in _STATE_BOUNDS.items():
        if min_lat <= gps_latitude <= max_lat and min_lon <= gps_longitude <= max_lon:
            matches.append(state)

    if normalized in matches:
        return {
            "consistent": True,
            "matched_state": normalized,
            "claimed_state_normalized": normalized,
            "distance_note": "GPS coordinates fall within the claimed state's boundary.",
            "severity": "PASS",
        }

    if matches:
        return {
            "consistent": False,
            "matched_state": matches[0],
            "claimed_state_normalized": normalized,
            "distance_note": (
                f"GPS coordinates fall within {', '.join(matches)}, "
                f"but the record claims '{normalized}'. Possible mis-tagging or fraudulent entry."
            ),
            "severity": "CRITICAL",
        }

    return {
        "consistent": False,
        "matched_state": None,
        "claimed_state_normalized": normalized,
        "distance_note": (
            "GPS coordinates do not fall within any recognized Nigerian state boundary "
            "(may be outside Nigeria, or GPS capture failed)."
        ),
        "severity": "CRITICAL",
    }


def check_building_density_via_osm(gps_latitude: float, gps_longitude: float, claimed_household_count: int = 1,
                                    radius_meters: int = 150) -> dict:
    """
    Cross-references a household's reported location against real building
    footprint data from OpenStreetMap (a satellite/aerial-imagery-derived
    dataset) to sanity-check that structures actually exist nearby, and that
    the claimed household count is plausible for the building density observed.

    This acts as the "satellite-based verification" signal: OSM building
    footprints are digitized from satellite/aerial imagery, so an area with
    zero mapped buildings but a submitted household record is a red flag
    worth a supervisor's attention (could be unmapped rural housing OR a
    fabricated GPS/record).

    Args:
        gps_latitude: Latitude of the household.
        gps_longitude: Longitude of the household.
        claimed_household_count: Number of households/persons claimed at this location.
        radius_meters: Search radius around the point.

    Returns:
        dict with keys: building_count (int|None), density_flag (str),
        severity (str), note (str), source (str)
    """
    if gps_latitude is None or gps_longitude is None:
        return {
            "building_count": None,
            "density_flag": "NO_GPS",
            "severity": "INFO",
            "note": "No GPS coordinates provided — skipping satellite/building-footprint check.",
            "source": "openstreetmap-overpass",
        }

    cache_key = f"{round(gps_latitude, 4)}:{round(gps_longitude, 4)}:{radius_meters}"
    cached = _osm_cache.get(cache_key)
    if cached and (time.time() - cached[0]) < _OSM_CACHE_TTL_SECONDS:
        result = dict(cached[1])
    else:
        query = f"""
        [out:json][timeout:15];
        (
          way["building"](around:{radius_meters},{gps_latitude},{gps_longitude});
          relation["building"](around:{radius_meters},{gps_latitude},{gps_longitude});
        );
        out count;
        """
        last_err = None
        result = None
        for attempt in range(2):
            try:
                resp = requests.post(
                    OVERPASS_URL,
                    data={"data": query},
                    timeout=25,
                    headers={"User-Agent": "census-integrity-agent/1.0 (contact: census-project)"},
                )
                resp.raise_for_status()
                data = resp.json()
                count = 0
                for el in data.get("elements", []):
                    if el.get("type") == "count":
                        count = int(el.get("tags", {}).get("total", 0))
                        break
                result = {"building_count": count, "source": "openstreetmap-overpass", "_error": None}
                break
            except Exception as exc:  # noqa: BLE001 — external API, want to degrade gracefully
                last_err = exc
                continue
        if result is None:
            result = {"building_count": None, "source": "openstreetmap-overpass", "_error": str(last_err)}
        _osm_cache[cache_key] = (time.time(), result)

    building_count = result.get("building_count")
    err = result.get("_error")

    if err or building_count is None:
        return {
            "building_count": None,
            "density_flag": "LOOKUP_FAILED",
            "severity": "INFO",
            "note": f"Could not reach building-footprint data source ({err}). Verify manually.",
            "source": "openstreetmap-overpass",
        }

    if building_count == 0:
        return {
            "building_count": 0,
            "density_flag": "NO_STRUCTURES_DETECTED",
            "severity": "WARNING",
            "note": (
                f"No mapped building structures found within {radius_meters}m of the submitted GPS point. "
                "This may just mean the area isn't mapped in OpenStreetMap yet (common in rural Nigeria), "
                "but combined with other red flags it warrants a manual look."
            ),
            "source": "openstreetmap-overpass",
        }

    # Rough plausibility heuristic: households per building shouldn't be wildly high
    if claimed_household_count and building_count:
        ratio = claimed_household_count / building_count
        if ratio > 8:
            return {
                "building_count": building_count,
                "density_flag": "HIGH_HOUSEHOLD_TO_BUILDING_RATIO",
                "severity": "WARNING",
                "note": (
                    f"{building_count} buildings detected nearby, but {claimed_household_count} households "
                    f"claimed at/near this point ({ratio:.1f} households/building) — unusually dense. Review."
                ),
                "source": "openstreetmap-overpass",
            }

    return {
        "building_count": building_count,
        "density_flag": "CONSISTENT",
        "severity": "PASS",
        "note": f"{building_count} mapped structures found nearby — consistent with a populated area.",
        "source": "openstreetmap-overpass",
    }


def check_temporal_spatial_clustering(gps_latitude: float, gps_longitude: float, submitted_at: str,
                                       recent_records: list) -> dict:
    """
    Flags potential fabricated/duplicated submissions by looking for other
    records submitted from (almost) the exact same GPS point within a short
    time window — a common signature of an enumerator inventing data from
    their desk instead of visiting households.

    Args:
        gps_latitude: Latitude of this record.
        gps_longitude: Longitude of this record.
        submitted_at: ISO timestamp of this submission.
        recent_records: List of dicts with keys gps_latitude, gps_longitude,
            created_date (ISO string) for other recent records to compare against.

    Returns:
        dict with keys: cluster_count (int), severity (str), note (str)
    """
    if gps_latitude is None or gps_longitude is None:
        return {"cluster_count": 0, "severity": "INFO", "note": "No GPS coordinates — skipping cluster check."}

    try:
        this_time = datetime.fromisoformat(submitted_at.replace("Z", "+00:00"))
    except Exception:  # noqa: BLE001
        this_time = datetime.now(timezone.utc)

    PROXIMITY_METERS = 30
    WINDOW_MINUTES = 15

    def haversine_m(lat1, lon1, lat2, lon2):
        R = 6371000
        phi1, phi2 = math.radians(lat1), math.radians(lat2)
        dphi = math.radians(lat2 - lat1)
        dlambda = math.radians(lon2 - lon1)
        a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
        return 2 * R * math.asin(math.sqrt(a))

    cluster = 0
    for rec in recent_records or []:
        lat2, lon2 = rec.get("gps_latitude"), rec.get("gps_longitude")
        created = rec.get("created_date")
        if lat2 is None or lon2 is None or not created:
            continue
        try:
            rec_time = datetime.fromisoformat(str(created).replace("Z", "+00:00"))
        except Exception:  # noqa: BLE001
            continue
        if abs((this_time - rec_time).total_seconds()) > WINDOW_MINUTES * 60:
            continue
        if haversine_m(gps_latitude, gps_longitude, lat2, lon2) <= PROXIMITY_METERS:
            cluster += 1

    if cluster >= 3:
        return {
            "cluster_count": cluster,
            "severity": "CRITICAL",
            "note": (
                f"{cluster} other records submitted within {PROXIMITY_METERS}m and {WINDOW_MINUTES} minutes of "
                "this one — strong signature of desk-fabricated data rather than real field visits."
            ),
        }
    if cluster >= 1:
        return {
            "cluster_count": cluster,
            "severity": "WARNING",
            "note": f"{cluster} nearby record(s) submitted in a similar time window — worth a quick look.",
        }
    return {"cluster_count": 0, "severity": "PASS", "note": "No suspicious temporal-spatial clustering detected."}
