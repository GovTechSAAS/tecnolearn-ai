"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { BrainCircuit, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
    } else {
      router.push('/dashboard');
      router.refresh(); // resync server memory
    }
    setLoading(false);
  };

  return (
    <Card className="border-0 shadow-2xl bg-white/80 backdrop-blur-xl dark:bg-zinc-950/80">
      <CardHeader className="space-y-3 pb-6 text-center">
        <div className="flex justify-center mb-2">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#C0392B] to-[#6C3483] flex items-center justify-center shadow-lg">
            <BrainCircuit className="text-white" size={32} />
          </div>
        </div>
        <CardTitle className="text-3xl font-bold tracking-tight">Bem-vindo(a) de volta</CardTitle>
        <CardDescription className="text-base">
          Acesse a plataforma Tecnolearn
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              placeholder="seu@email.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Senha</Label>
              <Link href="/forgot-password" className="text-sm font-medium text-[var(--accent)] hover:underline">
                Esqueceu a senha?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11"
            />
          </div>

          {error && (
            <div className="p-3 text-sm text-red-500 bg-red-100 rounded-md dark:bg-red-900/30">
              Chave de acesso inválida ou usuário não encontrado.
            </div>
          )}

          <Button
            type="submit"
            className="w-full h-11 text-base font-medium shadow-md transition-transform hover:scale-[1.02] bg-[var(--primary)] text-white hover:bg-[#A93226]"
            disabled={loading}
          >
            {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : 'Entrar na Plataforma'}
          </Button>
        </form>
      </CardContent>

      <CardFooter className="flex flex-col space-y-4 pt-4 border-t border-border/40">
        <div className="text-sm text-center text-muted-foreground">
          Ainda não tem uma conta?{' '}
          <Link href="/register" className="font-semibold text-foreground hover:underline">
            Cadastre-se agora
          </Link>
        </div>
      </CardFooter>
    </Card>
  );
}
