-- ========================================================
-- SISTEMA DE QUIZZES (KAHOOT STYLE)
-- ========================================================

-- 1. Tabela Principal de Quizzes
CREATE TABLE quizzes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  author_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  share_code TEXT UNIQUE, -- Código curto como PIN (ex: "748921")
  is_published BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Perguntas do Quiz
CREATE TABLE quiz_questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE,
  title TEXT NOT NULL, -- Texto da pergunta
  time_limit INT DEFAULT 20, -- Em segundos
  points INT DEFAULT 1000, -- Base fixa para o Kahoot
  order_index INT NOT NULL,
  image_url TEXT, -- Opcional
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Alternativas (Opções)
CREATE TABLE quiz_options (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question_id UUID REFERENCES quiz_questions(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  is_correct BOOLEAN DEFAULT false,
  color_hex TEXT, -- Para o visual do Kahoot (Vermelho, Azul, Amarelo, Verde)
  shape TEXT, -- Ex: 'triangle', 'diamond', 'circle', 'square'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Sessão (Partida Ativa)
CREATE TABLE quiz_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE,
  host_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('waiting', 'active', 'finished')) DEFAULT 'waiting',
  current_question_id UUID REFERENCES quiz_questions(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Participantes da Partida
CREATE TABLE quiz_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES quiz_sessions(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- Apelido do jogador
  score INT DEFAULT 0,
  joined_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Respostas (Logs)
CREATE TABLE quiz_answers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES quiz_sessions(id) ON DELETE CASCADE,
  participant_id UUID REFERENCES quiz_participants(id) ON DELETE CASCADE,
  question_id UUID REFERENCES quiz_questions(id) ON DELETE CASCADE,
  option_id UUID REFERENCES quiz_options(id) ON DELETE CASCADE,
  is_correct BOOLEAN DEFAULT false,
  points_earned INT DEFAULT 0,
  answered_at TIMESTAMPTZ DEFAULT NOW(),
  -- Garantir que cada participante responda apenas uma vez por pergunta
  UNIQUE(participant_id, question_id)
);


-- ========================================================
-- RLS (ROW LEVEL SECURITY)
-- ========================================================

ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_answers ENABLE ROW LEVEL SECURITY;

-- QUIZZES (Professor gerencia os seus, aluno lê se publicado ou convocado)
CREATE POLICY "Leitura de quizzes publicados ou próprios" ON quizzes
FOR SELECT TO authenticated USING (is_published = true OR auth.uid() = author_id);
CREATE POLICY "Criar quizzes" ON quizzes FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Atualizar próprios quizzes" ON quizzes FOR UPDATE TO authenticated USING (auth.uid() = author_id);
CREATE POLICY "Deletar próprios quizzes" ON quizzes FOR DELETE TO authenticated USING (auth.uid() = author_id);

-- QUESTIONS & OPTIONS (Livres para leitura via quiz_id, professor gerencia as suas)
CREATE POLICY "Leitura de perguntas" ON quiz_questions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Gerenciar perguntas" ON quiz_questions FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM quizzes WHERE quizzes.id = quiz_questions.quiz_id AND quizzes.author_id = auth.uid())
);

CREATE POLICY "Leitura de opções" ON quiz_options FOR SELECT TO authenticated USING (true);
CREATE POLICY "Gerenciar opções" ON quiz_options FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM quiz_questions JOIN quizzes ON quiz_questions.quiz_id = quizzes.id WHERE quiz_questions.id = quiz_options.question_id AND quizzes.author_id = auth.uid())
);

-- SESSIONS (Livres leitura via share_code ou se for o host. Host gerencia)
-- Para participantes anônimos, usaremos public policies (pois eles não tem auth.uid())
CREATE POLICY "Allow public read sessions" ON quiz_sessions FOR SELECT USING (true);
CREATE POLICY "Host gerencia sessões" ON quiz_sessions FOR ALL TO authenticated USING (auth.uid() = host_id);

-- PARTICIPANTS (Leitura pública, inserção pública)
CREATE POLICY "Allow public read participants" ON quiz_participants FOR SELECT USING (true);
CREATE POLICY "Allow public insert participants" ON quiz_participants FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update participants" ON quiz_participants FOR UPDATE USING (true);

-- ANSWERS (Leitura pública associada a session, Inserção pública)
CREATE POLICY "Allow public read answers" ON quiz_answers FOR SELECT USING (true);
CREATE POLICY "Allow public insert answers" ON quiz_answers FOR INSERT WITH CHECK (true);

-- ========================================================
-- CONFIGURACAO DO SUPABASE REALTIME
-- ========================================================
-- Você precisará rodar isso caso ainda não tenha ativado o realtime:
-- (A tabela `quiz_sessions` e `quiz_participants` precisam emitir os eventos de Update e Insert)
ALTER PUBLICATION supabase_realtime ADD TABLE quiz_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE quiz_participants;
