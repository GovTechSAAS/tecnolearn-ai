"use client";

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

function PlayForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryPin = searchParams?.get('pin') || '';

  const [pin, setPin] = useState(queryPin);
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim() || !nickname.trim()) {
      toast.error('Preencha o PIN e o seu Nickname!');
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();

      // 1. Achar o quiz pelo PIN
      const { data: qData, error: qErr } = await supabase
        .from('quizzes')
        .select('id')
        .eq('share_code', pin.trim())
        .single();

      if (qErr || !qData) {
        throw new Error('PIN inválido ou quiz não encontrado.');
      }

      // 2. Achar a sessão mais recente Waiting ou Active para este quiz
      const { data: sessData, error: sessErr } = await supabase
        .from('quiz_sessions')
        .select('id, status')
        .eq('quiz_id', qData.id)
        .in('status', ['waiting', 'active'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (sessErr || !sessData) {
        throw new Error('Nenhuma sala aberta para este jogo no momento.');
      }

      // 3. Cadastrar participante
      const { data: pData, error: pErr } = await supabase
        .from('quiz_participants')
        .insert({
          session_id: sessData.id,
          name: nickname.trim(),
          score: 0
        })
        .select()
        .single();

      if (pErr) throw pErr;

      // Salvar nome localmente (opcional para referências rápidas)
      localStorage.setItem(`quiz_nickname_${sessData.id}`, pData.name);
      localStorage.setItem(`quiz_participant_id_${sessData.id}`, pData.id);

      // 4. Redirecionar para controle
      router.push(`/play/${sessData.id}`);

    } catch (err: any) {
      toast.error(err.message);
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleJoin} className="bg-white dark:bg-zinc-900 p-8 rounded-3xl shadow-2xl w-full max-w-sm space-y-6">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-black text-[var(--primary)] tracking-tighter">TecnoPlay</h1>
        <p className="text-muted-foreground font-medium mt-2">Pronto para jogar?</p>
      </div>

      <div className="space-y-4">
        <input
          type="number"
          placeholder="PIN DO JOGO"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          className="w-full text-center text-3xl font-black tracking-widest p-4 rounded-xl border-2 border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 focus:border-[var(--primary)] outline-none transition-colors"
          required
        />

        <input
          type="text"
          placeholder="Seu Nickname"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          className="w-full text-center text-xl font-bold p-4 rounded-xl border-2 border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 focus:border-[var(--primary)] outline-none transition-colors"
          required
          maxLength={15}
        />
      </div>

      <Button
        type="submit"
        disabled={loading}
        className="w-full py-8 text-2xl font-black bg-[var(--primary)] hover:bg-[#1A5F90] text-white shadow-xl flex items-center justify-center rounded-xl"
      >
        {loading ? <Loader2 className="w-8 h-8 animate-spin" /> : <>Entrar <ArrowRight className="ml-2 w-8 h-8" /></>}
      </Button>
    </form>
  );
}

export default function PlayEntryPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[var(--primary)] to-[var(--secondary)] flex items-center justify-center p-4">
       <Suspense fallback={<div className="text-white text-2xl font-bold font-mono">Carregando...</div>}>
         <PlayForm />
       </Suspense>
    </div>
  );
}
