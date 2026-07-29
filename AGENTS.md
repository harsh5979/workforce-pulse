# AGENTS.md — Workforce Pulse Coding Rules

This file defines strict coding conventions for all AI agents and developers
working on this codebase. Follow every rule — they exist to keep the
architecture clean, auditable, and correct.

---

## 📁 Project Structure

```
workforce-pulse/
├── frontend/       Next.js 14 App Router (UI only)
├── backend/        Node.js + Express API (all business logic)
├── docs/           Technical documentation (never auto-generated)
├── data/           Raw data files (activity_logs.csv, employees.json)
└── .github/        CI/CD workflows
```

---

## 🖥️ Frontend Rules

### Component Architecture
- **Default: Server Component.** Every file in `components/` is a Server Component unless explicitly marked.
- **Add `"use client"` ONLY when you need:**
  - React hooks (`useState`, `useEffect`, `useRef`, etc.)
  - Event handlers (`onClick`, `onChange`, etc.)
  - Browser-only APIs (`window`, `localStorage`, etc.)
  - Recharts or any chart library (they require DOM)
  - Zustand store reads/writes
- **Never add `"use client"` just because it's convenient.** Think first.
- Server Components that need client interactivity should delegate to a thin Client wrapper:
  ```tsx
  // Server Component (data fetching)
  export default async function EmployeePage() {
    const data = await fetchEmployees();
    return <EmployeeTableClient initialData={data} />;  // thin client wrapper
  }
  ```

### Data Fetching
- **Server Components:** Use `fetch()` directly or import service functions. Always `await`.
- **Client Components:** Use TanStack Query hooks from `/hooks/` directory ONLY.
- **Never call the PostgreSQL database from the frontend.** All data goes through the backend API.
- **Never use `useEffect` to fetch data** — use TanStack Query instead.

### State Management
- **Global filter state** (dept, category, week, employee) lives ONLY in `store/filter-store.ts` (Zustand).
- Never prop-drill filter state more than 1 level.
- URL params must mirror filter state using the `nuqs` library.
- TanStack Query cache keys MUST include active filters:
  ```ts
  queryKey: ['employees', filters.dept, filters.category, filters.week]
  ```

---

## ⚙️ Backend Rules

### Layer Separation (strict)
```
Route → Controller → Service → DB Query
```
- **Routes:** Only parse req/res, call controller, return response. No business logic.
- **Controllers:** Validate input (Zod), call service, format response. No DB calls.
- **Services:** All business logic lives here. Can call DB queries. No req/res objects.
- **DB Queries:** Drizzle ORM only. No raw SQL strings except in comments.

### Database
- All queries live in `src/db/queries/` — NEVER inline queries in controllers or services.
- Use Drizzle's typed query builders. Never use `$queryRaw` unless absolutely necessary.
- Always run migrations before seed: `npm run db:migrate && npm run db:seed`.
- Drizzle types: use `InferSelectModel<typeof tableName>` for query return types.

### Error Handling
- All async route handlers must be wrapped with try/catch or an async error middleware.
- Use the central error middleware (`middleware/error.middleware.ts`) for consistent error responses.
- Never send raw stack traces to the client in production.
- Always return JSON: `{ error: string, code?: string, details?: unknown }`.

---

## 🤖 AI Rules

### Grounding (non-negotiable)
- Every AI response MUST be grounded in the live dataset context.
- The `context-builder.ts` output MUST be included in every system prompt.
- Never allow the model to respond without first injecting the data context.
- If the context build fails, return an error to the user — do not send a context-free prompt.

### Citations
- Every quantitative claim in an AI response must include a citation.
- Citation format: `[E007: 42.3h/week]`, `[Finance dept: 68% repetitive]`
- The `citation-chip.tsx` component renders these inline.

### Multi-turn Conversations
- Conversation history is stored server-side in `services/ai/conversation.store.ts`.
- Use a `sessionId` (UUID) generated on first message, stored in client `localStorage`.
- Max conversation history: 20 messages (prune oldest when exceeded).
- Never store conversation history in the database — in-memory Map is sufficient.

### OpenRouter Models (priority order)
1. `google/gemini-2.0-flash-exp:free`
2. `google/gemini-flash-1.5:free`
3. `meta-llama/llama-3.1-8b-instruct:free`
4. `mistralai/mistral-7b-instruct:free`

---

## 🔢 TypeScript Rules

- **No `any` types.** Use `unknown` with type guards, or proper interfaces.
- All API response shapes must be typed in `frontend/types/index.ts`.
- All DB query return types must use Drizzle's `InferSelectModel`.
- All environment variables validated with Zod at startup in `config/env.ts`.
- Never use non-null assertion `!` on nullable values — use proper null checks.

---

## 💰 Number Formatting (ALWAYS use these)

```ts
// frontend/lib/formatters.ts — use these, never format manually
formatINR(123456.78)    // → "₹1,23,456"  (Indian locale)
formatHours(42.3)       // → "42.3 hrs"
formatPct(0.678)        // → "67.8%"
formatCount(1234)       // → "1,234"
```

Never write `₹${number}` or `${n}%` inline — always use formatters.

---

## 🌍 Environment Variables

### Backend `.env`
```
DATABASE_URL=postgresql://...
OPENROUTER_API_KEY=sk-or-...
SITE_URL=http://localhost:3000
PORT=4000
NODE_ENV=development
```

### Frontend `.env.local`
```
NEXT_PUBLIC_API_URL=http://localhost:4000
```

**Rules:**
- `NEXT_PUBLIC_` prefix ONLY for values safe to expose in browser bundles.
- Never log env vars (even in dev).
- Never commit `.env` files — only `.env.example`.
- App must crash at startup if required env vars are missing (Zod validation).

---

## 🎨 UI Rules

### Design System
- Use CSS custom properties from `globals.css` — never hardcode colors.
- Use Shadcn/ui components from `components/ui/` — never write raw HTML buttons/inputs.
- All async components must have a Skeleton loading state.
- All data-fetching components must handle error state visibly (not silently fail).

### Charts
- All charts are in `components/charts/` and are `"use client"`.
- Every chart must have a `<ChartSkeleton />` loading state.
- Use consistent colors from `DEPT_COLORS` and `CATEGORY_COLORS` in `lib/constants.ts`.

### Responsiveness
- All layouts must work at 375px (iPhone SE) viewport width.
- Sidebar collapses to bottom nav on mobile.
- Test with Chrome DevTools mobile emulation before marking any task done.

---

## 📝 Git Rules

- **Conventional Commits:** `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`
- Never commit `.env` — CI will catch it but don't rely on that.
- PR must pass TypeScript check (`tsc --noEmit`) before merge.
- Deploy happens automatically on merge to `main`.

---

## 📊 Data Integrity Rules

- **Never modify the source data files** in `/data/`. They are read-only inputs.
- **Never synthesize data** — if a field is missing, flag it; don't invent a value.
- **Every aggregated number on the dashboard must be traceable** to source rows.
- Document every normalization decision in `docs/data-normalization.md`.
