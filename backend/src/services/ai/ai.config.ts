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
//
// ✅ GROQ model IDs — official per console.groq.com/docs/models
//    Requires GROQ_API_KEY=gsk_... in .env
export const MODELS: string[] = isGroq ? [
  'llama-3.3-70b-versatile',  // ✅ Best quality — full tool-calling, 128k ctx
  'llama-3.1-8b-instant',     // ✅ Ultra-fast LPU fallback
  'gemma2-9b-it',             // ✅ Google Gemma2 fallback
  'mixtral-8x7b-32768',       // ✅ Large context fallback (32k)
] : [
  // ✅ OpenRouter FREE models — verified live 2026-08-28 via /api/v1/models
  //    All support tool_choice (confirmed via supported_parameters field)
  'nvidia/nemotron-3-ultra-550b-a55b:free',  // 550B — highest quality free model
  'minimax/minimax-m3:free',                  // 1M ctx — great for long context
  'nvidia/nemotron-3-super-120b-a12b:free',  // 120B — strong reasoning
  'google/gemma-4-31b-it:free',              // 262k ctx — Google Gemma4
  'inclusionai/ling-3.0-flash-fin:free',     // Fast financial/analytical model
  'z-ai/glm-5.2:free',                       // 256k ctx fallback
];

