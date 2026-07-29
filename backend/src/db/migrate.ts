import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db, pool } from '../config/db';
import path from 'path';

async function runMigrations() {
  console.log('🗄️  Running database migrations...');
  try {
    await migrate(db, {
      migrationsFolder: path.resolve(__dirname, './migrations'),
    });
    console.log('✅ Migrations complete');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations();
