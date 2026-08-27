import OpenAI from 'openai';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';

// ── Provider selection: Groq takes priority over OpenRouter ──────────────────
const groqKey       = env.GROQ_API_KEY;
const openrouterKey = env.OPENROUTER_API_KEY;
export const isGroq = Boolean(groqKey && groqKey.startsWith('gsk_'));
const rawApiKey     = isGroq ? groqKey! : openrouterKey;

// ── Startup diagnostics ───────────────────────────────────────────────────────
logger.info(`=== AI SERVICE STARTUP ===`);
logger.info(`Provider : ${isGroq ? '✅ GROQ (qwen3.8-27b — LPU inference)' : '⚠️  OpenRouter (fallback)'}`);
logger.info(`API Key  : ${rawApiKey ? rawApiKey.slice(0, 12) + '...' + rawApiKey.slice(-4) : '❌ MISSING — add GROQ_API_KEY=gsk_... to backend/.env'}`);
if (!isGroq && groqKey) logger.warn(`GROQ_API_KEY does NOT start with "gsk_" — check your key`);
if (!rawApiKey)         logger.error(`❌ No API key! Add GROQ_API_KEY=gsk_... to backend/.env`);
logger.info(`=========================`);

// ── OpenAI-compatible client ──────────────────────────────────────────────────
// maxRetries=0: we handle retries ourselves across models in ai.service.ts
// timeout=20s: generous for streaming but avoids hanging forever on Groq LPU
export const openai = new OpenAI({
  baseURL    : isGroq ? 'https://api.groq.com/openai/v1' : 'https://openrouter.ai/api/v1',
  apiKey     : rawApiKey,
  maxRetries : 0,      // manual per-model fallback in ai.service.ts
  timeout    : 20_000, // 20 s — Groq LPU is fast; this avoids silent hangs
  defaultHeaders: isGroq ? {} : {
    'HTTP-Referer': env.SITE_URL,
    'X-Title'     : 'Workforce Pulse',
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// MODEL LISTS — Live-tested 2026-08-28 against Groq /v1/models + completions
//
// DECOMMISSIONED on Groq (DO NOT USE — return 404):
//   llama-3.3-70b-versatile · llama-3.1-8b-instant · gemma2-9b-it · mixtral-8x7b-32768
// ─────────────────────────────────────────────────────────────────────────────

// ── STEP 1: Tool-intent resolution — requires tool_choice support ─────────────
// Live test result: ONLY qwen/qwen3.8-27b supports tool_choice=auto on Groq.
// All others either 400, return empty content, or leak <think> tags.
export const TOOL_MODELS: string[] = isGroq ? [
  'qwen/qwen3.8-27b',   // ✅ 131k ctx — only Groq model with verified tool_choice
] : [
  'minimax/minimax-m3:free',                 // ✅ OpenRouter fallback — tool_choice verified
  'nvidia/nemotron-3-super-120b-a12b:free', // ✅ tool_choice verified
  'inclusionai/ling-3.0-flash-fin:free',    // ✅ tool_choice verified
];

// ── STEP 3 / Fast-path: Plain text streaming — no tool_choice needed ──────────
// gpt-oss models produce clean markdown with no reasoning token leaks.
// qwen3.8 kept first for best quality; gpt-oss as fast text-only fallback.
export const TEXT_MODELS: string[] = isGroq ? [
  'qwen/qwen3.8-27b',    // ✅ Best quality — no <think> leak in text mode
  'openai/gpt-oss-120b', // ✅ Fast formatter — 131k ctx, clean markdown
  'openai/gpt-oss-20b',  // ✅ Fast formatter — 131k ctx, clean markdown
] : [
  'minimax/minimax-m3:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
  'inclusionai/ling-3.0-flash-fin:free',
];

// Backward-compat alias — Step 1 loop in ai.service.ts uses MODELS
export const MODELS = TOOL_MODELS;

// ── Token budgets (enforced in ai.service.ts) ────────────────────────────────
// Step 1  — tool call JSON is short; cap hard to kill idle reasoning tokens
export const MAX_TOKENS_STEP1 = 80;
// Step 3 / Fast-path — markdown table + 3 chips rarely exceeds 400 tokens
export const MAX_TOKENS_STEP3 = 450;
export const MAX_TOKENS_FASTPATH = 400;
