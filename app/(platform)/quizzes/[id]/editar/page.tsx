"use client";

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Save, Loader2, Plus, GripVertical, Trash2, CheckCircle2, Clock } from 'lucide-react';
import { toast } from 'sonner';

type Question = {
  id: string;
  title: string;
  time_limit: number;
  points: number;
  order_index: number;
};

const DEFAULT_OPTIONS = [
  { text: '', is_correct: false, color_hex: '#E21B3C', shape: 'triangle' },
  { text: '', is_correct: false, color_hex: '#1368CE', shape: 'diamond' },
  { text: '', is_correct: false, color_hex: '#D89E00', shape: 'circle' },
  { text: '', is_correct: false, color_hex: '#26890C', shape: 'square' },
];

export default function EditQuizPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const quizId = resolvedParams.id;
  const router = useRouter();

  const [quiz, setQuiz] = useState<any>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);

  // Form de nova pergunta
  const [isAdding, setIsAdding] = useState(false);
  const [savingQuestion, setSavingQuestion] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newTime, setNewTime] = useState(20);
  const [newOptions, setNewOptions] = useState(DEFAULT_OPTIONS);

  useEffect(() => {
    fetchQuiz();
  }, [quizId]);

  const fetchQuiz = async () => {
    try {
      const supabase = createClient();
      const { data: qData, error: qErr } = await supabase
        .from('quizzes')
        .select('*')
        .eq('id', quizId)
        .single();

      if (qErr) throw qErr;
      setQuiz(qData);

      const { data: qsData, error: qsErr } = await supabase
        .from('quiz_questions')
        .select('*')
        .eq('quiz_id', quizId)
        .order('order_index', { ascending: true });

      if (qsErr) throw qsErr;
      setQuestions(qsData || []);
    } catch (err: any) {
      toast.error('Erro ao buscar quiz: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const publishQuiz = async () => {
    if (questions.length === 0) {
      toast.error('Você precisa adicionar pelo menos uma pergunta para publicar.');
      return;
    }

    try {
      const supabase = createClient();
      await supabase.from('quizzes').update({ is_published: true }).eq('id', quizId);
      toast.success('Quiz Publicado com sucesso!');
      router.push('/quizzes');
    } catch (err: any) {
      toast.error('Erro ao publicar: ' + err.message);
    }
  };

  const handleOptionChange = (idx: number, field: string, value: any) => {
    const updated = [...newOptions];
    if (field === 'is_correct') {
      // Se for rádio (apenas 1 certa), desmarcamos as outras.
      // Se quiser multipla escolha, remova este bloco e deixe o toggle normal.
      updated.forEach((opt, i) => {
        opt.is_correct = (i === idx) ? value : false;
      });
    } else {
      updated[idx] = { ...updated[idx], [field]: value };
    }
    setNewOptions(updated);
  };

  const saveQuestion = async () => {
    if (!newTitle.trim()) return toast.error('Digite o título da pergunta.');
    if (newOptions.some(opt => !opt.text.trim())) return toast.error('Preencha as quatro alternativas.');
    if (!newOptions.some(opt => opt.is_correct)) return toast.error('Marque pelo menos uma alternativa como correta.');

    setSavingQuestion(true);
    try {
      const supabase = createClient();

      // 1. Inserir a pergunta
      const order_index = questions.length + 1; // Simplificado
      const { data: qData, error: qErr } = await supabase
        .from('quiz_questions')
        .insert({
          quiz_id: quizId,
          title: newTitle,
          time_limit: newTime,
          points: 1000,
          order_index
        })
        .select()
        .single();

      if (qErr) throw qErr;

      // 2. Inserir as opções vinculadas a pergunta
      const optionsToInsert = newOptions.map(opt => ({
        question_id: qData.id,
        text: opt.text,
        is_correct: opt.is_correct,
        color_hex: opt.color_hex,
        shape: opt.shape
      }));

      const { error: oErr } = await supabase.from('quiz_options').insert(optionsToInsert);
      if (oErr) throw oErr;

      toast.success('Pergunta adicionada!');

      // Reset State
      setQuestions([...questions, qData]);
      setIsAdding(false);
      setNewTitle('');
      setNewTime(20);
      setNewOptions(DEFAULT_OPTIONS);

    } catch (err: any) {
      toast.error('Erro ao salvar pergunta: ' + err.message);
    } finally {
      setSavingQuestion(false);
    }
  };

  const deleteQuestion = async (id: string) => {
    if (!confirm('Deseja excluir esta pergunta?')) return;
    try {
      const supabase = createClient();
      const { error } = await supabase.from('quiz_questions').delete().eq('id', id);
      if (error) throw error;

      toast.success('Pergunta excluída.');
      setQuestions(questions.filter(q => q.id !== id));
    } catch (err: any) {
      toast.error('Erro ao excluir: ' + err.message);
    }
  }

  return (
    <div className="max-w-5xl mx-auto py-8">
      <button
        onClick={() => router.back()}
        className="flex items-center text-sm font-medium text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        Voltar
      </button>

      {loading ? (
        <Loader2 className="animate-spin w-8 h-8 text-[var(--primary)] mx-auto" />
      ) : (
        <div className="space-y-6">
          {/* Header do Quiz */}
          <div className="flex justify-between items-start bg-white dark:bg-zinc-950 p-6 rounded-xl border border-border">
            <div>
              <h1 className="text-2xl font-bold">{quiz?.title}</h1>
              <p className="text-muted-foreground">PIN: {quiz?.share_code} • {questions.length} perguntas cadastradas</p>
            </div>

            <div className="flex gap-2">
              {!quiz.is_published && (
                <Button onClick={publishQuiz} className="bg-green-500 hover:bg-green-600 text-white font-bold shadow">
                  Publicar Jogo
                </Button>
              )}
            </div>
          </div>

          {/* Form Create Question */}
          {isAdding ? (
            <div className="bg-white dark:bg-zinc-950 p-6 rounded-xl border border-[var(--primary)] shadow-lg animate-in fade-in slide-in-from-top-4">
              <h2 className="text-xl font-bold mb-6 text-foreground">Nova Pergunta</h2>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="text-sm font-semibold mb-1 block">Título da Pergunta *</label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Ex: Qual o ano de descobrimento do Brasil?"
                    className="w-full text-lg font-bold p-4 text-center rounded-xl border-2 border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 focus:border-[var(--primary)] outline-none"
                    required
                  />
                </div>

                <div className="w-1/3">
                  <label className="text-sm font-semibold mb-1 block">Tempo Limite (segundos)</label>
                  <select
                    value={newTime}
                    onChange={(e) => setNewTime(Number(e.target.value))}
                    className="w-full p-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                  >
                    <option value={10}>10 Segundos</option>
                    <option value={20}>20 Segundos</option>
                    <option value={30}>30 Segundos</option>
                    <option value={60}>1 Minuto</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {newOptions.map((opt, idx) => (
                  <div key={idx} className="relative group">
                    <div
                      className={`flex items-center gap-3 p-2 rounded-xl border-2 transition-all ${opt.is_correct ? 'border-green-500 bg-green-50/50 dark:bg-green-900/10' : 'border-border bg-white dark:bg-zinc-950 hover:bg-zinc-50 dark:hover:bg-zinc-900'
                        }`}
                    >
                      <div className="w-12 h-12 flex-shrink-0 flex items-center justify-center rounded-lg text-white font-black text-xl shadow-inner" style={{ backgroundColor: opt.color_hex }}>
                        {/* Ícone mock da forma geométrica */}
                        <span className="opacity-80 mix-blend-overlay">O</span>
                      </div>

                      <input
                        type="text"
                        value={opt.text}
                        onChange={(e) => handleOptionChange(idx, 'text', e.target.value)}
                        placeholder={`Alternativa ${idx + 1}`}
                        className="flex-1 bg-transparent border-none text-base font-semibold focus:ring-0 outline-none placeholder:font-normal"
                      />

                      <button
                        type="button"
                        onClick={() => handleOptionChange(idx, 'is_correct', !opt.is_correct)}
                        className={`w-10 h-10 flex-shrink-0 rounded-full border-2 flex items-center justify-center transition-colors ${opt.is_correct
                            ? 'bg-green-500 border-green-500 text-white'
                            : 'border-zinc-300 dark:border-zinc-700 text-transparent hover:border-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 hover:text-green-400'
                          }`}
                        title="Marcar como Resposta Correta"
                      >
                        <CheckCircle2 className="w-6 h-6" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-border">
                <Button variant="ghost" onClick={() => setIsAdding(false)} disabled={savingQuestion}>
                  Cancelar
                </Button>
                <Button onClick={saveQuestion} disabled={savingQuestion} className="bg-[var(--accent)] text-white hover:bg-[#D35400]">
                  {savingQuestion ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                  Salvar Pergunta
                </Button>
              </div>
            </div>
          ) : (
            <Button
              onClick={() => setIsAdding(true)}
              className="w-full py-8 border-2 border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 hover:bg-zinc-100 dark:hover:bg-zinc-900 text-muted-foreground hover:text-foreground text-lg"
            >
              <Plus className="w-6 h-6 mr-2" /> Adicionar Pergunta
            </Button>
          )}

          {/* List existing questions */}
          <div className="space-y-4">
            {questions.map((q, idx) => (
              <div key={q.id} className="bg-white dark:bg-zinc-950 p-4 border border-border rounded-xl flex items-center gap-4 justify-between hover:border-[var(--primary)] transition-colors group">
                <div className="flex items-center gap-4 flex-1">
                  <div className="cursor-grab p-1 text-muted-foreground opacity-50 hover:opacity-100">
                    <GripVertical className="w-5 h-5" />
                  </div>
                  <div className="bg-zinc-100 dark:bg-zinc-800 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm">
                    {idx + 1}
                  </div>
                  <div className="font-semibold text-lg">{q.title}</div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex items-center text-muted-foreground text-sm font-medium bg-zinc-100 dark:bg-zinc-900 px-3 py-1 rounded-md">
                    <Clock className="w-4 h-4 mr-1.5" /> {q.time_limit}s
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => deleteQuestion(q.id)} className="text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

        </div>
      )}
    </div>
  );
}
