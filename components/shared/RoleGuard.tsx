"use client";

import { ReactNode } from 'react';
import { usePermissions } from '@/hooks/usePermissions';

export function RoleGuard({ 
  requiredPermission, 
  children, 
  fallback = null 
}: { 
  requiredPermission: string; 
  children: ReactNode; 
  fallback?: ReactNode;
}) {
  const permissions = usePermissions();
  
  // se permissions conter a chave necessária e for true
  const hasAccess = permissions[requiredPermission] === true;

  if (!hasAccess) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
