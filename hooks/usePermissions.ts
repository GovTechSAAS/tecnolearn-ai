import { useAuth } from './useAuth';
import { PERMISSIONS } from '@/lib/permissions';

export function usePermissions() {
  const { profile } = useAuth();
  
  return Object.fromEntries(
    Object.entries(PERMISSIONS).map(([key, roles]) => [
      key,
      roles.includes(profile?.role ?? ''),
    ])
  );
}
