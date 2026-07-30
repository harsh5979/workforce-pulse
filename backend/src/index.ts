import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';

// Load and validate env vars first — crashes if invalid
import { env } from './config/env';
import { logger } from './utils/logger';

// Routes
import ingestRoutes    from './routes/ingest.routes';
import dashboardRoutes from './routes/dashboard.routes';
import employeeRoutes  from './routes/employees.routes';
import categoryRoutes  from './routes/categories.routes';
import trendsRoutes    from './routes/trends.routes';
import anomalyRoutes   from './routes/anomalies.routes';
import aiRoutes        from './routes/ai.routes';
import authRoutes      from './routes/auth.routes';

const app = express();

// Trust reverse proxy (Nginx) for accurate IP rate limiting
app.set('trust proxy', 1);

// ─── Security & Logging ───────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));

// ─── CORS ─────────────────────────────────────────────────────────
app.use(cors({
  origin: [env.SITE_URL, 'http://localhost:3000', 'http://localhost:3001'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}));

// ─── Body Parser ──────────────────────────────────────────────────
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ─── Rate Limiting ────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use(limiter);

// AI endpoint has a separate, stricter limit
const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20,
  message: { error: 'AI rate limit exceeded. Please wait before sending another message.' },
});

// ─── Routes ───────────────────────────────────────────────────────
app.use('/api/ingest',     ingestRoutes);
app.use('/api/dashboard',  dashboardRoutes);
app.use('/api/employees',  employeeRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/trends',     trendsRoutes);
app.use('/api/anomalies',  anomalyRoutes);
app.use('/api/ai',         aiLimiter, aiRoutes);
app.use('/api/auth',       authRoutes);

// ─── Health Check ─────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), env: env.NODE_ENV });
});

// ─── 404 ──────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// ─── Global Error Handler ─────────────────────────────────────────
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    error: env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
});

// ─── Start Server ─────────────────────────────────────────────────
import { initDatabaseAndTables } from './db/init';

app.listen(env.PORT, async () => {
  logger.info(`🚀 Workforce Pulse API running on port ${env.PORT}`);
  logger.info(`🌍 Environment: ${env.NODE_ENV}`);
  logger.info(`📊 Health: http://localhost:${env.PORT}/api/health`);
  try {
    await initDatabaseAndTables();
    logger.info(`🚀 Automated DB synchronization complete.`);
  } catch (err: any) {
    logger.warn(`⚠️ Automatic DB init check skipped or failed: ${err.message}`);
  }
});

export default app;

