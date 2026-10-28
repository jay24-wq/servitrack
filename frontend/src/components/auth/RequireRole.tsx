import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore, homeForRole, type UserRole } from '../../store';

interface RequireRoleProps {
  allow: UserRole[];
  children: ReactNode;
}

/**
 * Route guard that restricts a page to one or more roles.
 * - Not authenticated -> /login
 * - Authenticated but wrong role -> redirected to the dashboard of their own role
 */
export default function RequireRole({ allow, children }: RequireRoleProps) {
  const user = useAuthStore((s) => s.user);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!allow.includes(user.role)) {
    return <Navigate to={homeForRole(user.role)} replace />;
  }

  return <>{children}</>;
}
