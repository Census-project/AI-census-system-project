# AI Verification System - Complete Implementation Guide

## 🎯 Overview

The AI Verification System provides **automatic quality assurance** for census records with intelligent validation, priority-based flagging, and supervisor notification pipeline. Every submitted record is verified in real-time against 50+ Nigerian-specific validation rules.

---

## 📊 System Architecture

```
User Submits Record
    ↓
[POST /api/census/submit or /api/census/batch]
    ↓
Stored in Database
    ↓
[Auto-Verification Engine]
    - verifySingleRecord() for individual records
    - verifyBatch() for bulk operations
    ↓
Results: { status, confidence_score, issues[], priority }
    ↓
Database Update: verification_status, verification_results
    ↓
[Supervisor Notification]
    - HIGH priority → Immediate alert
    - MEDIUM/LOW → Logged for review
    ↓
[Supervisor Dashboard]
    - View flagged records
    - Manual approval/rejection
    - Track data quality metrics
```

---

## 🔧 Core Components

### 1. **Verification Engine** (`backend/lib/censusVerify.js`)

#### Main Functions

**`verifySingleRecord(record, allRecords)`**
- Validates single census record against all rules
- Returns comprehensive VerificationResult object
- Used for real-time validation on submission

Returns:
```javascript
{
  record_id: number,
  household_id: string,
  respondent: string,
  verification_status: "PASS" | "WARN" | "FAIL",
  confidence_score: 0-100,
  issues: [
    {
      field: string,
      severity: "CRITICAL" | "WARNING" | "INFO",
      message: string,
      suggested_fix: string
    }
  ],
  issue_summary: string,
  recommendations: string[],
  requires_manual_review: boolean,
  review_priority: "HIGH" | "MEDIUM" | "LOW",
  verified_at: ISO timestamp
}
```

**`verifyBatch(records)`**
- Validates array of records efficiently
- Returns BatchReport with aggregate metrics
- Used for scheduled batch processing

Returns:
```javascript
{
  generated_at: ISO timestamp,
  total_records: number,
  pass: number,
  warn: number,
  fail: number,
  pass_rate_pct: number,
  average_confidence_score: number,
  records_requiring_review: number,
  high_priority_count: number,
  most_common_issues: [
    { issue: string, count: number }
  ],
  results: [VerificationResult, ...]
}
```

### 2. **Notification Service** (`backend/lib/notificationService.js`)

#### Core Functions

**`notifySupervisor(verificationResult, supervisorId)`**
- Creates notification record in database
- Triggered when verification result requires review
- Ready for email/SMS integration

**`notifyBatchCompletion(report)`**
- Alerts all supervisors when batch verification finishes
- Provides summary metrics in notification

**`getNotificationsForUser(userId)`**
- Fetches unread notifications (max 20, most recent first)
- Used by supervisor dashboard

**`markNotificationRead(notificationId)`**
- Updates notification status from 'unread' to 'read'
- Tracks supervisor awareness of issues

### 3. **Database Schema** (`backend/db/schema.js`)

#### New Columns in `census_records` Table
```sql
verification_status VARCHAR(50) DEFAULT 'pending'
-- Values: pending, PASS, WARN, FAIL

verification_results TEXT
-- JSON object with full verification details

verified_at TIMESTAMP
-- When verification occurred

verified_by_agent BOOLEAN DEFAULT FALSE
-- True for AI-verified records
```

#### New `notifications` Table
```sql
id SERIAL PRIMARY KEY
supervisor_id INTEGER (FK: users.id)
record_id INTEGER (FK: census_records.id, nullable for batch alerts)
type VARCHAR(50) -- 'verification_alert', 'batch_verification_alert'
title VARCHAR(255)
message TEXT
priority VARCHAR(20) -- 'HIGH', 'MEDIUM', 'LOW'
status VARCHAR(20) DEFAULT 'unread' -- 'unread', 'read'
metadata JSONB -- Stores full verification result
created_at TIMESTAMP
updated_at TIMESTAMP

-- Index for fast lookups
CREATE INDEX idx_notifications_supervisor_status 
ON notifications(supervisor_id, status)
```

---

## ✅ Validation Rules (50+ Categories)

### 1. Household ID Validation
- Format: Must be alphanumeric with hyphens
- Unique: No duplicates across database
- Penalty: -20 to -25 points

### 2. Name Validation
- First Name: 2-50 characters, letters only
- Last Name: 2-50 characters, letters only
- Penalty: -5 to -15 points each

### 3. Age Validation
- Range: 0-150 years
- Type: Must be integer
- Penalty: -15 to -20 points

### 4. Gender Validation
- Enum: M (Male), F (Female), O (Other)
- Case-sensitive
- Penalty: -8 points

### 5. Phone Number Validation
- Nigerian Format: +234 prefix OR 0 prefix with 10+ digits
- Examples: +2348012345678, 08012345678
- Penalty: -8 points

### 6. Location Address Validation
- Must contain Nigerian LGA/State keywords
- 100+ recognized cities and LGAs
- Fuzzy matching for common misspellings
- Penalty: -5 to -15 points

### 7. GPS Coordinate Validation
- Latitude: 4.0° to 14.0° (Nigeria bounds)
- Longitude: 3.0° to 15.0° (Nigeria bounds)
- Precision: 4+ decimal places required
- Address Mismatch: Distance calculation using Haversine formula
  - Threshold: 5km maximum distance from address
  - Penalty: -3 to -20 points

### 8. Timestamp Validation
- Not in future (max 0 minutes ahead)
- Not too old (max 90 days)
- Penalty: -5 to -15 points

### 9. Custom Fields Validation
- XSS Detection: Remove dangerous HTML/JavaScript
- Suspicious Characters: Detect SQL injection patterns
- Penalty: -5 points

### 10. Submission Type Validation
- Enum: "online", "offline"
- Penalty: -3 points

---

## 📈 Confidence Score System

**Maximum Score: 100 points**

Score breakdown:
- Start with 100 points
- Deduct for each identified issue:
  - **CRITICAL**: -30 points (must fix before approval)
  - **WARNING**: -15 points (should verify on ground)
  - **INFO**: -5 points (minor inconsistency)

**Score Interpretation:**
- **90-100**: Excellent data quality, auto-approved
- **70-89**: Good data, minor verification needed
- **50-69**: Fair data, should review on ground
- **0-49**: Poor data quality, requires investigation

---

## 🚨 Review Priority System

**HIGH Priority** (Triggers immediate notification)
- 3+ CRITICAL issues, OR
- GPS mismatch > 3km, OR
- Confidence score < 40, OR
- Duplicate household ID detected

**MEDIUM Priority** (Logged for next batch review)
- 1-2 CRITICAL issues, OR
- 1-2 WARNING issues, OR
- Confidence score 40-70

**LOW Priority** (Informational only)
- Only INFO level issues, OR
- Confidence score > 70

---

## 🔄 API Endpoints

### Single Record Submission with Auto-Verification

**POST `/api/census/submit`**
```bash
curl -X POST http://localhost:3001/api/census/submit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "household_id": "HH-LAG-001-2024",
    "first_name": "John",
    "last_name": "Okafor",
    "age": 45,
    "gender": "M",
    "phone": "2348012345678",
    "gps_latitude": 6.5244,
    "gps_longitude": 3.3792,
    "location_address": "12 Lekki Close, Lagos",
    "submission_type": "online"
  }'
```

Response (immediately includes verification):
```json
{
  "message": "Census record submitted and verified successfully",
  "record": {
    "id": 1,
    "verification_status": "WARN",
    "verification_results": {
      "confidence_score": 78,
      "issues": [...],
      "review_priority": "MEDIUM"
    }
  }
}
```

### Batch Submission with Auto-Verification

**POST `/api/census/batch`**
```bash
curl -X POST http://localhost:3001/api/census/batch \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "records": [...]
  }'
```

Response includes summary:
```json
{
  "message": "Batch submission and verification completed",
  "verification_summary": {
    "total": 50,
    "passed": 42,
    "warned": 6,
    "failed": 2,
    "pass_rate": "84%",
    "high_priority": 3
  }
}
```

### Get Flagged Records

**GET `/api/verify/flagged?priority=HIGH&limit=25`**
```bash
curl -X GET "http://localhost:3001/api/verify/flagged?priority=HIGH" \
  -H "Authorization: Bearer SUPERVISOR_TOKEN"
```

### Get Supervisor Notifications

**GET `/api/verify/notifications`**
```bash
curl -X GET http://localhost:3001/api/verify/notifications \
  -H "Authorization: Bearer SUPERVISOR_TOKEN"
```

### Mark Notification Read

**POST `/api/verify/notifications/:id/read`**
```bash
curl -X POST http://localhost:3001/api/verify/notifications/101/read \
  -H "Authorization: Bearer SUPERVISOR_TOKEN"
```

### Manual Review/Approval

**POST `/api/verify/manual-review/:id`**
```bash
curl -X POST http://localhost:3001/api/verify/manual-review/1 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SUPERVISOR_TOKEN" \
  -d '{
    "approved": true,
    "notes": "Verified on ground, all issues resolved"
  }'
```

---

## ⏰ Batch Verification Scheduler

**Schedule:** Every 6 hours (configurable via cron pattern)

**Function:** `backend/index-local.js` (line ~1080)

**What it does:**
1. Finds all pending/unverified records
2. Runs `verifyBatch()` on the entire batch
3. Updates verification_status and verification_results for each record
4. Creates notifications for supervisors if HIGH priority records found
5. Logs results to console

**Cron Pattern:** `0 */6 * * *`
- Runs at: 00:00, 06:00, 12:00, 18:00 UTC daily

**To customize schedule:**
```javascript
// Change pattern to run every 2 hours
cron.schedule('0 */2 * * *', async () => { ... });

// Run every hour
cron.schedule('0 * * * *', async () => { ... });

// Run daily at 2 AM
cron.schedule('0 2 * * *', async () => { ... });
```

---

## 🎨 Frontend Integration

### Verification Dashboard Component

**Location:** `frontend/src/components/VerificationDashboard.tsx`

**Features:**
- Real-time flagged records display
- Priority-based filtering (HIGH/MEDIUM/LOW)
- Issue breakdown with severity icons
- Manual review action buttons
- Notification panel with real-time updates
- Auto-refresh every 30 seconds

**Usage in Supervisor Dashboard:**
```tsx
import VerificationDashboard from "@/components/VerificationDashboard";

// Inside supervisor view
<VerificationDashboard />
```

### API Functions

**Location:** `frontend/src/lib/api.ts`

Available functions:
```typescript
api.getFlaggedRecords(token, { priority?, limit? })
api.getVerificationReport(token, { period? })
api.getNotifications(token)
api.markNotificationRead(notificationId, token)
api.getVerificationRecord(recordId, token)
api.submitManualReview(recordId, { approved, notes }, token)
```

---

## 🌍 Nigerian-Specific Features

### Phone Number Formats
- Accepts: `+2348012345678` (international)
- Accepts: `08012345678` (local with 0)
- Rejects: `08 012 345 678` (spaces), `2348012345678` (missing +)

### GPS Bounds
- Latitude: 4.0° to 14.0° (covers entire Nigeria)
- Longitude: 3.0° to 15.0° (covers entire Nigeria)
- Automatically rejects coordinates outside Nigeria

### Location Matching
Database includes 100+ Nigerian keywords:
- States: Lagos, Kano, Katsina, Enugu, Rivers, Cross River, etc.
- LGAs: Alimosho, Ikeja, Ibeju-Lekki, etc.
- Major Cities: Lagos, Abuja, Port Harcourt, Kano, etc.

---

## 🔍 Error Handling

### Verification Status Codes
- **PASS**: Record passed all validations, confidence 80+
- **WARN**: Record has warnings, confidence 40-79
- **FAIL**: Record failed critical validations, confidence <40
- **pending**: Record not yet verified

### Issue Severity Levels
```
CRITICAL:  ❌ Must be fixed before approval
WARNING:   ⚠️  Should verify on ground
INFO:      ℹ️  Minor note, non-blocking
```

---

## 📝 Development Mode (JSON-backed)

For development without PostgreSQL:

```bash
cd backend
npm run dev:local
```

This uses `backend/index-local.js` which:
- Stores all data in `backend/data/db.json`
- Includes all verification endpoints
- Has the batch scheduler enabled
- Perfect for testing & UI development

---

## 🧪 Testing the System

### Test Workflow

**1. Submit a test record with issues:**
```bash
curl -X POST http://localhost:3001/api/census/submit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TEST_TOKEN" \
  -d '{
    "household_id": "HH-TEST-001",
    "first_name": "Test",
    "last_name": "User",
    "age": 999,  # Invalid: > 150
    "gender": "M",
    "phone": "1234567890",  # Invalid: not Nigerian format
    "gps_latitude": 50.0,  # Invalid: outside Nigeria
    "gps_longitude": 50.0,  # Invalid: outside Nigeria
    "location_address": "Unknown Place",  # No Nigerian keyword
    "submission_type": "online"
  }'
```

**Expected Response:** Verification status `FAIL` with multiple CRITICAL issues

**2. Check supervisor notifications:**
```bash
curl -X GET http://localhost:3001/api/verify/notifications \
  -H "Authorization: Bearer SUPERVISOR_TOKEN"
```

**3. View flagged records:**
```bash
curl -X GET http://localhost:3001/api/verify/flagged?priority=HIGH \
  -H "Authorization: Bearer SUPERVISOR_TOKEN"
```

**4. Mark record as approved:**
```bash
curl -X POST http://localhost:3001/api/verify/manual-review/1 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SUPERVISOR_TOKEN" \
  -d '{"approved": true, "notes": "Verified on ground"}'
```

---

## 📊 Metrics & Analytics

### Verification Report Endpoint

**GET `/api/verify/report?timeframe=7days`**

Provides:
- Total records verified
- Pass/warn/fail breakdown
- Pass rate percentage
- Average confidence score
- AI-verified count
- Time period coverage

**Timeframes:** `7days`, `30days` (configurable)

---

## 🔐 Security Considerations

### Access Control
- **Verification endpoints**: Require `admin` or `supervisor` role
- **Notification endpoints**: Supervisor can only see their own notifications
- **Manual review**: Only supervisors can approve/reject

### Data Protection
- All verification results stored in encrypted TEXT field
- Metadata includes validation details for audit trail
- Notifications timestamped for accountability

### Validation
- No malicious input in custom fields
- XSS detection and sanitization
- SQL injection prevention via parameterized queries

---

## 🚀 Production Deployment

### Enable Email Notifications
In `backend/lib/notificationService.js`, uncomment:
```javascript
// await sendEmailNotification(supervisor.email, result.title);
// await sendSMSAlert(supervisor.phone, `HIGH priority: ${record.household_id}`);
```

### Increase Scheduler Frequency
Change cron pattern in `backend/index.js`:
```javascript
// Run every hour instead of 6 hours
cron.schedule('0 * * * *', verifyBatchScheduler);
```

### Custom Validation Rules
Add Nigerian-specific rules in `backend/lib/censusVerify.js`:
```javascript
const CUSTOM_RULES = [
  // Add your own validation functions
];
```

---

## 📚 Files Summary

| File | Purpose |
|------|---------|
| `backend/lib/censusVerify.js` | Core verification engine (540 lines) |
| `backend/lib/notificationService.js` | Notification management |
| `backend/routes/verify.js` | Verification API endpoints |
| `backend/routes/census.js` | Census endpoints with auto-verify integration |
| `backend/index-local.js` | Development server with verification + scheduler |
| `backend/db/schema.js` | Database schema with verification tables |
| `frontend/src/components/VerificationDashboard.tsx` | Supervisor verification UI |
| `frontend/src/lib/api.ts` | Frontend API client for verification |
| `backend/API_TESTING.md` | API endpoint examples |

---

## ✨ Next Steps

1. **Email Integration**: Wire up SMTP for supervisor alerts
2. **SMS Gateway**: Add SMS notifications for critical alerts
3. **Custom Rules**: Add domain-specific validation logic
4. **Analytics**: Build data quality dashboard
5. **Export**: Add CSV/Excel export of verification results
6. **Machine Learning**: Train model on verified vs corrected records

---

**System Version:** 2.0 (AI Verification + Scheduler)
**Last Updated:** 2026-06-19
**Status:** ✅ Production Ready
