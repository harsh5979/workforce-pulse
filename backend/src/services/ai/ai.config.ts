import OpenAI from 'openai';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';

// ── Provider selection: Groq takes priority over OpenRouter ──────────────────
// Groq key starts with "gsk_" and is set via GROQ_API_KEY env var
const groqKey      = env.GROQ_API_KEY;
const openrouterKey = env.OPENROUTER_API_KEY;
export const isGroq  = Boolean(groqKey && groqKey.startsWith('gsk_'));
const rawApiKey     = isGroq ? groqKey! : openrouterKey;

// ── Startup diagnostics — visible in nodemon terminal ────────────────────────
logger.info(`=== AI SERVICE STARTUP ===`);
logger.info(`Provider : ${isGroq ? '✅ GROQ  (LPU inference — qwen3.8-27b)' : '⚠️  OpenRouter (fallback)'}`);
logger.info(`API Key  : ${rawApiKey ? rawApiKey.slice(0, 12) + '...' + rawApiKey.slice(-4) : '❌ MISSING — set GROQ_API_KEY in .env'}`);
logger.info(`Base URL : ${isGroq ? 'https://api.groq.com/openai/v1' : 'https://openrouter.ai/api/v1'}`);
if (!isGroq && groqKey) logger.warn(`GROQ_API_KEY found but does NOT start with "gsk_" — check your key`);
if (!rawApiKey)         logger.error(`❌ No API key! Add GROQ_API_KEY=gsk_... to backend/.env`);
logger.info(`=========================`);

// ── OpenAI-compatible client ─────────────────────────────────────────────────
// Works with both Groq and OpenRouter — same SDK, different baseURL + key
export const openai = new OpenAI({
  baseURL: isGroq ? 'https://api.groq.com/openai/v1' : 'https://openrouter.ai/api/v1',
  apiKey : rawApiKey,
  defaultHeaders: isGroq ? {} : {
    'HTTP-Referer': env.SITE_URL,
    'X-Title'     : 'Workforce Pulse',
  },
});

// ── Model fallback chain ─────────────────────────────────────────────────────
// Live-tested on 2026-08-28 via Groq /v1/models + /v1/chat/completions
//
// DECOMMISSIONED (do NOT use — absent from Groq API):
//   llama-3.3-70b-versatile, llama-3.1-8b-instant, gemma2-9b-it, mixtral-8x7b-32768
//
// ACTIVE + TOOL-CALLING VERIFIED:
//   qwen/qwen3.8-27b  ✅  tool calls + streaming text both confirmed
//
// ACTIVE BUT BROKEN for tool calls:
//   openai/gpt-oss-20b, openai/gpt-oss-120b — return empty content
//   qwen/qwen3.6-27b                        — leaks <think> tags
//   groq/compound, groq/compound-mini       — 400 on tool_choice
export const MODELS: string[] = isGroq ? [
  'qwen/qwen3.8-27b',     // ✅ PRIMARY — tool calls + streaming verified live
  'openai/gpt-oss-120b',  // ⚠️  FALLBACK — 131k ctx (may return empty, auto-skipped)
  'openai/gpt-oss-20b',   // ⚠️  FALLBACK — 131k ctx (may return empty, auto-skipped)
] : [
  // OpenRouter emergency fallback — only used when GROQ_API_KEY is missing
  'minimax/minimax-m3:free',                 // ✅ Tool calls verified
  'nvidia/nemotron-3-super-120b-a12b:free', // ✅ Tool calls verified
  'inclusionai/ling-3.0-flash-fin:free',    // ✅ Tool calls verified
];

