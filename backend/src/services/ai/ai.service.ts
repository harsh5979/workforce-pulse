import OpenAI from 'openai';
import { openai, MODELS, TEXT_MODELS, MAX_TOKENS_STEP1, MAX_TOKENS_STEP3, MAX_TOKENS_FASTPATH } from './ai.config';
import {
  buildSystemPersona,
  buildSystemRules,
  buildStep3Prompt
} from './ai.prompts';
import { compressToolResult } from './ai.compress';
import { selectToolSchemas } from './ai.schema-selector';
import { chatbotTools } from './tools';
import { executeTool } from './tool-handlers';
import {
  addMessage, getHistory,
  getOrCreateSession
} from './conversation.store';
import { buildCompactAIPrompt } from './context-builder';
import { logger } from '../../utils/logger';
import { Response } from 'express';

// ─────────────────────────────────────────────────────────────────────────────
// THINK-TAG STRIPPER — Qwen3 / DeepSeek emit <think>...</think> reasoning blocks
// Strip them incrementally so they never reach the client.
// ─────────────────────────────────────────────────────────────────────────────
function stripThinkTags(acc: string): string {
  let result = acc.replace(/<think>[\s\S]*?<\/think>/gi, '');
  result = result.replace(/<think>[\s\S]*/i, '');
  return result.trimStart();
}

// ─────────────────────────────────────────────────────────────────────────────
// HEARTBEAT — writes SSE comment every 5 s so the browser never sees a silent
// connection. Must be cleared once the first token arrives.
// ─────────────────────────────────────────────────────────────────────────────
function startHeartbeat(res: Response): ReturnType<typeof setInterval> {
  return setInterval(() => {
    try { res.write(': ♥\n\n'); } catch { /* stream already closed */ }
  }, 5_000);
}

// ─────────────────────────────────────────────────────────────────────────────
// SORRY STREAM — friendly fallback sent when a streaming call times out or
// aborts. Writes tokens word-by-word so the UI renders gracefully.
// ─────────────────────────────────────────────────────────────────────────────
async function streamSorry(res: Response, sid: string, reason = 'timeout'): Promise<string> {
  const sorry = reason === 'timeout'
    ? "The request timed out. Please try again."
    : "The service is currently unavailable. Please try again.";
  for (const word of sorry.split(/(\s+)/)) {
    res.write(`data: ${JSON.stringify({ content: word, sessionId: sid })}\n\n`);
    await new Promise(r => setTimeout(r, 10));
  }
  res.write(`data: ${JSON.stringify({ done: true, sessionId: sid, model: 'fallback' })}\n\n`);
  res.end();
  return sorry;
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function setSseHeaders(res: Response, sid: string): void {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Session-Id', sid);
  res.setHeader('X-Accel-Buffering', 'no');
}

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
  await addMessage(sid, { role: 'assistant', content: text });
  res.write(`data: ${JSON.stringify({ done: true, sessionId: sid, model })}\n\n`);
  res.end();
  return text;
}

// ─────────────────────────────────────────────────────────────────────────────
// GATE CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const WRITE_INTENT_RE = /\b(create|cretae|delete|delte|insert|remove|modify)\b/i;
const WRITE_ENTITY_RE = /\b(add|new)\s+(employee|emplooy|dept|department|record|log|user)\b/i;
const EDIT_RE = /\b(update|edit|edti|change)\s+(employee|emplooy|dept|department|compensation|record|log|role|user)\b/i;
const WRITE_DENIAL = "I'm a read-only analytics assistant, and I don't have the capability to create, update, delete, or edit any records in the database. My purpose is to provide insights and analytics based on the existing operational data.";

const GREETING_RE = /^(hi|hello|hey|helo|hii|hola|good\s*(morning|afternoon|evening|day)|greetings|howdy|sup|what'?s up|yo)\W*$/i;
const GREETING_FULL = `Hello! I'm **WorkforcePulse AI** — your read-only workforce analytics assistant.\n\nI can help you with:\n- **Employee performance** — hours logged, repetitive task load, cost per employee\n- **Department analytics** — team breakdowns, headcount, rep share %\n- **Task categories** — automation priority scores, time distribution\n- **Weekly trends** — repetitive work progression over time\n- **Automation ROI** — monthly INR recovery potential\n\nWhat would you like to explore today?`;
const GREETING_COMPACT = 'Hello! I am WorkforcePulse AI — your workforce analytics assistant. Ready to help.';

const SCOPE_RE = /\b(employee|emplo|dept|department|hour|repetitive|task|categor|salary|cost|compensation|automat|roi|workfor|analytic|trend|week|anomaly|headcount|finance|sales|operations|marketing|overtime|budget|\bcs\b|\bhr\b)\b/i;
const FOLLOWUP_RE = /^(and|also|what about|break|now show|compare|how about|which|who|show me|give me)\b/i;
const SCOPE_DENIAL = 'I am a read-only workforce analytics assistant. I can only provide insights based on employee performance, department metrics, task categories, or automation ROI. Please ask a workforce-related question.';

// ─────────────────────────────────────────────────────────────────────────────
// STREAM TIMEOUT — 25 s per Groq streaming call. If no first token arrives
// within 25 s the AbortSignal fires, we catch it and stream a sorry message.
// ─────────────────────────────────────────────────────────────────────────────
const STREAM_TIMEOUT_MS = 25_000;

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
  const sid = await getOrCreateSession(user?.id || 'default');

  // ── 2. HISTORY — last 3 turns (6 msgs) ─────────────────────────────────────
  const allHistory = await getHistory(sid);
  const history = allHistory.filter(m => m.role !== 'system').slice(-4).map(m => {
    if (m.role === 'assistant' && m.content.includes('|') && m.content.length > 300) {
      const firstSentence = m.content.split(/(?<=\.\s)|\n/)[0]?.trim() ?? '';
      return {
        ...m,
        content: firstSentence.length > 20
          ? firstSentence + ' …[full table delivered to user]'
          : m.content.slice(0, 200) + '…'
      };
    }
    return m;
  });
  await addMessage(sid, { role: 'user', content: userMessage });

  // ── 3. WRITE-INTENT GATE (0 tokens) ────────────────────────────────────────
  const lc = userMessage.toLowerCase();
  if (WRITE_INTENT_RE.test(lc) || WRITE_ENTITY_RE.test(lc) || EDIT_RE.test(lc)) {
    logger.info(`Write intent detected: "${userMessage}" — short-circuited`);
    return streamDirect(res, sid, WRITE_DENIAL, 'security-gateway');
  }

  // ── 4. GREETING GATE (0 tokens) ────────────────────────────────────────────
  if (GREETING_RE.test(userMessage.trim())) {
    logger.info(`Greeting detected — responding with intro (0 tokens)`);
    setSseHeaders(res, sid);
    for (const word of GREETING_FULL.split(/(\s+)/)) {
      res.write(`data: ${JSON.stringify({ content: word, sessionId: sid })}\n\n`);
      await new Promise(r => setTimeout(r, 8));
    }
    await addMessage(sid, { role: 'assistant', content: GREETING_COMPACT });
    res.write(`data: ${JSON.stringify({ done: true, sessionId: sid, model: 'greeting' })}\n\n`);
    res.end();
    return GREETING_FULL;
  }

  // ── 5. SCOPE GATE (0 tokens) ────────────────────────────────────────────────
  if (!SCOPE_RE.test(userMessage) && !FOLLOWUP_RE.test(userMessage.trim())) {
    logger.info(`Scope-gate rejected off-topic query: "${userMessage.slice(0, 60)}"`);
    return streamDirect(res, sid, SCOPE_DENIAL, 'scope-gate');
  }

  // ── 6. BUILD MESSAGE CONTEXT ────────────────────────────────────────────────
  const compactCtx = await buildCompactAIPrompt();

  // Single merged system prompt — avoids sending persona + rules as two messages
  // (~80 token saving per request vs split approach)
  const SYSTEM = `${buildSystemPersona()}\n${buildSystemRules()}\n\n[LIVE DATA — answer simple queries directly. Use tools only for deep/filtered queries.]\n${compactCtx}`;

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: SYSTEM },
    // History: last 3 turns, assistant tables compressed to 1 sentence
    ...history.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content   // no XML wrapping — saves ~4 tokens per msg
    })),
    { role: 'user', content: userMessage },
  ];

  setSseHeaders(res, sid);

  // ── 7. FAST-PATH: answer directly from compact context ──────────────────────
  const isFastPath = (() => {
    const m = userMessage.toLowerCase();
    const categoryQ = /\b(categor|automat|roi|task\s*type|priority|automate\s+first)\b/.test(m);
    const deptQ = /\b(department|dept|division|team|breakdown|overview)\b/.test(m) && !/\b(employee|person|who|individual|staff\s+list)\b/.test(m);
    const rankQ = /\b(top|most|highest|lowest|best|worst|rank|compare|vs|versus)\b/.test(m) && !/\b(week|trend|over\s*time)\b/.test(m);
    const headlineQ = /\b(total|overall|summary|how\s+many|how\s+much|average|mean|recap)\b/.test(m);
    const needsTool = /\b(employee|staff|person|who|week|trend|anomal|outlier|specific|filter\s+by)\b/.test(m);
    return (categoryQ || deptQ || rankQ || headlineQ) && !needsTool;
  })();

  if (isFastPath) {
    logger.info(`[Fast-path] Answering from compact context (skipping Step 1 tool call)`);
    let fullResponse = '';
    let fpModelUsed = '';
    let fpAllRateLimited = true;

    for (let i = 0; i < TEXT_MODELS.length; i++) {
      const model = TEXT_MODELS[i];
      try {
        logger.info(`[Fast-path] Streaming via ${model}`);

        // ── Heartbeat: keeps the SSE connection alive while Groq is thinking
        const hb = startHeartbeat(res);
        let firstToken = false;

        try {
          const stream = await openai.chat.completions.create({
            model,
            messages: [
              { role: 'system', content: buildStep3Prompt() + `\n\n[LIVE DATA]\n${compactCtx}` },
              { role: 'user', content: userMessage },
            ],
            stream: true,
            max_tokens: MAX_TOKENS_FASTPATH,
            temperature: 0.0,
          }, { signal: AbortSignal.timeout(STREAM_TIMEOUT_MS) });

          fpModelUsed = model;
          fpAllRateLimited = false;
          let rawAcc = '';

          for await (const chunk of stream) {
            if (!firstToken) { clearInterval(hb); firstToken = true; }
            const delta = chunk.choices[0]?.delta?.content ?? '';
            if (delta) {
              rawAcc += delta;
              const visible = stripThinkTags(rawAcc);
              const prev = stripThinkTags(rawAcc.slice(0, rawAcc.length - delta.length));
              const newVisible = visible.slice(prev.length);
              if (newVisible) {
                fullResponse += newVisible;
                res.write(`data: ${JSON.stringify({ content: newVisible, sessionId: sid })}\n\n`);
              }
            }
          }
        } finally {
          clearInterval(hb);
        }
        break;

      } catch (err: any) {
        const isTimeout = err.name === 'TimeoutError' || err.name === 'AbortError';
        const is429 = err.status === 429 || err.message?.includes('429') || err.message?.includes('rate');

        logger.warn(`[Fast-path] ${model} failed${isTimeout ? ' (timeout)' : is429 ? ' (429)' : ''}: ${err.message}`);

        if (!is429) fpAllRateLimited = false;

        if (isTimeout && i < TEXT_MODELS.length - 1) {
          // Try next model — it might be faster
          continue;
        }

        if (isTimeout) {
          // All models timed out — stream a sorry message
          logger.warn(`[Fast-path] All models timed out — streaming sorry`);
          return streamSorry(res, sid, 'timeout');
        }

        if (i === TEXT_MODELS.length - 1) {
          const errEvent = fpAllRateLimited
            ? { content: "The service is experiencing high traffic. Please try again shortly.", sessionId: sid }
            : { error: "The service is currently unavailable. Please try again.", isError: true };
          res.write(`data: ${JSON.stringify(errEvent)}\n\n`);
          res.write(`data: ${JSON.stringify({ done: true, sessionId: sid, model: 'fallback' })}\n\n`);
          res.end();
          return '';
        }
      }
    }

    if (fullResponse) {
      await addMessage(sid, { role: 'assistant', content: fullResponse });
    }
    res.write(`data: ${JSON.stringify({ done: true, sessionId: sid, model: fpModelUsed })}\n\n`);
    res.end();
    return fullResponse;
  }

  // ── 8. STEP 1 — Tool intent resolution ─────────────────────────────────────
  let schemas = selectToolSchemas(userMessage);
  let retriedWithAllSchemas = false;
  let firstResponse: any = null;
  let modelUsed = '';
  let allRateLimited = true;

  // Heartbeat for Step 1 (non-streaming, but can still take >5s on OpenRouter)
  const hbStep1 = startHeartbeat(res);

  try {
    for (let i = 0; i < MODELS.length; i++) {
      const model = MODELS[i];
      try {
        logger.info(`[Step 1] Intent resolution via ${model}${schemas.length < chatbotTools.length ? ' (selective schema)' : ' (all schemas)'}`);
        const completion = await openai.chat.completions.create({
          model,
          messages,
          tools: schemas,
          tool_choice: 'auto',
          temperature: 0.0,
          max_tokens: MAX_TOKENS_STEP1,
          stop: ['<|im_end|>', '</tool_call>'],
        }, { signal: AbortSignal.timeout(20_000) });
        firstResponse = completion.choices[0].message;
        modelUsed = model;
        allRateLimited = false;
        break;
      } catch (err: any) {
        const isTimeout = err.name === 'TimeoutError' || err.name === 'AbortError';
        const is429 = err.status === 429 || err.message?.includes('429') || err.message?.includes('rate');
        const isToolMismatch = err.status === 400 && err.message?.includes('not in request.tools');
        const isDecommissioned = err.message?.includes('decommissioned') || err.status === 404;

        if (isToolMismatch && !retriedWithAllSchemas) {
          logger.warn(`[Step 1] Tool mismatch on ${model} — retrying with all schemas`);
          schemas = chatbotTools;
          retriedWithAllSchemas = true;
          i--;
          continue;
        }

        logger.warn(`Model ${model} failed${isTimeout ? ' (timeout)' : is429 ? ' (429)' : isDecommissioned ? ' (decommissioned/404)' : ''}: ${err.message}`);
        if (!is429) allRateLimited = false;

        if (isTimeout && i === MODELS.length - 1) {
          clearInterval(hbStep1);
          return streamSorry(res, sid, 'timeout');
        }

        if (i === MODELS.length - 1) {
          clearInterval(hbStep1);
          res.write(`data: ${JSON.stringify(
            allRateLimited
              ? { content: "The service is experiencing high traffic. Please try again shortly.", sessionId: sid }
              : { error: "The service is currently unavailable. Please try again.", isError: true }
          )}\n\n`);
          res.write(`data: ${JSON.stringify({ done: true, sessionId: sid, model: 'fallback' })}\n\n`);
          res.end();
          return '';
        }
      }
    }
  } finally {
    clearInterval(hbStep1);
  }

  if (!firstResponse) { res.end(); return ''; }

  // ── 9. STEP 2 — Execute tool calls ─────────────────────────────────────────
  if (firstResponse.tool_calls?.length > 0) {
    logger.info(`LLM requested ${firstResponse.tool_calls.length} tool call(s) via ${modelUsed}`);
    messages.push(firstResponse);

    for (const call of firstResponse.tool_calls) {
      try {
        const args = JSON.parse(call.function.arguments);
        logger.info(`Tool "${call.function.name}" args: ${JSON.stringify(args)}`);
        const result = await executeTool(call.function.name, args, user);
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: compressToolResult(call.function.name, result),
        } as any);
      } catch (err: any) {
        logger.error(`Tool "${call.function.name}" failed: ${err.message}`);
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify({ error: err.message }),
        } as any);
      }
    }

    // ── 10. STEP 3 — Stream final formatted answer ──────────────────────────
    // Replace Step 1 system prompt with minimal formatter.
    messages[0] = { role: 'system', content: buildStep3Prompt() };

    let fullResponse = '';
    let step3Done = false;

    for (let ti = 0; ti < TEXT_MODELS.length && !step3Done; ti++) {
      const textModel = TEXT_MODELS[ti];
      const hbStep3 = startHeartbeat(res);
      let firstToken = false;

      try {
        logger.info(`[Step 3] Streaming via ${textModel}`);
        const stream = await openai.chat.completions.create({
          model: textModel,
          messages,
          stream: true,
          max_tokens: MAX_TOKENS_STEP3,
          temperature: 0.0,
        }, { signal: AbortSignal.timeout(STREAM_TIMEOUT_MS) });

        let streamBlocked = false;
        let rawAcc = '';

        for await (const chunk of stream) {
          if (!firstToken) { clearInterval(hbStep3); firstToken = true; }
          if (streamBlocked) break;
          const delta = chunk.choices[0]?.delta?.content ?? '';
          if (delta) {
            rawAcc += delta;
            const visible = stripThinkTags(rawAcc);
            const prev = stripThinkTags(rawAcc.slice(0, rawAcc.length - delta.length));
            const newVisible = visible.slice(prev.length);
            if (newVisible) {
              fullResponse += newVisible;
              const lowerRes = fullResponse.toLowerCase();
              if (lowerRes.includes('read-only executive') || lowerRes.includes('absolute rules') || lowerRes.includes('data-grounded')) {
                res.write(`data: ${JSON.stringify({ error: '\n\n[Read-only analytics assistant — please ask a workforce question.]' })}\n\n`);
                streamBlocked = true;
                break;
              }
              res.write(`data: ${JSON.stringify({ content: newVisible, sessionId: sid })}\n\n`);
            }
          }
        }
        step3Done = true;

      } catch (err: any) {
        const isTimeout = err.name === 'TimeoutError' || err.name === 'AbortError';
        logger.warn(`[Step 3] ${textModel} failed${isTimeout ? ' (timeout)' : ''}: ${err.message}${ti < TEXT_MODELS.length - 1 ? ' — trying next' : ''}`);

        if (isTimeout && ti === TEXT_MODELS.length - 1) {
          clearInterval(hbStep3);
          return streamSorry(res, sid, 'timeout');
        }

        if (ti === TEXT_MODELS.length - 1) {
          clearInterval(hbStep3);
          res.write(`data: ${JSON.stringify({ error: "The service is currently unavailable. Please try again.", isError: true })}\n\n`);
          res.end();
          return '';
        }
      } finally {
        clearInterval(hbStep3);
      }
    }

    if (fullResponse) {
      await addMessage(sid, { role: 'assistant', content: fullResponse });
    }
    res.write(`data: ${JSON.stringify({ done: true, sessionId: sid, model: TEXT_MODELS[0] })}\n\n`);
    res.end();
    return fullResponse;
  }

  // ── 11. DIRECT ANSWER — LLM responded without a tool call ──────────────────
  const content = firstResponse.content
    || 'I am ready to help you analyze your workforce data. Please let me know how I can assist you.';
  logger.info(`Direct answer from ${modelUsed} (no tool called)`);
  for (const word of content.split(/(\s+)/)) {
    res.write(`data: ${JSON.stringify({ content: word, sessionId: sid })}\n\n`);
    await new Promise(r => setTimeout(r, 5));
  }
  await addMessage(sid, { role: 'assistant', content });
  res.write(`data: ${JSON.stringify({ done: true, sessionId: sid, model: modelUsed })}\n\n`);
  res.end();
  return content;
}
