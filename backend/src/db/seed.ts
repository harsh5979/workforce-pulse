import { runIngestion } from '../services/ingestion/joiner';
import { pool } from '../config/db';
import { logger } from '../utils/logger';
import { initDatabaseAndTables } from './init';
import bcrypt from 'bcryptjs';

async function seedUsers() {
  logger.info('👤 Seeding admin user...');
  const checkAdmin = await pool.query("SELECT id FROM users WHERE email = 'admin@workforcepulse.com'");
  if (checkAdmin.rowCount === 0) {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash('admin', salt);
    await pool.query(
      "INSERT INTO users (email, password_hash, role) VALUES ($1, $2, 'admin')",
      ['admin@workforcepulse.com', hash]
    );
    logger.info('✅ Admin user created successfully.');
  } else {
    logger.info('✅ Admin user already exists.');
  }
}

async function seed() {
  logger.info('🌱 Starting database seed script via ingestion pipeline...');
  try {
    await initDatabaseAndTables();
    await seedUsers();
    const result = await runIngestion();
    logger.info('✅ Database seeded successfully with normalized logs!');
    logger.info(`Stats: ${JSON.stringify(result.stats, null, 2)}`);
  } catch (err) {
    logger.error('❌ Seeding failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();

