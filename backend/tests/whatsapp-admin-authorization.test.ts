import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@middleware/AuthMiddleware', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@middleware/AuthMiddleware')>();
  return {
    ...actual,
    authMiddleware: (req: any, _res: any, next: () => void) => {
      req.user = { user_id: 'staff-id', tenant_id: 'tenant-id', role: req.header('x-test-role') ?? 'teknisi' };
      next();
    },
  };
});

vi.mock('@middleware/TenantResolver', () => ({
  tenantResolver: (_req: any, _res: any, next: () => void) => next(),
  reqDb: () => { throw new Error('Role lain tidak boleh mencapai query tenant'); },
}));

import { whatsappRouter } from '../src/api/whatsapp';

describe('WhatsApp admin endpoints', () => {
  it('rejects a non-admin at the backend before reaching tenant data', async () => {
    const app = express();
    app.use('/api/whatsapp', whatsappRouter);

    const response = await request(app).get('/api/whatsapp/status').set('x-test-role', 'teknisi');

    expect(response.status).toBe(403);
    expect(response.body.error).toContain('Role');
  });
});
