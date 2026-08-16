---
tags: [frontend, architecture, react, nextjs, tailwind]
aliases: [Frontend, UI, Components]
---
# Frontend Pages and Components

## Architecture
This is a Next.js 14 App Router application. All UI logic is strictly segregated from backend business logic (see [[Node_Connection_Architecture]]).

## Styling
The application uses **Tailwind CSS v4** with a custom **Ivory & Forest** theme defined in `frontend/app/globals.css`. 
All components strictly adhere to a flat UI design: `rounded-none`, semantic background variables (`bg-card`, `bg-background`), and no gradients.

## Core Pages
- **Login (`/login`)**: Authenticates users and stores session tokens.
- **Dashboard (`/dashboard`)**: The main overview containing the [[Metric_Methodology|Hero Metrics]], Automation Chart, and the Top Automation Candidates list.
- **Data Ingestion (`/dashboard/data`)**: The ETL pipeline page for uploading and parsing CSV logs. See [[Data_Ingestion_Audit|Data Ingestion Audit]].
- **AI Copilot (`/dashboard/ai`)**: A multi-turn AI interface for querying Postgres telemetry (see [[AI_Copilot_Flow]]).

## Components
All shared UI components are located in `frontend/components/ui`. Dashboard specific components are in `frontend/components/dashboard`.
