import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const routeMocks = vi.hoisted(() => ({
  getRoute: vi.fn(),
  assignment: {
    id: 'assignment-1', tenant_id: 'tenant-a', branch_id: 'branch-a', courier_id: 'courier-a',
    assignment_type: 'pickup', status: 'KURIR_DITUGASKAN', device_picked_up: false,
    customer_name: 'Pelanggan', customer_address: 'Alamat pelanggan', customer_latitude: -8.65, customer_longitude: 115.21,
    branch_name: 'Toko', branch_address: 'Alamat toko', store_latitude: -8.7, store_longitude: 115.2,
  },
}));

vi.mock('@middleware/AuthMiddleware', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@middleware/AuthMiddleware')>();
  return {
    ...actual,
    authMiddleware: (req: any, _res: any, next: () => void) => {
      req.user = {
        user_id: req.header('x-test-courier') || 'courier-a',
        tenant_id: 'tenant-a',
        branch_id: 'branch-a',
        email: 'courier@example.test',
        role: req.header('x-test-role') || 'kurir',
      };
      next();
    },
    branchResolver: (_req: any, _res: any, next: () => void) => next(),
  };
});

vi.mock('@middleware/TenantResolver', () => ({
  tenantResolver: (_req: any, _res: any, next: () => void) => next(),
  reqDb: () => {
    const builder: any = {
      filters: {},
      join: () => builder,
      leftJoin: () => builder,
      select: () => builder,
      where: (filters: Record<string, unknown>) => { builder.filters = filters; return builder; },
      first: async () => {
        const task = routeMocks.assignment;
        return builder.filters['ca.id'] === task.id
          && builder.filters['ca.tenant_id'] === task.tenant_id
          && builder.filters['ca.branch_id'] === task.branch_id
          && builder.filters['ca.courier_id'] === task.courier_id
          ? task
          : undefined;
      },
    };
    return Object.assign(() => builder, { raw: () => ({}) });
  },
}));

vi.mock('@services/osrmRouting', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@services/osrmRouting')>();
  return { ...actual, getCourierRoute: routeMocks.getRoute };
});

import { courierRouter } from '../src/api/courier';

describe('courier route authorization', () => {
  beforeEach(() => routeMocks.getRoute.mockReset().mockResolvedValue({
    geometry: { type: 'LineString', coordinates: [[115.2, -8.7], [115.21, -8.65]] },
    distance: 2345,
    duration: 480,
  }));

  it('serves the assigned task route and rejects a different courier before OSRM is called', async () => {
    const app = express();
    app.use('/api/courier', courierRouter);

    const ownRoute = await request(app).get('/api/courier/assignments/assignment-1/route');
    expect(ownRoute.status).toBe(200);
    expect(routeMocks.getRoute).toHaveBeenCalledWith('courier-a',
      { latitude: -8.7, longitude: 115.2 }, { latitude: -8.65, longitude: 115.21 });

    routeMocks.getRoute.mockClear();
    const otherCourier = await request(app).get('/api/courier/assignments/assignment-1/route').set('x-test-courier', 'courier-b');
    expect(otherCourier.status).toBe(404);
    expect(routeMocks.getRoute).not.toHaveBeenCalled();
  });
});
