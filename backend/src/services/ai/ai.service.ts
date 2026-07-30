import OpenAI from 'openai';
import { env } from '../../config/env';
import { buildCompactAIPrompt } from './context-builder';
import { addMessage, getHistory, createSession, getSession } from './conversation.store';
import { logger } from '../../utils/logger';
import { Response } from 'express';

// ── Provider selection: Groq takes priority over OpenRouter ─────────────────
// Groq key starts with "gsk_" and is set via GROQ_API_KEY env var
const groqKey = env.GROQ_API_KEY;
const openrouterKey = env.OPENROUTER_API_KEY;
const isGroq = Boolean(groqKey && groqKey.startsWith('gsk_'));
const rawApiKey = isGroq ? groqKey! : openrouterKey;

// ── Startup log — visible in nodemon terminal ────────────────────────────────
logger.info(`=== AI SERVICE STARTUP ===`);
logger.info(`Provider : ${isGroq ? '✅ GROQ  (fast LPU inference)' : '⚠️  OpenRouter (GPU shared)'}`);
logger.info(`API Key  : ${rawApiKey ? rawApiKey.slice(0, 12) + '...' + rawApiKey.slice(-4) : '❌ MISSING'}`);
logger.info(`Base URL : ${isGroq ? 'https://api.groq.com/openai/v1' : 'https://openrouter.ai/api/v1'}`);
logger.info(`Models   : ${isGroq ? 'llama-3.1-8b-instant → gemma2-9b-it → llama-3.3-70b' : 'gemini-flash → llama-8b → gpt-oss-20b...'}`);
if (!isGroq && groqKey) logger.warn(`GROQ_API_KEY found but does NOT start with "gsk_" — falling back to OpenRouter`);
if (!rawApiKey) logger.error(`❌ No API key found! Set GROQ_API_KEY or OPENROUTER_API_KEY in .env`);
logger.info(`=========================`);

const openai = new OpenAI({
  baseURL: isGroq ? 'https://api.groq.com/openai/v1' : 'https://openrouter.ai/api/v1',
  apiKey: rawApiKey,
  defaultHeaders: isGroq ? {} : {
    'HTTP-Referer': env.SITE_URL,
    'X-Title': 'Workforce Pulse',
  },
});

// Model fallback chains — priority order
const MODELS = isGroq ? [
  // llama-3.1-8b-instant: 14,400 req/day free — fastest, perfect for structured data
  'llama-3.1-8b-instant',
  // gemma2-9b-it: 14,400 req/day, 15k tokens/min — great fallback
  'gemma2-9b-it',
  // llama-3.3-70b: only 500 req/day — use as last resort for complex queries
  'llama-3.3-70b-versatile',
  'mixtral-8x7b-32768',
] : [
  // Fastest free models first — reordered for speed
  'google/gemini-flash-1.5:free',          // ~200 t/s, most reliable free model
  'meta-llama/llama-3.1-8b-instruct:free', // ~80 t/s, small = fast
  'openai/gpt-oss-20b:free',               // Good quality but slower
  'openai/gpt-oss-120b:free',              // High quality, slower
  'google/gemma-4-31b-it:free',            // Fallback
  'inclusionai/ling-3.0-flash:free',       // Fallback
  'nvidia/nemotron-3-super-120b-a12b:free', // Last resort — large model
];

function buildSystemPrompt(contextTableText: string): string {
  return `You are WorkforcePulse AI, an executive data analyst assistant for a workforce productivity platform.

You have access to the LIVE workforce analytics dataset formatted in compact tabular format below:

<DATA_CONTEXT>
${contextTableText}
</DATA_CONTEXT>

STRICT RULES:
1. ONLY answer using exact facts from the DATA_CONTEXT above. Never invent or round numbers inaccurately.
2. ALWAYS cite exact figures and IDs when making quantitative claims (e.g., E014 Arun Kumar: 21.6h Email Triage, ₹15,985/mo).
3. Support follow-up questions cleanly with multi-turn context.
4. FORMAT RULES — follow these exactly:
   - For ANY comparison, ranking, or list of 2+ employees/departments/tasks: output a MARKDOWN TABLE using pipe syntax (| Col | Col |). Example:
     | Employee | Hours | Cost/mo |
     |---|---|---|
     | Arun Kumar (E014) | 21.6h | ₹15,985 |
   - For single-entity answers: use bullet points with bold labels (e.g. **Employee:** Arun Kumar).
   - Use bold (**text**) for key names, figures, and labels.
   - Keep responses concise and executive-grade. No filler text.
5. OUT-OF-SCOPE OR NO RECORD QUERIES: Never give a blunt or robotic "not present in dataset" response. If an inquiry targets an entity, date range, or filter where zero matching telemetry logs exist, respond in a formal, courteous, and professional executive tone. For example: "Based on our active PostgreSQL workforce telemetry and HRMS schemas, no recorded activity logs currently match these criteria." Then gracefully offer a related analytical insight from the available dataset.
6. When evaluating automation ROI or executive summaries, cite priority index scores and INR savings potential.
7. Never output raw JSON. Only use Markdown (tables, bullets, bold).`;
}

export async function streamAIChat(
  sessionId: string | null,
  userMessage: string,
  res: Response
): Promise<string> {
  // Create or retrieve session
  let sid = sessionId;
  if (!sid || !getSession(sid)) {
    sid = createSession();
  }

  // Build ultra-compact grounded context (reduces tokens by ~85%)
  const contextText = await buildCompactAIPrompt();

  // Get conversation history — cap at 4 turns (saves ~200 tokens vs 6 turns)
  const history = getHistory(sid).filter(m => m.role !== 'system').slice(-4);

  // Add user message to history
  addMessage(sid, { role: 'user', content: userMessage });

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: 'system', content: buildSystemPrompt(contextText) },
    ...history.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    { role: 'user', content: userMessage },
  ];

  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Session-Id', sid);

  let fullResponse = '';
  let modelUsed = '';
  let allRateLimited = true; // track if every failure was a 429

  // Try models in priority order
  for (let i = 0; i < MODELS.length; i++) {
    const model = MODELS[i];
    try {
      logger.info(`Attempting ${isGroq ? 'Groq' : 'OpenRouter'} model: ${model}`);
      const stream = await openai.chat.completions.create({
        model,
        messages,
        stream: true,
        max_tokens: 512,  // Workforce answers are concise — 512 saves tokens & speeds up response
        temperature: 0.15, // Lower = more deterministic, faster convergence on factual answers
      });

      modelUsed = model;
      allRateLimited = false; // at least one model worked

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content ?? '';
        if (delta) {
          fullResponse += delta;
          res.write(`data: ${JSON.stringify({ content: delta, sessionId: sid })}\n\n`);
        }
      }

      // If model returned an empty body, treat it as a failure and try next model
      if (!fullResponse) {
        logger.warn(`Model ${model} returned empty content — falling through to next model.`);
        modelUsed = '';
        allRateLimited = false;
        if (i === MODELS.length - 1) {
          const providerName = isGroq ? 'Groq' : 'OpenRouter';
          res.write(`data: ${JSON.stringify({ error: `All free ${providerName} AI models returned empty responses. Please try again shortly.` })}\n\n`);
          res.end();
          return '';
        }
        continue; // try next model
      }

      break; // success — stop trying models
    } catch (err: any) {
      const is429 = err.status === 429 || err.message?.includes('429') || err.message?.includes('rate');
      logger.warn(`Model ${model} failed${is429 ? ' (429 rate-limited)' : ''}: ${err.message}`);

      if (!is429) allRateLimited = false; // non-429 failure — not a rate limit

      if (i === MODELS.length - 1) {
        // All models exhausted
        if (allRateLimited) {
          // Every model returned 429 — tell the frontend to show rate-limit UI
          res.write(`data: ${JSON.stringify({ rateLimited: true })}\n\n`);
        } else {
          const providerName = isGroq ? 'Groq' : 'OpenRouter';
          res.write(`data: ${JSON.stringify({ error: `All free ${providerName} AI models are temporarily unavailable. Please try again shortly.` })}\n\n`);
        }
        res.end();
        return '';
      }
      // Try next model
      continue;
    }
  }

  // Store assistant response in history
  if (fullResponse) {
    addMessage(sid, { role: 'assistant', content: fullResponse });
  }

  res.write(`data: ${JSON.stringify({ done: true, sessionId: sid, model: modelUsed })}\n\n`);
  res.end();

  return fullResponse;
}
