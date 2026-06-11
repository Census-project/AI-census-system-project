const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'census_dev_secret_key';

// Middleware
app.use(cors());
app.use(express.json());

// Local JSON-backed storage for users and census records
const fs = require('fs');
const path = require('path');
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
const dbFile = path.join(dataDir, 'db.json');

let db = { users: [], censusRecords: [] };
let userIdCounter = 1;
let recordIdCounter = 1;

// load existing data if present
if (fs.existsSync(dbFile)) {
  try {
    db = JSON.parse(fs.readFileSync(dbFile, 'utf-8'));
    if (db.users.length > 0) {
      userIdCounter = Math.max(...db.users.map(u => u.id)) + 1;
    }
    if (db.censusRecords.length > 0) {
      recordIdCounter = Math.max(...db.censusRecords.map(r => r.id)) + 1;
    }
  } catch (err) {
    console.error('Error reading db file:', err);
  }
}

const users = new Map(db.users.map(u => [u.id, u]));
const censusRecords = db.censusRecords.slice();

function saveDb() {
  const toSave = {
    users: Array.from(users.values()),
    censusRecords,
  };
  fs.writeFileSync(dbFile, JSON.stringify(toSave, null, 2));
}

// Utility functions
const generateToken = (userId, role) => {
  return jwt.sign(
    { userId, role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
};

const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'Census API running (local mode)', timestamp: new Date().toISOString() });
});

// ==================== AUTHENTICATION ROUTES ====================

// Register user
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password, role = 'enumerator' } = req.body;

    // Validation
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }

    if (!['admin', 'supervisor', 'enumerator'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be admin, supervisor, or enumerator' });
    }

    // Check if user exists
    for (let user of users.values()) {
      if (user.email === email || user.username === username) {
        return res.status(409).json({ error: 'User already exists' });
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const userId = userIdCounter++;
    const newUser = {
      id: userId,
      username,
      email,
      password_hash: hashedPassword,
      role,
      status: 'active',
      created_at: new Date(),
      assigned_surveys: [],
    };

    users.set(userId, newUser);
    saveDb();

    // Generate token
    const token = generateToken(userId, role);

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: userId,
        username,
        email,
        role,
      },
      token,
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login user
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user by email
    let foundUser = null;
    for (let user of users.values()) {
      if (user.email === email) {
        foundUser = user;
        break;
      }
    }

    if (!foundUser) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, foundUser.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate token
    const token = generateToken(foundUser.id, foundUser.role);

    res.json({
      message: 'Login successful',
      user: {
        id: foundUser.id,
        username: foundUser.username,
        email: foundUser.email,
        role: foundUser.role,
      },
      token,
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ==================== CENSUS DATA ROUTES ====================

// Submit single census record
app.post('/api/census/submit', verifyToken, (req, res) => {
  try {
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
      submission_type = 'online',
    } = req.body;

    // Validation
    if (!household_id || !first_name || !last_name) {
      return res.status(400).json({ error: 'Household ID, first name, and last name are required' });
    }

    // Check for duplicate household_id
    if (censusRecords.some(r => r.household_id === household_id)) {
      return res.status(409).json({ error: 'Household ID already exists' });
    }

    // Create record
    const recordId = recordIdCounter++;
    const newRecord = {
      id: recordId,
      enumerator_id: req.user.userId,
      household_id,
      first_name,
      last_name,
      age: age || null,
      gender: gender || null,
      phone: phone || null,
      gps_latitude: gps_latitude || null,
      gps_longitude: gps_longitude || null,
      location_address: location_address || null,
      custom_fields: custom_fields || {},
      submission_type,
      submission_timestamp: new Date(),
      sync_status: 'synced',
      is_duplicate: false,
      anomaly_flags: null,
      created_at: new Date(),
    };

    censusRecords.push(newRecord);
    saveDb();

    res.status(201).json({
      message: 'Census record submitted successfully',
      record: newRecord,
    });
  } catch (err) {
    console.error('Submission error:', err);
    res.status(500).json({ error: 'Submission failed' });
  }
});

// Batch submission for offline sync
app.post('/api/census/batch', verifyToken, (req, res) => {
  try {
    const { records } = req.body;

    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ error: 'Records array is required' });
    }

    const submittedRecords = [];

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
        submission_type = 'offline',
      } = record;

      // Validate required fields
      if (!household_id || !first_name || !last_name) {
        submittedRecords.push({
          household_id: household_id || 'unknown',
          error: 'First name and last name are required',
        });
        continue;
      }

      // Check for duplicate household_id
      if (censusRecords.some(r => r.household_id === household_id)) {
        submittedRecords.push({
          household_id,
          error: 'Household ID already exists',
        });
        continue;
      }

      // Create record
      const recordId = recordIdCounter++;
      const newRecord = {
        id: recordId,
        enumerator_id: req.user.userId,
        household_id,
        first_name,
        last_name,
        age: age || null,
        gender: gender || null,
        phone: phone || null,
        gps_latitude: gps_latitude || null,
        gps_longitude: gps_longitude || null,
        location_address: location_address || null,
        custom_fields: custom_fields || {},
        submission_type,
        submission_timestamp: new Date(),
        sync_status: 'synced',
        is_duplicate: false,
        anomaly_flags: null,
        created_at: new Date(),
      };

      censusRecords.push(newRecord);
      saveDb();
      submittedRecords.push({
        id: recordId,
        household_id,
        sync_status: 'synced',
      });
    }

    res.status(201).json({
      message: `Batch submission completed. ${submittedRecords.filter(r => !r.error).length} records processed.`,
      results: submittedRecords,
    });
  } catch (err) {
    console.error('Batch submission error:', err);
    res.status(500).json({ error: 'Batch submission failed' });
  }
});

// Retrieve census records with pagination
app.get('/api/census/records', verifyToken, (req, res) => {
  try {
    const { page = 1, limit = 50, household_id, status, enumerator_id } = req.query;
    const offset = (page - 1) * limit;

    // Filter records
    let filtered = censusRecords;

    if (req.user.role === 'enumerator') {
      filtered = filtered.filter(r => r.enumerator_id === req.user.userId);
    } else if (enumerator_id) {
      filtered = filtered.filter(r => r.enumerator_id === Number(enumerator_id));
    }

    if (household_id) {
      filtered = filtered.filter(r => r.household_id.includes(household_id));
    }

    if (status) {
      filtered = filtered.filter(r => r.sync_status === status);
    }

    // Paginate
    const total = filtered.length;
    const paginatedRecords = filtered.slice(offset, offset + parseInt(limit));

    res.json({
      data: paginatedRecords,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error('Retrieve records error:', err);
    res.status(500).json({ error: 'Failed to retrieve records' });
  }
});

// ==================== AI AUTO MODE ENDPOINTS ====================

// Natural language query processing
app.post('/api/ai/query', verifyToken, (req, res) => {
  try {
    const { query } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query string is required' });
    }

    const lowerQuery = query.toLowerCase();
    let result = null;

    // Count queries
    if (lowerQuery.includes("how many") || lowerQuery.includes("count") || lowerQuery.includes("total")) {
      if (lowerQuery.includes("male") || lowerQuery.includes("men")) {
        const count = censusRecords.filter(r => r.gender === "M").length;
        result = { type: "count", title: "Male Records", value: count };
      } else if (lowerQuery.includes("female") || lowerQuery.includes("women")) {
        const count = censusRecords.filter(r => r.gender === "F").length;
        result = { type: "count", title: "Female Records", value: count };
      } else if (lowerQuery.includes("geotagged") || lowerQuery.includes("coordinates")) {
        const count = censusRecords.filter(r => r.gps_latitude && r.gps_longitude).length;
        result = { type: "count", title: "Geotagged Records", value: count };
      } else if (lowerQuery.includes("online")) {
        const count = censusRecords.filter(r => r.submission_type === "online").length;
        result = { type: "count", title: "Online Submissions", value: count };
      } else if (lowerQuery.includes("offline")) {
        const count = censusRecords.filter(r => r.submission_type !== "online").length;
        result = { type: "count", title: "Offline Submissions", value: count };
      } else {
        result = { type: "count", title: "Total Records", value: censusRecords.length };
      }
    }

    // Average queries
    else if (lowerQuery.includes("average") || lowerQuery.includes("avg") || lowerQuery.includes("mean")) {
      if (lowerQuery.includes("age")) {
        const avg = Math.round(censusRecords.reduce((sum, r) => sum + Number(r.age), 0) / censusRecords.length);
        result = { type: "average", title: "Average Age", value: avg, details: "years" };
      }
    }

    // Location queries
    else if (lowerQuery.includes("location") || lowerQuery.includes("area") || lowerQuery.includes("region")) {
      const locations = censusRecords.reduce((acc, r) => {
        const loc = r.location_address.split(",")[0]?.trim() || "Unknown";
        acc[loc] = (acc[loc] || 0) + 1;
        return acc;
      }, {});
      const topLocation = Object.entries(locations).sort((a, b) => b[1] - a[1])[0];
      result = {
        type: "list",
        title: "Top Location",
        value: topLocation ? `${topLocation[0]} (${topLocation[1]} records)` : "No data",
        data: Object.entries(locations).slice(0, 5)
      };
    }

    // Age distribution queries
    else if (lowerQuery.includes("age") && (lowerQuery.includes("distribution") || lowerQuery.includes("breakdown"))) {
      const ageGroups = censusRecords.reduce((acc, r) => {
        const age = Number(r.age);
        const group = age <= 17 ? "0-17" : age <= 35 ? "18-35" : age <= 59 ? "36-59" : "60+";
        acc[group] = (acc[group] || 0) + 1;
        return acc;
      }, {});
      result = {
        type: "list",
        title: "Age Distribution",
        value: "Breakdown by age groups",
        data: Object.entries(ageGroups)
      };
    }

    // Percentage queries
    else if (lowerQuery.includes("percentage") || lowerQuery.includes("percent") || lowerQuery.includes("%")) {
      if (lowerQuery.includes("geotagged")) {
        const percentage = Math.round((censusRecords.filter(r => r.gps_latitude && r.gps_longitude).length / censusRecords.length) * 100);
        result = { type: "percentage", title: "Geotagged Records", value: `${percentage}%` };
      } else if (lowerQuery.includes("online")) {
        const percentage = Math.round((censusRecords.filter(r => r.submission_type === "online").length / censusRecords.length) * 100);
        result = { type: "percentage", title: "Online Submissions", value: `${percentage}%` };
      }
    }

    // Trend queries
    else if (lowerQuery.includes("trend") || lowerQuery.includes("recent") || lowerQuery.includes("last")) {
      const recent = censusRecords.slice(-5).map(r => ({
        date: new Date(r.submission_timestamp).toLocaleDateString(),
        count: 1
      }));
      result = {
        type: "trend",
        title: "Recent Submissions",
        value: `${recent.length} records in last submissions`,
        data: recent
      };
    }

    if (result) {
      res.json({ success: true, result });
    } else {
      res.json({ success: false, message: "Query not understood. Try asking about counts, averages, locations, or trends." });
    }
  } catch (err) {
    console.error('AI query error:', err);
    res.status(500).json({ error: 'AI query processing failed' });
  }
});

// Generate AI insights
app.get('/api/ai/insights', verifyToken, (req, res) => {
  try {
    if (censusRecords.length === 0) {
      return res.json({
        insights: ["No records available yet. Capture data to generate AI insights."]
      });
    }

    const total = censusRecords.length;
    const geotagged = censusRecords.filter(r => r.gps_latitude !== null && r.gps_longitude !== null).length;
    const offline = censusRecords.filter(r => r.submission_type !== "online").length;
    const ageGroups = censusRecords.reduce((acc, r) => {
      const age = Number(r.age);
      const group = age <= 17 ? "0-17" : age <= 35 ? "18-35" : age <= 59 ? "36-59" : "60+";
      acc[group] = (acc[group] || 0) + 1;
      return acc;
    }, {});

    const topGroup = Object.entries(ageGroups).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Unknown";
    const projectedNextWave = Math.max(total + 1, Math.round(total * 1.08));

    const insights = [
      `AI predicts the next reporting wave could reach approximately ${projectedNextWave} records if current submission momentum continues.`,
      `${Math.round((geotagged / total) * 100)}% of records are geotagged, which supports location-driven planning.`,
      `The most represented age band is ${topGroup}. Use this to adjust follow-up questions and local service planning.`,
      `There are currently ${offline} offline records; prioritize sync for these to keep the dataset up to date.`,
    ];

    res.json({ insights });
  } catch (err) {
    console.error('AI insights error:', err);
    res.status(500).json({ error: 'Failed to generate insights' });
  }
});

// Get validation hints for a record
app.post('/api/ai/validation', verifyToken, (req, res) => {
  try {
    const record = req.body;

    const hints = [];

    if (!record.household_id?.trim()) {
      hints.push("Household ID is missing. Auto-generate one to avoid duplicates.");
    }
    if (!record.first_name?.trim() || !record.last_name?.trim()) {
      hints.push("Please provide both first name and last name for accurate identity matching.");
    }
    if (record.age && !/^[0-9]{1,3}$/.test(String(record.age))) {
      hints.push("Age should be a whole number between 0 and 150.");
    }
    if (record.age && Number(record.age) > 100) {
      hints.push("This age is unusually high; please confirm it with the respondent.");
    }
    if (record.phone && !/^\+?[0-9]{10,15}$/.test(record.phone)) {
      hints.push("Phone number appears to be in an invalid format.");
    }
    if (!record.location_address?.trim() && record.gps_latitude !== null && record.gps_longitude !== null) {
      hints.push("GPS coordinates are available. Add a matching address for better location records.");
    }
    if (record.gps_latitude === null || record.gps_longitude === null) {
      hints.push("Capture GPS coordinates when possible to improve spatial analysis.");
    }

    res.json({ hints });
  } catch (err) {
    console.error('AI validation error:', err);
    res.status(500).json({ error: 'Failed to generate validation hints' });
  }
});

// Get anomaly score for a record
app.post('/api/ai/anomaly', verifyToken, (req, res) => {
  try {
    const record = req.body;

    let score = 0;
    if (!record.household_id?.trim()) score += 20;
    if (!record.first_name?.trim() || !record.last_name?.trim()) score += 20;
    if (!record.location_address?.trim()) score += 15;
    if (record.gps_latitude === null || record.gps_longitude === null) score += 20;
    if (record.age && Number(record.age) > 90) score += 15;
    if (record.phone && !/^\+?[0-9]{10,15}$/.test(record.phone)) score += 10;

    res.json({ anomalyScore: Math.min(100, score) });
  } catch (err) {
    console.error('AI anomaly error:', err);
    res.status(500).json({ error: 'Failed to compute anomaly score' });
  }
});

// Get mapping recommendations
app.get('/api/ai/mapping', verifyToken, (req, res) => {
  try {
    if (censusRecords.length === 0) {
      return res.json({
        recommendation: "No coordinate data available yet. Start collecting GPS-enabled records to get mapping recommendations."
      });
    }

    const onlineRecords = censusRecords.filter(r => r.submission_type === "online");
    const offlineCount = censusRecords.length - onlineRecords.length;
    const geotaggedRecords = censusRecords.filter(r => r.gps_latitude !== null && r.gps_longitude !== null);

    let recommendation = "";

    if (geotaggedRecords.length < censusRecords.length * 0.5) {
      recommendation = `Only ${geotaggedRecords.length} out of ${censusRecords.length} records have GPS coordinates. Focus on capturing location data for better spatial analysis.`;
    } else if (offlineCount > 0) {
      recommendation = `You have ${offlineCount} offline records. Prioritize syncing these to include their coordinates in mapping analysis.`;
    } else {
      const avgLat = geotaggedRecords.reduce((sum, r) => sum + r.gps_latitude, 0) / geotaggedRecords.length;
      const avgLng = geotaggedRecords.reduce((sum, r) => sum + r.gps_longitude, 0) / geotaggedRecords.length;
      recommendation = `Data collection is well-geotagged. The central collection area is approximately at coordinates (${avgLat.toFixed(4)}, ${avgLng.toFixed(4)}). Consider expanding collection to surrounding areas.`;
    }

    res.json({ recommendation });
  } catch (err) {
    console.error('AI mapping error:', err);
    res.status(500).json({ error: 'Failed to generate mapping recommendation' });
  }
});

// ==================== ADMIN ENDPOINTS ====================

// Get all users (admin only)
app.get('/api/admin/users', verifyToken, (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'supervisor') {
    return res.status(403).json({ error: 'Admin or supervisor access required' });
  }

  try {
    const enumerationStats = censusRecords.reduce((stats, record) => {
      const id = record.enumerator_id;
      if (!stats[id]) {
        stats[id] = { totalRecords: 0, onlineRecords: 0, offlineRecords: 0, lastSubmission: null };
      }

      stats[id].totalRecords += 1;
      if (record.submission_type === 'online') {
        stats[id].onlineRecords += 1;
      } else {
        stats[id].offlineRecords += 1;
      }

      const createdAt = new Date(record.created_at).toISOString();
      if (!stats[id].lastSubmission || createdAt > stats[id].lastSubmission) {
        stats[id].lastSubmission = createdAt;
      }

      return stats;
    }, {});

    let userList = Array.from(users.values()).map(user => {
      const metrics = enumerationStats[user.id] || { totalRecords: 0, onlineRecords: 0, offlineRecords: 0, lastSubmission: null };
      return {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        created_at: user.created_at,
        assigned_surveys: user.assigned_surveys || [],
        totalRecords: metrics.totalRecords,
        onlineRecords: metrics.onlineRecords,
        offlineRecords: metrics.offlineRecords,
        lastSubmissionAt: metrics.lastSubmission,
      };
    });

    if (req.user.role === 'supervisor') {
      userList = userList.filter((user) => user.role === 'enumerator');
    }

    res.json({ users: userList });
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({ error: 'Failed to retrieve users' });
  }
});

// Assign a survey to an enumerator (admin only)
app.post('/api/admin/assign-survey', verifyToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    const { enumeratorId, surveyName } = req.body;
    if (!enumeratorId || !surveyName) {
      return res.status(400).json({ error: 'Enumerator ID and survey name are required' });
    }

    const user = users.get(Number(enumeratorId));
    if (!user || user.role !== 'enumerator') {
      return res.status(404).json({ error: 'Enumerator not found' });
    }

    user.assigned_surveys = user.assigned_surveys || [];
    user.assigned_surveys.push({ name: surveyName, assigned_at: new Date().toISOString() });
    users.set(user.id, user);
    saveDb();

    res.json({ message: 'Survey assigned successfully', user: {
      id: user.id,
      username: user.username,
      assigned_surveys: user.assigned_surveys,
    }});
  } catch (err) {
    console.error('Assign survey error:', err);
    res.status(500).json({ error: 'Failed to assign survey' });
  }
});

// Get system statistics (admin only)
app.get('/api/admin/stats', verifyToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    const totalUsers = users.size;
    const totalRecords = censusRecords.length;
    const onlineRecords = censusRecords.filter(r => r.submission_type === 'online').length;
    const offlineRecords = totalRecords - onlineRecords;
    const lastSync = censusRecords.length > 0 ? 
      new Date(Math.max(...censusRecords.map(r => new Date(r.created_at).getTime()))).toISOString() : 
      null;

    res.json({
      totalUsers,
      totalRecords,
      onlineRecords,
      offlineRecords,
      lastSync,
    });
  } catch (err) {
    console.error('Get stats error:', err);
    res.status(500).json({ error: 'Failed to retrieve statistics' });
  }
});

// Export data (admin only)
app.get('/api/admin/export', verifyToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    const exportData = {
      users: Array.from(users.values()),
      censusRecords,
      exportDate: new Date().toISOString(),
      totalRecords: censusRecords.length,
      totalUsers: users.size,
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="census_export.json"');
    res.json(exportData);
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

// ==================== ERROR HANDLING ====================

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ==================== START SERVER ====================

app.listen(PORT, () => {
  console.log(`✓ Census API running on http://localhost:${PORT}`);
  console.log(`✓ Mode: Local Development (JSON file storage)`);
  console.log(`✓ Database file: ${dbFile}`);
  console.log(`\nAvailable endpoints:`);
  console.log(`  POST   /api/auth/register`);
  console.log(`  POST   /api/auth/login`);
  console.log(`  POST   /api/census/submit`);
  console.log(`  POST   /api/census/batch`);
  console.log(`  GET    /api/census/records`);
  console.log(`  POST   /api/ai/query`);
  console.log(`  GET    /api/ai/insights`);
  console.log(`  POST   /api/ai/validation`);
  console.log(`  POST   /api/ai/anomaly`);
  console.log(`  GET    /api/ai/mapping`);
  console.log(`  GET    /api/admin/users`);
  console.log(`  GET    /api/admin/stats`);
  console.log(`  GET    /api/admin/export`);
});