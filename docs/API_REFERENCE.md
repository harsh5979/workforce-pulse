# Workforce Pulse — REST & Streaming API Reference

The Workforce Pulse backend server (`http://localhost:4000`) exposes a clean, type-safe REST API powered by Express, TypeScript, and Drizzle ORM, with native Server-Sent Events (SSE) streaming for grounded AI inference.

---

## 1. Authentication & Headers
All requests should include appropriate Content-Type headers:
```http
Content-Type: application/json
```
For SSE Streaming endpoints, clients must handle text streams without request buffering.

---

## 2. Core Dashboard Endpoints

### `GET /api/dashboard`
Returns high-level organizational KPI summaries, financial recovery opportunities, and recent data ingestion statistics.

**Query Parameters:**
- `department` (optional string): e.g., `Finance`
- `category` (optional string): e.g., `Report Generation`
- `week` (optional integer): `1` to `4`

**Response Example (`200 OK`):**
```json
{
  "hoursRecoverablePerMonth": 482.5,
  "inrRecoverablePerMonth": 314500,
  "totalRepetitiveHours": 450.2,
  "totalHours": 1280.0,
  "repetitiveShare": 35.2,
  "datasetDays": 28,
  "latestIngestion": {
    "rowsActivityRaw": 89,
    "rowsActivityClean": 88,
    "rowsDropped": 1,
    "duplicateEmployees": 1
  }
}
```

---

## 3. Categorical Analysis & Rankings

### `GET /api/categories`
Returns grouped time expenditures across standardized classifications.

**Query Parameters:**
- `groupBy` (required): `'task_category' | 'app_used' | 'department'`
- `department`, `week`, `category` (optional filters)

### `GET /api/categories/ranking`
Returns task categories sorted by composite automation priority score (40% volume, 40% repetitive share, 20% reach).

**Response Example (`200 OK`):**
```json
[
  {
    "category": "Report Generation",
    "score": 0.812,
    "totalHours": 240.5,
    "repetitiveHours": 210.0,
    "repetitiveShare": 87.3,
    "employeeCount": 8,
    "rank": 1
  }
]
```

---

## 4. Workforce Employee Records

### `GET /api/employees`
Returns active and terminated employee list with aggregated activity summaries. Supports filtering by `department`, `week`, and `category`.

### `GET /api/employees/:id`
Returns high-fidelity single employee profile, normalized compensation details, 4-week activity trajectories, and role peer benchmarks.
- **Example**: `/api/employees/E007`

---

## 5. Temporal Trends & Anomalies

### `GET /api/trends`
Returns week-by-week aggregated totals for productive versus repetitive work across weeks 1 to 4.

### `GET /api/anomalies`
Executes background Z-score analysis and returns flagged statistical workload outliers and departments logging $>80\%$ repetitive task ratios.

**Response Example (`200 OK`):**
```json
[
  {
    "id": "zscore-E007-w2",
    "type": "high_volume",
    "subject": "E007",
    "subjectType": "employee",
    "headline": "E007 logged abnormally high hours in Week 2",
    "detail": "65.2h logged vs dept avg 42.0h (z-score: 2.84)",
    "severity": "medium",
    "value": 65.2,
    "benchmark": 42.0
  }
]
```

---

## 6. Grounded AI Copilot (OpenRouter Integration)

### `POST /api/ai/chat`
Server-Sent Events (SSE) endpoint providing grounded analytical chat responses using OpenRouter models (`google/gemini-2.0-flash-exp:free`, fallback to Llama 3.1).

**Request Body:**
```json
{
  "message": "Who in finance is spending the most time on report generation?",
  "sessionId": "a823f78a-c219-4112-9c32" 
}
```
*(Omit `sessionId` on first turn; server will assign and return a UUID to preserve multi-turn history).*

**Stream Output Protocol (`text/event-stream`):**
```http
data: {"content": "Based on active database records, ", "sessionId": "a823f78a-c219-4112-9c32"}

data: {"content": "**Meera Iyer (E007)** spends the highest duration in Finance...", "sessionId": "..."}

data: {"done": true, "model": "google/gemini-2.0-flash-exp:free"}
```

### `GET /api/ai/context`
Returns the exact JSON representation of active DB aggregates currently injected into the LLM context window (for evaluation and zero-hallucination verification).

---

## 7. Pipeline Trigger & Maintenance

### `POST /api/ingest`
Manually triggers the data ingestion and hygiene engine to re-parse `/data/activity_logs.csv` and `/data/employees.json`, resolve conflicts, and re-seed PostgreSQL tables.

### `GET /api/health`
Standard Kubernetes/Docker health check endpoint.
```json
{ "status": "ok", "timestamp": "2026-07-28T18:05:00.000Z", "env": "development" }
```
