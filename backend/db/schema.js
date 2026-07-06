const pool = require('../config/database');

// Initialize database schema
const initializeDatabase = async () => {
  try {
    // Create users table with roles (RBAC)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'enumerator',
        status VARCHAR(50) DEFAULT 'active',
        passport_photo TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create census_records table with GPS and submission data
    await pool.query(`
      CREATE TABLE IF NOT EXISTS census_records (
        id SERIAL PRIMARY KEY,
        enumerator_id INT REFERENCES users(id) ON DELETE SET NULL,
        household_id VARCHAR(255) UNIQUE NOT NULL,
        first_name VARCHAR(255) NOT NULL,
        last_name VARCHAR(255) NOT NULL,
        age INT,
        gender VARCHAR(50),
        phone VARCHAR(20),
        gps_latitude DECIMAL(10, 8),
        gps_longitude DECIMAL(11, 8),
        location_address VARCHAR(500),
        custom_fields TEXT,
        submission_type VARCHAR(50) DEFAULT 'online',
        submission_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        sync_status VARCHAR(50) DEFAULT 'synced',
        is_duplicate BOOLEAN DEFAULT FALSE,
        anomaly_flags TEXT,
        verification_status VARCHAR(50) DEFAULT 'pending',
        verification_results TEXT,
        verified_at TIMESTAMP,
        verified_by_agent BOOLEAN DEFAULT FALSE,
        geo_verification_status VARCHAR(50),
        geo_verification_results TEXT,
        geo_confidence_score INT,
        geo_verified_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Add geo-verification columns for existing databases created before this feature
    await pool.query(`
      ALTER TABLE census_records
      ADD COLUMN IF NOT EXISTS geo_verification_status VARCHAR(50),
      ADD COLUMN IF NOT EXISTS geo_verification_results TEXT,
      ADD COLUMN IF NOT EXISTS geo_confidence_score INT,
      ADD COLUMN IF NOT EXISTS geo_verified_at TIMESTAMP
    `);

    // Create index on GPS coordinates for spatial queries
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_census_gps 
      ON census_records(gps_latitude, gps_longitude)
    `);

    // Create index on household_id for fast lookups
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_census_household_id 
      ON census_records(household_id)
    `);

    // Create audit_log table for tracking changes
    await pool.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(id) ON DELETE SET NULL,
        action VARCHAR(100) NOT NULL,
        entity_type VARCHAR(100),
        entity_id INT,
        changes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create notifications table for supervisor alerts
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        supervisor_id INT REFERENCES users(id) ON DELETE CASCADE,
        record_id VARCHAR(255),
        type VARCHAR(100) NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT,
        priority VARCHAR(50) DEFAULT 'LOW',
        status VARCHAR(50) DEFAULT 'unread',
        metadata TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create index on notifications for quick lookups
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_notifications_supervisor_status
      ON notifications(supervisor_id, status)
    `);

    // Create survey assignment table for admin workflows
    await pool.query(`
      CREATE TABLE IF NOT EXISTS survey_assignments (
        id SERIAL PRIMARY KEY,
        enumerator_id INT REFERENCES users(id) ON DELETE CASCADE,
        survey_name VARCHAR(255) NOT NULL,
        assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('Database tables initialized successfully');
  } catch (err) {
    console.error('Database initialization error:', err);
    throw err;
  }
};

module.exports = { initializeDatabase };
