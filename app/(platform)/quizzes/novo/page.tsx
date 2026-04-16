"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Gamepad2, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

export default function NovoQuizPage() {
  const router = useRouter();
  const { profile } = useAuth();
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  // Gera um PIN de 6 dígitos aleatório
  const generatePin = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  const handleCreateQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('O título do quiz é obrigatório.');
      return;
    }
    if (!profile?.id) {
      toast.error('Usuário não autenticado.');
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const pin = generatePin();

      const { data, error } = await supabase
        .from('quizzes')
        .insert({
          title: title.trim(),
          description: description.trim(),
          author_id: profile.id,
          share_code: pin,
          is_published: false
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Quiz criado! Agora adicione as perguntas.');
      router.push(`/quizzes/${data.id}/editar`);
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao criar quiz: ' + (err.message || 'Tente novamente.'));
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <button 
        onClick={() => router.back()}
        className="flex items-center text-sm font-medium text-muted-foreground hover:text-foreground mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        Voltar para Quizzes
      </button>

      <div className="bg-white dark:bg-zinc-950 border border-border mt-4 rounded-xl shadow-xl overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)]" />
        
        <div className="p-8">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-14 h-14 rounded-2xl bg-[var(--primary)]/10 flex items-center justify-center text-[var(--primary)]">
              <Gamepad2 className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Criar Novo Quiz</h1>
              <p className="text-muted-foreground">Configure as informações básicas do seu jogo.</p>
            </div>
          </div>

          <form onSubmit={handleCreateQuiz} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="title" className="text-sm font-semibold text-foreground">
                Título do Quiz <span className="text-red-500">*</span>
              </label>
              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Revisão de História do Brasil"
                className="flex h-12 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                maxLength={100}
                required
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="description" className="text-sm font-semibold text-foreground">
                Descrição <span className="text-muted-foreground font-normal">(Opcional)</span>
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Uma breve descrição sobre o assunto..."
                className="flex min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-y"
                maxLength={300}
              />
            </div>

            <div className="bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-xl border border-dashed border-border flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-[var(--accent)] shrink-0 mt-0.5" />
              <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Após criar as informações básicas, você será redirecionado para a tela de edição onde poderá adicionar as perguntas, definir o tempo de resposta e as alternativas corretas.
              </p>
            </div>

            <div className="pt-4 flex justify-end">
              <Button 
                type="submit" 
                size="lg" 
                className="w-full sm:w-auto bg-[var(--primary)] hover:bg-[#1A5F90] text-white shadow-lg text-base"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Criando...
                  </>
                ) : (
                  'Continuar para Perguntas'
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
