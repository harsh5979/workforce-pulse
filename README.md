# Workforce Pulse

> **Engineering Challenge** — Workforce Analytics Dashboard
> Answering the COO question: *"Where are we wasting the most time and money, and what should we automate first?"*

## 🔗 Live URL

`http://your.server.ip` ← update after deployment

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- Node.js 20+
- Docker + Docker Compose
- npm

### 1. Clone and setup
```bash
git clone https://github.com/yourusername/workforce-pulse.git
cd workforce-pulse
cp .env.example .env
# Edit .env with your values
```

### 2. Add data files
Place your files in `/data/`:
```
data/
├── activity_logs.csv
└── employees.json
```

### 3. Start all services
```bash
docker compose -f docker-compose.dev.yml up
```

### 4. Run ingestion
```bash
curl -X POST http://localhost:4000/api/ingest
```

### 5. Open the dashboard
```
http://localhost:3000
```

---

## 📁 Project Structure

```
workforce-pulse/
├── frontend/          Next.js 14 App Router (UI)
├── backend/           Node.js + Express API
├── docs/              Technical documentation
├── data/              Source data files (gitignored if sensitive)
├── .github/workflows/ GitHub Actions CI/CD
├── docker-compose.yml Production stack
├── nginx.conf         Reverse proxy config
└── README.md          This file
```

---

## 📊 Data Sources

### `activity_logs.csv`
~540 rows of employee activity logs over 4 weeks.
| Column | Type | Notes |
|--------|------|-------|
| `employee_id` | string | 15 employees, some unknown IDs |
| `department` | string | Sales, Finance, Operations, CS, HR, Marketing |
| `timestamp` | datetime | Multiple formats — ISO, slash-style, mixed precision |
| `app_used` | string | Inconsistent casing, whitespace padding |
| `task_category` | string | Casing varies, abbreviations, missing values |
| `duration_minutes` | number | Negatives, zeros, outliers, blanks present |
| `is_repetitive` | boolean | 11 different spellings: TRUE/true/1/yes/Yes/no/empty/NA |

### `employees.json`
HRMS export — one record per employee, wrapped in `data.employees`.
| Field | Notes |
|-------|-------|
| `employee_id` / `EmployeeID` | Casing varies |
| `department` / `Dept` | Key name varies |
| `role` or `meta.role` | Flat or nested |
| `compensation` | Annual INR, hourly INR, or LPA (lakhs per annum) |
| `working_hours` | `"9-18"` string or `{"start":"09:00","end":"18:00"}` object |

---

## 🧹 Assumptions

### activity_logs.csv
- **Negative durations:** Data entry errors → set to 0, flagged in ingestion log
- **Duration > 960 min (16h):** Treated as outliers → flagged but included, not dropped
- **Blank/zero duration:** Dropped (no signal value)
- **`is_repetitive` blank/NA/empty:** Conservative → treated as `false`
- **Timestamps without timezone:** Assumed IST (UTC+5:30)
- **Duplicate rows (exact):** Dropped, counted in ingestion stats
- **Unknown employee IDs:** Included with `has_metadata = false`

### employees.json
- **Duplicate `employee_id`:** Kept the record with `status: active`; flagged the duplicate
- **Employee in activity but not HRMS:** Included with `has_metadata = false`; INR calculation excluded for this employee
- **Employee in HRMS but no activity:** Included with `has_activity = false`; shown in UI panel
- **Terminated employee:** Activity before `terminated_on` is counted; flagged in employee profile
- **Missing `department`:** Inferred from activity logs if available; otherwise `"Unknown"`

---

## 🔗 Join Strategy

```
LEFT JOIN activity_logs ON employees
WHERE LOWER(TRIM(activity.employee_id)) = LOWER(TRIM(hrms.employee_id))
```

**Conflict resolution:**
1. `employee_id` normalized (lowercase, trimmed) before join
2. Duplicate HRMS record: active record wins; if both active, keep first-seen, flag both
3. Unmatched activity rows: preserved, flagged as `has_metadata = false`
4. Compensation conflicts on duplicates: use the non-zero, non-null value

---

## 📐 Formulas

### Hours Recoverable / Month
```
dataset_days = (max_timestamp - min_timestamp) in days

hours_recoverable = SUM(duration_min WHERE is_repetitive = true) / 60
                  × (30 / dataset_days)
```

### INR Recoverable / Month
```
For each employee e with metadata:
  hourly_rate_e    = comp_annual_inr_e / (260 × working_hours_day_e)
  rep_hours_e      = SUM(duration_min WHERE employee_id = e AND is_repetitive) / 60
  monthly_rep_e    = rep_hours_e × (30 / dataset_days)
  inr_recoverable_e = monthly_rep_e × hourly_rate_e

INR_recoverable = SUM(inr_recoverable_e) for all e with metadata
```

**Compensation normalization:**
```
annual_inr source  → use directly
hourly_inr source  → hourly × 8 × 260
LPA source         → lpa × 100,000
```

### Automation Priority Score
```
For each task category c:
  volume_norm_c       = total_hours_c / max_category_hours_across_all
  rep_share_c         = repetitive_hours_c / total_hours_c
  emp_concentration_c = count(distinct employees doing c) / total_employees

  score_c = (volume_norm_c × 0.40)
           + (rep_share_c × 0.40)
           + (emp_concentration_c × 0.20)
```

---

## 🚨 Anomaly Detection

**Algorithm:** Z-score on employee-level total hours per week, grouped by department.

```
For each (employee, week) pair:
  dept_mean = mean(total_hours) for all employees in same dept in same week
  dept_std  = std_dev(total_hours) for same group
  z_score   = (employee_hours - dept_mean) / dept_std
  
  Flag if |z_score| > 2.0
```

**Additional rule-based flags:**
- Department with > 80% repetitive task share
- Employee with 0 tasks logged in any week they appear
- Week-over-week repetitive share increase > 30 percentage points

Each anomaly card shows: *what it is*, *why it's flagged*, *the exact numbers*.

---

## ✂️ What Was Cut (and Why)

| Feature | Reason Cut |
|---------|-----------|
| Real-time activity updates | Data is a static snapshot; polling adds complexity without value |
| User authentication | Single-user COO dashboard; multi-tenant not in scope |
| Historical month-over-month | Only 4 weeks of data; insufficient for longer trends |
| Natural language → SQL | Too high hallucination risk; used structured context injection instead |
| Slack/email alerts | Out of scope for this challenge |

---

## 🔮 What We'd Build Next (2 More Days)

1. **Alert subscriptions** — Slack webhook when a new anomaly is detected each week
2. **Month-over-month comparison** — after accumulating 2+ months of data
3. **Export to Google Slides** — for leadership all-hands presentations
4. **Role-based access** — managers see only their department; COO sees all
5. **AI suggestion execution** — "Automate this" button that drafts an RPA brief

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router, Server + Client Components) |
| UI Components | Shadcn/ui + Tailwind CSS |
| Charts | Recharts |
| State | Zustand (filters) + TanStack Query (server state) |
| Backend | Node.js + Express + TypeScript |
| Database | PostgreSQL 16 |
| ORM | Drizzle ORM |
| AI | OpenRouter API (Gemini 2.0 Flash free tier) |
| PDF Export | Puppeteer (server-side) |
| Deployment | Docker Compose + Nginx + GitHub Actions |

---

## 📚 Documentation

Full technical documentation is in the [`docs/`](./docs/) directory:

- [Architecture](./docs/architecture.md) — System diagram and data flow
- [Data Normalization](./docs/data-normalization.md) — Field-by-field cleaning rules
- [Join Strategy](./docs/join-strategy.md) — Join logic and conflict resolution
- [AI Layer](./docs/ai-layer.md) — Grounding approach and prompt design
- [Analytics Formulas](./docs/analytics-formulas.md) — All calculation formulas
- [Deployment](./docs/deployment.md) — Server setup and CI/CD
- [API Reference](./docs/api-reference.md) — All REST endpoints

---

## ⚠️ Security

- All secrets in environment variables — never in code or git history
- `.env` is gitignored — use `.env.example` as template
- API rate limited with `express-rate-limit`
- Helmet.js security headers on all responses
- OpenRouter API key stored server-side only — never exposed to browser
