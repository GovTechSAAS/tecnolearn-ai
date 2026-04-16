"use client";

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { Loader2, HelpCircle, Trophy } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

type QuizSession = {
  id: string;
  status: 'waiting' | 'active' | 'finished';
  current_question_id: string | null;
};

// Cores e Icones baseados no Kahoot (Vermelho: Triângulo, Azul: Losango, Amarelo: Círculo, Verde: Quadrado)
const SHAPES = [
  { color: 'bg-[#E21B3C]', shape: 'clip-path-triangle' },
  { color: 'bg-[#1368CE]', shape: 'clip-path-diamond' },
  { color: 'bg-[#D89E00]', shape: 'clip-path-circle' },
  { color: 'bg-[#26890C]', shape: 'clip-path-square' }
];

export default function PlayerControllerPage({ params }: { params: Promise<{ session_id: string }> }) {
  const resolvedParams = use(params);
  const sessionId = resolvedParams.session_id;
  const router = useRouter();

  const [session, setSession] = useState<QuizSession | null>(null);
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [questionTitle, setQuestionTitle] = useState<string>('');
  const [options, setOptions] = useState<any[]>([]);
  const [answered, setAnswered] = useState(false);
  const [isCorrectResult, setIsCorrectResult] = useState<boolean | null>(null);

  useEffect(() => {
    // Pegar pId do localStorage
    const pId = localStorage.getItem(`quiz_participant_id_${sessionId}`);
    if (!pId) {
      toast.error('Você precisa se registrar com um nickname primeiro.');
      router.push('/play');
      return;
    }
    setParticipantId(pId);
    subscribeToSession();
  }, [sessionId]); // eslint-disable-line

  // Sincronização robusta (Fallback para o Realtime) para avançar a tela se perder o evento
  useEffect(() => {
    if (!sessionId) return;
    const fetchSession = async () => {
      const supabase = createClient();
      const { data: sessData } = await supabase
        .from('quiz_sessions')
        .select('id, status, current_question_id')
        .eq('id', sessionId)
        .single();

      if (sessData) {
        setSession((prevSess) => {
          if (prevSess?.current_question_id !== sessData.current_question_id) {
            setAnswered(false);
            setIsCorrectResult(null);
            if (sessData.current_question_id) fetchOptions(sessData.current_question_id);
          } else if (prevSess?.status !== sessData.status) {
            // Em caso de finalização da partida, por exemplo
          }
          return sessData;
        });
      }
    };
    
    // Roda o fallback a cada 1,5 segundos (Garante a troca rápida se Realtime falhar)
    const interval = setInterval(fetchSession, 1500);
    return () => clearInterval(interval);
  }, [sessionId]);

  const subscribeToSession = async () => {
    const supabase = createClient();

    // Busca estado inicial
    const { data: sessData } = await supabase
      .from('quiz_sessions')
      .select('id, status, current_question_id')
      .eq('id', sessionId)
      .single();

    if (sessData) {
      setSession(sessData);
      if (sessData.status === 'active' && sessData.current_question_id) {
        fetchOptions(sessData.current_question_id);
      }
    }

    // Assina mudanças
    supabase.channel(`game_${sessionId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'quiz_sessions', filter: `id=eq.${sessionId}` },
        (payload) => {
          const updatedSess = payload.new as QuizSession;

          setSession((prevSess) => {
             // Se a pergunta mudou, reseta o controlle
             if (prevSess?.current_question_id !== updatedSess.current_question_id) {
               setAnswered(false);
               setIsCorrectResult(null);
               if (updatedSess.current_question_id) {
                 fetchOptions(updatedSess.current_question_id);
               }
             }
             return updatedSess;
          });
        }
      )
      .subscribe();
  };

  const fetchOptions = async (questionId: string) => {
    const supabase = createClient();

    const { data: qData } = await supabase
      .from('quiz_questions')
      .select('title')
      .eq('id', questionId)
      .single();
    if (qData) setQuestionTitle(qData.title);

    const { data } = await supabase
      .from('quiz_options')
      .select('id, text, is_correct')
      .eq('question_id', questionId)
      .order('created_at', { ascending: true }); // idealmente uma ordem fixa se quisermos manter a cor

    if (data) setOptions(data);
  };

  const submitAnswer = async (optionId: string, isCorrect: boolean) => {
    if (answered || !participantId || !session?.current_question_id) return;

    setAnswered(true);
    setIsCorrectResult(isCorrect); // Pra dar um feedback imediato

    try {
      const supabase = createClient();
      await supabase
        .from('quiz_answers')
        .insert({
          session_id: sessionId,
          participant_id: participantId,
          question_id: session.current_question_id,
          option_id: optionId,
          is_correct: isCorrect,
          points_earned: isCorrect ? 1000 : 0 // TODO: Tempo baseado
        });
    } catch (err: any) {
      console.error(err);
      toast.error('Falha ao registrar resposta!');
      setAnswered(false);
    }
  };


  if (!session) {
    return (
      <div className="min-h-screen bg-zinc-900 flex items-center justify-center text-white">
        <Loader2 className="w-12 h-12 animate-spin" />
      </div>
    );
  }

  if (session.status === 'waiting') {
    return (
      <div className="min-h-screen bg-gradient-to-tr from-[var(--primary)] to-purple-800 flex flex-col items-center justify-center text-white p-6 text-center">
        <h1 className="text-4xl md:text-6xl font-black tracking-tighter mb-4 animate-bounce">Você está no Jogo!</h1>
        <p className="text-xl md:text-2xl font-bold opacity-80">Olhe para a tela principal.</p>
        <p className="mt-8 opacity-50 text-sm font-mono">Aguardando professor iniciar...</p>
      </div>
    );
  }

  if (session.status === 'finished') {
    return (
      <div className="min-h-screen bg-zinc-900 flex flex-col items-center justify-center text-white p-6 text-center">
        <Trophy className="w-32 h-32 text-yellow-500 mb-8" />
        <h1 className="text-4xl md:text-6xl font-black mb-4">Fim de Jogo!</h1>
        <p className="text-xl font-bold opacity-80">Olhe a lousa para ver o pódio.</p>
        <Button onClick={() => router.push('/play')} className="mt-12 bg-white text-zinc-900 hover:bg-zinc-200">
          Jogar Outro
        </Button>
      </div>
    );
  }

  if (session.status === 'active') {
    if (answered) {
      return (
        <div className={`min-h-screen flex flex-col items-center justify-center text-white p-6 text-center transition-colors duration-500 ${isCorrectResult ? 'bg-green-500' : 'bg-red-500'}`}>
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter mb-4 animate-in zoom-in">
            {isCorrectResult ? 'Correto!' : 'Incorreto'}
          </h1>
          <p className="text-xl font-bold opacity-80">Aguarde a próxima pergunta...</p>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-[#F4F4F4] flex flex-col p-4">
        {/* Título da Pergunta exibido para o aluno */}
        <div className="w-full bg-white dark:bg-zinc-900 rounded-3xl shadow-sm border border-border p-6 mb-4 flex items-center justify-center min-h-[120px]">
           <h2 className="text-xl md:text-3xl font-black text-foreground text-center break-words">{questionTitle}</h2>
        </div>

        <div className="flex-1 grid grid-cols-2 grid-rows-2 gap-2">
          {/* Tailwind clip-path util classes não nativas precisam de polyfill, então usaremos icones ou divis de forma */}
          <style dangerouslySetInnerHTML={{
            __html: `
              .clip-path-triangle { clip-path: polygon(50% 0%, 0% 100%, 100% 100%); }
              .clip-path-diamond { clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%); }
              .clip-path-circle { border-radius: 50%; }
              .clip-path-square { border-radius: 12px; }
            `}} />

          {options.map((opt, idx) => {
            const style = SHAPES[idx % 4];
            return (
              <button
                key={opt.id}
                onClick={() => submitAnswer(opt.id, opt.is_correct)}
                className={`${style.color} w-full h-full flex flex-col items-center justify-center shadow-[inset_0_-8px_0_rgba(0,0,0,0.2)] hover:brightness-110 active:translate-y-2 active:shadow-[inset_0_-0px_0_rgba(0,0,0,0.2)] transition-all rounded-xl p-4 text-white overflow-hidden`}
              >
                <div className={`w-8 h-8 md:w-16 md:h-16 bg-white/30 ${style.shape} mb-3 flex-shrink-0`} />
                <span className="text-lg md:text-2xl font-bold text-center break-words max-w-full drop-shadow-md line-clamp-3">
                  {opt.text}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return null;
}
