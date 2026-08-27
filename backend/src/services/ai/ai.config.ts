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
// If model i returns 429 (rate-limited) or fails, the service retries with model i+1.
export const MODELS: string[] = isGroq ? [
  'openai/gpt-oss-20b',     // ✅ Ultra-fast LPU inference, structured tool calls & reasoning
  'openai/gpt-oss-120b',    // ✅ Higher capacity fallback
  'groq/compound',          // ✅ Multi-model composite fallback
  'allam-2-7b',             // ✅ Fast fallback
  'qwen/qwen3.6-27b',       // ✅ Deep reasoning fallback
] : [
  'minimax/minimax-m3:free',               // ✅ Active OpenRouter free tier with full tool-calling
  'inclusionai/ling-3.0-flash-fin:free',  // ✅ High speed financial/analytical free model
  'google/gemma-4-31b-it:free',            // ✅ Google Gemma-4 free model
  'google/gemma-4-26b-a4b-it:free',        // ✅ Google Gemma-4 fast free model
  'z-ai/glm-5.2:free',                     // ✅ GLM-5 free model
  'liquid/lfm-2.5-2.6b:free',              // ✅ Fast compact fallback
];

