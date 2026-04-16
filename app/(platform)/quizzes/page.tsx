"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { createClient } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Gamepad2, Loader2, AlertCircle, Edit, Trash2, Play } from 'lucide-react';
import { toast } from 'sonner';

type Quiz = {
  id: string;
  title: string;
  description: string;
  share_code: string;
  is_published: boolean;
  created_at: string;
};

export default function QuizzesPage() {
  const permissions = usePermissions();
  const { profile, loading: authLoading } = useAuth();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchQuizzes() {
      if (authLoading) return;
      if (!permissions.canManageQuizzes) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const supabase = createClient();

        const { data, error } = await supabase
          .from('quizzes')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        setQuizzes(data || []);
      } catch (err: any) {
        console.error('Erro ao buscar quizzes:', err);
        setError('Não foi possível carregar os quizzes no momento.');
      } finally {
        setLoading(false);
      }
    }

    fetchQuizzes();
  }, [authLoading, profile, permissions.canManageQuizzes]);

  const handleDeleteQuiz = async (id: string, title: string) => {
    if (!confirm(`Tem certeza que deseja excluir o quiz "${title}"? Todas as perguntas e histórico serão apagados.`)) {
      return;
    }

    try {
      const supabase = createClient();
      const { error } = await supabase.from('quizzes').delete().eq('id', id);

      if (error) throw error;
      
      toast.success('Quiz excluído com sucesso.');
      setQuizzes(prev => prev.filter(q => q.id !== id));
    } catch (err: any) {
      console.error(err);
      toast.error('Erro na exclusão: ' + (err.message || 'Verifique o Console'));
    }
  };

  if (!permissions.canManageQuizzes && !loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <AlertCircle className="w-12 h-12 mb-4 text-red-500" />
        <h3 className="text-xl font-bold text-foreground">Acesso Negado</h3>
        <p>Você não tem permissão para gerenciar Quizzes.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold tracking-tight">Meus Quizzes</h1>
          <p className="text-muted-foreground mt-1">
            Crie jogos e engaje seus alunos em tempo real estilo Kahoot!.
          </p>
        </div>
        <Link href="/quizzes/novo">
          <Button className="bg-[var(--accent)] text-white hover:bg-[#D35400] shadow-md">
            <Plus className="mr-2 h-4 w-4" />
            Criar Quiz
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="w-8 h-8 animate-spin mb-4 text-[var(--primary)]" />
          <p>Carregando seus quizzes...</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-12 text-red-500 bg-red-50 dark:bg-red-950/20 rounded-xl border border-red-200 dark:border-red-900 border-dashed">
          <AlertCircle className="w-10 h-10 mb-2" />
          <p className="font-semibold">{error}</p>
        </div>
      ) : quizzes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-dashed border-border text-center px-4">
          <Gamepad2 className="w-12 h-12 mb-4 opacity-20" />
          <h3 className="text-xl font-bold text-foreground">Nenhum Quiz Criado</h3>
          <p className="mt-2 max-w-sm">
            Comece criando o seu primeiro quiz interativo para jogar com seus alunos.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {quizzes.map((quiz) => (
            <Card key={quiz.id} className="group hover:shadow-xl transition-all duration-300 border-border/50 bg-white/60 dark:bg-zinc-900/60 backdrop-blur-md overflow-hidden flex flex-col">
              <div className="h-2 w-full bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)] flex-shrink-0" />

              <CardHeader className="pb-3">
                <div className="flex justify-between items-start mb-2">
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${quiz.is_published ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800/50' : 'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700'}`}>
                    {quiz.is_published ? 'Pronto para Jogar' : 'Rascunho'}
                  </span>
                  <div className="flex items-center text-xs font-mono font-medium bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded-md text-[var(--accent)]">
                    PIN: {quiz.share_code || '---'}
                  </div>
                </div>
                <CardTitle className="text-xl group-hover:text-[var(--primary)] transition-colors">{quiz.title}</CardTitle>
                <CardDescription className="line-clamp-2 mt-2">
                  {quiz.description || 'Sem descrição.'}
                </CardDescription>
              </CardHeader>

              <CardContent className="flex-1">
                 {/* Espaço para mais infos tipo Qtd de Perguntas */}
              </CardContent>

              <CardFooter className="pt-4 border-t border-border/40 gap-2">
                <div className="flex-1">
                  <Link href={`/quizzes/${quiz.id}/host`} className="w-full block">
                    <Button disabled={!quiz.is_published} className="w-full font-bold bg-green-500 hover:bg-green-600 text-white shadow-md transition-all">
                      <Play className="mr-2 h-4 w-4 fill-current" />
                      Hospedar Jogo
                    </Button>
                  </Link>
                </div>
                <div className="flex gap-2">
                  <Link href={`/quizzes/${quiz.id}/editar`}>
                    <Button variant="outline" size="icon" className="hover:text-[var(--primary)] hover:border-[var(--primary)]">
                      <Edit className="w-4 h-4" />
                    </Button>
                  </Link>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleDeleteQuiz(quiz.id, quiz.title)}
                    className="hover:text-red-600 hover:border-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
