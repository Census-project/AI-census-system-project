# AI-Driven Digital Census Project

This repository contains the frontend and backend for an AI-assisted digital census system with realtime mapping, analytics, and export-ready reporting.

## Structure
- `frontend/` - progressive web app and operational dashboards.
- `backend/` - API server, auth services, census persistence, and analytics.

## Key Features
- Realtime activity feed and coordinate-tagged mapping for field operations.
- Role-based access control for enumerators, supervisors, and administrators.
- AI-driven mapping recommendations, validation hints, and anomaly detection.
- Export-ready JSON data for reporting, partner integration, and commercial use.
- Offline sync, batch submissions, and local JSON development mode.

## Backend Setup
1. Change to the backend folder:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy environment variables:
   ```bash
   cp .env.example .env
   ```
4. Start the app with PostgreSQL:
   ```bash
   npm run dev:pg
   ```

For local JSON-enabled development without PostgreSQL, use:
```bash
npm run dev:local
```

Refer to `backend/README.md` for full backend setup and API details.

## Commercial and Analytics Capabilities
- Live activity stream for all census submissions handled by the web app.
- Downloadable dataset export for backup, reporting, and commercialization.
- Supervisor and admin dashboards with coverage, sync and quality metrics.
- AI-assisted map strategy suggestions to optimize geographic deployment.
- Survey assignment and role-based workflows for scaling field operations.
