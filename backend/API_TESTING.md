# Census API Testing Guide

Quick reference for testing the Census Backend API using cURL or Postman.

## Prerequisites
- PostgreSQL running locally
- Backend server running on http://localhost:3000
- Create `.env` file with database credentials

## Test Flow

### 1. Register an Enumerator
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "enum_john",
    "email": "john@census.com",
    "password": "SecurePass123",
    "role": "enumerator"
  }'
```

**Save the token from response**

### 2. Login (Alternative)
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@census.com",
    "password": "SecurePass123"
  }'
```

### 3. Submit Single Census Record
Replace `YOUR_TOKEN` with the token from registration/login:

```bash
curl -X POST http://localhost:3000/api/census/submit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
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

### 4. Submit Batch Records (Offline Sync)
```bash
curl -X POST http://localhost:3000/api/census/batch \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "records": [
      {
        "household_id": "HH-LAG-002-2024",
        "first_name": "Jane",
        "last_name": "Adeyemi",
        "age": 38,
        "gender": "F",
        "phone": "2348012345679",
        "gps_latitude": 6.5245,
        "gps_longitude": 3.3793,
        "location_address": "14 Lekki Close, Lagos",
        "submission_type": "offline"
      },
      {
        "household_id": "HH-LAG-003-2024",
        "first_name": "Ahmed",
        "last_name": "Hassan",
        "age": 52,
        "gender": "M",
        "phone": "2348012345680",
        "gps_latitude": 6.5246,
        "gps_longitude": 3.3794,
        "location_address": "16 Lekki Close, Lagos",
        "submission_type": "offline"
      }
    ]
  }'
```

### 5. Retrieve All Records
```bash
curl -X GET http://localhost:3000/api/census/records \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 6. Retrieve with Filters & Pagination
```bash
curl -X GET "http://localhost:3000/api/census/records?page=1&limit=10&household_id=HH-LAG" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Postman Collection

Import this into Postman for easier testing:

### Environment Variables
```json
{
  "base_url": "http://localhost:3000",
  "token": ""
}
```

### Register Request
```
POST {{base_url}}/api/auth/register
Body (raw JSON):
{
  "username": "enum_test",
  "email": "test@census.com",
  "password": "TestPass123",
  "role": "enumerator"
}
```

After registration, copy the token and set it in Postman as:
```
Headers: Authorization: Bearer {token}
```

---

## Verification Endpoints (AI Agent Integration)

### Get Flagged Records (Requires Review)
```bash
curl -X GET "http://localhost:3000/api/verify/flagged?priority=HIGH&limit=25" \
  -H "Authorization: Bearer SUPERVISOR_TOKEN"
```

Response:
```json
{
  "priority": "HIGH",
  "count": 3,
  "records": [
    {
      "id": 1,
      "household_id": "HH-LAG-001-2024",
      "first_name": "John",
      "last_name": "Okafor",
      "verification_status": "WARN",
      "verification_results": {
        "confidence_score": 72,
        "issues": [
          {
            "field": "phone",
            "severity": "WARNING",
            "message": "Invalid Nigerian phone format"
          },
          {
            "field": "gps",
            "severity": "WARNING",
            "message": "GPS coordinates 8.5km from address"
          }
        ],
        "requires_manual_review": true,
        "review_priority": "HIGH",
        "recommendations": ["Verify phone number", "Confirm GPS location"]
      },
      "verified_at": "2026-06-19T10:30:00Z"
    }
  ]
}
```

### Get Verification Report
```bash
curl -X GET "http://localhost:3000/api/verify/report?timeframe=7days" \
  -H "Authorization: Bearer SUPERVISOR_TOKEN"
```

### Get Single Record Verification Status
```bash
curl -X GET "http://localhost:3000/api/verify/record/1" \
  -H "Authorization: Bearer TOKEN"
```

### Submit Manual Review/Approval
```bash
curl -X POST "http://localhost:3000/api/verify/manual-review/1" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SUPERVISOR_TOKEN" \
  -d '{
    "approved": true,
    "notes": "Data verified on ground. All issues resolved."
  }'
```

### Get Supervisor Notifications
```bash
curl -X GET "http://localhost:3000/api/verify/notifications" \
  -H "Authorization: Bearer SUPERVISOR_TOKEN"
```

Response:
```json
{
  "count": 5,
  "notifications": [
    {
      "id": 101,
      "supervisor_id": 2,
      "record_id": 1,
      "type": "verification_alert",
      "title": "Record Requires Review: John Okafor",
      "message": "Priority: HIGH. Issues: 2",
      "priority": "HIGH",
      "status": "unread",
      "created_at": "2026-06-19T10:30:00Z"
    }
  ]
}
```

### Mark Notification as Read
```bash
curl -X POST "http://localhost:3000/api/verify/notifications/101/read" \
  -H "Authorization: Bearer SUPERVISOR_TOKEN"
```

---

## Batch Verification (AI Agent)

### Get Unverified Records for Batch Processing
```bash
curl -X GET "http://localhost:3000/api/verify/batch?limit=100&offset=0" \
  -H "Authorization: Bearer SUPERVISOR_TOKEN"
```

### Submit Batch Verification Results
```bash
curl -X POST "http://localhost:3000/api/verify/batch" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -d '{
    "verification_results": [
      {
        "record_id": 1,
        "household_id": "HH-LAG-001-2024",
        "respondent": "John Okafor",
        "verification_status": "WARN",
        "confidence_score": 72,
        "issues": [...],
        "requires_manual_review": true,
        "review_priority": "HIGH"
      }
    ]
  }'
```

---

## Auto-Verification Features

### Single Submission Auto-Verification
When you POST to `/api/census/submit`, the system automatically:
1. Runs verification against 50+ validation rules
2. Computes confidence score (0-100)
3. Identifies issues with severity levels
4. Flags for manual review if priority is HIGH
5. Notifies supervisors immediately

### Batch Verification Scheduler
- Runs every 6 hours automatically (cron job)
- Processes all pending/unverified records
- Generates batch report with aggregate metrics
- Creates supervisor notifications for high priority items
- Logs all activities for audit trail

### Verification Rule Categories
1. **Household ID**: Format validation, duplicate detection
2. **Names**: Length validation, special character check
3. **Age**: Range validation (0-150)
4. **Gender**: Enum validation (M/F/Other)
5. **Phone**: Nigerian format validation (+234 or 0xxx)
6. **Location**: Address keyword matching against 100+ Nigerian LGAs
7. **GPS**: Coordinate bounds (4.0-14.0 lat, 3.0-15.0 lon), address mismatch detection (5km threshold)
8. **Timestamp**: Future date and 90+ days old checks
9. **Custom Fields**: XSS and suspicious character detection
10. **Submission Type**: Enum validation (online/offline)

### Confidence Score Breakdown
- Starts at 100 points
- Penalties deducted for each issue:
  - CRITICAL issue: -30 points
  - WARNING issue: -15 points
  - INFO issue: -5 points
- Final score reflects data quality percentage

### Severity Levels
- **CRITICAL**: Data quality issue that prevents processing
- **WARNING**: Data should be verified on ground
- **INFO**: Minor inconsistency, for reference only

---

| Code | Meaning |
|------|---------|
| 200  | Success |
| 201  | Created |
| 400  | Bad Request (validation error) |
| 401  | Unauthorized (missing/invalid token) |
| 409  | Conflict (e.g., duplicate household_id) |
| 500  | Internal Server Error |

---

## Next Steps

After confirming API works:
1. Connect the frontend PWA to these endpoints
2. Implement offline sync queue in frontend
3. Add AI/ML model endpoints for anomaly detection
4. Implement geospatial verification with PostGIS