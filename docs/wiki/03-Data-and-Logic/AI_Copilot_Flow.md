---
tags: [ai, llm, copilot, chat, openrouter]
aliases: [AI Copilot, Chatbot, LLM]
---
# AI Agent Chatbot Flow

The AI Copilot (see [[Pages_and_Components]]) is a core feature of the Workforce Pulse dashboard, providing a multi-turn, context-aware chat interface. It allows executives to query operational data using natural language.

## Flow Architecture

1. **User Input**
   - The user navigates to `/dashboard/ai` or clicks the floating AI Copilot button.
   - The user types a query in the chat interface.

2. **Context Hydration (Grounding)**
   - Before sending the user's query to the LLM, the frontend gathers the currently active filters (Department, Week, Category) based on [[Date_Management]].
   - The backend API receives the query along with the filter state (see [[Node_Connection_Architecture]]).
   - The backend queries the **PostgreSQL** database (via Drizzle ORM) to fetch real-time, aggregated telemetry data matching the user's filters.
   - *Rule:* The AI response MUST be grounded in the live dataset context (see [[Metric_Methodology]]).

3. **LLM Invocation (OpenRouter)**
   - The backend constructs a system prompt containing the grounded data context.
   - The request is sent to an external LLM provider via **OpenRouter**. 

4. **Multi-turn Conversation Management**
   - Conversation history is managed server-side.
   - The frontend maintains a `sessionId` (UUID) stored in `localStorage`.

5. **Response & Citations**
   - The LLM streams or returns the response.
   - Every quantitative claim MUST include a citation (e.g., `[E007: 42.3h/week]`).
