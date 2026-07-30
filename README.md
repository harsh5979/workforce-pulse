# Workforce Pulse

Workforce Pulse is an enterprise-grade workforce analytics dashboard designed to help operations leaders and executives answer the critical business question:
> **"Where are we wasting the most time and money, and what should we automate first?"**

The platform ingests raw activity logs and HRMS employee databases, normalizes and joins the data, calculates key productivity metrics, identifies operational anomalies, and provides an interactive AI copilot to query database analytics securely.

---

## 🔗 Live URLs

- **Frontend Web Dashboard:** [https://workforce.iomd.site](https://workforce.iomd.site)
- **Backend Analytics API:** [https://workforce.api.iomd.site](https://workforce.api.iomd.site)

---

## 🖥️ Platform Features (How they work)

Workforce Pulse is split into seven dedicated sections, each serving a specific analytical purpose:

### 1. Overview (Executive Dashboard)
* **What it is:** A high-level visual summary of the organization's entire workforce output.
* **Key Metrics:** Displays total active headcount, total hours tracked, total repetitive hours, and **Recoverable Monthly Cost** (the money currently spent on repetitive tasks that could be automated).
* **Visual charts:** Includes department comparisons (headcount vs. cost) and a breakdown of repetitive task share by department.

### 2. Categories (Task & Automation Analysis)
* **What it is:** A dashboard focusing on task categories (e.g., Email Triage, Meetings, CRM Updates) to identify automation candidates.
* **Automation Priority Score:** Calculates a custom score from `0.0` to `1.0` for each task category using volume, repetitive share, and employee concentration. Higher scores represent higher ROI automation opportunities.
* **INR Savings Potential:** Lists the exact monthly financial savings potential if a category is automated.

### 3. Employees (Operational Telemetry)
* **What it is:** A directory listing of all employees with individual performance cards.
* **Profiles:** Displays each employee's department, role, total logged hours, repetitive work share (%), and estimated hourly rate.
* **Category Breakdown:** Shows a breakdown of the specific tasks they spend the most time on.

### 4. Trends (WoW Performance Analysis)
* **What it is:** A week-over-week trend analyzer.
* **Repetitive Work Share:** Tracks whether the share of repetitive tasks is increasing or decreasing over time across different departments.
* **Productivity Logs:** Visualizes total hours logged per week to identify seasonal productivity trends.

### 5. Anomalies (Outlier & Statistical Flags)
* **What it is:** An automated auditor that flags unusual activity using statistics.
* **Z-Score Detection:** Calculates a Z-score for weekly employee hours compared to their department average. If an employee logs hours that deviate significantly from their peers ($|Z| > 2.0$), they are flagged.
* **Rule Flags:** Also flags departments with over 80% repetitive work, employees with 0 tasks logged in an active week, and sudden week-over-week repetitive share spikes (>30%).

### 6. Data & CSV Import (Data Pipeline)
* **What it is:** The ingestion gateway for the platform.
* **Normalizer:** Ingests raw `activity_logs.csv` and `employees.json`, normalizes dirty fields (different date formats, boolean spellings, casing inconsistencies), runs duplicate checks, and writes clean records to PostgreSQL.

### 7. AI Copilot (Secure Analytics Assistant)
* **What it is:** A grounded chatbot that lets managers query secure natural-language database questions.
* **Policy A Security (Strict Data-Only):** The AI can only answer questions that translate directly into database filters and tool queries (e.g. *"Who in finance is spending the most time on email triage?"*). It is strictly forbidden from writing software code, scripting, or responding to general-knowledge chat queries.

---

## 🚀 Local Development Setup Guide

This guide walks you through setting up the Workforce Pulse workspace on your local computer.

### Prerequisites (What you need installed)
1. **Node.js (v20+):** The JavaScript runtime environment used to build and run our frontend and backend servers.
2. **Docker & Docker Compose:** A containerization tool. It downloads, configures, and runs PostgreSQL, the frontend, and the backend inside isolated environments so you do not need to install databases manually on your local system.

---

### Step 1: Clone and Environment Setup
Open your terminal and clone the repository to your computer:
```bash
git clone https://github.com/yourusername/workforce-pulse.git
cd workforce-pulse
```

Create a local environment variables file by copying the template:
```bash
cp .env.example .env
```
Open the `.env` file and configure your API keys:
* **`GROQ_API_KEY`**: Obtain a free API key from [Groq Console](https://console.groq.com/) for ultra-fast LPU chat streams.
* **`OPENROUTER_API_KEY`**: Obtain an API key from [OpenRouter](https://openrouter.ai/) to use as a fallback provider.

---

### Step 2: Add Data Files
For the ingestion pipeline to run, place your raw CSV and JSON data files inside the `/data/` folder in the project root:
```
workforce-pulse/
└── data/
    ├── activity_logs.csv
    └── employees.json
```

---

### Step 3: Start Services via Docker Compose
Run the following command to download, build, and start the local developer containers:
```bash
docker compose -f docker-compose.dev.yml up -d
```
* **What happens under the hood:** Docker Compose downloads the PostgreSQL 16 image and spins up three services:
  1. `postgres`: Reclaims port `5432` to run the relational database.
  2. `backend`: A Node.js container compiling TypeScript on save and running on port `5000`.
  3. `frontend`: A Next.js container listening on port `3000`.

---

### Step 4: Run Database Ingestion
With the containers running, trigger the data cleaning and ingestion script:
```bash
curl -X POST http://localhost:5000/api/ingest
```
* **What happens under the hood:** The backend reads the dirty raw files in `/data/`, normalizes date strings, fixes capitalization, applies join conflict logic, and inserts the normalized records into the PostgreSQL tables.

Now, open **`http://localhost:3000`** in your browser to view the active local dashboard!

---

## 🛠️ Technology Stack & Libraries Used

| Technology | What it is | How we use it in the platform |
|:---|:---|:---|
| **Next.js 14** | React Framework | Powers the frontend dashboard, handling layouts, loading states, and page navigation. |
| **Tailwind CSS** | CSS Framework | Handles custom styling using clean utility classes, creating a responsive glassmorphism dark theme. |
| **Recharts** | Interactive Charts | Renders dashboard graphs, bar comparisons, and department trendlines. |
| **Zustand** | State Manager | Stores and synchronizes dashboard search filters (department, search text) across all page views. |
| **Express.js** | Node.js Server | Handles API routing for employees, anomalies, and AI chat. |
| **Drizzle ORM** | Database Query Mapper | Maps PostgreSQL database schemas to TypeScript, making queries compile-safe. |
| **PostgreSQL 16** | Relational Database | Stores and indexes raw activity logs, department mappings, and employee metadata. |
| **Groq LPU** | Inference Engine | Resolves natural-language chat intents and streams tokens in 1-2 seconds. |
| **Puppeteer** | Headless Browser | Runs on the backend to render dashboards and export clean PDF reports. |
| **express-rate-limit**| API Guardian | Blocks abuse by rate-limiting chat requests to 20 per minute. |
| **Helmet.js** | Security Middleware | Secures backend response headers by stripping framework details (like `X-Powered-By`). |
