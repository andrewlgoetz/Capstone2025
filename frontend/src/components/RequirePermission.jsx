import { useAuth } from '../contexts/AuthContext';
import { Alert } from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';

/**
 * Wrapper component that checks if user has required permission(s).
 * Shows access denied message if permission check fails.
 *
 * Usage:
 *   <RequirePermission permission="inventory:view">
 *     <InventoryTable />
 *   </RequirePermission>
 *
 *   <RequirePermission permission={["inventory:view", "reports:view"]} requireAll={false}>
 *     <SomeComponent />
 *   </RequirePermission>
 */
export default function RequirePermission({
  permission,
  requireAll = true,
  fallback = null,
  children
}) {
  const { hasPermission, loading } = useAuth();

  if (loading) return null;

  const permissions = Array.isArray(permission) ? permission : [permission];
  const hasAccess = requireAll
    ? permissions.every(p => hasPermission(p))
    : permissions.some(p => hasPermission(p));

  if (!hasAccess) {
    if (fallback) return fallback;

    return (
      <Alert
        severity="warning"
        icon={<LockIcon />}
        sx={{
          display: 'flex',
          alignItems: 'center',
          backgroundColor: '#fef3c7',
          color: '#92400e'
        }}
      >
        You do not have permission to access this feature.
      </Alert>
    );
  }

  return children;
}

/**
 * Hook for checking permissions in component logic.
 *
 * Usage:
 *   const canEdit = useHasPermission('inventory:edit');
 *   if (canEdit) { ... }
 */
export function useHasPermission(permission) {
  const { hasPermission } = useAuth();
  const permissions = Array.isArray(permission) ? permission : [permission];
  return permissions.every(p => hasPermission(p));
}
