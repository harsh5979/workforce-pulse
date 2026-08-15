import OpenAI from 'openai';
import { openai, MODELS }          from './ai.config';
import { buildSystemPersona,
         buildSystemRules,
         buildStep3Prompt }         from './ai.prompts';
import { compressToolResult }       from './ai.compress';
import { selectToolSchemas }        from './ai.schema-selector';
import { chatbotTools }             from './tools';          // ← all 5 schemas (mismatch fallback)
import { executeTool }              from './tool-handlers';
import { addMessage, getHistory,
         createSession, getSession } from './conversation.store';
import { logger }                   from '../../utils/logger';
import { Response }                 from 'express';

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Set standard SSE response headers. */
function setSseHeaders(res: Response, sid: string): void {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Session-Id', sid);
  res.setHeader('X-Accel-Buffering', 'no');
}

/**
 * Stream a plain string word-by-word via SSE — no LLM call needed.
 * Used by all zero-token gates (write-intent, greeting, scope).
 */
async function streamDirect(
  res: Response,
  sid: string,
  text: string,
  model: string,
  delayMs = 5
): Promise<string> {
  setSseHeaders(res, sid);
  for (const word of text.split(/(\s+)/)) {
    res.write(`data: ${JSON.stringify({ content: word, sessionId: sid })}\n\n`);
    await new Promise(r => setTimeout(r, delayMs));
  }
  addMessage(sid, { role: 'assistant', content: text });
  res.write(`data: ${JSON.stringify({ done: true, sessionId: sid, model })}\n\n`);
  res.end();
  return text;
}

// ─────────────────────────────────────────────────────────────────────────────
// GATE CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

// Gate 1 — Write/mutation intent
const WRITE_INTENT_RE = /\b(create|cretae|delete|delte|insert|remove|modify)\b/i;
const WRITE_ENTITY_RE = /\b(add|new)\s+(employee|emplooy|dept|department|record|log|user)\b/i;
const EDIT_RE         = /\b(update|edit|edti|change)\s+(employee|emplooy|dept|department|compensation|record|log|role|user)\b/i;
const WRITE_DENIAL    = "I'm a read-only analytics assistant, and I don't have the capability to create, update, delete, or edit any records in the database. My purpose is to provide insights and analytics based on the existing operational data.";

// Gate 2 — Greeting
const GREETING_RE      = /^(hi|hello|hey|helo|hii|hola|good\s*(morning|afternoon|evening|day)|greetings|howdy|sup|what'?s up|yo)\W*$/i;
const GREETING_FULL    = `Hello! I'm **WorkforcePulse AI** — your read-only workforce analytics assistant.\n\nI can help you with:\n- **Employee performance** — hours logged, repetitive task load, cost per employee\n- **Department analytics** — team breakdowns, headcount, rep share %\n- **Task categories** — automation priority scores, time distribution\n- **Weekly trends** — repetitive work progression over time\n- **Automation ROI** — monthly INR recovery potential\n\nWhat would you like to explore today?`;
const GREETING_COMPACT = 'Hello! I am WorkforcePulse AI — your workforce analytics assistant. Ready to help.';

// Gate 3 — Off-topic scope
const SCOPE_RE        = /\b(employee|emplo|dept|department|hour|repetitive|task|categor|salary|cost|compensation|automat|roi|workfor|analytic|trend|week|anomaly|headcount|finance|sales|operations|marketing|overtime|budget|\bcs\b|\bhr\b)\b/i;
const FOLLOWUP_RE     = /^(and|also|what about|break|now show|compare|how about|which|who|show me|give me)\b/i;
const SCOPE_DENIAL    = 'I am a read-only workforce analytics assistant. I can only provide insights based on employee performance, department metrics, task categories, or automation ROI. Please ask a workforce-related question.';

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────────────────────

export async function streamAIChat(
  sessionId: string | null,
  userMessage: string,
  res: Response,
  user?: any
): Promise<string> {

  // ── 1. SESSION ──────────────────────────────────────────────────────────────
  const sid = sessionId && getSession(sessionId) ? sessionId : createSession();

  // ── 2. HISTORY — last 2 messages only (= 1 turn ≈ 60–130 tokens) ───────────
  const history = getHistory(sid).filter(m => m.role !== 'system').slice(-2);
  addMessage(sid, { role: 'user', content: userMessage });

  // ── 3. WRITE-INTENT GATE (0 LLM tokens) ────────────────────────────────────
  const lc = userMessage.toLowerCase();
  if (WRITE_INTENT_RE.test(lc) || WRITE_ENTITY_RE.test(lc) || EDIT_RE.test(lc)) {
    logger.info(`Write intent detected: "${userMessage}" — short-circuited`);
    return streamDirect(res, sid, WRITE_DENIAL, 'security-gateway');
  }

  // ── 4. GREETING GATE (0 LLM tokens) ────────────────────────────────────────
  if (GREETING_RE.test(userMessage.trim())) {
    logger.info(`Greeting detected — responding with intro (0 tokens)`);
    setSseHeaders(res, sid);
    for (const word of GREETING_FULL.split(/(\s+)/)) {
      res.write(`data: ${JSON.stringify({ content: word, sessionId: sid })}\n\n`);
      await new Promise(r => setTimeout(r, 8));
    }
    addMessage(sid, { role: 'assistant', content: GREETING_COMPACT }); // compact in history
    res.write(`data: ${JSON.stringify({ done: true, sessionId: sid, model: 'greeting' })}\n\n`);
    res.end();
    return GREETING_FULL;
  }

  // ── 5. SCOPE GATE (0 LLM tokens) ───────────────────────────────────────────
  const priorTurns = getHistory(sid).filter(m => m.role === 'user').length;
  if (!SCOPE_RE.test(userMessage) && !FOLLOWUP_RE.test(userMessage.trim()) && priorTurns <= 1) {
    logger.info(`Scope-gate rejected off-topic query: "${userMessage.slice(0, 60)}"`);
    return streamDirect(res, sid, SCOPE_DENIAL, 'scope-gate');
  }

  // ── 6. BUILD MESSAGE CONTEXT ────────────────────────────────────────────────
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: buildSystemPersona() },
    ...history.map(m => ({ 
       role: m.role as 'user' | 'assistant', 
       content: m.role === 'user' ? `<user_input>\n${m.content}\n</user_input>` : m.content 
    })),
    { role: 'user', content: `<user_input>\n${userMessage}\n</user_input>` },
    { role: 'system', content: buildSystemRules() }
  ];

  setSseHeaders(res, sid);

  // ── 7. STEP 1 — Tool intent resolution ─────────────────────────────────────
  // Selective schema: send only the 1 most-likely schema (~75 tokens) instead
  // of all 5 (~380 tokens). Saves ~305 tokens on most requests.
  //
  // Safety net: if the LLM tries to call a tool that wasn't offered (400 mismatch),
  // we retry the SAME model once with all 5 schemas — no user-visible failure.
  let schemas = selectToolSchemas(userMessage); // start selective
  let retriedWithAllSchemas = false;            // prevent infinite retry
  let firstResponse: any    = null;
  let modelUsed             = '';
  let allRateLimited        = true;

  for (let i = 0; i < MODELS.length; i++) {
    const model = MODELS[i];
    try {
      logger.info(`[Step 1] Intent resolution via ${model}${schemas.length < chatbotTools.length ? ' (selective schema)' : ' (all schemas)'}`);
      const completion = await openai.chat.completions.create({
        model,
        messages,
        tools       : schemas,
        tool_choice : 'auto',
        temperature : 0.0,
      });
      firstResponse  = completion.choices[0].message;
      modelUsed      = model;
      allRateLimited = false;
      break;
    } catch (err: any) {
      const is429          = err.status === 429 || err.message?.includes('429') || err.message?.includes('rate');
      const isToolMismatch = err.status === 400 && err.message?.includes('not in request.tools');
      const isDecommissioned = err.message?.includes('decommissioned');

      // ── Tool mismatch: LLM picked a schema we didn't offer ──────────────────
      // Retry the SAME model once with all 5 schemas. Does not advance i.
      if (isToolMismatch && !retriedWithAllSchemas) {
        logger.warn(`[Step 1] Tool mismatch on ${model} — retrying with all schemas`);
        schemas = chatbotTools;     // expand to full set
        retriedWithAllSchemas = true;
        i--;                        // stay on same model index
        continue;
      }

      logger.warn(`Model ${model} failed${is429 ? ' (429)' : isDecommissioned ? ' (decommissioned)' : ''}: ${err.message}`);
      if (!is429) allRateLimited = false;

      if (i === MODELS.length - 1) {
        res.write(`data: ${JSON.stringify(
          allRateLimited
            ? { rateLimited: true }
            : { error: 'Too many requests due to high traffic. Please try again in a moment.' }
        )}\n\n`);
        res.end();
        return '';
      }
    }
  }

  if (!firstResponse) { res.end(); return ''; }

  // ── 8. STEP 2 — Execute tool calls ─────────────────────────────────────────
  if (firstResponse.tool_calls?.length > 0) {
    logger.info(`LLM requested ${firstResponse.tool_calls.length} tool call(s) via ${modelUsed}`);
    messages.push(firstResponse);

    for (const call of firstResponse.tool_calls) {
      try {
        const args = JSON.parse(call.function.arguments);
        logger.info(`Tool "${call.function.name}" args: ${JSON.stringify(args)}`);
        const result = await executeTool(call.function.name, args, user);
        // Append compressed result — 50–70% fewer tokens vs raw JSON
        messages.push({
          role        : 'tool',
          tool_call_id: call.id,
          content     : compressToolResult(call.function.name, result),
        } as any);
      } catch (err: any) {
        logger.error(`Tool "${call.function.name}" failed: ${err.message}`);
        messages.push({
          role        : 'tool',
          tool_call_id: call.id,
          content     : JSON.stringify({ error: err.message }),
        } as any);
      }
    }

    // ── 9. STEP 3 — Stream final formatted answer ───────────────────────────
    // Replace Step 1 system prompt (~130 tokens) with minimal Step 3 formatter (~35 tokens).
    // Tool schemas no longer needed here — just a data formatter.
    messages[0] = { role: 'system', content: buildStep3Prompt() };

    let fullResponse = '';
    try {
      logger.info(`[Step 3] Streaming final response via ${modelUsed}`);
      const stream = await openai.chat.completions.create({
        model      : modelUsed,
        messages,
        stream     : true,
        max_tokens : 700,
        temperature: 0.0,
      });

      let streamBlocked = false;
      for await (const chunk of stream) {
        if (streamBlocked) break;
        const delta = chunk.choices[0]?.delta?.content ?? '';
        if (delta) {
          fullResponse += delta;

          // Output guardrail - intercept if it starts leaking instructions
          const lowerRes = fullResponse.toLowerCase();
          if (lowerRes.includes('read-only executive') || lowerRes.includes('absolute rules') || lowerRes.includes('data-grounded')) {
             res.write(`data: ${JSON.stringify({ error: '\n\n[I am a read-only workforce analytics assistant. I can only provide insights based on employee performance, department metrics, task categories, or automation ROI. Please ask a workforce-related question.]' })}\n\n`);
             streamBlocked = true;
             break;
          }

          res.write(`data: ${JSON.stringify({ content: delta, sessionId: sid })}\n\n`);
        }
      }

      // Truncate history entry to prevent token bloat on future turns.
      // The full answer was already streamed to the user.
      if (fullResponse) {
        const histContent = fullResponse.length > 400
          ? fullResponse.slice(0, 400) + '…[full response delivered to user]'
          : fullResponse;
        addMessage(sid, { role: 'assistant', content: histContent });
      }

      res.write(`data: ${JSON.stringify({ done: true, sessionId: sid, model: modelUsed })}\n\n`);
      res.end();
      return fullResponse;
    } catch (err: any) {
      logger.error(`Step 3 stream failed: ${err.message}`);
      res.write(`data: ${JSON.stringify({ error: 'Connection failed due to high traffic. Please try again in a moment.' })}\n\n`);
      res.end();
      return '';
    }
  }

  // ── 10. DIRECT ANSWER — LLM responded without needing a tool ───────────────
  const content = firstResponse.content
    || 'I am ready to help you analyze your workforce data. Please let me know how I can assist you.';
  logger.info(`Direct answer from ${modelUsed} (no tool called)`);
  for (const word of content.split(/(\s+)/)) {
    res.write(`data: ${JSON.stringify({ content: word, sessionId: sid })}\n\n`);
    await new Promise(r => setTimeout(r, 5));
  }
  addMessage(sid, { role: 'assistant', content });
  res.write(`data: ${JSON.stringify({ done: true, sessionId: sid, model: modelUsed })}\n\n`);
  res.end();
  return content;
}
