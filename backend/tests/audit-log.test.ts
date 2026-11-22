import { describe, expect, it, vi } from 'vitest';
import { logAudit } from '@services/auditLog';

describe('logAudit', () => {
  it('writes tenant, actor, event details, and request IP', async () => {
    const insert = vi.fn().mockResolvedValue([]);
    const db = vi.fn(() => ({ insert }));

    await logAudit(db as any, {
      user: { tenant_id: 'tenant-1', user_id: 'user-1' },
      ip: '192.0.2.10',
    } as any, {
      action: 'staff.created',
      entityType: 'staff',
      entityId: 'staff-1',
      newValues: { name: 'Ayu' },
    });

    expect(db).toHaveBeenCalledWith('audit_logs');
    expect(insert).toHaveBeenCalledWith({
      tenant_id: 'tenant-1',
      user_id: 'user-1',
      action: 'staff.created',
      entity_type: 'staff',
      entity_id: 'staff-1',
      old_values: null,
      new_values: { name: 'Ayu' },
      ip_address: '192.0.2.10',
    });
  });

  it('rejects writes without a tenant context', async () => {
    const db = vi.fn();

    await expect(logAudit(db as any, { user: { user_id: 'user-1' } } as any, {
      action: 'staff.created',
      entityType: 'staff',
    })).rejects.toThrow('Tenant tidak teridentifikasi untuk audit log');
    expect(db).not.toHaveBeenCalled();
  });
});
