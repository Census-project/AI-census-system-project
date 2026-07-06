/**
 * Client for the Census Integrity Agent — a Python microservice built with
 * Google's Agent Development Kit (ADK) that performs geospatiotemporal
 * verification: state-boundary geofencing, satellite/aerial-imagery-derived
 * building-footprint density checks (via OpenStreetMap), and temporal-spatial
 * fraud-pattern detection.
 *
 * The agent runs as a separate process (backend/ai-agent/, Python + FastAPI).
 * This client calls it over HTTP and degrades gracefully if the agent is
 * unreachable — geospatial verification is a valuable *addition* to the
 * existing rule-based census verification, not a hard dependency for it.
 */

const AI_AGENT_URL = process.env.AI_AGENT_URL || 'http://localhost:8001';
const REQUEST_TIMEOUT_MS = parseInt(process.env.AI_AGENT_TIMEOUT_MS || '15000', 10);

/**
 * Runs the geospatiotemporal integrity check for a census record.
 *
 * @param {Object} record - { claimed_state, gps_latitude, gps_longitude, household_count, submitted_at }
 * @param {Array} recentRecords - other nearby-in-time records for clustering comparison
 * @returns {Promise<Object|null>} verification result, or null if the agent is unreachable
 */
async function runGeoIntegrityCheck(record, recentRecords = []) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${AI_AGENT_URL}/verify/geospatial`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        claimed_state: record.claimed_state || record.location_address || null,
        location_address: record.location_address || null,
        gps_latitude: record.gps_latitude != null ? Number(record.gps_latitude) : null,
        gps_longitude: record.gps_longitude != null ? Number(record.gps_longitude) : null,
        household_count: record.household_count || 1,
        submitted_at: record.submitted_at || new Date().toISOString(),
        recent_records: recentRecords.map((r) => ({
          gps_latitude: r.gps_latitude != null ? Number(r.gps_latitude) : null,
          gps_longitude: r.gps_longitude != null ? Number(r.gps_longitude) : null,
          created_date: r.created_date || r.submission_timestamp || null,
        })),
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      console.error(`[geoIntegrityClient] Agent responded with ${response.status}`);
      return null;
    }

    return await response.json();
  } catch (err) {
    console.error(`[geoIntegrityClient] Could not reach Census Integrity Agent at ${AI_AGENT_URL}: ${err.message}`);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Health check — used at backend startup to log whether the agent is reachable.
 */
async function pingGeoIntegrityAgent() {
  try {
    const response = await fetch(`${AI_AGENT_URL}/health`, { method: 'GET' });
    if (!response.ok) return { reachable: false };
    const data = await response.json();
    return { reachable: true, ...data };
  } catch (err) {
    return { reachable: false, error: err.message };
  }
}

module.exports = { runGeoIntegrityCheck, pingGeoIntegrityAgent };
