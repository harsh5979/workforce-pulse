import OpenAI from 'openai';
import { env } from '../../config/env';
import { buildCompactAIPrompt } from './context-builder';
import { addMessage, getHistory, createSession, getSession } from './conversation.store';
import { logger } from '../../utils/logger';
import { Response } from 'express';

// Automatically detect whether user is supplying a Groq API key (starts with gsk_ or GROQ_API_KEY in .env) vs OpenRouter
const rawApiKey = env.GROQ_API_KEY || env.OPENROUTER_API_KEY;
const isGroq = rawApiKey?.startsWith('gsk_') || Boolean(env.GROQ_API_KEY);

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
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'mixtral-8x7b-32768',
  'gemma2-9b-it',
] : [
  // Primary: GPT OSS 20B (fastest, best for structured data queries)
  'openai/gpt-oss-20b:free',
  // First fallback: GPT OSS 120B (higher quality, slightly slower)
  'openai/gpt-oss-120b:free',
  // Remaining free fallbacks in quality order
  'google/gemma-4-31b-it:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
  'poolside/laguna-s-2.1:free',
  'inclusionai/ling-3.0-flash:free',
  'meta-llama/llama-3.1-8b-instruct:free',
  'google/gemini-flash-1.5:free',
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

  // Get conversation history (cap at last 4 user/assistant turns to conserve tokens)
  const history = getHistory(sid).filter(m => m.role !== 'system').slice(-6);

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
        max_tokens: 1024,
        temperature: 0.25,
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
