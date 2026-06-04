# AI-Driven Digital Census Project

This repository contains the frontend and backend for the AI-driven digital census PWA system.\n
## Structure
- `frontend/` - progressive web app and web portal.
- `backend/` - API server, database models, AI/ML services.

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
