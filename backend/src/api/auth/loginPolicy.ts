export type LoginPortal = 'admin' | 'staff';

const PORTAL_ROLES: Record<LoginPortal, Set<string>> = {
  // Tenant owners are stored with the `admin` role by the registration flow.
  admin: new Set(['admin']),
  staff: new Set(['frontdesk', 'teknisi', 'kurir']),
};

export function getPortalRoleError(portal: LoginPortal, role: string): string | null {
  if (PORTAL_ROLES[portal].has(role.trim().toLowerCase())) return null;
  return portal === 'staff' ? 'Silakan gunakan Portal Admin.' : 'Silakan gunakan Portal Staff.';
}
