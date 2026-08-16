---
tags: [dates, time, logic, formatting]
aliases: [Dates, Time, Weekly Filtering]
---
# Date Management

Dates are a critical part of the Workforce Pulse telemetry dashboard. They heavily impact how [[Metric_Methodology]] operates.

## Weekly Filtering
The primary time-series filter in the application is based on **Audit Weeks** in Q3 2024.
- Week 1: Aug 01-07
- Week 2: Aug 08-14
- Week 3: Aug 15-21
- Week 4: Aug 22-28

When no week is selected, the dashboard aggregates data across the entire Q3 dataset. This filter is sent in API calls to the backend (see [[API_Reference]]).

## Storage
All timestamps are stored in PostgreSQL using the `timestamp` type and are always managed in **UTC** (see [[Node_Connection_Architecture]]).

## Formatting
On the frontend (see [[Pages_and_Components]]), dates are formatted into localized strings using the native JS `Intl.DateTimeFormat`.
