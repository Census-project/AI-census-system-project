const express = require('express');
const pool = require('../config/database');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

router.get('/users', verifyToken, async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'supervisor') {
    return res.status(403).json({ error: 'Admin or supervisor access required' });
  }

  try {
    const result = await pool.query(
      `SELECT u.id, u.username, u.email, u.role, u.status, u.passport_photo, u.created_at,
              COALESCE(json_agg(json_build_object('id', sa.id, 'survey_name', sa.survey_name, 'assigned_at', sa.assigned_at))
                       FILTER (WHERE sa.id IS NOT NULL), '[]') AS assigned_surveys
       FROM users u
       LEFT JOIN survey_assignments sa ON sa.enumerator_id = u.id
       GROUP BY u.id
       ORDER BY u.created_at DESC`
    );

    // Convert binary passport photos to base64
    let users = result.rows.map(user => ({
      ...user,
      passport_photo: user.passport_photo ? user.passport_photo.toString('base64') : null
    }));

    if (req.user.role === 'supervisor') {
      users = users.filter((user) => user.role === 'enumerator');
    }

    res.json({ users });
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({ error: 'Failed to retrieve users' });
  }
});

router.post('/assign-survey', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { enumeratorId, surveyName } = req.body;
    if (!enumeratorId || !surveyName) {
      return res.status(400).json({ error: 'Enumerator ID and survey name are required' });
    }

    const userResult = await pool.query('SELECT id, role FROM users WHERE id = $1', [enumeratorId]);
    if (userResult.rows.length === 0 || userResult.rows[0].role !== 'enumerator') {
      return res.status(404).json({ error: 'Enumerator not found' });
    }

    const assignmentResult = await pool.query(
      'INSERT INTO survey_assignments (enumerator_id, survey_name) VALUES ($1, $2) RETURNING id, enumerator_id, survey_name, assigned_at',
      [enumeratorId, surveyName]
    );

    res.json({ message: 'Survey assigned successfully', assignment: assignmentResult.rows[0] });
  } catch (err) {
    console.error('Assign survey error:', err);
    res.status(500).json({ error: 'Failed to assign survey' });
  }
});

router.post('/upload-passport-photo', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { userId, photoData } = req.body;
    
    if (!userId || !photoData) {
      return res.status(400).json({ error: 'User ID and photo data are required' });
    }

    // Verify user exists
    const userResult = await pool.query('SELECT id FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update user's passport photo
    const updateResult = await pool.query(
      'UPDATE users SET passport_photo = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, passport_photo',
      [photoData, userId]
    );

    res.json({ 
      message: 'Passport photo uploaded successfully', 
      user: updateResult.rows[0] 
    });
  } catch (err) {
    console.error('Photo upload error:', err);
    res.status(500).json({ error: 'Failed to upload passport photo' });
  }
});

router.get('/stats', verifyToken, requireAdmin, async (req, res) => {
  try {
    const [
      totalUsersResult,
      totalRecordsResult,
      onlineRecordsResult,
      offlineRecordsResult,
      lastSyncResult,
    ] = await Promise.all([
      pool.query('SELECT COUNT(*) AS total_users FROM users'),
      pool.query('SELECT COUNT(*) AS total_records FROM census_records'),
      pool.query("SELECT COUNT(*) AS online_records FROM census_records WHERE submission_type = 'online'"),
      pool.query("SELECT COUNT(*) AS offline_records FROM census_records WHERE submission_type != 'online'"),
      pool.query('SELECT MAX(created_at) AS last_sync FROM census_records'),
    ]);

    res.json({
      totalUsers: Number(totalUsersResult.rows[0].total_users || 0),
      totalRecords: Number(totalRecordsResult.rows[0].total_records || 0),
      onlineRecords: Number(onlineRecordsResult.rows[0].online_records || 0),
      offlineRecords: Number(offlineRecordsResult.rows[0].offline_records || 0),
      lastSync: lastSyncResult.rows[0].last_sync,
    });
  } catch (err) {
    console.error('Get stats error:', err);
    res.status(500).json({ error: 'Failed to retrieve statistics' });
  }
});

router.get('/export', verifyToken, requireAdmin, async (req, res) => {
  try {
    const [usersResult, censusResult, assignmentsResult] = await Promise.all([
      pool.query('SELECT id, username, email, role, status, created_at FROM users ORDER BY created_at DESC'),
      pool.query('SELECT * FROM census_records ORDER BY created_at DESC'),
      pool.query('SELECT id, enumerator_id, survey_name, assigned_at FROM survey_assignments ORDER BY assigned_at DESC'),
    ]);

    const exportData = {
      users: usersResult.rows,
      censusRecords: censusResult.rows,
      surveyAssignments: assignmentsResult.rows,
      exportDate: new Date().toISOString(),
      totalRecords: censusResult.rows.length,
      totalUsers: usersResult.rows.length,
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="census_export.json"');
    res.json(exportData);
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

module.exports = router;
