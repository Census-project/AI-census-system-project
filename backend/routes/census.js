const express = require('express');
const pool = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const { censusRecordSchema, batchSubmissionSchema } = require('../schema/validation');
const { verifySingleRecord, verifyBatch } = require('../lib/censusVerify');
const { notifySupervisor, notifyBatchCompletion } = require('../lib/notificationService');

const router = express.Router();

function resolveStateFromAddress(address) {
  if (!address) return 'Unknown';
  const parts = address.split(',').map((part) => part.trim()).filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : address;
}

// Submit a single census record with auto-verification
router.post('/submit', verifyToken, async (req, res) => {
  try {
    // Validate input
    const { error, value } = censusRecordSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const {
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
    } = value;

    // Insert census record
    const result = await pool.query(
      `INSERT INTO census_records 
       (enumerator_id, household_id, first_name, last_name, age, gender, phone, 
        gps_latitude, gps_longitude, location_address, custom_fields, submission_type, verification_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        req.user.userId,
        household_id,
        first_name,
        last_name,
        age,
        gender,
        phone,
        gps_latitude,
        gps_longitude,
        location_address,
        JSON.stringify(custom_fields || {}),
        submission_type,
        'pending',
      ]
    );

    const record = result.rows[0];
    const recordData = {
      id: record.id,
      record_id: record.id,
      household_id: record.household_id,
      first_name: record.first_name,
      last_name: record.last_name,
      age: record.age,
      gender: record.gender,
      phone: record.phone,
      gps_latitude: record.gps_latitude,
      gps_longitude: record.gps_longitude,
      location_address: record.location_address,
      custom_fields: record.custom_fields,
      submission_type: record.submission_type,
      timestamp: record.submission_timestamp,
    };

    // Auto-verify the record
    const verificationResult = verifySingleRecord(recordData, []);

    // Update verification results in database
    await pool.query(`
      UPDATE census_records
      SET
        verification_status = $1,
        verification_results = $2,
        verified_at = NOW(),
        verified_by_agent = true,
        updated_at = NOW()
      WHERE id = $3
    `, [
      verificationResult.verification_status,
      JSON.stringify(verificationResult),
      record.id,
    ]);

    // Notify supervisors if record requires review
    if (verificationResult.requires_manual_review) {
      const supervisors = await pool.query('SELECT id FROM users WHERE role IN ($1, $2)', ['admin', 'supervisor']);
      for (const supervisor of supervisors.rows) {
        await notifySupervisor(verificationResult, supervisor.id);
      }
    }

    res.status(201).json({
      message: 'Census record submitted and verified successfully',
      record: {
        ...record,
        verification_status: verificationResult.verification_status,
        verification_results: verificationResult,
      },
    });
  } catch (err) {
    console.error('Submission error:', err);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Household ID already exists' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Batch submission for offline sync with verification
router.post('/batch', verifyToken, async (req, res) => {
  const client = await pool.connect();

  try {
    // Validate input
    const { error, value } = batchSubmissionSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { records } = value;

    // Start transaction
    await client.query('BEGIN');

    const submittedRecords = [];
    const allRecordsForVerification = [];

    // Insert each record
    for (const record of records) {
      const {
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
      } = record;

      try {
        const result = await client.query(
          `INSERT INTO census_records 
           (enumerator_id, household_id, first_name, last_name, age, gender, phone, 
            gps_latitude, gps_longitude, location_address, custom_fields, submission_type, verification_status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
           RETURNING *`,
          [
            req.user.userId,
            household_id,
            first_name,
            last_name,
            age,
            gender,
            phone,
            gps_latitude,
            gps_longitude,
            location_address,
            JSON.stringify(custom_fields || {}),
            submission_type,
            'pending',
          ]
        );

        const insertedRecord = result.rows[0];
        allRecordsForVerification.push(insertedRecord);
        submittedRecords.push({
          id: insertedRecord.id,
          household_id: insertedRecord.household_id,
          sync_status: 'inserted',
        });
      } catch (recordErr) {
        if (recordErr.code === '23505') {
          submittedRecords.push({
            household_id: record.household_id,
            error: 'Duplicate household ID',
          });
        } else {
          throw recordErr;
        }
      }
    }

    // Run batch verification on all submitted records
    const verificationData = allRecordsForVerification.map((r) => ({
      id: r.id,
      record_id: r.id,
      household_id: r.household_id,
      first_name: r.first_name,
      last_name: r.last_name,
      age: r.age,
      gender: r.gender,
      phone: r.phone,
      gps_latitude: r.gps_latitude,
      gps_longitude: r.gps_longitude,
      location_address: r.location_address,
      custom_fields: r.custom_fields,
      submission_type: r.submission_type,
      timestamp: r.submission_timestamp,
    }));

    const batchReport = verifyBatch(verificationData);

    // Update verification results for each record
    for (const result of batchReport.results) {
      await client.query(`
        UPDATE census_records
        SET
          verification_status = $1,
          verification_results = $2,
          verified_at = NOW(),
          verified_by_agent = true,
          updated_at = NOW()
        WHERE id = $3
      `, [
        result.verification_status,
        JSON.stringify(result),
        result.record_id,
      ]);
    }

    // Commit transaction
    await client.query('COMMIT');

    // Notify supervisors of batch completion
    if (batchReport.high_priority_count > 0) {
      await notifyBatchCompletion(batchReport);
    }

    res.status(201).json({
      message: `Batch submission and verification completed. ${submittedRecords.length} records processed.`,
      verification_summary: {
        total: batchReport.total_records,
        passed: batchReport.pass,
        warned: batchReport.warn,
        failed: batchReport.fail,
        pass_rate: `${batchReport.pass_rate_pct}%`,
        high_priority: batchReport.high_priority_count,
      },
      results: submittedRecords,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Batch submission error:', err);
    res.status(500).json({ error: 'Batch submission failed' });
  } finally {
    client.release();
  }
});

// Retrieve census records (with pagination and filtering)
router.get('/records', verifyToken, async (req, res) => {
  try {
    const { page = 1, limit = 50, household_id, status, enumerator_id } = req.query;
    const offset = (page - 1) * limit;

    let query = 'SELECT * FROM census_records WHERE 1=1';
    const params = [];

    if (req.user.role === 'enumerator') {
      query += ` AND enumerator_id = $${params.length + 1}`;
      params.push(req.user.userId);
    } else if (enumerator_id) {
      query += ` AND enumerator_id = $${params.length + 1}`;
      params.push(Number(enumerator_id));
    }

    if (household_id) {
      query += ` AND household_id ILIKE $${params.length + 1}`;
      params.push(`%${household_id}%`);
    }

    if (status) {
      query += ` AND sync_status = $${params.length + 1}`;
      params.push(status);
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    let countQuery = 'SELECT COUNT(*) FROM census_records WHERE 1=1';
    const countParams = [];

    if (req.user.role === 'enumerator') {
      countQuery += ` AND enumerator_id = $${countParams.length + 1}`;
      countParams.push(req.user.userId);
    } else if (enumerator_id) {
      countQuery += ` AND enumerator_id = $${countParams.length + 1}`;
      countParams.push(Number(enumerator_id));
    }

    if (household_id) {
      countQuery += ` AND household_id ILIKE $${countParams.length + 1}`;
      countParams.push(`%${household_id}%`);
    }

    if (status) {
      countQuery += ` AND sync_status = $${countParams.length + 1}`;
      countParams.push(status);
    }

    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    res.json({
      data: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('Retrieve records error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/activity', verifyToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 50;
    const result = await pool.query(
      'SELECT * FROM census_records ORDER BY created_at DESC LIMIT $1',
      [limit]
    );

    const records = result.rows;
    const onlineRecords = records.filter((record) => record.submission_type === 'online').length;
    const offlineRecords = records.length - onlineRecords;
    const coverageZones = new Set(records.map((record) => resolveStateFromAddress(record.location_address))).size;

    res.json({
      data: records,
      summary: {
        totalRecords: records.length,
        onlineRecords,
        offlineRecords,
        coverageZones,
        lastUpdated: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('Activity feed error:', err);
    res.status(500).json({ error: 'Failed to retrieve activity feed' });
  }
});

router.get('/summary', verifyToken, async (req, res) => {
  try {
    const [totalResult, onlineResult, offlineResult, syncedResult] = await Promise.all([
      pool.query('SELECT COUNT(*) AS total_records FROM census_records'),
      pool.query("SELECT COUNT(*) AS online_records FROM census_records WHERE submission_type = 'online'"),
      pool.query("SELECT COUNT(*) AS offline_records FROM census_records WHERE submission_type != 'online'"),
      pool.query('SELECT MAX(created_at) AS last_updated FROM census_records'),
    ]);

    res.json({
      summary: {
        totalRecords: Number(totalResult.rows[0].total_records || 0),
        onlineRecords: Number(onlineResult.rows[0].online_records || 0),
        offlineRecords: Number(offlineResult.rows[0].offline_records || 0),
        lastUpdated: syncedResult.rows[0].last_updated,
      },
    });
  } catch (err) {
    console.error('Summary error:', err);
    res.status(500).json({ error: 'Failed to retrieve summary' });
  }
});

module.exports = router;
