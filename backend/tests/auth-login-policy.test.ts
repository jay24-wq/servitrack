import { describe, expect, it } from 'vitest';
import { getPortalRoleError } from '../src/api/auth/loginPolicy';

describe('login portal role policy', () => {
  it.each(['admin', 'ADMIN'])('allows %s in the admin portal', (role) => {
    expect(getPortalRoleError('admin', role)).toBeNull();
  });

  it.each(['frontdesk', 'teknisi', 'kurir'])('allows %s in the staff portal', (role) => {
    expect(getPortalRoleError('staff', role)).toBeNull();
  });

  it.each(['frontdesk', 'teknisi', 'kurir'])('rejects %s from the admin portal', (role) => {
    expect(getPortalRoleError('admin', role)).toBe('Silakan gunakan Portal Staff.');
  });

  it('rejects an admin from the staff portal with the requested guidance', () => {
    expect(getPortalRoleError('staff', 'admin')).toBe('Silakan gunakan Portal Admin.');
  });
});
