import { beforeAll, afterAll } from 'vitest';
import db from '../src/models/index';

beforeAll(async () => {
  // Global setup if needed
});

afterAll(async () => {
  await db.destroy();
});
