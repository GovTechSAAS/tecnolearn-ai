export type UserRole = 'aluno' | 'professor' | 'admin' | 'monitor';

export type Profile = {
  id: string;
  full_name: string;
  role: UserRole;
  avatar_url?: string;
};

export type Trail = {
  id: string;
  title: string;
  subject_id: string;
  bimestre: number;
  is_published: boolean;
};

export type TrailNode = {
  id: string;
  trail_id: string;
  title: string;
  content_type: 'video' | 'pdf' | 'texto' | 'atividade';
  order_index: number;
  prerequisite_node_id?: string;
};

export type AttendanceStatus = 'presente' | 'ausente' | 'justificado';

export type SecurityListType = 'whitelist' | 'blacklist';
