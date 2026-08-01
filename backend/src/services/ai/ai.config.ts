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
logger.info(`Provider : ${isGroq ? '✅ GROQ  (fast LPU inference)' : '⚠️  OpenRouter (GPU shared)'}`);
logger.info(`API Key  : ${rawApiKey ? rawApiKey.slice(0, 12) + '...' + rawApiKey.slice(-4) : '❌ MISSING'}`);
logger.info(`Base URL : ${isGroq ? 'https://api.groq.com/openai/v1' : 'https://openrouter.ai/api/v1'}`);
logger.info(`Models   : ${isGroq ? 'llama-3.1-8b-instant → gemma2-9b-it → llama-3.3-70b' : 'gemini-flash → llama-8b → gpt-oss-20b...'}`);
if (!isGroq && groqKey) logger.warn(`GROQ_API_KEY found but does NOT start with "gsk_" — falling back to OpenRouter`);
if (!rawApiKey)         logger.error(`❌ No API key found! Set GROQ_API_KEY or OPENROUTER_API_KEY in .env`);
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

// ── Model fallback chains — tried in priority order ──────────────────────────
// If model i returns 429 (rate-limited), the service retries with model i+1.
export const MODELS: string[] = isGroq ? [
  'llama-3.1-8b-instant',    // ✅ 14,400 req/day — fastest, ideal for structured data
  'llama-3.3-70b-versatile', // ✅ 500 req/day — strong quality fallback
  'llama3-8b-8192',          // ✅ Stable older model, good general fallback
  'llama-3.1-70b-versatile', // ✅ High quality, lower rate limit — last resort
  // ❌ gemma2-9b-it       — decommissioned by Groq (removed)
  // ❌ mixtral-8x7b-32768 — decommissioned by Groq (removed)
] : [
  'google/gemini-flash-1.5:free',           // ~200 t/s — most reliable free model
  'meta-llama/llama-3.1-8b-instruct:free',  // ~80 t/s, small = fast
  'openai/gpt-oss-20b:free',                // Good quality, moderate speed
  'openai/gpt-oss-120b:free',               // High quality, slower
  'google/gemma-4-31b-it:free',             // Fallback
  'inclusionai/ling-3.0-flash:free',        // Fallback
  'nvidia/nemotron-3-super-120b-a12b:free', // Last resort — large model
];

