---
tags: [backend, api, node, express, database, postgres]
aliases: [Backend, Express, Database]
---
# Node Connection & Architecture

## Express Server
The backend is a Node.js API powered by **Express**. It handles all business logic, data validation (via Zod), and direct database interactions.

## Database
We use **PostgreSQL** with **Drizzle ORM**.
- All queries are housed strictly in `backend/src/db/queries/`.
- The frontend (see [[Pages_and_Components]]) **NEVER** calls the database directly.

## Frontend to Backend Connection
The Next.js frontend connects to the Node backend via a custom API client (`frontend/lib/api-client.ts`). See the full [[API_Reference]].
In development, the backend runs on port 4000, and the frontend on port 3000. 

### CORS
CORS is configured in the Express backend to accept requests from `NEXT_PUBLIC_API_URL` (typically `http://localhost:3000` in dev).
