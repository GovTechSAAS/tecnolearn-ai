export const PERMISSIONS = {
  canCreateContent: ['professor', 'admin'],
  canManageSecurity: ['monitor', 'admin'],
  canTakeAttendance: ['professor', 'monitor', 'admin'],
  canManageConfig: ['admin'],
  canCreateTrails: ['professor', 'admin'],
  canViewChat: ['aluno', 'professor', 'admin', 'monitor'],
  canManageClasses: ['admin'],
} satisfies Record<string, string[]>;
