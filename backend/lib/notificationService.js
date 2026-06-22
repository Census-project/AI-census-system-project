// ============================================================
// Supervisor Notification Service
// Alerts supervisors of HIGH priority verification flags
// ============================================================

const pool = require('../config/database');

/**
 * Send notification to supervisor about flagged record
 * Can be extended for email/SMS integration
 */
async function notifySupervisor(verificationResult, supervisorId) {
  try {
    // Store notification in database
    await pool.query(`
      INSERT INTO notifications (
        supervisor_id,
        record_id,
        type,
        title,
        message,
        priority,
        status,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
    `, [
      supervisorId,
      verificationResult.record_id,
      'VERIFICATION_FLAG',
      `Record ${verificationResult.record_id} Requires Review`,
      `${verificationResult.respondent} - ${verificationResult.issue_summary.critical} critical issues found`,
      verificationResult.review_priority,
      'unread',
    ]);

    // TODO: Integrate with email/SMS service
    // if (verificationResult.review_priority === 'HIGH') {
    //   await sendEmail(supervisor.email, {
    //     subject: `🚨 HIGH Priority Census Record: ${verificationResult.respondent}`,
    //     template: 'verification-alert',
    //     data: verificationResult,
    //   });
    // }

    console.log(`[Notification] Supervisor ${supervisorId} alerted about record ${verificationResult.record_id}`);
    return true;
  } catch (err) {
    console.error('Failed to notify supervisor:', err);
    return false;
  }
}

/**
 * Notify all supervisors of batch completion
 */
async function notifyBatchCompletion(report) {
  try {
    // Get all supervisors
    const supervisors = await pool.query(`
      SELECT id, email FROM users WHERE role = 'supervisor'
    `);

    for (const supervisor of supervisors.rows) {
      await pool.query(`
        INSERT INTO notifications (
          supervisor_id,
          type,
          title,
          message,
          priority,
          status,
          metadata,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      `, [
        supervisor.id,
        'BATCH_VERIFICATION_COMPLETE',
        'Batch Verification Complete',
        `${report.total_records} records verified. Pass rate: ${report.pass_rate_pct}%. High priority flagged: ${report.high_priority_count}`,
        report.high_priority_count > 0 ? 'MEDIUM' : 'LOW',
        'unread',
        JSON.stringify({
          total_records: report.total_records,
          pass_rate_pct: report.pass_rate_pct,
          high_priority_count: report.high_priority_count,
          summary: report.most_common_issues.slice(0, 3),
        }),
      ]);
    }

    return true;
  } catch (err) {
    console.error('Failed to notify batch completion:', err);
    return false;
  }
}

/**
 * Get unread notifications for user
 */
async function getNotificationsForUser(userId) {
  try {
    const result = await pool.query(`
      SELECT
        id,
        type,
        title,
        message,
        priority,
        metadata,
        created_at
      FROM notifications
      WHERE supervisor_id = $1 AND status = 'unread'
      ORDER BY created_at DESC
      LIMIT 20
    `, [userId]);

    return result.rows;
  } catch (err) {
    console.error('Failed to fetch notifications:', err);
    return [];
  }
}

/**
 * Mark notification as read
 */
async function markNotificationRead(notificationId) {
  try {
    await pool.query(`
      UPDATE notifications
      SET status = 'read', updated_at = NOW()
      WHERE id = $1
    `, [notificationId]);

    return true;
  } catch (err) {
    console.error('Failed to mark notification read:', err);
    return false;
  }
}

module.exports = {
  notifySupervisor,
  notifyBatchCompletion,
  getNotificationsForUser,
  markNotificationRead,
};
