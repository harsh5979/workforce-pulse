import { z } from 'zod';
import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Look for .env in current directory, backend directory, or project root
const envPaths = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(__dirname, '../../.env'),
  path.resolve(__dirname, '../../../.env'),
];

for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override: false });
  }
}

const envSchema = z.object({
  DATABASE_URL: z.string().default('postgresql://postgres:postgres@localhost:5432/workforce'),
  OPENROUTER_API_KEY: z.string().default('sk-or-v1-placeholder-key'),
  GROQ_API_KEY: z.string().optional(),
  PORT: z.coerce.number().default(5000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  SITE_URL: z.string().url().default('http://localhost:3000'),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error('❌ Invalid environment variables:');
  console.error(_env.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = _env.data;
