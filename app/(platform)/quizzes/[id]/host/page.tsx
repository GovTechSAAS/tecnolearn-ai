"use client";

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Users, Play, Loader2, Trophy, ArrowRight, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

type Participant = {
  id: string;
  name: string;
  score: number;
};

type Question = {
  id: string;
  title: string;
  time_limit: number;
  points: number;
};

type QuizSession = {
  id: string;
  quiz_id: string;
  host_id: string;
  status: 'waiting' | 'active' | 'finished';
  current_question_id: string | null;
};

export default function HostQuizPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const quizId = resolvedParams.id;
  const router = useRouter();
  const { profile } = useAuth();
  
  const [quiz, setQuiz] = useState<any>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [session, setSession] = useState<QuizSession | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);

  // Status de jogo ativo
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(-1);
  const [timeLeft, setTimeLeft] = useState(0);
  const [answersCount, setAnswersCount] = useState(0);

  useEffect(() => {
    if (!profile?.id) return;
    initHostSession();

    // Cleanup
    return () => {
      // Idealmente, encerrar sessão se sair prematuramente, ou apenas deixar orfã
    };
  }, [profile?.id]); // eslint-disable-line

  const initHostSession = async () => {
    try {
      const supabase = createClient();
      
      // 1. Fetch Quiz and Questions
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

      if (!qsData || qsData.length === 0) {
        toast.error('Este quiz não tem perguntas! Adicione-as primeiro.');
        router.push(`/quizzes/${quizId}/editar`);
        return;
      }

      // 2. Check for existing waiting session or Create a new one
      let sessData;
      const { data: existingSess } = await supabase
        .from('quiz_sessions')
        .select('*')
        .eq('quiz_id', quizId)
        .eq('host_id', profile!.id)
        .eq('status', 'waiting')
        .single();
        
      if (existingSess) {
        sessData = existingSess;
        // Fetch existing participants if any
        const { data: existingParts } = await supabase
          .from('quiz_participants')
          .select('*')
          .eq('session_id', sessData.id);
        if (existingParts) {
          setParticipants(existingParts);
        }
      } else {
        const { data: newSess, error: sessErr } = await supabase
          .from('quiz_sessions')
          .insert({
            quiz_id: quizId,
            host_id: profile!.id,
            status: 'waiting'
          })
          .select()
          .single();

        if (sessErr) throw sessErr;
        sessData = newSess;
      }

      setSession(sessData);

      // 3. Subscribe to Participants
      const channel = supabase.channel(`session_${sessData.id}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'quiz_participants', filter: `session_id=eq.${sessData.id}` },
          (payload) => {
            setParticipants((prev) => [...prev, payload.new as Participant]);
          }
        )
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'quiz_answers', filter: `session_id=eq.${sessData.id}` },
          (payload) => {
            setAnswersCount((prev) => prev + 1);
          }
        )
        .subscribe();

      setLoading(false);
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao iniciar sessão: ' + err.message);
      router.push('/quizzes');
    }
  };

  const startGame = async () => {
    if (!session) return;
    if (participants.length === 0) {
      if (!confirm('Nenhum aluno entrou ainda. Tem certeza que deseja iniciar?')) return;
    }

    try {
      const firstQ = questions[0];
      const supabase = createClient();
      await supabase
        .from('quiz_sessions')
        .update({ 
          status: 'active',
          current_question_id: firstQ.id,
          started_at: new Date().toISOString()
        })
        .eq('id', session.id);

      setSession({ ...session, status: 'active', current_question_id: firstQ.id });
      setCurrentQuestionIndex(0);
      setTimeLeft(firstQ.time_limit);
      setAnswersCount(0);
      startTimer(firstQ.time_limit);
    } catch (err: any) {
      toast.error('Erro ao iniciar jogo: ' + err.message);
    }
  };

  const nextQuestion = async () => {
    if (!session) return;
    const nextIdx = currentQuestionIndex + 1;
    
    if (nextIdx >= questions.length) {
      endGame();
      return;
    }

    try {
      const nextQ = questions[nextIdx];
      const supabase = createClient();
      await supabase
        .from('quiz_sessions')
        .update({ current_question_id: nextQ.id })
        .eq('id', session.id);

      setSession({ ...session, current_question_id: nextQ.id });
      setCurrentQuestionIndex(nextIdx);
      setTimeLeft(nextQ.time_limit);
      setAnswersCount(0);
      startTimer(nextQ.time_limit);
    } catch (err: any) {
      toast.error('Erro ao avançar pergunta: ' + err.message);
    }
  };

  const endGame = async () => {
    if (!session) return;
    try {
      const supabase = createClient();
      await supabase
        .from('quiz_sessions')
        .update({ 
          status: 'finished',
          finished_at: new Date().toISOString()
        })
        .eq('id', session.id);

      setSession({ ...session, status: 'finished' });
      
      // Buscar placar final
      const { data } = await supabase
        .from('quiz_participants')
        .select('*')
        .eq('session_id', session.id)
        .order('score', { ascending: false });
        
      if (data) setParticipants(data);
    } catch (err: any) {
      toast.error('Erro ao finalizar jogo: ' + err.message);
    }
  };

  const startTimer = (duration: number) => {
    // Implementação básica (poderia usar REF ou um worker para ser mais preciso)
    let left = duration;
    const interval = setInterval(() => {
      left -= 1;
      setTimeLeft(left);
      if (left <= 0) {
        clearInterval(interval);
      }
    }, 1000);
  };

  if (loading || !quiz || !session) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950 text-white">
        <Loader2 className="w-12 h-12 animate-spin text-[var(--accent)]" />
        <span className="ml-4 font-bold text-xl">Preparando Sala...</span>
      </div>
    );
  }

  // Obter URL base
  const playUrl = `${window.location.origin}/play?pin=${quiz.share_code}`;

  if (session.status === 'waiting') {
    return (
      <div className="flex flex-col h-screen bg-[#F4F4F4] dark:bg-zinc-950 overflow-hidden relative">
        <div className="absolute top-4 left-4 z-10">
          <Button variant="outline" className="bg-white/10 text-foreground border-white/20" onClick={() => router.push('/quizzes')}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Sair
          </Button>
        </div>

        <div className="flex-1 flex flex-col md:flex-row p-8 gap-8 items-center justify-center max-w-7xl mx-auto w-full">
          
          {/* Lado Esquerdo: Info e PIN */}
          <div className="flex-1 space-y-8 text-center md:text-left bg-white dark:bg-zinc-900 p-10 rounded-3xl shadow-2xl border border-border">
            <h1 className="text-4xl md:text-5xl font-black text-foreground mb-4">{quiz.title}</h1>
            <p className="text-xl text-muted-foreground">Acesse <strong>{window.location.origin}/play</strong> e digite o PIN:</p>
            
            <div className="bg-zinc-100 dark:bg-zinc-950 p-6 rounded-2xl border-4 border-[var(--primary)] border-dashed inline-block">
              <span className="text-6xl md:text-8xl font-black font-mono tracking-widest text-[var(--primary)]">
                {quiz.share_code}
              </span>
            </div>
            
            <div className="pt-8">
              <Button onClick={startGame} size="lg" className="w-full md:w-auto text-xl py-8 px-12 bg-green-500 hover:bg-green-600 font-bold shadow-xl animate-pulse">
                <Play className="w-8 h-8 mr-2 fill-current" /> Começar Jogo!
              </Button>
            </div>
          </div>

          {/* Lado Direito: QR Code e Lista de Alunos */}
          <div className="w-full md:w-1/3 flex flex-col items-center space-y-6">
            <div className="bg-white p-6 rounded-3xl shadow-xl w-full max-w-sm aspect-square flex flex-col items-center justify-center">
              <QRCodeSVG value={playUrl} size={250} level="H" includeMargin={false} />
              <p className="mt-4 text-sm font-bold text-zinc-500 text-center uppercase tracking-wider">Escaneie para jogar</p>
            </div>

            <div className="w-full bg-white dark:bg-zinc-900 rounded-3xl shadow-xl p-6 border border-border max-h-64 overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg flex items-center">
                  <Users className="w-5 h-5 mr-2 text-[var(--accent)]" /> 
                  Na Sala
                </h3>
                <span className="bg-zinc-100 dark:bg-zinc-800 text-foreground font-bold px-3 py-1 rounded-full">
                  {participants.length}
                </span>
              </div>
              
              <div className="flex flex-wrap gap-2">
                {participants.length === 0 ? (
                  <p className="text-muted-foreground text-sm py-4 w-full text-center">Aguardando jogadores...</p>
                ) : (
                  participants.map(p => (
                    <span key={p.id} className="bg-[var(--primary)]/10 text-[var(--primary)] font-bold px-4 py-2 rounded-xl text-lg animate-in zoom-in duration-300">
                      {p.name}
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    );
  }

  if (session.status === 'active') {
    const currentQ = questions[currentQuestionIndex];
    
    return (
      <div className="flex flex-col h-screen bg-zinc-50 dark:bg-zinc-950">
         <div className="flex justify-between items-center p-6 bg-white dark:bg-zinc-900 border-b border-border shadow-sm">
            <div className="font-bold text-xl text-[var(--primary)]">
              Pergunta {currentQuestionIndex + 1} de {questions.length}
            </div>
            <div className="text-3xl font-black tabular-nums">
              {timeLeft > 0 ? (
                <span className={timeLeft <= 5 ? "text-red-500 animate-pulse" : "text-foreground"}>{timeLeft}</span>
              ) : (
                <span className="text-red-500">Tempo Esgotado!</span>
              )}
            </div>
            <div>
               <Button onClick={nextQuestion} variant={timeLeft > 0 ? "outline" : "default"} className={timeLeft > 0 ? "" : "bg-[var(--accent)] hover:bg-[#D35400]"}>
                  Próxima <ArrowRight className="w-4 h-4 ml-2" />
               </Button>
            </div>
         </div>

         <div className="flex-1 flex flex-col items-center justify-center p-8 max-w-5xl mx-auto w-full text-center">
            <h2 className="text-4xl md:text-6xl font-black mb-12">{currentQ?.title}</h2>
            
            <div className="text-2xl font-medium text-muted-foreground bg-white dark:bg-zinc-900 p-8 rounded-3xl shadow-lg border border-border mt-8">
              Respostas Recebidas: <strong className="text-[var(--accent)] text-4xl ml-4">{answersCount}</strong> / {participants.length}
            </div>
         </div>
      </div>
    );
  }

  // Finished status
  return (
    <div className="flex flex-col h-screen bg-[#F4F4F4] dark:bg-zinc-950 items-center justify-center p-8">
      <Trophy className="w-32 h-32 text-yellow-500 mb-8 animate-bounce" />
      <h1 className="text-5xl font-black mb-8">Pódio Final</h1>
      
      <div className="bg-white dark:bg-zinc-900 p-8 rounded-3xl shadow-2xl border border-border w-full max-w-2xl">
        {participants.slice(0, 5).map((p, idx) => (
          <div key={p.id} className="flex justify-between items-center p-4 border-b border-border/50 last:border-0 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 rounded-xl transition-colors">
            <div className="flex items-center gap-4">
              <span className={`font-black text-2xl w-8 text-center ${idx === 0 ? 'text-yellow-500' : idx === 1 ? 'text-zinc-400' : idx === 2 ? 'text-amber-700' : 'text-zinc-600'}`}>{idx + 1}</span>
              <span className="text-2xl font-bold">{p.name}</span>
            </div>
            <span className="text-xl font-black text-[var(--primary)]">{p.score} pts</span>
          </div>
        ))}

        <div className="mt-8 text-center">
          <Button size="lg" onClick={() => router.push('/quizzes')} className="bg-[var(--primary)]">
            Voltar aos Meus Quizzes
          </Button>
        </div>
      </div>
    </div>
  );
}
