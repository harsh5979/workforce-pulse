import { Client } from 'pg';
import { env } from '../config/env';
import { logger } from '../utils/logger';

export async function initDatabaseAndTables(): Promise<void> {
  const targetUrl = env.DATABASE_URL;
  let dbName = 'workforce';
  let adminUrl = targetUrl;

  try {
    const urlObj = new URL(targetUrl);
    dbName = urlObj.pathname.replace(/^\//, '') || 'workforce';
    urlObj.pathname = '/postgres'; // default PostgreSQL admin database
    adminUrl = urlObj.toString();
  } catch (e) {
    logger.warn('Could not parse DATABASE_URL with URL API, falling back to string manipulation');
    adminUrl = targetUrl.replace(/\/[^\/]+$/, '/postgres');
  }

  // 1. Ensure database exists via admin connection
  const adminClient = new Client({ connectionString: adminUrl, connectionTimeoutMillis: 5000 });
  try {
    await adminClient.connect();
    const checkRes = await adminClient.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
    if (checkRes.rowCount === 0) {
      logger.info(`🗄️ Database '${dbName}' not found. Automatically creating database...`);
      await adminClient.query(`CREATE DATABASE "${dbName}"`);
      logger.info(`🎉 Successfully created database '${dbName}'!`);
    } else {
      logger.info(`✅ Database '${dbName}' exists and is reachable.`);
    }
  } catch (err: any) {
    logger.error(`❌ Could not verify/create database via admin url: ${err.message}`);
    throw err;
  } finally {
    await adminClient.end().catch(() => {});
  }

  // 2. Connect to target database and ensure schema tables exist
  const appClient = new Client({ connectionString: targetUrl, connectionTimeoutMillis: 5000 });
  try {
    await appClient.connect();
    logger.info('📦 Initializing PostgreSQL tables if not present...');

    await appClient.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'admin',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS employees (
        employee_id VARCHAR(20) PRIMARY KEY,
        full_name VARCHAR(100),
        department VARCHAR(50),
        role VARCHAR(100),
        tenure_years NUMERIC(4, 1),
        comp_annual_inr NUMERIC(14, 2),
        comp_source VARCHAR(20),
        working_hours_day INTEGER DEFAULT 8,
        status VARCHAR(20) DEFAULT 'active',
        terminated_on DATE,
        has_activity BOOLEAN DEFAULT TRUE,
        has_metadata BOOLEAN DEFAULT TRUE,
        raw_data JSONB
      );

      CREATE TABLE IF NOT EXISTS activity_logs (
        id SERIAL PRIMARY KEY,
        employee_id VARCHAR(20) NOT NULL REFERENCES employees(employee_id) ON DELETE CASCADE,
        department VARCHAR(50),
        timestamp_ist TIMESTAMPTZ NOT NULL,
        week_number INTEGER NOT NULL,
        app_used VARCHAR(100),
        task_category VARCHAR(100),
        duration_min NUMERIC(8, 2) NOT NULL,
        is_repetitive BOOLEAN NOT NULL,
        raw_is_repetitive VARCHAR(30),
        ingestion_flags TEXT[] DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS ingestion_runs (
        id SERIAL PRIMARY KEY,
        run_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        rows_activity_raw INTEGER DEFAULT 0,
        rows_activity_clean INTEGER DEFAULT 0,
        rows_dropped INTEGER DEFAULT 0,
        rows_fixed INTEGER DEFAULT 0,
        rows_flagged INTEGER DEFAULT 0,
        employees_no_meta INTEGER DEFAULT 0,
        metadata_no_activity INTEGER DEFAULT 0,
        duplicate_employees INTEGER DEFAULT 0,
        notes TEXT
      );
    `);
    logger.info('✅ Database schema tables verified/created successfully!');
  } catch (err: any) {
    logger.error(`❌ Table initialization failed on database '${dbName}': ${err.message}`);
    throw err;
  } finally {
    await appClient.end().catch(() => {});
  }
}
