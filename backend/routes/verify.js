const express = require('express');
const pool = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const { verifySingleRecord, verifyBatch } = require('../lib/censusVerify');
const { notifySupervisor, notifyBatchCompletion, getNotificationsForUser, markNotificationRead } = require('../lib/notificationService');
const { pingGeoIntegrityAgent } = require('../lib/geoIntegrityClient');

const router = express.Router();

// Helper: Check if user is admin or supervisor
function isSupervisorOrAdmin(req) {
  return req.user && (req.user.role === 'admin' || req.user.role === 'supervisor');
}

/**
 * GET /api/verify/report
 * Get verification summary report
 * Only accessible to admin and supervisor
 */
router.get('/report', verifyToken, async (req, res) => {
  try {
    if (!isSupervisorOrAdmin(req)) {
      return res.status(403).json({ error: 'Access denied. Supervisor or admin role required.' });
    }

    const timeframe = req.query.timeframe || '7days'; // 7days, 30days, all

    let dateFilter = '';
    if (timeframe === '7days') {
      dateFilter = "AND verified_at >= NOW() - INTERVAL '7 days'";
    } else if (timeframe === '30days') {
      dateFilter = "AND verified_at >= NOW() - INTERVAL '30 days'";
    }

    // Verification summary
    const summaryResult = await pool.query(`
      SELECT
        verification_status,
        COUNT(*) as count,
        AVG(CAST((verification_results::json->>'confidence_score')::numeric AS numeric)) as avg_confidence
      FROM census_records
      WHERE verification_status IS NOT NULL ${dateFilter}
      GROUP BY verification_status
    `);

    // Issues breakdown
    const issuesResult = await pool.query(`
      SELECT
        COUNT(*) as total_records_verified,
        COUNT(CASE WHEN verification_status = 'PASS' THEN 1 END) as passed,
        COUNT(CASE WHEN verification_status = 'FAIL' THEN 1 END) as failed,
        COUNT(CASE WHEN verification_status = 'WARN' THEN 1 END) as warned,
        COUNT(CASE WHEN verified_by_agent = true THEN 1 END) as ai_verified
      FROM census_records
      WHERE verification_status IS NOT NULL ${dateFilter}
    `);

    res.json({
      timeframe,
      summary: summaryResult.rows,
      stats: issuesResult.rows[0],
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Verification report error:', err);
    res.status(500).json({ error: 'Failed to generate verification report' });
  }
});

/**
 * GET /api/verify/batch
 * Get unverified records for batch processing by AI agent
 * Query params: limit, offset
 */
router.get('/batch', verifyToken, async (req, res) => {
  try {
    if (!isSupervisorOrAdmin(req)) {
      return res.status(403).json({ error: 'Access denied. Supervisor or admin role required.' });
    }

    const limit = Math.min(parseInt(req.query.limit || '50'), 500);
    const offset = parseInt(req.query.offset || '0');

    const result = await pool.query(`
      SELECT
        id,
        household_id,
        first_name,
        last_name,
        age,
        gender,
        phone,
        gps_latitude,
        gps_longitude,
        location_address,
        custom_fields,
        submission_type,
        submission_timestamp,
        enumerator_id
      FROM census_records
      WHERE verification_status = 'pending' OR verification_status IS NULL
      ORDER BY submission_timestamp DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);

    res.json({
      records: result.rows,
      count: result.rows.length,
      limit,
      offset,
    });
  } catch (err) {
    console.error('Batch fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch batch records' });
  }
});

/**
 * POST /api/verify/batch
 * Run verification on a batch of records using the AI verification engine
 * Body: { records: CensusRecord[] }
 */
router.post('/batch', verifyToken, async (req, res) => {
  try {
    if (!isSupervisorOrAdmin(req)) {
      return res.status(403).json({ error: 'Access denied. Supervisor or admin role required.' });
    }

    const { records } = req.body;

    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ error: 'Request body must include a non-empty "records" array.' });
    }

    if (records.length > 500) {
      return res.status(400).json({ error: 'Batch size exceeds maximum of 500 records. Split into smaller batches.' });
    }

    // Run batch verification
    const report = verifyBatch(records);

    // Store verification results in database
    for (const result of report.results) {
      try {
        await pool.query(`
          UPDATE census_records
          SET
            verification_status = $1,
            verification_results = $2,
            verified_at = NOW(),
            verified_by_agent = true,
            updated_at = NOW()
          WHERE id = $3 OR household_id = $4
        `, [
          result.verification_status,
          JSON.stringify(result),
          result.record_id,
          result.household_id,
        ]);
      } catch (err) {
        console.error(`Failed to store verification for record ${result.record_id}:`, err);
      }
    }

    res.json(report);
  } catch (err) {
    console.error('Batch verification error:', err);
    res.status(500).json({ error: 'Failed to process batch verification' });
  }
});

/**
 * GET /api/verify/record/:id
 * Get verification results for a single record
 */
router.get('/record/:id', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        household_id,
        first_name,
        last_name,
        verification_status,
        verification_results,
        verified_at,
        verified_by_agent
      FROM census_records
      WHERE id = $1
    `, [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Record not found' });
    }

    const record = result.rows[0];
    res.json({
      ...record,
      verification_results: record.verification_results ? JSON.parse(record.verification_results) : null,
    });
  } catch (err) {
    console.error('Record verification fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch record verification' });
  }
});

/**
 * POST /api/verify/record/:id
 * Submit verification result for a single record from AI agent
 * Body: { verification_status, confidence_score, issues, requires_manual_review, review_priority }
 */
router.post('/record/:id', verifyToken, async (req, res) => {
  try {
    if (!isSupervisorOrAdmin(req)) {
      return res.status(403).json({ error: 'Access denied. Supervisor or admin role required.' });
    }

    const { verification_status, confidence_score, issues, requires_manual_review, review_priority, recommendations } = req.body;

    const result = await pool.query(`
      UPDATE census_records
      SET
        verification_status = $1,
        verification_results = $2,
        verified_at = NOW(),
        verified_by_agent = true,
        updated_at = NOW()
      WHERE id = $3
      RETURNING *
    `, [
      verification_status,
      JSON.stringify({
        confidence_score,
        issues,
        requires_manual_review,
        review_priority,
        recommendations,
        verified_at: new Date().toISOString(),
      }),
      req.params.id,
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Record not found' });
    }

    res.json({
      message: 'Record verification updated',
      record: result.rows[0],
    });
  } catch (err) {
    console.error('Record verification error:', err);
    res.status(500).json({ error: 'Failed to update record verification' });
  }
});

/**
 * GET /api/verify/flagged
 * Get records flagged for manual review
 */
router.get('/flagged', verifyToken, async (req, res) => {
  try {
    if (!isSupervisorOrAdmin(req)) {
      return res.status(403).json({ error: 'Access denied. Supervisor or admin role required.' });
    }

    const priority = req.query.priority || 'HIGH'; // HIGH, MEDIUM, LOW
    const limit = Math.min(parseInt(req.query.limit || '25'), 100);

    const result = await pool.query(`
      SELECT
        id,
        household_id,
        first_name,
        last_name,
        verification_status,
        verification_results,
        verified_at,
        submission_timestamp
      FROM census_records
      WHERE
        verified_by_agent = true
        AND verification_results::json->>'requires_manual_review' = 'true'
        AND verification_results::json->>'review_priority' = $1
      ORDER BY verified_at DESC
      LIMIT $2
    `, [priority, limit]);

    res.json({
      priority,
      count: result.rows.length,
      records: result.rows.map((r) => ({
        ...r,
        verification_results: JSON.parse(r.verification_results),
      })),
    });
  } catch (err) {
    console.error('Flagged records fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch flagged records' });
  }
});

/**
 * POST /api/verify/manual-review/:id
 * Supervisor mark record as reviewed and approved/rejected
 * Body: { status: 'approved' | 'rejected', notes }
 */
router.post('/manual-review/:id', verifyToken, async (req, res) => {
  try {
    if (!isSupervisorOrAdmin(req)) {
      return res.status(403).json({ error: 'Access denied. Supervisor or admin role required.' });
    }

    const { status, notes } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Status must be approved or rejected' });
    }

    const result = await pool.query(`
      UPDATE census_records
      SET
        verification_status = $1,
        verification_results = jsonb_set(verification_results, '{manual_review}', $2),
        updated_at = NOW()
      WHERE id = $3
      RETURNING *
    `, [
      status === 'approved' ? 'APPROVED' : 'REJECTED',
      JSON.stringify({
        reviewed_by: req.user.userId,
        reviewed_at: new Date().toISOString(),
        notes: notes || '',
      }),
      req.params.id,
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Record not found' });
    }

    res.json({
      message: `Record ${status}`,
      record: result.rows[0],
    });
  } catch (err) {
    console.error('Manual review error:', err);
    res.status(500).json({ error: 'Failed to save manual review' });
  }
});

/**
 * GET /api/verify/notifications
 * Get unread verification notifications for current supervisor
 */
router.get('/notifications', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'supervisor') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const notifications = await getNotificationsForUser(req.user.userId);
    res.json({
      count: notifications.length,
      notifications,
    });
  } catch (err) {
    console.error('Fetch notifications error:', err);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

/**
 * POST /api/verify/notifications/:id/read
 * Mark notification as read
 */
router.post('/notifications/:id/read', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'supervisor') {
      return res.status(403).json({ error: 'Access denied' });
    }

    await markNotificationRead(req.params.id);
    res.json({ message: 'Notification marked as read' });
  } catch (err) {
    console.error('Mark read error:', err);
    res.status(500).json({ error: 'Failed to update notification' });
  }
});

/**
 * GET /api/verify/geo-report
 * Geospatiotemporal integrity report (Census Integrity Agent — Google ADK).
 * Shows how many records passed/warned/failed the satellite/geofence/clustering
 * checks, plus whether the AI agent process is currently reachable.
 */
router.get('/geo-report', verifyToken, async (req, res) => {
  try {
    if (!isSupervisorOrAdmin(req)) {
      return res.status(403).json({ error: 'Access denied. Supervisor or admin role required.' });
    }

    const timeframe = req.query.timeframe || '7days';
    let dateFilter = '';
    if (timeframe === '7days') {
      dateFilter = "AND geo_verified_at >= NOW() - INTERVAL '7 days'";
    } else if (timeframe === '30days') {
      dateFilter = "AND geo_verified_at >= NOW() - INTERVAL '30 days'";
    }

    const summary = await pool.query(`
      SELECT geo_verification_status, COUNT(*) as count, AVG(geo_confidence_score) as avg_confidence
      FROM census_records
      WHERE geo_verification_status IS NOT NULL ${dateFilter}
      GROUP BY geo_verification_status
    `);

    const flaggedRecords = await pool.query(`
      SELECT id, household_id, first_name, last_name, location_address,
             gps_latitude, gps_longitude, geo_verification_status,
             geo_confidence_score, geo_verification_results, geo_verified_at
      FROM census_records
      WHERE geo_verification_status = 'FAIL' ${dateFilter}
      ORDER BY geo_verified_at DESC
      LIMIT 50
    `);

    const agentStatus = await pingGeoIntegrityAgent();

    res.json({
      timeframe,
      agent_status: agentStatus,
      summary: summary.rows,
      flagged_records: flaggedRecords.rows,
    });
  } catch (err) {
    console.error('Geo report error:', err);
    res.status(500).json({ error: 'Failed to generate geo-integrity report' });
  }
});

module.exports = router;
