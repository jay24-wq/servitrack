import 'dotenv/config';
import { migrateLatest, migrateLatestWithTimeout } from 'knex-migrator';
import { migrate as knexMigrate } from 'knex';
import db from '../src/models/index';

// Setup: migrate up to latest before all tests
export async function setupTestDatabase() {
  // Pastikan migration sudah diterapkan (run knex migrate:latest ke DB test)
  // File ini dipanggil sebelum test, migrasi dulu
  const ran = await knexMigrate.latest({
    client: 'pg',
    connection: {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_TEST_NAME || 'servitrack_test',
    },
  });
  return ran;
}

// Cleanup: rollback everything after all tests  
export async function cleanupTestDatabase() {
  await knexMigrate.rollback({
    client: 'pg',
    connection: {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_TEST_NAME || 'servitrack_test',
    },
  });
}

// Terima db ter-test (menggantikan db utama)
// Untuk menghindari membuat db baru setiap test, kita pakai transaction per test
export async function withTransaction<T>(fn: (trx: any) => Promise<T>): Promise<T> {
  const trx = db.transaction();
  try {
    const result = await fn(trx);
    await trx.rollback();  // Rollback setelah test -> data tidak ke DB
    return result;
  } catch (e) {
    await trx.rollback();
    throw e;
  }
}
