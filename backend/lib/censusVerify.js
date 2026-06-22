// ============================================================
// AI CENSUS SYSTEM — Verification Engine (JavaScript)
// Adapted for Node.js/Express backend
// ============================================================

const NIGERIA_BOUNDS = { latMin: 4.0, latMax: 14.0, lonMin: 3.0, lonMax: 15.0 };
const VALID_GENDERS = ["M", "F", "Other", "Prefer not to say"];
const HH_ID_REGEX = /^HH-\d{4}-\d{3,}$/;
const PHONE_REGEX = /^(\+234[789]\d{9}|0[789]\d{9}|0[1-9]\d{7,8})$/;
const NAME_REGEX = /^[a-zA-Z\s\-'.]+$/;
const SUSPICIOUS_CHARS = /[<>{}()|;$\]]/;

const NIGERIAN_KEYWORDS = [
  "Lagos", "Abuja", "Kano", "Ibadan", "Port Harcourt", "Benin City",
  "Maiduguri", "Zaria", "Aba", "Jos", "Ilorin", "Oyo", "Enugu",
  "Abeokuta", "Onitsha", "Warri", "Sokoto", "Kaduna", "Calabar", "Uyo",
  "FCT", "Borno", "Katsina", "Anambra", "Rivers", "Delta", "Osun", "Ondo",
  "Ekiti", "Kwara", "Niger", "Benue", "Nasarawa", "Plateau", "Taraba",
  "Adamawa", "Bauchi", "Gombe", "Yobe", "Jigawa", "Kebbi", "Zamfara",
  "Imo", "Abia", "Ebonyi", "Cross River", "Akwa Ibom", "Bayelsa", "Edo",
  "Ogun", "Surulere", "Ikeja", "Lekki", "Ajah", "Mushin", "Agege",
  "Alimosho", "Oshodi", "Kosofe", "Ikorodu", "Eko", "Maitama",
  "Garki", "Wuse", "Gwarinpa", "Kuje", "Gwagwalada", "Lugbe",
  "Apapa", "Yaba", "Isale-Eko", "Badagry", "Epe", "Ibeju-Lekki",
];

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function isNigerianAddress(address) {
  if (!address) return false;
  const upper = address.toUpperCase();
  return NIGERIAN_KEYWORDS.some((kw) => upper.includes(kw.toUpperCase()));
}

function decimalPlaces(val) {
  const str = String(val);
  return str.includes(".") ? str.split(".")[1].length : 0;
}

function parseCustomFields(raw) {
  if (!raw) return null;
  if (typeof raw === "object") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function estimateNigerianGPS(address) {
  // Simplified geocoding fallback for common Nigerian locations
  const locationMap = {
    "ikeja": { lat: 6.6018, lon: 3.3515 },
    "lagos": { lat: 6.5244, lon: 3.3842 },
    "abuja": { lat: 9.0765, lon: 7.3986 },
    "kano": { lat: 12.0022, lon: 8.5919 },
    "ibadan": { lat: 7.3878, lon: 3.8955 },
    "port harcourt": { lat: 4.7711, lon: 7.0124 },
    "benin": { lat: 6.4969, lon: 5.6289 },
    "jos": { lat: 9.8965, lon: 8.8583 },
  };

  const lower = address.toLowerCase();
  for (const [city, coords] of Object.entries(locationMap)) {
    if (lower.includes(city)) return coords;
  }
  return null;
}

// ─────────────────────────────────────────────
// CORE VERIFICATION FUNCTION
// ─────────────────────────────────────────────

function verifySingleRecord(record, allRecords = []) {
  const issues = [];
  let score = 100;

  const flag = (field, severity, message, suggested_fix, penalty) => {
    issues.push({ field, severity, message, suggested_fix });
    score -= penalty;
  };

  // ── 1. HOUSEHOLD ID ──────────────────────────
  if (!record.household_id) {
    flag("household_id", "CRITICAL", "Missing household ID", "Generate using format HH-YYYY-###", 20);
  } else if (!HH_ID_REGEX.test(record.household_id)) {
    flag("household_id", "CRITICAL", `Invalid format: "${record.household_id}"`, "Use format HH-2026-001", 15);
  } else {
    const dupes = allRecords.filter(
      (r) => r.household_id === record.household_id && r.record_id !== record.record_id && r.id !== record.id
    );
    if (dupes.length > 0) {
      flag("household_id", "CRITICAL", `Duplicate household ID found in ${dupes.length} other record(s)`, "Assign a unique HH ID for this submission", 25);
    }
  }

  // ── 2. NAMES ──────────────────────────────────
  if (!record.first_name || !record.first_name.toString().trim()) {
    flag("first_name", "CRITICAL", "First name is missing", "Enter the respondent's first name", 15);
  } else if (!NAME_REGEX.test(record.first_name)) {
    flag("first_name", "WARNING", `First name contains invalid characters: "${record.first_name}"`, "Use only letters, spaces, hyphens, or apostrophes", 5);
  }

  if (!record.last_name || !record.last_name.toString().trim()) {
    flag("last_name", "CRITICAL", "Last name is missing", "Enter the respondent's last name", 15);
  } else if (!NAME_REGEX.test(record.last_name)) {
    flag("last_name", "WARNING", `Last name contains invalid characters: "${record.last_name}"`, "Use only letters, spaces, hyphens, or apostrophes", 5);
  }

  // ── 3. AGE ────────────────────────────────────
  if (record.age === null || record.age === undefined || record.age === "") {
    flag("age", "CRITICAL", "Age is missing", "Enter age in years (0–150)", 15);
  } else {
    const age = Number(record.age);
    if (isNaN(age) || age < 0 || age > 150) {
      flag("age", "CRITICAL", `Age ${record.age} is out of valid range (0–150)`, "Verify age with ID document and correct", 20);
    } else if (age > 110) {
      flag("age", "WARNING", `Age ${age} is unusually high — verify with supporting document`, "Attach ID or birth certificate for confirmation", 5);
    }
  }

  // ── 4. GENDER ─────────────────────────────────
  if (!record.gender) {
    flag("gender", "WARNING", "Gender is missing", "Select one of: M, F, Other, Prefer not to say", 8);
  } else if (!VALID_GENDERS.includes(record.gender)) {
    flag("gender", "WARNING", `Gender value "${record.gender}" is not a recognized code`, `Must be one of: ${VALID_GENDERS.join(", ")}`, 8);
  }

  // ── 5. PHONE ──────────────────────────────────
  if (!record.phone) {
    flag("phone", "WARNING", "Phone number is missing", "Enter a valid Nigerian number (+234 or 0 prefix)", 8);
  } else {
    const cleaned = record.phone.toString().replace(/[\s-]/g, "");
    if (!PHONE_REGEX.test(cleaned)) {
      flag("phone", "WARNING", `Phone "${record.phone}" does not match Nigerian format`, "Expected: +2348012345678 or 08012345678", 8);
    }
  }

  // ── 6. LOCATION ADDRESS ───────────────────────
  if (!record.location_address) {
    flag("location_address", "CRITICAL", "Location address is missing", "Enter street address with LGA and State name", 15);
  } else if (!isNigerianAddress(record.location_address)) {
    flag("location_address", "WARNING", `Address "${record.location_address}" does not reference a known Nigerian State or LGA`, "Include a valid Nigerian State or LGA name in the address", 5);
  }

  // ── 7. GPS COORDINATES ────────────────────────
  const hasLat = record.gps_latitude !== null && record.gps_latitude !== undefined && record.gps_latitude !== "";
  const hasLon = record.gps_longitude !== null && record.gps_longitude !== undefined && record.gps_longitude !== "";

  if (hasLat && hasLon) {
    const lat = Number(record.gps_latitude);
    const lon = Number(record.gps_longitude);

    if (isNaN(lat) || isNaN(lon)) {
      flag("gps_coordinates", "CRITICAL", "GPS coordinates are not valid numbers", "Re-capture GPS on the device", 15);
    } else {
      if (lat < NIGERIA_BOUNDS.latMin || lat > NIGERIA_BOUNDS.latMax || lon < NIGERIA_BOUNDS.lonMin || lon > NIGERIA_BOUNDS.lonMax) {
        flag("gps_coordinates", "CRITICAL", `GPS (${lat}, ${lon}) is outside Nigeria's geographic boundaries`, "Re-capture GPS at the actual enumeration location", 20);
      }
      if (decimalPlaces(record.gps_latitude) < 4 || decimalPlaces(record.gps_longitude) < 4) {
        flag("gps_coordinates", "WARNING", "GPS coordinates lack sufficient precision (< 4 decimal places)", "Use device GPS with at least 4 decimal places", 3);
      }

      // Check address/GPS mismatch
      if (record.location_address) {
        const estimatedGPS = estimateNigerianGPS(record.location_address);
        if (estimatedGPS) {
          const distance = haversineKm(lat, lon, estimatedGPS.lat, estimatedGPS.lon);
          if (distance > 5) {
            flag("gps_coordinates", "WARNING", `GPS is ${Math.round(distance)}km from stated address location`, "Verify GPS coordinates match the address", 8);
          }
        }
      }
    }
  } else if ((hasLat && !hasLon) || (!hasLat && hasLon)) {
    flag("gps_coordinates", "WARNING", "GPS coordinates are incomplete (missing lat or lon)", "Capture both latitude and longitude or leave both empty", 5);
  }

  // ── 8. TIMESTAMP ─────────────────────────────
  if (record.timestamp) {
    const submissionTime = new Date(record.timestamp);
    const now = new Date();
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    if (submissionTime > now) {
      flag("timestamp", "CRITICAL", "Submission timestamp is in the future", "Verify device time is correct", 15);
    } else if (submissionTime < ninetyDaysAgo) {
      flag("timestamp", "WARNING", "Submission timestamp is older than 90 days", "Resubmit with current date or provide justification", 5);
    }
  }

  // ── 9. CUSTOM FIELDS ─────────────────────────
  const customFields = parseCustomFields(record.custom_fields);
  if (customFields && typeof customFields === "object") {
    for (const [key, value] of Object.entries(customFields)) {
      if (SUSPICIOUS_CHARS.test(key) || SUSPICIOUS_CHARS.test(String(value))) {
        flag("custom_fields", "WARNING", `Custom field "${key}" contains suspicious characters`, "Remove special characters or use safe values", 5);
      }
    }
  }

  // ── 10. SUBMISSION TYPE ──────────────────────
  if (!record.submission_type) {
    flag("submission_type", "INFO", "Submission type not specified", "Specify 'online' or 'offline'", 0);
  } else if (!["online", "offline"].includes(record.submission_type)) {
    flag("submission_type", "WARNING", `Invalid submission type: "${record.submission_type}"`, "Use 'online' or 'offline'", 3);
  }

  // ── Calculate Review Priority ────────────────
  const criticalCount = issues.filter((i) => i.severity === "CRITICAL").length;
  const warningCount = issues.filter((i) => i.severity === "WARNING").length;

  let reviewPriority = "LOW";
  if (criticalCount > 0) reviewPriority = "HIGH";
  else if (warningCount >= 3) reviewPriority = "MEDIUM";
  else if (warningCount > 0) reviewPriority = "LOW";

  // ── Build Recommendations ────────────────────
  const recommendations = [];
  if (criticalCount > 0) {
    recommendations.push("Address all CRITICAL issues before final approval");
  }
  if (record.submission_type === "offline") {
    recommendations.push("Offline submission — verify sync timestamp when device reconnects");
  }
  if (issues.some((i) => i.field === "gps_coordinates")) {
    recommendations.push("Re-collect GPS coordinates at enumeration point using GPS app");
  }

  score = Math.max(0, score);
  const status = criticalCount > 0 ? "FAIL" : warningCount > 0 ? "WARN" : "PASS";
  const requiresReview = status !== "PASS" || record.submission_type === "offline";

  return {
    record_id: record.record_id || record.id || "UNKNOWN",
    household_id: record.household_id || "N/A",
    respondent: `${record.first_name || "Unknown"} ${record.last_name || ""}`.trim(),
    verification_status: status,
    confidence_score: score,
    issues,
    issue_summary: {
      critical: criticalCount,
      warning: warningCount,
      info: issues.filter((i) => i.severity === "INFO").length,
    },
    recommendations,
    requires_manual_review: requiresReview,
    review_priority: reviewPriority,
    verified_at: new Date().toISOString(),
    submission_type: record.submission_type || "unknown",
  };
}

function verifyBatch(records) {
  const results = records.map((record) => verifySingleRecord(record, records));

  const pass = results.filter((r) => r.verification_status === "PASS").length;
  const warn = results.filter((r) => r.verification_status === "WARN").length;
  const fail = results.filter((r) => r.verification_status === "FAIL").length;
  const totalScore = results.reduce((sum, r) => sum + r.confidence_score, 0);

  // Most common issues
  const issueMap = {};
  results.forEach((result) => {
    result.issues.forEach((issue) => {
      const key = `${issue.field}`;
      issueMap[key] = (issueMap[key] || 0) + 1;
    });
  });

  const mostCommonIssues = Object.entries(issueMap)
    .map(([field, count]) => ({ field, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    generated_at: new Date().toISOString(),
    total_records: records.length,
    pass,
    warn,
    fail,
    pass_rate_pct: records.length > 0 ? Math.round((pass / records.length) * 100) : 0,
    average_confidence_score: records.length > 0 ? Math.round(totalScore / records.length) : 0,
    records_requiring_review: results.filter((r) => r.requires_manual_review).length,
    high_priority_count: results.filter((r) => r.review_priority === "HIGH").length,
    most_common_issues: mostCommonIssues,
    results,
  };
}

module.exports = { verifySingleRecord, verifyBatch };
