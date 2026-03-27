-- ========================================================
-- TECNOLEARN - SUPABASE SCHEMA START
-- Crie suas tabelas rodando este código no painel SQL Editor do Supabase.
-- ========================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Tabela Base: Perfis dos Usuários (Sincronizado via Triggers com o auth.users)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('aluno', 'professor', 'monitor', 'admin')) DEFAULT 'aluno',
  avatar_url TEXT,
  -- Array de 128 dimensões retornado pelo Face-API.js (Float32Array)
  face_descriptor REAL[], 
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Turmas (Classes)
CREATE TABLE classes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Matriculas em Turmas (Class Enrollments)
CREATE TABLE class_enrollments (
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  student_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (class_id, student_id)
);

-- 4. Trilhas de Aprendizagem (Learning Trails)
CREATE TABLE learning_trails (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  subject TEXT NOT NULL,
  bimestre INT NOT NULL,
  published BOOLEAN DEFAULT false,
  thumbnail_url TEXT,
  author_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Nós/Aulas da Trilha (Trail Nodes)
CREATE TABLE trail_nodes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trail_id UUID REFERENCES learning_trails(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('video', 'texto', 'atividade')),
  description TEXT,
  -- URL apontando para o arquivo no Supabase Storage
  content_url TEXT, 
  duration TEXT, -- ex: "12 min"
  order_index INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Progresso do Aluno nos Tópicos
CREATE TABLE student_progress (
  student_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  node_id UUID REFERENCES trail_nodes(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('locked', 'in-progress', 'completed')) DEFAULT 'locked',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (student_id, node_id)
);

-- 7. Histórico e Controles de Chamada (Attendance)
CREATE TABLE attendance_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  recorded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE attendance_entries (
  record_id UUID REFERENCES attendance_records(id) ON DELETE CASCADE,
  student_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('presente', 'ausente', 'pendente')) DEFAULT 'pendente',
  PRIMARY KEY (record_id, student_id)
);

-- 8. Blacklist de Segurança Biométrica
CREATE TABLE security_blacklist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  reason TEXT NOT NULL,
  face_descriptor REAL[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Configurações Globais (Armazenamento Seguro do OpenRouter, UI config)
CREATE TABLE platform_configs (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);


-- ========================================================
-- OPTE POR AUTOMATIZAR A CRIAÇÃO DE PERFIS
-- Trigger para criar 'profile' vazio quando novo usuário de 'auth' é inserido
-- ========================================================

CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', COALESCE(new.raw_user_meta_data->>'role', 'aluno'));
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

  
-- ========================================================
-- RLS - ROW LEVEL SECURITY (Opcional, mas Altamente Recomendado)
-- Para uso direto com Front-end (Browser APIs do Supabase)
-- ========================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_trails ENABLE ROW LEVEL SECURITY;
ALTER TABLE trail_nodes ENABLE ROW LEVEL SECURITY;

-- Políticas Livres para Leitura aos Autenticados
CREATE POLICY "Leitura livre de dados base" ON profiles FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Leitura de turmas para autenticados" ON classes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Leitura de trilhas para autenticados" ON learning_trails FOR SELECT TO authenticated USING (true);
CREATE POLICY "Leitura de conteúdo para autenticados" ON trail_nodes FOR SELECT TO authenticated USING (true);

-- Matriculas e Presenças
ALTER TABLE class_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leitura de matriculas para autenticados" ON class_enrollments FOR SELECT TO authenticated USING (true);

ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leitura de chamadas para autenticados" ON attendance_records FOR SELECT TO authenticated USING (true);
CREATE POLICY "Inserção de chamadas para autenticados" ON attendance_records FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Atualização de chamadas para autenticados" ON attendance_records FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE attendance_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leitura de entradas para autenticados" ON attendance_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "Inserção de entradas para autenticados" ON attendance_entries FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Atualização de entradas para autenticados" ON attendance_entries FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Professores/Admins podem persistir novas trilhas e conteudos
-- NOTA: Validar Roles via RLS exige checagem na tabela profiles ou Claims em JWT personalizado
-- A abordagem base abaixo permite INSERT apenas se autenticado, a camada Middleware no Next/React trata de "UI guards". 
-- (Numa build Enterprise severa: adicionar inner join no RLS `WHERE (SELECT role FROM profiles WHERE id = auth.uid()) IN ('professor', 'admin')`)
CREATE POLICY "Professores podem Inserir Trilhas" ON learning_trails FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Professores podem Inserir Topicos" ON trail_nodes FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Políticas de Edição e Exclusão
CREATE POLICY "Professores podem Deletar suas Trilhas" ON learning_trails FOR DELETE USING (auth.role() = 'authenticated');
CREATE POLICY "Professores podem Atualizar suas Trilhas" ON learning_trails FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Professores podem Deletar Topicos" ON trail_nodes FOR DELETE USING (auth.role() = 'authenticated');
CREATE POLICY "Professores podem Atualizar Topicos" ON trail_nodes FOR UPDATE USING (auth.role() = 'authenticated');

-- Políticas para student_progress
ALTER TABLE student_progress ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Estudantes podem ver seu próprio progresso" ON student_progress;
DROP POLICY IF EXISTS "Estudantes podem atualizar seu próprio progresso" ON student_progress;
DROP POLICY IF EXISTS "Estudantes podem modificar seu próprio progresso" ON student_progress;

CREATE POLICY "Gerenciar proprio progresso" ON student_progress
FOR ALL
TO authenticated
USING (auth.uid() = student_id)
WITH CHECK (auth.uid() = student_id);

-- ========================================================
-- SUPABASE STORAGE (Para hospedar os Vídeos "useMediaRecorder")
-- ========================================================
-- Lembrete: O Bucket "course-contents" precisa ser criado nas configurações do painel ou usando Query:
insert into storage.buckets (id, name, public) values ('course-contents', 'course-contents', false);

-- Apenas Autenticados podem ler ou gravar mídias:
CREATE POLICY "Acesso as mídias para estudantes" ON storage.objects FOR SELECT USING (bucket_id = 'course-contents' AND auth.role() = 'authenticated');
CREATE POLICY "Professores podem fazer upload de vídeo" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'course-contents' AND auth.role() = 'authenticated');

-- ========================================================
-- AUDITORIA DE CHAMADA (Logs de Alteração)
-- ========================================================
CREATE TABLE attendance_change_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    record_id UUID REFERENCES attendance_records(id) ON DELETE CASCADE,
    student_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    changed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    old_status TEXT,
    new_status TEXT,
    justification TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE attendance_change_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leitura de logs para professores e admins" ON attendance_change_logs
FOR SELECT TO authenticated USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() AND role IN ('professor', 'admin')
    )
);

CREATE POLICY "Inserção de logs para professores e admins" ON attendance_change_logs
FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() AND role IN ('professor', 'admin')
    )
);
